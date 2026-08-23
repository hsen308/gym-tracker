// Double progression — the program's central rule, and the thing the app
// exists to stop you doing in your head mid-set:
//
//   1. Hit the top of the rep range on all sets.
//   2. Next session, add weight and drop to the bottom of the range.
//   3. Work back up over the following weeks. Repeat forever.
//
// Jumps: +2.5 kg upper body, +5 kg lower body. On isolation work the program
// says use the smallest plate available or add reps instead.
import { WEIGHT_STEP_KG, WEIGHT_STEP_KG_LONG_PRESS } from './constants'
import { modeOf } from './loadMode'

const LOWER_BODY = new Set(['quads', 'hamstrings', 'glutes', 'calves'])

export const jumpFor = (exercise) =>
  LOWER_BODY.has(exercise?.primary_muscle) ? WEIGHT_STEP_KG_LONG_PRESS : WEIGHT_STEP_KG

// `lastSets` = the working sets from the most recent session that contained
// this exercise, already filtered to non-warmup and non-deleted.
// Returns null when there's nothing useful to say — the UI shows nothing
// rather than inventing advice from one data point.
export function progressionAdvice({ lastSets, programExercise, exercise }) {
  if (!programExercise || !lastSets?.length) return null
  const { rep_min, rep_max, target_sets } = programExercise

  // Duration-tracked holds (planks, farmer's) progress by time, not load.
  if (exercise?.tracks === 'duration') {
    const allAtTop = lastSets.every((s) => (s.duration_seconds ?? 0) >= rep_max)
    return allAtTop
      ? { action: 'add_time', message: `Held ${rep_max}s on every set. Add load or push past ${rep_max}s.` }
      : null
  }

  // Only sets sharing a load mode belong on one curve. A 120 kg machine dip
  // and a bodyweight dip are different exercises, and mixing them produced
  // advice drawn from a curve that read 120, 105, 95, 0, 80.
  const dominantMode = modeOf(lastSets[lastSets.length - 1])
  const sameCurve = lastSets.filter((s) => modeOf(s) === dominantMode)

  const withReps = sameCurve.filter((s) => s.reps != null && s.weight_kg != null)
  if (!withReps.length) return null

  // Bodyweight sets have no load to add, so progression is reps, not kilos.
  if (dominantMode === 'bodyweight') {
    const allAtTop = withReps.every((s) => s.reps >= rep_max)
    return allAtTop
      ? { action: 'add_reps', message: `${withReps.map((s) => s.reps).join(', ')} reps at bodyweight last time.`, detail: `Past ${rep_max} clean reps — add a belt and start the range again.` }
      : { action: 'add_reps', message: `Bodyweight × ${withReps.map((s) => s.reps).join(', ')} last time.`, detail: `Work toward ${target_sets}×${rep_max}.` }
  }

  // Compare within the heaviest load used last time. Mixing loads (e.g. a
  // drop set, or a swap mid-session) would otherwise make "all sets at the
  // top of the range" mean nothing.
  const topWeight = Math.max(...withReps.map((s) => s.weight_kg))
  const atTopWeight = withReps.filter((s) => s.weight_kg === topWeight)

  const completedAllSets = atTopWeight.length >= target_sets
  const allAtTop = atTopWeight.every((s) => s.reps >= rep_max)
  const anyBelowMin = atTopWeight.some((s) => s.reps < rep_min)

  if (allAtTop && completedAllSets) {
    const jump = jumpFor(exercise)
    return {
      action: 'add_weight',
      nextWeight: topWeight + jump,
      message: `${target_sets}×${rep_max} at ${fmt(topWeight)}kg last time — top of the range.`,
      detail: `Add ${jump}kg → ${fmt(topWeight + jump)}kg for ${rep_min}–${rep_max}.`,
    }
  }

  if (anyBelowMin) {
    return {
      action: 'hold',
      nextWeight: topWeight,
      message: `Dropped below ${rep_min} reps at ${fmt(topWeight)}kg last time.`,
      detail: `Stay at ${fmt(topWeight)}kg until all ${target_sets} sets clear ${rep_min}.`,
    }
  }

  const best = Math.max(...atTopWeight.map((s) => s.reps))
  return {
    action: 'add_reps',
    nextWeight: topWeight,
    message: `${fmt(topWeight)}kg × ${atTopWeight.map((s) => s.reps).join(', ')} last time.`,
    detail: `Same weight. Work toward ${target_sets}×${rep_max}${best < rep_max ? '' : ' on every set'}.`,
  }
}

const fmt = (n) => (n % 1 === 0 ? String(n) : n.toFixed(1))

// The program's warm-up ramp for the day's first lift:
//   empty bar × 10 → 50% × 5 → 70% × 3 → 85% × 1 → working weight
// Only meaningful with a real working load, and the empty-bar step only
// applies to a barbell — there's no "empty bar" on a cable stack.
const BAR_KG = 20

export function warmupRamp(workingWeightKg, equipment) {
  if (!workingWeightKg || workingWeightKg <= 0) return []
  const isBarbell = equipment === 'barbell'
  const steps = []

  if (isBarbell && workingWeightKg > BAR_KG * 1.5) {
    steps.push({ weight_kg: BAR_KG, reps: 10 })
  }
  for (const [pct, reps] of [[0.5, 5], [0.7, 3], [0.85, 1]]) {
    // Round to the nearest 2.5kg — you can't load 43.7kg.
    const w = Math.round((workingWeightKg * pct) / 2.5) * 2.5
    if (w <= 0) continue
    if (steps.some((s) => s.weight_kg === w)) continue // skip duplicates on light loads
    if (w >= workingWeightKg) continue
    steps.push({ weight_kg: w, reps })
  }
  return steps
}
