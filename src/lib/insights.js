// Pure computation for Phase 6 (build-plan §7) — kept separate from
// InsightsScreen so the logic is readable/testable without a component
// tree around it. Every function takes plain arrays already pulled from
// Dexie; nothing here touches the database.
import { e1rm, slope, setContribution } from './calc'
import { MIN_SESSIONS_FOR_CORRELATION } from './constants'

// Weekly sets per muscle vs. the 10–20/week band, from sets in the last 7 days.
export function weeklySetsPerMuscle(sets, exerciseById) {
  const since = Date.now() - 7 * 86_400_000
  const totals = {}
  for (const s of sets) {
    if (s.is_warmup || new Date(s.completed_at).getTime() < since) continue
    const ex = exerciseById[s.exercise_id]
    if (!ex) continue
    for (const [muscle, weight] of setContribution(ex)) {
      totals[muscle] = (totals[muscle] ?? 0) + weight
    }
  }
  return totals
}

// One best-set-e1RM point per session, per exercise — the same "top set
// wins" rule ExerciseHistory uses, just computed for every exercise at once.
// An exercise's trend can only be drawn across sets that measure the same
// thing. Dips logged on the machine (95 kg) and on the bars (bodyweight, so
// e1RM 0) are two different exercises sharing a name, and a line through
// both is a cliff that means nothing. Sets outside the mode you mostly use
// are left out of the trend rather than allowed to distort it.
export function dominantModeByExercise(sets) {
  const tally = {}
  for (const s of sets) {
    if (s.is_warmup) continue
    ;(tally[s.exercise_id] ??= {})[s.load_mode ?? 'added'] =
      ((tally[s.exercise_id]?.[s.load_mode ?? 'added']) ?? 0) + 1
  }
  return Object.fromEntries(
    Object.entries(tally).map(([id, modes]) =>
      [id, Object.entries(modes).sort((a, b) => b[1] - a[1])[0][0]]),
  )
}

export function sessionPointsByExercise(sets, workouts) {
  const workoutById = Object.fromEntries(workouts.map((w) => [w.id, w]))
  const dominant = dominantModeByExercise(sets)
  const bestByExerciseSession = {} // `${exerciseId}::${workoutId}` -> best set

  for (const s of sets) {
    if (s.is_warmup) continue
    if ((s.load_mode ?? 'added') !== dominant[s.exercise_id]) continue
    const workout = workoutById[s.workout_id]
    if (!workout?.date) continue
    const key = `${s.exercise_id}::${s.workout_id}`
    // Nothing is loaded, so there is no estimated 1RM to speak of — reps
    // ARE the progress. Without this every bodyweight exercise scores 0
    // forever and gets reported as permanently stalling.
    const bw = (s.load_mode ?? 'added') === 'bodyweight'
    const value = bw ? (s.reps ?? 0) : e1rm(s)
    const current = bestByExerciseSession[key]
    if (!current || value > current.e1rm) {
      bestByExerciseSession[key] = { exerciseId: s.exercise_id, date: workout.date, e1rm: value, metric: bw ? 'reps' : 'e1rm' }
    }
  }

  const byExercise = {}
  for (const point of Object.values(bestByExerciseSession)) {
    (byExercise[point.exerciseId] ??= []).push(point)
  }
  for (const points of Object.values(byExercise)) points.sort((a, b) => new Date(a.date) - new Date(b.date))
  return byExercise
}

// Flags lifts whose e1RM slope over their last 4 sessions is <= 0.
// Needs at least 4 sessions logged for that lift before it can say anything.
export function detectStalls(pointsByExercise, exerciseById) {
  const stalls = []
  for (const [exerciseId, points] of Object.entries(pointsByExercise)) {
    if (points.length < 4) continue
    const last4 = points.slice(-4)
    const t0 = new Date(last4[0].date).getTime()
    const xy = last4.map((p) => ({ x: (new Date(p.date).getTime() - t0) / 86_400_000, y: p.e1rm }))
    const m = slope(xy)
    if (m <= 0) stalls.push({ exerciseId, name: exerciseById[exerciseId]?.name ?? 'Exercise', slope: m })
  }
  return stalls
}

// (Week/deload maths moved to lib/phase.js — it drives the logging screen's
// load and set adjustments too, not just this readout, and having two
// implementations of "what week is it" was asking for them to disagree.)

// build-plan §7 Phase 6 item 4, exact thresholds from the spec.
export function calorieAdjustSuggestion({ weightTrendKgPerWeek, stalledLiftCount, avgEnergy }) {
  if (weightTrendKgPerWeek != null && Math.abs(weightTrendKgPerWeek) < 0.05) {
    return { delta: -175, reason: 'Bodyweight trend has been flat for 21 days.' }
  }
  if (stalledLiftCount >= 2 && avgEnergy != null && avgEnergy < 2.5) {
    return { delta: 175, reason: 'e1RM is falling on multiple lifts and energy scores are low.' }
  }
  return null
}

// Mean SI pain of sessions containing an exercise vs. sessions without it.
// Gated behind MIN_SESSIONS_FOR_CORRELATION — "a signal to investigate,
// never a verdict" (§7 Phase 6 item 5), so it stays silent below that.
export function siCorrelation(workouts, sets, exerciseById) {
  const setsByWorkout = {}
  for (const s of sets) {
    if (s.is_warmup) continue
    (setsByWorkout[s.workout_id] ??= new Set()).add(s.exercise_id)
  }

  const scored = workouts.filter((w) => w.si_pain_score != null)
  const exerciseIds = new Set(sets.map((s) => s.exercise_id))
  const avg = (arr) => arr.reduce((s, v) => s + v, 0) / arr.length

  const results = []
  for (const exerciseId of exerciseIds) {
    const withEx = []
    const withoutEx = []
    for (const w of scored) {
      const has = setsByWorkout[w.id]?.has(exerciseId)
      ;(has ? withEx : withoutEx).push(w.si_pain_score)
    }
    if (withEx.length < MIN_SESSIONS_FOR_CORRELATION || withoutEx.length === 0) continue
    results.push({
      exerciseId,
      name: exerciseById[exerciseId]?.name ?? 'Exercise',
      diff: avg(withEx) - avg(withoutEx),
      sessionsWith: withEx.length,
    })
  }
  return results.sort((a, b) => b.diff - a.diff)
}
