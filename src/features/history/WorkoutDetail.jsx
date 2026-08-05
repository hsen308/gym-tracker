// Phase 3 item 2: full readout of one past session — every set, grouped by
// exercise, plus the finish-time metadata (pain/energy/notes) captured by
// FinishSheet.
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate, useParams } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import { db } from '../../db/dexie'
import { formatDuration, formatWeight } from '../../lib/format'

export default function WorkoutDetail() {
  const { workoutId } = useParams()
  const navigate = useNavigate()

  const workout = useLiveQuery(() => db.workouts.get(workoutId), [workoutId])
  const day = useLiveQuery(() => (workout ? db.program_days.get(workout.program_day_id) : undefined), [workout?.program_day_id])
  const sets = useLiveQuery(
    () => db.sets.where('workout_id').equals(workoutId).filter((s) => !s.deleted_at).sortBy('completed_at'),
    [workoutId],
  )
  const exercises = useLiveQuery(() => db.exercises.toArray(), [])

  if (!workout || !sets || !exercises) return null
  const exerciseById = Object.fromEntries(exercises.map((e) => [e.id, e]))

  const setsByExercise = {}
  for (const s of sets) (setsByExercise[s.exercise_id] ??= []).push(s)
  const duration = workout.finished_at ? (new Date(workout.finished_at) - new Date(workout.started_at)) / 1000 : null

  return (
    <div className="container history-screen">
      <header className="row today-header">
        <button className="btn btn-ghost pressable" onClick={() => navigate(-1)} aria-label="back">←</button>
        <span className="stepper-label">{day?.name ?? 'Workout'}</span>
        <span />
      </header>

      <div className="stack-2" style={{ marginBottom: 'var(--space-6)' }}>
        <div className="row"><span className="muted">Date</span><span>{format(parseISO(workout.date), 'EEEE, MMM d')}</span></div>
        {duration != null && <div className="row"><span className="muted">Duration</span><span className="mono">{formatDuration(duration)}</span></div>}
        {workout.si_pain_score != null && <div className="row"><span className="muted">SI pain</span><span className="mono">{workout.si_pain_score}/10</span></div>}
        {workout.energy != null && <div className="row"><span className="muted">Energy</span><span className="mono">{workout.energy}/5</span></div>}
        {workout.notes && <p className="muted" style={{ fontSize: 14 }}>{workout.notes}</p>}
      </div>

      {Object.entries(setsByExercise).map(([exerciseId, exSets]) => (
        <div key={exerciseId} className="card" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-3)' }}>
          <button className="pressable" style={{ fontWeight: 600, marginBottom: 8, color: 'var(--text)' }} onClick={() => navigate(`/exercise/${exerciseId}`)}>
            {exerciseById[exerciseId]?.name ?? 'Exercise'} ›
          </button>
          <div className="stack-2">
            {exSets.map((s) => (
              <div key={s.id} className="row mono" style={{ fontSize: 14 }}>
                <span className="faint">#{s.set_number}</span>
                <span>{formatWeight(s.weight_kg)} × {s.reps}</span>
                <span className="muted">RIR {s.rir}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
