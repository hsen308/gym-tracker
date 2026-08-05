// Phase 3 item 3: every session for one lift, with an e1RM line chart and
// PR markers (build-plan §7). React.lazy defers pulling in recharts until
// this exact screen is opened — everywhere else in the app never pays for it.
import { lazy, Suspense, useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate, useParams } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import { db } from '../../db/dexie'
import { e1rm } from '../../lib/calc'
import { formatWeight } from '../../lib/format'

const E1rmChart = lazy(() => import('./E1rmChart'))

export default function ExerciseHistory() {
  const { exerciseId } = useParams()
  const navigate = useNavigate()

  const exercise = useLiveQuery(() => db.exercises.get(exerciseId), [exerciseId])
  const sets = useLiveQuery(
    () => db.sets.where('exercise_id').equals(exerciseId).filter((s) => !s.deleted_at && !s.is_warmup).toArray(),
    [exerciseId],
  )
  const workouts = useLiveQuery(() => db.workouts.toArray(), [])

  // One point per session: the session's best set by e1RM (the "top set"),
  // which is the number worth charting — an average across warmup-adjacent
  // sets would blur exactly the signal e1RM exists to isolate.
  const sessionPoints = useMemo(() => {
    if (!sets || !workouts) return []
    const workoutById = Object.fromEntries(workouts.map((w) => [w.id, w]))
    const bestBySession = {}
    for (const s of sets) {
      const value = e1rm(s)
      const current = bestBySession[s.workout_id]
      if (!current || value > current.e1rm) bestBySession[s.workout_id] = { ...s, e1rm: value }
    }
    const points = Object.values(bestBySession)
      .map((s) => ({ date: workoutById[s.workout_id]?.date, e1rm: s.e1rm, workoutId: s.workout_id }))
      .filter((p) => p.date)
      .sort((a, b) => new Date(a.date) - new Date(b.date))

    // A PR marker is the running max, not just "higher than the previous
    // point" — a dip-then-recovery shouldn't re-flag a number already hit.
    let runningMax = -Infinity
    return points.map((p) => {
      const isPR = p.e1rm > runningMax
      runningMax = Math.max(runningMax, p.e1rm)
      return { ...p, isPR }
    })
  }, [sets, workouts])

  if (!exercise || !sets || !workouts) return null

  return (
    <div className="container history-screen">
      <header className="row today-header">
        <button className="btn btn-ghost pressable" onClick={() => navigate(-1)} aria-label="back">←</button>
        <span className="stepper-label">{exercise.name}</span>
        <span />
      </header>

      {sessionPoints.length < 2 ? (
        <p className="muted">Not enough sessions yet to chart a trend.</p>
      ) : (
        <div className="card" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
          <Suspense fallback={<div style={{ height: 220 }} />}>
            <E1rmChart points={sessionPoints} />
          </Suspense>
        </div>
      )}

      <h2 className="section-label">Sessions</h2>
      <div className="stack-2">
        {[...sessionPoints].reverse().map((p) => (
          <div key={p.workoutId} className="row card" style={{ padding: 'var(--space-3) var(--space-4)' }}>
            <span className="muted">{format(parseISO(p.date), 'MMM d, yyyy')}</span>
            <span className="mono">
              {formatWeight(p.e1rm)} e1RM {p.isPR && <span className="pr-badge" style={{ marginLeft: 6 }}>PR</span>}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
