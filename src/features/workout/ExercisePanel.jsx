// useState + useEffect together, for a reason: `draft` is local, per-panel UI
// state — the numbers currently in the steppers, not yet confirmed — so it has
// no business living in Dexie. The effect re-seeds it whenever the "next set
// to log" changes, e.g. right after a confirm bumps the set number.
import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, getLastPerformanceByExercise } from '../../db/dexie'
import { isPR } from '../../lib/calc'
import { progressionAdvice, warmupRamp } from '../../lib/progression'
import { adjustedSets, adjustedWeight } from '../../lib/phase'
import { formatWeight } from '../../lib/format'
import SetRow from './SetRow'
import SetEditor from './SetEditor'
import PainControl from './PainControl'
import Sheet from '../../components/Sheet'
import Icon from '../../components/Icon'

export default function ExercisePanel({
  exercise, programExercise, confirmedSets, workoutId, index, phase,
  isExpanded, onToggleExpand, onConfirmSet, onUpdateSet, onRemoveSet, onOpenCues,
  onOpenSwap, isSwapped, painLevel, onPainChange,
}) {
  const isDuration = exercise.tracks === 'duration'
  const isCompound = (programExercise?.rest_seconds ?? 0) >= 120
  // Weeks 1–3 and deload weeks change how many sets today actually calls for.
  const targetSets = adjustedSets(programExercise?.target_sets ?? 3, phase, isCompound)

  const working = confirmedSets.filter((s) => !s.is_warmup)
  const warmups = confirmedSets.filter((s) => s.is_warmup)
  const nextSetNumber = working.length + 1

  const [editingSet, setEditingSet] = useState(null)
  const [editDraft, setEditDraft] = useState(null)

  const lastPerformance = useLiveQuery(
    () => getLastPerformanceByExercise(exercise.id, workoutId),
    [exercise.id, workoutId],
  )

  // Every non-warmup set ever logged for this exercise in OTHER sessions —
  // the PR baseline, and the raw material for the progression prompt and the
  // recent-history line.
  const historicalSets = useLiveQuery(
    () => db.sets.where('exercise_id').equals(exercise.id)
      .filter((s) => s.workout_id !== workoutId && !s.is_warmup && !s.deleted_at).toArray(),
    [exercise.id, workoutId],
  )

  const sessions = useMemo(() => {
    if (!historicalSets?.length) return []
    const byWorkout = {}
    for (const s of historicalSets) (byWorkout[s.workout_id] ??= []).push(s)
    return Object.values(byWorkout)
      .map((list) => ({
        at: list.reduce((max, s) => (s.completed_at > max ? s.completed_at : max), list[0].completed_at),
        sets: [...list].sort((a, b) => a.set_number - b.set_number),
      }))
      .sort((a, b) => new Date(b.at) - new Date(a.at))
  }, [historicalSets])

  const advice = useMemo(
    () => progressionAdvice({ lastSets: sessions[0]?.sets, programExercise, exercise }),
    [sessions, programExercise, exercise],
  )

  // What the recommended load becomes after a return/deload week scales it.
  const reducedTarget = useMemo(() => {
    if (!advice?.nextWeight || !phase || phase.loadPct >= 1) return null
    const adjusted = adjustedWeight(advice.nextWeight, phase)
    return adjusted === advice.nextWeight ? null : adjusted
  }, [advice?.nextWeight, phase])

  const [draft, setDraft] = useState(null)
  useEffect(() => {
    setDraft(seedDraft({ nextSetNumber, lastPerformance, working, programExercise, isDuration, advice, phase }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nextSetNumber, lastPerformance, advice?.nextWeight])

  const complete = working.length >= targetSets

  const header = (
    <button
      className={`ex-row pressable ${isExpanded ? 'is-open' : ''} ${complete ? 'is-complete' : ''}`}
      onClick={isExpanded ? onToggleExpand : onToggleExpand}
    >
      <span className="ex-row-index">{String(index).padStart(2, '0')}</span>
      <span className="ex-row-name">
        <span className="ex-row-title">{exercise.name}</span>
        {isSwapped && <span className="tag tag-swap">SWAP</span>}
        {programExercise?.is_strength_lift && <span className="tag tag-strength">MAIN LIFT</span>}
        {exercise.si_risk === 'caution' && <span className="tag tag-caution">SI</span>}
      </span>
      <span className={`ex-row-count ${complete ? 'is-done' : ''}`}>
        {complete && <Icon name="check" size={13} strokeWidth={2.5} />}
        {working.length}/{targetSets}
      </span>
    </button>
  )

  if (!isExpanded) return header

  const repTarget = isDuration
    ? `${programExercise.rep_min}–${programExercise.rep_max}s`
    : `${programExercise.rep_min}–${programExercise.rep_max} reps`
  const leftTarget = phase?.rir
    ? ` · leave ${phase.rir} in the tank`
    : programExercise?.target_rir_min != null
      ? ` · leave ${programExercise.target_rir_min}${programExercise.target_rir_max !== programExercise.target_rir_min ? `–${programExercise.target_rir_max}` : ''} in the tank`
      : ''

  const addWarmups = () => {
    const ramp = warmupRamp(draft?.weight_kg, exercise.equipment)
    ramp.forEach((step, i) => onConfirmSet({ ...step, rir: null, is_warmup: true, set_number: i + 1 }))
  }

  // The draft must carry ONLY the fields this exercise actually tracks.
  // Including `duration_seconds: 0` on a weight-based set made the saved row
  // read as a timed hold — SetRow treats "duration is not null" as the
  // signal, and 0 is not null.
  const openEdit = (s) => {
    setEditingSet(s)
    setEditDraft(isDuration
      ? { duration_seconds: s.duration_seconds ?? 0 }
      : { weight_kg: s.weight_kg ?? 0, reps: s.reps ?? 0, rir: s.rir ?? 0 })
  }

  return (
    <div className="ex-panel">
      {header}

      <p className="ex-target">
        {targetSets} × {repTarget}{leftTarget} · {programExercise.rest_seconds}s rest
      </p>
      {programExercise.notes && <p className="ex-note">{programExercise.notes}</p>}

      {/* The progression prompt — the program's central rule, applied for you
          instead of being worked out mid-set. */}
      {advice && (
        <div className={`advice advice-${advice.action}`}>
          <p className="advice-main">{advice.message}</p>
          {advice.detail && <p className="advice-detail">{advice.detail}</p>}
          {/* On a reduced week the advice and the pre-filled weight would
              otherwise contradict each other — "add 2.5kg → 72.5kg" above a
              stepper sitting at 40kg. Say which number applies today. */}
          {reducedTarget != null && (
            <p className="advice-today">
              {phase.kind === 'deload' ? 'Deload' : `Week ${phase.week}`} — work at {formatWeight(reducedTarget)} today.
            </p>
          )}
        </div>
      )}

      {sessions.length > 0 && (
        <p className="ex-history">
          <span className="faint">Last: </span>{summarise(sessions[0].sets, isDuration)}
        </p>
      )}

      <div className="ex-actions">
        <button className="ex-action pressable" onClick={onOpenCues}>
          <Icon name="info" size={15} /> How to do it
        </button>
        <button className="ex-action pressable" onClick={onOpenSwap}>
          <Icon name="swap" size={15} /> Swap
        </button>
        {programExercise?.is_strength_lift && !isDuration && warmups.length === 0 && (
          <button className="ex-action pressable" onClick={addWarmups}>
            <Icon name="plus" size={15} /> Warm-up ramp
          </button>
        )}
      </div>

      {(warmups.length > 0 || working.length > 0) && (
        <div className="set-list">
          {warmups.map((s) => (
            <SetRow key={s.id} setNumber={s.set_number} confirmedSet={s} isWarmup onEdit={() => openEdit(s)} />
          ))}
          {working.map((s) => (
            <SetRow
              key={s.id}
              setNumber={s.set_number}
              confirmedSet={s}
              isPR={historicalSets ? isPR(s, historicalSets) : false}
              onEdit={() => openEdit(s)}
            />
          ))}
        </div>
      )}

      {draft && (
        <div className="next-set">
          <p className="next-set-head">
            {complete ? `Extra set · ${nextSetNumber}` : `Set ${nextSetNumber} of ${targetSets}`}
          </p>
          <SetEditor
            draft={draft}
            onChange={setDraft}
            exercise={exercise}
            programExercise={programExercise}
            onSubmit={() => onConfirmSet({ ...draft, set_number: nextSetNumber })}
            submitLabel={complete ? 'Log extra set' : `Log set ${nextSetNumber}`}
          />
        </div>
      )}

      {/* Only on the lifts the program flags — asking after every cable curl
          would train you to ignore it (apple-design §13: over-feedback). */}
      {exercise.si_risk === 'caution' && (
        <PainControl value={painLevel} onChange={onPainChange} />
      )}

      <Sheet open={!!editingSet} onClose={() => setEditingSet(null)}>
        {editingSet && editDraft && (
          <>
            <h2 className="sheet-title">
              {editingSet.is_warmup ? 'Warm-up set' : `Set ${editingSet.set_number}`} · {exercise.name}
            </h2>
            <SetEditor
              draft={editDraft}
              onChange={setEditDraft}
              exercise={exercise}
              programExercise={programExercise}
              submitLabel="Save changes"
              onSubmit={() => { onUpdateSet(editingSet.id, editDraft); setEditingSet(null) }}
              onDelete={() => { onRemoveSet(editingSet.id); setEditingSet(null) }}
            />
          </>
        )}
      </Sheet>
    </div>
  )
}

const summarise = (sets, isDuration) => {
  if (isDuration) return `${sets.map((s) => s.duration_seconds ?? 0).join(' / ')}s`
  const w = sets[0]?.weight_kg
  const sameWeight = sets.every((s) => s.weight_kg === w)
  return sameWeight
    ? `${formatWeight(w)} × ${sets.map((s) => s.reps).join(', ')}`
    : sets.map((s) => `${formatWeight(s.weight_kg)}×${s.reps}`).join('  ')
}

// Pre-fill priority: the progression rule's recommendation if there is one →
// what you did on this exact set number last time → the previous set in THIS
// session (so an added set inherits sane numbers) → the programmed target, so
// a cold start still lands somewhere sensible rather than at zero.
function seedDraft({ nextSetNumber, lastPerformance, working, programExercise, isDuration, advice, phase }) {
  const last = lastPerformance?.[nextSetNumber]
  const prev = working[working.length - 1]

  if (isDuration) {
    return { duration_seconds: last?.duration_seconds ?? prev?.duration_seconds ?? programExercise?.rep_min ?? 30 }
  }

  const base = prev?.weight_kg ?? advice?.nextWeight ?? last?.weight_kg ?? 0
  return {
    weight_kg: prev ? base : adjustedWeight(base, phase),
    reps: last?.reps ?? prev?.reps ?? programExercise?.rep_min ?? 8,
    rir: last?.rir ?? prev?.rir ?? programExercise?.target_rir_max ?? 2,
  }
}
