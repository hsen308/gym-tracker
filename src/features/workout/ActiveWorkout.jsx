import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, newId, upsertRow, updateRow, softDeleteRow } from '../../db/dexie'
import { useElapsedSeconds } from '../../lib/useElapsed'
import { formatDuration } from '../../lib/format'
import { REST_SECONDS } from '../../lib/constants'
import { programPhase, setsForSession } from '../../lib/phase'
import { useProgramStart } from '../../lib/useProgramStart'
import OfflineBadge from '../../components/OfflineBadge'
import Sheet from '../../components/Sheet'
import Icon from '../../components/Icon'
import Button from '../../components/Button'
import ExercisePanel from './ExercisePanel'
import RestTimer from './RestTimer'
import FinishSheet from './FinishSheet'
import SwapSheet from './SwapSheet'
import CustomExerciseSheet from './CustomExerciseSheet'
import SessionTimeSheet from './SessionTimeSheet'
import CaffeinePrompt from './CaffeinePrompt'
import { ExerciseCues } from './DayPreview'

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
  // Per-slot session state: substitutions and traffic-light pain readings.
  const slotState = useLiveQuery(
    () => db.workout_exercises.where('workout_id').equals(workoutId).filter((r) => !r.deleted_at).toArray(),
    [workoutId],
  )
  const exercises = useLiveQuery(() => db.exercises.filter((e) => !e.deleted_at).toArray(), [])
  const sets = useLiveQuery(
    () => db.sets.where('workout_id').equals(workoutId).filter((s) => !s.deleted_at).sortBy('set_number'),
    [workoutId],
  )
  const activeRest = useLiveQuery(() => db.active_rest.get(workoutId), [workoutId])

  const [expandedId, setExpandedId] = useState(null)
  const [cueSlotId, setCueSlotId] = useState(null)
  const [swapSlotId, setSwapSlotId] = useState(null)
  const [finishOpen, setFinishOpen] = useState(false)
  const [timeOpen, setTimeOpen] = useState(false)
  const [customOpen, setCustomOpen] = useState(false)

  // Reopening a finished session turns this screen into an editor: same
  // logging UI, but no wake lock, no rest timers, and the footer saves rather
  // than finishes. Building a separate read-only editor would have meant two
  // implementations of every stepper and swap control.
  const isEditing = !!workout?.finished_at
  const elapsed = useElapsedSeconds(workout?.started_at)
  const programStart = useProgramStart()
  const phase = useMemo(() => programPhase(programStart), [programStart])

  // Keeps the screen awake for the session. Feature-detected because it
  // doesn't exist on iOS Safari (build-plan §9) — fails silently there.
  useEffect(() => {
    if (isEditing) return // nothing to keep awake; you're at a desk
    let lock = null
    let cancelled = false
    navigator.wakeLock?.request('screen').then((l) => {
      if (cancelled) l.release()
      else lock = l
    }).catch(() => {})
    return () => { cancelled = true; lock?.release?.().catch(() => {}) }
  }, [isEditing])

  // Bail out until every piece of state has resolved once — Dexie reads are
  // async, so on first paint these are all `undefined`. Rendering early with
  // partial data just flashes broken UI.
  if (!workout || !programExercises || !exercises || !sets || !slotState) return null

  const exerciseById = Object.fromEntries(exercises.map((e) => [e.id, e]))
  const slotByProgramId = Object.fromEntries(slotState.map((r) => [r.program_exercise_id, r]))

  // A LIGHT session (chosen at start) halves the sets of everything that
  // isn't a main lift, so the big lifts still get done on the days you'd
  // otherwise skip the gym entirely. Same rule the preview computed, so the
  // numbers you saw are the numbers you get.
  const isLight = !!workout.is_light
  const sessionSets = (pe) =>
    setsForSession(pe.target_sets, phase, (pe.rest_seconds ?? 0) >= 120, !!pe.is_strength_lift, isLight)

  // The exercise actually being performed in a slot — today's explicit choice
  // wins, then the remembered default (swap carried into future sessions),
  // then what the program says.
  const effectiveSwapId = (pe) => slotByProgramId[pe.id]?.swapped_exercise_id ?? pe.swap_to_exercise_id ?? null
  const resolveExercise = (pe) => exerciseById[effectiveSwapId(pe)] ?? exerciseById[pe.exercise_id]

  const setsByExercise = {}
  for (const s of sets) (setsByExercise[s.exercise_id] ??= []).push(s)

  // Auto-advance: the open panel is the first exercise that still has working
  // sets left, unless you've explicitly tapped another. Without this you'd
  // reopen every exercise by hand as you work down the list.
  const firstIncomplete = programExercises.find((pe) => {
    const ex = resolveExercise(pe)
    const done = (setsByExercise[ex?.id] ?? []).filter((s) => !s.is_warmup && !s.is_drop_set).length
    return done < sessionSets(pe)
  })
  const expanded = expandedId ?? firstIncomplete?.id ?? programExercises[0]?.id ?? null

  const totalTarget = programExercises.reduce((n, pe) => n + sessionSets(pe), 0)
  // Drops and warm-ups both excluded: the header count is working sets.
  const workingDone = sets.filter((s) => !s.is_warmup && !s.is_drop_set).length

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
      is_warmup: draft.is_warmup ?? false,
      is_drop_set: draft.is_drop_set ?? false,
      duration_seconds: draft.duration_seconds ?? null,
      completed_at: now,
      updated_at: now,
      deleted_at: null,
    })
    // Warm-up sets don't start a rest timer — the whole point of a ramp is to
    // move through it, and a 3-minute countdown after an empty-bar set is noise.
    // A drop is taken immediately after the set it follows — a rest
    // countdown is the opposite of the technique.
    if (draft.is_warmup || draft.is_drop_set || isEditing) return
    await db.active_rest.put({
      workout_id: workoutId,
      exercise_id: exercise.id,
      started_at: now,
      duration_seconds: programExercise.rest_seconds ?? REST_SECONDS.COMPOUND_ACCESSORY,
    })
  }

  // Upsert-by-slot: one row per (workout, programmed slot), created lazily the
  // first time you swap or record pain on it.
  const patchSlot = async (programExerciseId, patch) => {
    const existing = slotByProgramId[programExerciseId]
    const now = new Date().toISOString()
    if (existing) {
      await updateRow('workout_exercises', existing.id, { ...patch, updated_at: now })
    } else {
      await upsertRow('workout_exercises', {
        id: newId(),
        user_id: workout.user_id,
        workout_id: workoutId,
        program_exercise_id: programExerciseId,
        swapped_exercise_id: null,
        pain_level: null,
        pain_locations: [],
        created_at: now,
        updated_at: now,
        deleted_at: null,
        ...patch,
      })
    }
  }

  // Soft delete (build-plan §3a): the row stays in Dexie with deleted_at set,
  // so the deletion itself has something to push. A hard local delete would
  // erase the row before sync ever saw it.
  const removeSet = (setId) => softDeleteRow('sets', setId)

  // Editing a logged set, not just deleting it — entering a session after the
  // fact makes typos routine, and re-entering a whole set to fix one digit is
  // the kind of friction that stops people logging at all.
  const updateSet = (setId, patch) =>
    updateRow('sets', setId, {
      weight_kg: patch.weight_kg ?? null,
      reps: patch.reps ?? null,
      rir: patch.rir ?? null,
      duration_seconds: patch.duration_seconds ?? null,
      updated_at: new Date().toISOString(),
    })
  const clearRest = () => db.active_rest.delete(workoutId)

  // `finished_at` comes from the sheet so a session logged after the fact can
  // record when it actually ended, not when you got round to typing it up.
  const finishWorkout = async ({ finishedAt, ...extra }) => {
    const now = new Date().toISOString()
    await updateRow('workouts', workoutId, { ...extra, finished_at: finishedAt ?? now, updated_at: now })
    await db.active_rest.delete(workoutId)
    navigate('/')
  }

  const cueSlot = programExercises.find((pe) => pe.id === cueSlotId)
  const cueExercise = cueSlot ? resolveExercise(cueSlot) : null
  const swapSlot = programExercises.find((pe) => pe.id === swapSlotId)
  const swapProgrammed = swapSlot ? exerciseById[swapSlot.exercise_id] : null

  const goFullWorkout = () =>
    updateRow('workouts', workoutId, { is_light: false, updated_at: new Date().toISOString() })

  return (
    <div className={`workout-shell ${activeRest ? 'has-rest' : ''}`}>
      <header className="workout-head glass">
        <button className="btn btn-ghost btn-icon pressable" onClick={() => navigate('/')} aria-label="back to today">
          <Icon name="back" size={20} />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontWeight: 600, letterSpacing: '-0.01em' }}>
            {day?.name ?? '…'}
            {isEditing && <span className="tag tag-swap" style={{ marginLeft: 8 }}>EDITING</span>}
          </p>
          {/* The clock is a button: if you started the session late, or are
              typing it up hours afterwards, this is where you correct it. */}
          <button className="workout-clock pressable" onClick={() => setTimeOpen(true)}>
            {formatDuration(elapsed)} · {workingDone}/{totalTarget} sets
            <Icon name="timer" size={12} />
          </button>
        </div>
        <OfflineBadge />
      </header>

      <div className="workout-body">
        <CaffeinePrompt workout={workout} />

        {/* A light session is a promise you can break: accessories start at
            half their sets, but deciding mid-way that you're up for the full
            thing should never force abandoning the session and starting over. */}
        {isLight && (
          <div className="phase-banner" style={{ background: 'var(--signal-soft)', borderColor: 'var(--signal)' }}>
            <p className="label label-strong">Light session</p>
            <p className="phase-note">
              Accessories at half their sets; main lifts unchanged.{' '}
              <button type="button" className="link-action pressable" onClick={goFullWorkout}>Train the full session instead</button>
            </p>
          </div>
        )}

        {/* A reduced week changes what today is supposed to be — saying so once
            at the top beats silently altering the numbers underneath you. */}
        {phase?.title && (
          <div className="phase-banner">
            <p className="label">{phase.title}</p>
            <p className="phase-note">{phase.note}</p>
          </div>
        )}

        {programExercises.length === 0 && (
          <p className="empty">This day has no exercises. Check the program seeded correctly.</p>
        )}

        <div className="rule-list">
          {programExercises.map((pe, i) => {
            const exercise = resolveExercise(pe)
            if (!exercise) return null
            const slot = slotByProgramId[pe.id]
            return (
              <ExercisePanel
                key={pe.id}
                index={i + 1}
                exercise={exercise}
                programExercise={pe}
                workoutId={workoutId}
                phase={phase}
                isLight={isLight}
                confirmedSets={setsByExercise[exercise.id] ?? []}
                isExpanded={expanded === pe.id}
                isSwapped={!!effectiveSwapId(pe)}
                painLevel={slot?.pain_level ?? null}
                painLocations={slot?.pain_locations ?? []}
                onPainChange={(pain_level) => patchSlot(pe.id, { pain_level })}
                onPainLocationsChange={(pain_locations) => patchSlot(pe.id, { pain_locations })}
                onToggleExpand={() => setExpandedId(pe.id)}
                onOpenCues={() => setCueSlotId(pe.id)}
                onOpenSwap={() => setSwapSlotId(pe.id)}
                onConfirmSet={(draft) => confirmSet(pe, exercise, draft)}
                onUpdateSet={updateSet}
                onRemoveSet={removeSet}
              />
            )
          })}
        </div>

        {isEditing ? (
          <Button className="btn-block" style={{ marginTop: 'var(--space-6)' }} onClick={() => navigate(`/history/${workoutId}`)}>
            Done editing
          </Button>
        ) : (
          <Button variant="secondary" className="btn-block" style={{ marginTop: 'var(--space-6)' }} onClick={() => setFinishOpen(true)}>
            Finish workout
          </Button>
        )}
      </div>

      {activeRest && (
        <RestTimer
          startedAt={activeRest.started_at}
          durationSeconds={activeRest.duration_seconds}
          onSkip={clearRest}
        />
      )}

      {/* Same cue sheet the day preview shows — one component, so the
          reference you read before the gym is the one you get mid-set. */}
      <Sheet open={!!cueExercise} onClose={() => setCueSlotId(null)}>
        {cueExercise && <ExerciseCues exercise={cueExercise} />}
      </Sheet>

      <SwapSheet
        open={!!swapSlot}
        onClose={() => setSwapSlotId(null)}
        exercise={swapProgrammed}
        isSwapped={!!(swapSlot && effectiveSwapId(swapSlot))}
        defaultSwapId={swapSlot?.swap_to_exercise_id ?? null}
        onRevert={() => { patchSlot(swapSlot.id, { swapped_exercise_id: null }); setSwapSlotId(null) }}
        onSwap={(alt) => { patchSlot(swapSlot.id, { swapped_exercise_id: alt.id }); setSwapSlotId(null) }}
        onPersist={(exerciseId) => updateRow('program_exercises', swapSlot.id, { swap_to_exercise_id: exerciseId, updated_at: new Date().toISOString() })}
        onClearDefault={() => updateRow('program_exercises', swapSlot.id, { swap_to_exercise_id: null, updated_at: new Date().toISOString() })}
        onAddCustom={() => setCustomOpen(true)}
      />

      <CustomExerciseSheet
        open={customOpen}
        onClose={() => { setCustomOpen(false); setSwapSlotId(null) }}
        user={workout ? { id: workout.user_id } : null}
        onCreated={(ex) => {
          if (swapSlot) { patchSlot(swapSlot.id, { swapped_exercise_id: ex.id }) }
          setCustomOpen(false)
          setSwapSlotId(null)
        }}
      />

      <SessionTimeSheet
        open={timeOpen}
        onClose={() => setTimeOpen(false)}
        workout={workout}
        onSave={(patch) => updateRow('workouts', workoutId, { ...patch, updated_at: new Date().toISOString() })}
      />

      <FinishSheet
        open={finishOpen}
        onClose={() => setFinishOpen(false)}
        startedAt={workout.started_at}
        workout={workout}
        targetSets={totalTarget}
        doneSets={workingDone}
        onFinish={finishWorkout}
      />
    </div>
  )
}
