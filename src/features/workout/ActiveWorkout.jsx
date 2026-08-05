import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, newId, upsertRow, updateRow, softDeleteRow } from '../../db/dexie'
import { useElapsedSeconds } from '../../lib/useElapsed'
import { formatDuration } from '../../lib/format'
import { REST_SECONDS } from '../../lib/constants'
import OfflineBadge from '../../components/OfflineBadge'
import Sheet from '../../components/Sheet'
import Icon from '../../components/Icon'
import Button from '../../components/Button'
import ExercisePanel from './ExercisePanel'
import RestTimer from './RestTimer'
import FinishSheet from './FinishSheet'

// The core screen (build-plan §7 Phase 1 item 5). Every write below goes
// straight to Dexie and returns — nothing here awaits a network call (§0
// rule 5), and every read is a useLiveQuery against Dexie, never Supabase
// (§0 rule 1).
export default function ActiveWorkout() {
  const { workoutId } = useParams()
  const navigate = useNavigate()

  const workout = useLiveQuery(() => db.workouts.get(workoutId), [workoutId])
  const day = useLiveQuery(
    () => (workout ? db.program_days.get(workout.program_day_id) : undefined),
    [workout?.program_day_id],
  )
  const programExercises = useLiveQuery(
    () => (workout
      ? db.program_exercises.where('program_day_id').equals(workout.program_day_id)
          .filter((pe) => !pe.deleted_at).sortBy('order_index')
      : []),
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

  // Keeps the screen awake for the session. Feature-detected because it
  // doesn't exist on iOS Safari (build-plan §9) — fails silently there.
  useEffect(() => {
    let lock = null
    let cancelled = false
    navigator.wakeLock?.request('screen').then((l) => {
      if (cancelled) l.release()
      else lock = l
    }).catch(() => {}) // denied or unsupported — not worth surfacing
    return () => { cancelled = true; lock?.release?.().catch(() => {}) }
  }, [])

  // Bail out until every piece of state has resolved once — Dexie reads are
  // async, so on first paint these are all `undefined`. Rendering early with
  // partial data just flashes broken UI.
  if (!workout || !programExercises || !exercises || !sets) return null

  const exerciseById = Object.fromEntries(exercises.map((e) => [e.id, e]))
  const setsByExercise = {}
  for (const s of sets) (setsByExercise[s.exercise_id] ??= []).push(s)

  // Auto-advance: the open panel is the first exercise that still has sets
  // left, unless you've explicitly tapped a different one. Without this you
  // have to manually open every exercise as you work down the list.
  const firstIncomplete = programExercises.find(
    (pe) => (setsByExercise[pe.exercise_id]?.length ?? 0) < pe.target_sets,
  )
  const expanded = expandedId ?? firstIncomplete?.exercise_id ?? programExercises[0]?.exercise_id ?? null

  const totalTarget = programExercises.reduce((n, pe) => n + pe.target_sets, 0)

  const confirmSet = async (programExercise, exercise, draft) => {
    const now = new Date().toISOString()
    await upsertRow('sets', {
      id: newId(),
      user_id: workout.user_id,
      workout_id: workoutId,
      exercise_id: exercise.id,
      program_exercise_id: programExercise.id,
      set_number: draft.set_number,
      weight_kg: draft.weight_kg ?? null,
      reps: draft.reps ?? null,
      rir: draft.rir ?? null,
      is_warmup: false,
      duration_seconds: draft.duration_seconds ?? null,
      completed_at: now,
      updated_at: now,
      deleted_at: null,
    })
    // Confirming a set starts that exercise's rest timer (§7 item 5).
    // Local-only — active_rest has no Supabase counterpart.
    await db.active_rest.put({
      workout_id: workoutId,
      exercise_id: exercise.id,
      started_at: now,
      duration_seconds: programExercise.rest_seconds ?? REST_SECONDS.COMPOUND_ACCESSORY,
    })
  }

  // Soft delete (build-plan §3a): the row stays in Dexie with deleted_at set,
  // so the deletion itself has something to push. A hard local delete would
  // erase the row before sync ever saw it.
  const removeSet = (setId) => softDeleteRow('sets', setId)
  const clearRest = () => db.active_rest.delete(workoutId)

  const finishWorkout = async (extra) => {
    const now = new Date().toISOString()
    await updateRow('workouts', workoutId, { ...extra, finished_at: now, updated_at: now })
    await db.active_rest.delete(workoutId)
    navigate('/')
  }

  const cueExercise = cueExerciseId ? exerciseById[cueExerciseId] : null

  return (
    <div className={`workout-shell ${activeRest ? 'has-rest' : ''}`}>
      <header className="workout-head glass">
        <button className="btn btn-ghost btn-icon pressable" onClick={() => navigate('/')} aria-label="back to today">
          <Icon name="back" size={20} />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontWeight: 600, letterSpacing: '-0.01em' }}>{day?.name ?? '…'}</p>
          <p className="workout-clock">{formatDuration(elapsed)} · {sets.length}/{totalTarget} sets</p>
        </div>
        <OfflineBadge />
      </header>

      <div className="workout-body">
        {programExercises.length === 0 && (
          <p className="empty">This day has no exercises. Check the program seeded correctly.</p>
        )}
        <div className="rule-list">
          {programExercises.map((pe, i) => {
            const exercise = exerciseById[pe.exercise_id]
            if (!exercise) return null
            return (
              <ExercisePanel
                key={pe.id}
                index={i + 1}
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

        <Button variant="secondary" className="btn-block" style={{ marginTop: 'var(--space-6)' }} onClick={() => setFinishOpen(true)}>
          Finish workout
        </Button>
      </div>

      {activeRest && (
        <RestTimer
          startedAt={activeRest.started_at}
          durationSeconds={activeRest.duration_seconds}
          onSkip={clearRest}
        />
      )}

      <Sheet open={!!cueExercise} onClose={() => setCueExerciseId(null)}>
        {cueExercise && (
          <>
            <h2 className="sheet-title">{cueExercise.name}</h2>
            {/* The SI note leads, per build-plan §7: the whole reason the sheet
                exists is to put the caution in front of you at the moment it
                matters — mid-set, deciding whether to add load. */}
            {cueExercise.si_risk === 'caution' && (
              <div className="panel" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
                <p className="label" style={{ marginBottom: 6 }}>SI joint caution</p>
                <p style={{ fontSize: 14, lineHeight: 1.5 }}>
                  Watch load and position on this one. Stop before the hips tuck, stay symmetrical, never twist to grind a rep.
                </p>
              </div>
            )}
            {cueExercise.setup_notes && (
              <>
                <p className="label" style={{ marginBottom: 6 }}>Setup</p>
                <p style={{ fontSize: 14, lineHeight: 1.55, marginBottom: 'var(--space-5)' }}>{cueExercise.setup_notes}</p>
              </>
            )}
            {cueExercise.cues?.length > 0 && (
              <>
                <p className="label" style={{ marginBottom: 8 }}>Cues</p>
                <ul className="stack-3" style={{ margin: 0, paddingLeft: 18, fontSize: 14, lineHeight: 1.5 }}>
                  {cueExercise.cues.map((c, i) => <li key={i}>{c}</li>)}
                </ul>
              </>
            )}
          </>
        )}
      </Sheet>

      <FinishSheet open={finishOpen} onClose={() => setFinishOpen(false)} onFinish={finishWorkout} />
    </div>
  )
}
