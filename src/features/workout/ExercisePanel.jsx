// useState + useEffect together, for a reason: `draft` is local, per-panel UI
// state — the numbers currently sitting in the steppers, not yet confirmed —
// so it has no business living in Dexie. The effect re-seeds it whenever the
// "next set to log" changes, e.g. right after a confirm bumps the set number.
import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, getLastPerformanceByExercise } from '../../db/dexie'
import { isPR } from '../../lib/calc'
import SetRow from './SetRow'

export default function ExercisePanel({
  exercise, programExercise, confirmedSets, workoutId, index,
  isExpanded, onToggleExpand, onConfirmSet, onRemoveSet, onOpenCues,
}) {
  const targetSets = programExercise?.target_sets ?? 3
  const nextSetNumber = confirmedSets.length + 1
  const isDuration = exercise.tracks === 'duration'

  const lastPerformance = useLiveQuery(
    () => getLastPerformanceByExercise(exercise.id, workoutId),
    [exercise.id, workoutId],
  )

  // PR baseline: every non-warmup set ever logged for this exercise in OTHER
  // sessions. Worth knowing: a set confirmed earlier in TODAY'S session isn't
  // in this baseline, so a same-session "PR of a PR" won't flash twice. Never
  // crosses exercise substitutions, since it's filtered by this exercise_id.
  const historicalSets = useLiveQuery(
    () => db.sets.where('exercise_id').equals(exercise.id)
      .filter((s) => s.workout_id !== workoutId && !s.is_warmup && !s.deleted_at).toArray(),
    [exercise.id, workoutId],
  )

  const [draft, setDraft] = useState(() => seedDraft(nextSetNumber, lastPerformance, confirmedSets, programExercise, isDuration))
  useEffect(() => {
    setDraft(seedDraft(nextSetNumber, lastPerformance, confirmedSets, programExercise, isDuration))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nextSetNumber, lastPerformance])

  const complete = confirmedSets.length >= targetSets

  const header = (
    <button
      className={`ex-row pressable ${isExpanded ? 'is-open' : ''}`}
      onClick={isExpanded ? onOpenCues : onToggleExpand}
    >
      <span className="ex-row-index">{String(index).padStart(2, '0')}</span>
      <span className="ex-row-name">
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{exercise.name}</span>
        {programExercise?.is_strength_lift && <span className="strength-tag">STR</span>}
        {exercise.si_risk === 'caution' && <span className="si-mark">SI</span>}
      </span>
      <span className={`ex-row-count ${complete ? 'is-done' : ''}`}>{confirmedSets.length}/{targetSets}</span>
    </button>
  )

  if (!isExpanded) return header

  const repTarget = isDuration
    ? `${programExercise.rep_min}–${programExercise.rep_max}s`
    : `${programExercise.rep_min}–${programExercise.rep_max} reps`
  const rirTarget = programExercise?.target_rir_min != null
    ? ` · RIR ${programExercise.target_rir_min}${programExercise.target_rir_max !== programExercise.target_rir_min ? `–${programExercise.target_rir_max}` : ''}`
    : ''

  return (
    <div className="ex-panel">
      {header}
      <p className="ex-target">{targetSets} × {repTarget}{rirTarget} · {programExercise.rest_seconds}s rest</p>
      {confirmedSets.map((s) => (
        <SetRow
          key={s.id}
          setNumber={s.set_number}
          confirmedSet={s}
          tracks={exercise.tracks}
          isPR={historicalSets ? isPR(s, historicalSets) : false}
          onRemove={() => onRemoveSet(s.id)}
        />
      ))}
      <SetRow
        setNumber={nextSetNumber}
        draft={draft}
        tracks={exercise.tracks}
        onDraftChange={setDraft}
        onConfirm={() => onConfirmSet({ ...draft, set_number: nextSetNumber })}
      />
    </div>
  )
}

// Pre-fill priority: what you did on this exact set number last time this
// exercise was performed → otherwise whatever you just logged as the previous
// set in THIS session (so an added set inherits sane numbers) → otherwise the
// programmed target, so a cold start still lands somewhere sensible instead
// of at zero.
function seedDraft(setNumber, lastPerformance, confirmedSets, programExercise, isDuration) {
  const last = lastPerformance?.[setNumber]
  const prev = confirmedSets[confirmedSets.length - 1]
  if (isDuration) {
    return { duration_seconds: last?.duration_seconds ?? prev?.duration_seconds ?? programExercise?.rep_min ?? 30 }
  }
  return {
    weight_kg: last?.weight_kg ?? prev?.weight_kg ?? 0,
    reps: last?.reps ?? prev?.reps ?? programExercise?.rep_min ?? 8,
    rir: last?.rir ?? prev?.rir ?? programExercise?.target_rir_max ?? 2,
  }
}
