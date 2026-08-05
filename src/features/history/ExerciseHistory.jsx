// Phase 3 item 3: every session for one lift, with an e1RM line and PR
// markers (build-plan §7). React.lazy defers pulling in recharts until this
// exact screen opens — everywhere else never pays for it.
import { lazy, Suspense, useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate, useParams } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import { db } from '../../db/dexie'
import { e1rm } from '../../lib/calc'
import Icon from '../../components/Icon'

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

  // One point per session: that session's best set by e1RM (the "top set"),
  // which is the number worth charting — averaging across all sets would
  // blur exactly the signal e1RM exists to isolate.
  const sessionPoints = useMemo(() => {
    if (!sets || !workouts) return []
    const workoutById = Object.fromEntries(workouts.map((w) => [w.id, w]))
    const bestBySession = {}
    for (const s of sets) {
      if (s.weight_kg == null || s.reps == null) continue // duration-tracked holds have no e1RM
      const value = e1rm(s)
      const current = bestBySession[s.workout_id]
      if (!current || value > current.e1rm) bestBySession[s.workout_id] = { ...s, e1rm: value }
    }
    const points = Object.values(bestBySession)
      .map((s) => ({ date: workoutById[s.workout_id]?.date, e1rm: s.e1rm, workoutId: s.workout_id }))
      .filter((p) => p.date)
      .sort((a, b) => new Date(a.date) - new Date(b.date))

    // A PR marker is the running max, not "higher than the previous point" —
    // a dip then recovery shouldn't re-flag a number already hit.
    let runningMax = -Infinity
    return points.map((p) => {
      const isPR = p.e1rm > runningMax
      runningMax = Math.max(runningMax, p.e1rm)
      return { ...p, isPR }
    })
  }, [sets, workouts])

  if (!exercise || !sets || !workouts) return null

  const best = sessionPoints.reduce((m, p) => Math.max(m, p.e1rm), 0)

  return (
    <div className="container screen">
      <header className="screen-head">
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginLeft: -12 }}>
          <button className="btn btn-ghost btn-icon pressable" onClick={() => navigate(-1)} aria-label="back">
            <Icon name="back" size={20} />
          </button>
          <div>
            <p className="label">{sessionPoints.length} session{sessionPoints.length === 1 ? '' : 's'}</p>
            <h1 className="readout" style={{ fontSize: 26, letterSpacing: '-0.02em', lineHeight: 1.05, marginTop: 4 }}>
              {exercise.name.toUpperCase()}
            </h1>
          </div>
        </div>
      </header>

      {best > 0 && (
        <div className="panel" style={{ padding: 'var(--space-5)', marginBottom: 'var(--space-4)' }}>
          <p className="label">Best estimated 1RM</p>
          <p className="readout readout-lg" style={{ marginTop: 8 }}>{best.toFixed(1)}<span className="faint" style={{ fontSize: 20 }}> kg</span></p>
        </div>
      )}

      {sessionPoints.length < 2 ? (
        <p className="empty">Log this lift twice and a trend line appears here.</p>
      ) : (
        <div className="panel chart-panel">
          <Suspense fallback={<div style={{ height: 210 }} />}>
            <E1rmChart points={sessionPoints} />
          </Suspense>
        </div>
      )}

      <h2 className="label section-label">By session</h2>
      <div className="rule-list">
        {[...sessionPoints].reverse().map((p) => (
          <div key={p.workoutId} className="row" style={{ padding: 'var(--space-4) 0' }}>
            <span className="mono faint" style={{ fontSize: 12 }}>{format(parseISO(p.date), 'dd MMM yyyy')}</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
              <span className="mono">{p.e1rm.toFixed(1)} kg</span>
              {p.isPR && <span className="pr-chip">PR</span>}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
