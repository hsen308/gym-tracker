// Per-exercise analytics, one sheet reachable wherever you tap a lift: the
// day preview, the live session, and (via the coach report) the exercise
// history screen. Everything reads Dexie live (§0 rule 1) and reuses the same
// computations the rest of the app draws on — the "top set per session,
// dominant load mode" e1RM line that ExerciseHistory plots, and the SI-pain
// correlation signal that CoachReport reports — so no screen can ever
// disagree with this one.
import { lazy, Suspense, useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { db } from '../../db/dexie'
import { e1rm } from '../../lib/calc'
import { siCorrelation } from '../../lib/insights'
import { modeOf } from '../../lib/loadMode'
import Sheet from '../../components/Sheet'
import Icon from '../../components/Icon'

// Recharts — the heaviest charting dependency in the app — must stay out of
// the main bundle (build-plan §1), so the chart inside the sheet is lazy just
// like the one on ExerciseHistory.
const E1rmChart = lazy(() => import('../history/E1rmChart'))

export default function ExerciseAnalyticsSheet({ open, onClose, exercise, excludeWorkoutId }) {
  const navigate = useNavigate()

  // This exercise's own sets: what the trend and the best are drawn from.
  // `excludeWorkoutId` drops the session you're mid-way through — its sets
  // aren't history yet, and a half-logged bench can't be a data point.
  const exerciseSets = useLiveQuery(
    () => (exercise
      ? db.sets.where('exercise_id').equals(exercise.id)
          .filter((s) => !s.deleted_at && !s.is_warmup && s.workout_id !== excludeWorkoutId).toArray()
      : Promise.resolve([])),
    [exercise?.id, excludeWorkoutId],
  )
  const workouts = useLiveQuery(() => db.workouts.toArray(), [])
  const allSets = useLiveQuery(() => db.sets.filter((s) => !s.deleted_at).toArray(), [])
  const exercises = useLiveQuery(() => db.exercises.filter((e) => !e.deleted_at).toArray(), [])

  // Which mode this lift is mostly done in — machine dips and bodyweight dips
  // share a name but not a curve, and one line through both is a cliff.
  const dominantMode = useMemo(() => {
    const tally = {}
    for (const s of exerciseSets ?? []) tally[modeOf(s)] = (tally[modeOf(s)] ?? 0) + 1
    return Object.entries(tally).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'added'
  }, [exerciseSets])
  const byReps = dominantMode === 'bodyweight'

  // One point per session: that session's best set by e1RM (or by reps on a
  // bodyweight lift — there is no estimated 1RM to speak of). A PR marker is
  // the running max, not "higher than the previous point".
  const sessionPoints = useMemo(() => {
    if (!exerciseSets?.length || !workouts) return []
    const workoutById = Object.fromEntries(workouts.map((w) => [w.id, w]))
    const bestBySession = {}
    for (const s of exerciseSets) {
      if (s.weight_kg == null || s.reps == null) continue // duration holds have no e1RM
      if (modeOf(s) !== dominantMode) continue // don't mix modes
      const value = byReps ? (s.reps ?? 0) : e1rm(s)
      const current = bestBySession[s.workout_id]
      if (!current || value > current.e1rm) bestBySession[s.workout_id] = { ...s, e1rm: value }
    }
    const dated = Object.values(bestBySession)
      .map((s) => ({ date: workoutById[s.workout_id]?.date, e1rm: s.e1rm, workoutId: s.workout_id }))
      .filter((p) => p.date)
      .sort((a, b) => new Date(a.date) - new Date(b.date))
    let runningMax = -Infinity
    return dated.map((p) => {
      const isPR = p.e1rm > runningMax
      runningMax = Math.max(runningMax, p.e1rm)
      return { ...p, isPR }
    })
  }, [exerciseSets, workouts, dominantMode, byReps])

  // Sessions this lift actually appeared in (distinct workouts, current one
  // excluded), as opposed to trend points — a lift can be logged in a mode
  // that's not its dominant one and still count as a session.
  const sessionCount = useMemo(() => {
    if (!exerciseSets?.length) return 0
    return new Set(exerciseSets.map((s) => s.workout_id)).size
  }, [exerciseSets])

  // The same SI-pain signal the coach report draws, narrowed to this lift.
  // Gated to when the sheet is open — it scans all sets, so it shouldn't run
  // every time a set lands while the sheet sits closed on a live session.
  const correlation = useMemo(() => {
    if (!open || !exercise || !exercises || !workouts || !allSets) return null
    const exerciseById = Object.fromEntries(exercises.map((e) => [e.id, e]))
    return siCorrelation(workouts, allSets, exerciseById).find((r) => r.exerciseId === exercise.id) ?? null
  }, [open, exercise?.id, exercises, workouts, allSets])

  // Bail out until every piece of state has resolved once — on first open the
  // live queries are running, and rendering a chart over missing data either
  // flashes an empty state or crashes.
  if (!exercise || !exerciseSets || !workouts || !allSets || !exercises) return null

  const best = sessionPoints.reduce((m, p) => Math.max(m, p.e1rm), 0)
  const prCount = sessionPoints.filter((p) => p.isPR).length
  const muscle = exercise.primary_muscle ? exercise.primary_muscle.replace(/_/g, ' ').toUpperCase() : ''

  return (
    <Sheet open={open} onClose={onClose}>
      <div>
        <h2 className="sheet-title">{exercise.name}</h2>
        {muscle && <p className="mono muted" style={{ fontSize: 12, marginBottom: 'var(--space-4)' }}>{muscle}</p>}

        <div className="stat-strip analytics-stats">
          <div><p className="label">Sessions</p><p className="stat-strip-value">{sessionCount}</p></div>
          <div>
            <p className="label">{byReps ? 'Best set' : 'Best e1RM'}</p>
            <p className="stat-strip-value">{best > 0 ? (byReps ? best : best.toFixed(1)) : '—'}</p>
          </div>
          <div><p className="label">PRs</p><p className="stat-strip-value">{prCount}</p></div>
        </div>

        {sessionPoints.length >= 2 ? (
          <div className="chart-panel" style={{ marginTop: 'var(--space-4)' }}>
            <Suspense fallback={<div style={{ height: 210 }} />}>
              <E1rmChart points={sessionPoints} />
            </Suspense>
          </div>
        ) : (
          <p className="empty">Log this lift twice and a trend line appears here.</p>
        )}

        <SICorrelationCard correlation={correlation} style={{ marginTop: 'var(--space-4)' }} />

        <button
          className="btn btn-ghost btn-block pressable"
          style={{ marginTop: 'var(--space-5)' }}
          onClick={() => { onClose(); navigate(`/exercise/${exercise.id}`) }}
        >
          <Icon name="insights" size={16} /> Full history & workouts
        </button>
      </div>
    </Sheet>
  )
}

// The SI-pain correlation readout, shared so the analytics sheet and the
// exercise history screen render the identical signal. Same threshold and
// same "a signal to investigate, never a verdict" framing as the coach
// report (§7 Phase 6 item 5).
export function SICorrelationCard({ correlation, style }) {
  if (!correlation) return null
  const higher = correlation.diff > 0
  return (
    <div className={`callout ${higher ? 'callout-warn' : ''}`} style={{ marginTop: 'var(--space-4)', ...style }}>
      <p className="label label-strong">
        SI pain {higher ? `${correlation.diff.toFixed(1)} higher` : `${Math.abs(correlation.diff).toFixed(1)} lower`} on sessions
        including this lift
      </p>
      <p>
        Across {correlation.sessionsWith} sessions with this lift vs. sessions without.
        {correlation.diff >= 1 && ' This one is worth keeping an eye on.'}
        <span className="faint" style={{ display: 'block', marginTop: 4 }}>A signal to investigate, never a verdict.</span>
      </p>
    </div>
  )
}