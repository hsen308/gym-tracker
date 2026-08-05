// Phase 3 item 2: full readout of one past session — every set grouped by
// exercise, plus the finish-time metadata captured by FinishSheet.
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate, useParams } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import { db } from '../../db/dexie'
import { formatDuration, formatWeight } from '../../lib/format'
import Icon from '../../components/Icon'

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
    <div className="container screen">
      <header className="screen-head">
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginLeft: -12 }}>
          <button className="btn btn-ghost btn-icon pressable" onClick={() => navigate(-1)} aria-label="back">
            <Icon name="back" size={20} />
          </button>
          <div>
            <p className="label">{format(parseISO(workout.date), 'EEEE d MMMM')}</p>
            <h1 className="readout screen-title">{(day?.name ?? 'Workout').toUpperCase()}</h1>
          </div>
        </div>
      </header>

      <div className="detail-grid">
        <div className="detail-cell">
          <p className="label">Duration</p>
          <p className="detail-value">{duration != null ? formatDuration(duration) : '—'}</p>
        </div>
        <div className="detail-cell">
          <p className="label">SI pain</p>
          <p className="detail-value">{workout.si_pain_score ?? '—'}</p>
        </div>
        <div className="detail-cell">
          <p className="label">Energy</p>
          <p className="detail-value">{workout.energy ?? '—'}</p>
        </div>
      </div>

      {workout.notes && <p className="muted" style={{ fontSize: 14, marginTop: 'var(--space-5)', lineHeight: 1.6 }}>{workout.notes}</p>}

      <h2 className="label section-label">Sets logged</h2>
      <div className="rule-list">
        {Object.entries(setsByExercise).map(([exerciseId, exSets]) => (
          <div key={exerciseId} className="ex-group">
            <button className="ex-group-head pressable" onClick={() => navigate(`/exercise/${exerciseId}`)}>
              <span className="ex-group-name">{exerciseById[exerciseId]?.name ?? 'Exercise'}</span>
              <Icon name="chevron" size={16} className="faint" />
            </button>
            <div className="stack-2">
              {exSets.map((s) => (
                <div key={s.id} className="row mono" style={{ fontSize: 14 }}>
                  <span className="faint" style={{ fontSize: 11 }}>{String(s.set_number).padStart(2, '0')}</span>
                  <span style={{ flex: 1 }}>
                    {s.duration_seconds != null ? `${s.duration_seconds}s` : `${formatWeight(s.weight_kg)} × ${s.reps}`}
                  </span>
                  {s.rir != null && <span className="faint" style={{ fontSize: 12 }}>RIR {s.rir}</span>}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
