// Phase 3 item 2: full readout of one past session — every set grouped by
// exercise, plus the finish-time metadata captured by FinishSheet.
import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate, useParams } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import { db, updateRow, softDeleteRow } from '../../db/dexie'
import { formatDuration } from '../../lib/format'
import { formatWeightIn } from '../../lib/units'
import { describeLoad, supportsLoadModes } from '../../lib/loadMode'
import { useUnit } from '../../app/ProfileProvider'
import Icon from '../../components/Icon'
import Button from '../../components/Button'
import Sheet from '../../components/Sheet'
import SessionTimeSheet from '../workout/SessionTimeSheet'

export default function WorkoutDetail() {
  const { workoutId } = useParams()
  const navigate = useNavigate()
  const unit = useUnit()

  const workout = useLiveQuery(() => db.workouts.get(workoutId), [workoutId])
  const day = useLiveQuery(() => (workout ? db.program_days.get(workout.program_day_id) : undefined), [workout?.program_day_id])
  const sets = useLiveQuery(
    () => db.sets.where('workout_id').equals(workoutId).filter((s) => !s.deleted_at).sortBy('completed_at'),
    [workoutId],
  )
  const exercises = useLiveQuery(() => db.exercises.toArray(), [])

  const [confirmDelete, setConfirmDelete] = useState(false)
  const [timeOpen, setTimeOpen] = useState(false)

  if (!workout || !sets || !exercises) return null
  const exerciseById = Object.fromEntries(exercises.map((e) => [e.id, e]))

  const setsByExercise = {}
  for (const s of sets) (setsByExercise[s.exercise_id] ??= []).push(s)
  const duration = workout.finished_at ? (new Date(workout.finished_at) - new Date(workout.started_at)) / 1000 : null
  const isSkipped = !!workout.skipped_at
  const isEmpty = sets.length === 0

  // A skipped session keeps its place in the record. Deleting it would erase
  // the fact that it was scheduled at all, which is exactly the information
  // that makes adherence over a block readable.
  const markSkipped = () => updateRow('workouts', workoutId, {
    skipped_at: new Date().toISOString(),
    finished_at: null,
    updated_at: new Date().toISOString(),
  })
  const unmarkSkipped = () => updateRow('workouts', workoutId, {
    skipped_at: null,
    updated_at: new Date().toISOString(),
  })

  // Soft delete so the removal is something sync can push — a hard local
  // delete would leave the cloud copy alive to be pulled straight back.
  const deleteSession = async () => {
    for (const s of sets) await softDeleteRow('sets', s.id)
    await softDeleteRow('workouts', workoutId)
    navigate('/history')
  }

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

      {isSkipped && (
        <div className="callout callout-warn" style={{ marginBottom: 'var(--space-4)' }}>
          <p className="label label-strong">Skipped</p>
          <p>Kept on the record so the block's adherence still reads honestly.</p>
        </div>
      )}

      {!isSkipped && (
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
      )}

      {workout.notes && <p className="muted" style={{ fontSize: 14, marginTop: 'var(--space-5)', lineHeight: 1.6 }}>{workout.notes}</p>}

      <h2 className="label section-label">{isEmpty ? 'Nothing logged' : 'Sets logged'}</h2>
      {isEmpty ? (
        <p className="empty" style={{ paddingTop: 0 }}>
          This session has no sets. Mark it skipped to keep it on the record, or delete it outright.
        </p>
      ) : (
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
                    <span className="faint" style={{ fontSize: 11 }}>{s.is_warmup ? 'W' : String(s.set_number).padStart(2, '0')}</span>
                    <span style={{ flex: 1 }}>
                      {formatSet(s, exerciseById[exerciseId], unit)}
                    </span>
                    {s.rir != null && s.duration_seconds == null && (
                      <span className="faint" style={{ fontSize: 12 }}>{s.rir === 0 ? 'to failure' : `${s.rir} left`}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <h2 className="label section-label">Session</h2>
      <div className="stack-2">
        <Button variant="secondary" className="btn-block" onClick={() => navigate(`/workout/${workoutId}`)}>
          <Icon name="plus" size={18} /> Edit sets
        </Button>
        <Button variant="secondary" className="btn-block" onClick={() => setTimeOpen(true)}>
          <Icon name="timer" size={18} /> Change date &amp; time
        </Button>
        {isSkipped ? (
          <Button variant="secondary" className="btn-block" onClick={unmarkSkipped}>Un-mark skipped</Button>
        ) : (
          <Button variant="secondary" className="btn-block" onClick={markSkipped}>Mark as skipped</Button>
        )}
        <Button variant="danger" className="btn-block" onClick={() => setConfirmDelete(true)}>
          Delete this session
        </Button>
      </div>

      <SessionTimeSheet
        open={timeOpen}
        onClose={() => setTimeOpen(false)}
        workout={workout}
        onSave={(patch) => updateRow('workouts', workoutId, { ...patch, updated_at: new Date().toISOString() })}
      />

      <Sheet open={confirmDelete} onClose={() => setConfirmDelete(false)}>
        <h2 className="sheet-title">Delete this session?</h2>
        <p className="sheet-sub">
          {isEmpty
            ? 'Nothing was logged, so nothing is lost.'
            : `${sets.length} logged set${sets.length === 1 ? '' : 's'} will be deleted with it. This can't be undone.`}
          {' '}If you didn't train, marking it skipped keeps the record instead.
        </p>
        <Button variant="danger" className="btn-block" onClick={deleteSession}>Delete session</Button>
        <Button variant="secondary" className="btn-block" style={{ marginTop: 'var(--space-2)' }} onClick={() => setConfirmDelete(false)}>
          Keep it
        </Button>
      </Sheet>
    </div>
  )
}

// Reads a set back the way it was logged: which kit the weight was on, and
// whether the reps were per side.
function formatSet(s, exercise, unit) {
  const perSide = exercise?.is_unilateral ? '/side' : ''
  if (s.duration_seconds != null) return `${s.duration_seconds}s${perSide}`
  const load = supportsLoadModes(exercise)
    ? describeLoad(s, (kg) => formatWeightIn(kg, unit))
    : formatWeightIn(s.weight_kg, unit)
  return `${load} × ${s.reps}${perSide}`
}
