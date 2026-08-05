import { useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, newId, upsertRow, updateRow, softDeleteRow } from '../../db/dexie'
import { useElapsedSeconds } from '../../lib/useElapsed'
import { formatDuration } from '../../lib/format'
import { REST_SECONDS } from '../../lib/constants'
import OfflineBadge from '../../components/OfflineBadge'
import Sheet from '../../components/Sheet'
import ExercisePanel from './ExercisePanel'
import RestTimer from './RestTimer'
import FinishSheet from './FinishSheet'

// The core screen (build-plan §7 Phase 1 item 5). Every write below goes
// straight to Dexie and returns — nothing here ever awaits a network call
// (§0 rule 5), and every read is a useLiveQuery against Dexie, never
// Supabase (§0 rule 1).
export default function ActiveWorkout() {
  const { workoutId } = useParams()
  const navigate = useNavigate()

  const workout = useLiveQuery(() => db.workouts.get(workoutId), [workoutId])
  const day = useLiveQuery(
    () => (workout ? db.program_days.get(workout.program_day_id) : undefined),
    [workout?.program_day_id],
  )
  const programExercises = useLiveQuery(
    () => (workout ? db.program_exercises.where('program_day_id').equals(workout.program_day_id).sortBy('order_index') : []),
    [workout?.program_day_id],
  )
  const exerciseIds = useMemo(() => programExercises?.map((pe) => pe.exercise_id) ?? [], [programExercises])
  const exercises = useLiveQuery(
    () => (exerciseIds.length ? db.exercises.where('id').anyOf(exerciseIds).toArray() : []),
    [exerciseIds.join(',')],
  )
  const sets = useLiveQuery(
    () => db.sets.where('workout_id').equals(workoutId).filter((s) => !s.deleted_at).sortBy('set_number'),
    [workoutId],
  )
  const activeRest = useLiveQuery(() => db.active_rest.get(workoutId), [workoutId])

  const [expandedId, setExpandedId] = useState(null)
  const [cueExerciseId, setCueExerciseId] = useState(null)
  const [finishOpen, setFinishOpen] = useState(false)

  const elapsed = useElapsedSeconds(workout?.started_at)

  // Bail out of rendering until every piece of state has resolved at least
  // once — Dexie reads are async, so on first paint these are all
  // `undefined`. Rendering early with partial data would just flash broken UI.
  if (!workout || !programExercises || !exercises || !sets) return null

  const exerciseById = Object.fromEntries(exercises.map((e) => [e.id, e]))
  const setsByExercise = {}
  for (const s of sets) (setsByExercise[s.exercise_id] ??= []).push(s)

  const expanded = expandedId ?? programExercises[0]?.exercise_id ?? null

  const confirmSet = async (programExercise, exercise, draft) => {
    const now = new Date().toISOString()
    await upsertRow('sets', {
      id: newId(),
      user_id: workout.user_id,
      workout_id: workoutId,
      exercise_id: exercise.id,
      program_exercise_id: programExercise.id,
      set_number: draft.set_number,
      weight_kg: draft.weight_kg,
      reps: draft.reps,
      rir: draft.rir,
      is_warmup: false,
      duration_seconds: null,
      completed_at: now,
      updated_at: now,
      deleted_at: null,
    })
    // Confirming a set starts the rest timer for that exercise (§7 item 5).
    // Local-only — active_rest has no Supabase counterpart (§3b comment).
    await db.active_rest.put({
      workout_id: workoutId,
      exercise_id: exercise.id,
      started_at: now,
      duration_seconds: programExercise.rest_seconds ?? REST_SECONDS.COMPOUND_ACCESSORY,
    })
  }

  // Soft delete (build-plan §3a) — the row stays in Dexie with deleted_at
  // set, so the deletion itself has something to push to Supabase. A hard
  // local delete here would erase the row before sync ever saw it.
  const removeSet = (setId) => softDeleteRow('sets', setId)
  const clearRest = () => db.active_rest.delete(workoutId)

  const finishWorkout = async (extra) => {
    await updateRow('workouts', workoutId, {
      ...extra,
      finished_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    await db.active_rest.delete(workoutId)
    navigate('/')
  }

  const cueExercise = cueExerciseId ? exerciseById[cueExerciseId] : null

  return (
    <div className={`workout-shell ${activeRest ? 'has-rest-timer' : ''}`}>
      <header className="workout-header">
        <div>
          <div style={{ fontWeight: 700 }}>{day?.name ?? '…'}</div>
          <div className="mono muted" style={{ fontSize: 13 }}>{formatDuration(elapsed)}</div>
        </div>
        <OfflineBadge />
      </header>

      <div className="workout-body">
        {programExercises.length === 0 && (
          <p className="muted" style={{ marginTop: 40 }}>
            This day has no exercises yet — the program hasn't been filled into <code>src/db/seed.js</code> yet.
          </p>
        )}
        {programExercises.map((pe) => {
          const exercise = exerciseById[pe.exercise_id]
          if (!exercise) return null
          return (
            <ExercisePanel
              key={pe.id}
              exercise={exercise}
              programExercise={pe}
              workoutId={workoutId}
              confirmedSets={setsByExercise[exercise.id] ?? []}
              isExpanded={expanded === exercise.id}
              onToggleExpand={() => setExpandedId(exercise.id)}
              onOpenCues={() => setCueExerciseId(exercise.id)}
              onConfirmSet={(draft) => confirmSet(pe, exercise, draft)}
              onRemoveSet={removeSet}
            />
          )
        })}
      </div>

      <button className="btn btn-secondary pressable btn-block finish-btn" onClick={() => setFinishOpen(true)}>
        Finish workout
      </button>

      {activeRest && (
        <RestTimer
          startedAt={activeRest.started_at}
          durationSeconds={activeRest.duration_seconds}
          onSkip={clearRest}
          onComplete={clearRest}
        />
      )}

      <Sheet open={!!cueExercise} onClose={() => setCueExerciseId(null)}>
        {cueExercise && (
          <>
            <h2 style={{ fontSize: 18, marginBottom: 8 }}>{cueExercise.name}</h2>
            {cueExercise.si_risk === 'caution' && (
              <p style={{ color: 'var(--warn)', fontSize: 13, marginBottom: 12 }}>
                ⚠ SI joint caution — watch load and form on this one.
              </p>
            )}
            <p className="muted" style={{ fontSize: 14 }}>{cueExercise.setup_notes || 'No setup notes yet.'}</p>
            {cueExercise.cues?.length > 0 && (
              <ul className="muted cue-list">
                {cueExercise.cues.map((c, i) => <li key={i}>{c}</li>)}
              </ul>
            )}
          </>
        )}
      </Sheet>

      <FinishSheet open={finishOpen} onClose={() => setFinishOpen(false)} onFinish={finishWorkout} />
    </div>
  )
}
