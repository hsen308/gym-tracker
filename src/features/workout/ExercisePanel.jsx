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
import PainControl from './PainControl'
import Icon from '../../components/Icon'

export default function ExercisePanel({
  exercise, programExercise, confirmedSets, workoutId, index, phase,
  isExpanded, onToggleExpand, onConfirmSet, onRemoveSet, onOpenCues,
  onOpenSwap, isSwapped, painLevel, onPainChange,
}) {
  const isDuration = exercise.tracks === 'duration'
  const isCompound = (programExercise?.rest_seconds ?? 0) >= 120
  // Weeks 1–3 and deload weeks change how many sets today actually calls for.
  const targetSets = adjustedSets(programExercise?.target_sets ?? 3, phase, isCompound)

  const working = confirmedSets.filter((s) => !s.is_warmup)
  const warmups = confirmedSets.filter((s) => s.is_warmup)
  const nextSetNumber = working.length + 1

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

  // Group history into sessions so we can show the last few, and feed the
  // most recent one to the progression rule.
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

  const [draft, setDraft] = useState(null)
  useEffect(() => {
    setDraft(seedDraft({ nextSetNumber, lastPerformance, working, programExercise, isDuration, advice, phase }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nextSetNumber, lastPerformance, advice?.nextWeight])

  const complete = working.length >= targetSets

  const header = (
    <button
      className={`ex-row pressable ${isExpanded ? 'is-open' : ''}`}
      onClick={isExpanded ? onOpenCues : onToggleExpand}
    >
      <span className="ex-row-index">{String(index).padStart(2, '0')}</span>
      <span className="ex-row-name">
        <span className="ex-row-title">{exercise.name}</span>
        {isSwapped && <span className="si-mark">SWAP</span>}
        {programExercise?.is_strength_lift && <span className="strength-tag">STR</span>}
        {exercise.si_risk === 'caution' && <span className="si-mark">SI</span>}
      </span>
      <span className={`ex-row-count ${complete ? 'is-done' : ''}`}>{working.length}/{targetSets}</span>
    </button>
  )

  if (!isExpanded) return header

  const repTarget = isDuration
    ? `${programExercise.rep_min}–${programExercise.rep_max}s`
    : `${programExercise.rep_min}–${programExercise.rep_max} reps`
  const rirTarget = phase?.rir
    ? ` · RIR ${phase.rir}`
    : programExercise?.target_rir_min != null
      ? ` · RIR ${programExercise.target_rir_min}${programExercise.target_rir_max !== programExercise.target_rir_min ? `–${programExercise.target_rir_max}` : ''}`
      : ''

  const addWarmups = () => {
    const ramp = warmupRamp(draft?.weight_kg, exercise.equipment)
    ramp.forEach((step, i) => onConfirmSet({ ...step, rir: null, is_warmup: true, set_number: i + 1 }))
  }

  return (
    <div className="ex-panel">
      {header}

      <p className="ex-target">
        {targetSets} × {repTarget}{rirTarget} · {programExercise.rest_seconds}s rest
        {programExercise.notes && <span className="faint"> · {programExercise.notes}</span>}
      </p>

      {/* The progression prompt — the program's central rule, applied for you
          instead of being worked out mid-set. */}
      {advice && (
        <div className={`advice advice-${advice.action}`}>
          <p className="advice-main">{advice.message}</p>
          {advice.detail && <p className="advice-detail">{advice.detail}</p>}
        </div>
      )}

      {sessions.length > 0 && (
        <p className="ex-history">
          {sessions.slice(0, 3).map((s, i) => (
            <span key={i}>
              {i > 0 && <span className="faint"> · </span>}
              {summarise(s.sets, isDuration)}
            </span>
          ))}
        </p>
      )}

      <div className="ex-actions">
        <button className="ex-action pressable" onClick={onOpenSwap}>
          <Icon name="swap" size={15} /> Swap
        </button>
        {programExercise?.is_strength_lift && !isDuration && warmups.length === 0 && (
          <button className="ex-action pressable" onClick={addWarmups}>
            <Icon name="plus" size={15} /> Warm-up ramp
          </button>
        )}
        <button className="ex-action pressable" onClick={onOpenCues}>
          <Icon name="info" size={15} /> Cues
        </button>
      </div>

      {warmups.map((s) => (
        <SetRow key={s.id} setNumber={s.set_number} confirmedSet={s} tracks={exercise.tracks} isWarmup onRemove={() => onRemoveSet(s.id)} />
      ))}
      {working.map((s) => (
        <SetRow
          key={s.id}
          setNumber={s.set_number}
          confirmedSet={s}
          tracks={exercise.tracks}
          isPR={historicalSets ? isPR(s, historicalSets) : false}
          onRemove={() => onRemoveSet(s.id)}
        />
      ))}

      {draft && (
        <SetRow
          setNumber={nextSetNumber}
          draft={draft}
          tracks={exercise.tracks}
          equipment={exercise.equipment}
          isExtra={nextSetNumber > targetSets}
          onDraftChange={setDraft}
          onConfirm={() => onConfirmSet({ ...draft, set_number: nextSetNumber })}
        />
      )}

      {/* Only on the lifts the program flags — asking after every cable curl
          would train you to ignore it (apple-design §13: over-feedback). */}
      {exercise.si_risk === 'caution' && (
        <PainControl value={painLevel} onChange={onPainChange} />
      )}
    </div>
  )
}

const summarise = (sets, isDuration) => {
  if (isDuration) return `${sets.map((s) => s.duration_seconds ?? 0).join('/')}s`
  const w = sets[0]?.weight_kg
  const sameWeight = sets.every((s) => s.weight_kg === w)
  return sameWeight
    ? `${formatWeight(w)}×${sets.map((s) => s.reps).join(',')}`
    : sets.map((s) => `${formatWeight(s.weight_kg)}×${s.reps}`).join(' ')
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
    // A reduced-load week (return protocol, deload) scales the suggestion —
    // otherwise the app would quietly recommend a full-load session in a week
    // the program deliberately pulls back.
    weight_kg: prev ? base : adjustedWeight(base, phase),
    reps: last?.reps ?? prev?.reps ?? programExercise?.rep_min ?? 8,
    rir: last?.rir ?? prev?.rir ?? programExercise?.target_rir_max ?? 2,
  }
}
