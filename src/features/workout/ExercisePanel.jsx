// useState + useEffect together, for a reason: `draft` is local, per-panel
// UI state — the numbers currently sitting in the steppers, not yet
// confirmed — so it has no business living in Dexie. useEffect re-seeds it
// whenever the "next set to log" changes, e.g. right after a confirm bumps
// the set number forward.
import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, getLastPerformanceByExercise } from '../../db/dexie'
import { isPR } from '../../lib/calc'
import SetRow from './SetRow'

export default function ExercisePanel({
  exercise,
  programExercise,
  confirmedSets,
  workoutId,
  isExpanded,
  onToggleExpand,
  onConfirmSet,
  onRemoveSet,
  onOpenCues,
}) {
  const targetSets = programExercise?.target_sets ?? 3
  const nextSetNumber = confirmedSets.length + 1

  const lastPerformance = useLiveQuery(
    () => getLastPerformanceByExercise(exercise.id, workoutId),
    [exercise.id, workoutId],
  )

  // PR baseline: every non-warmup set ever logged for this exercise from
  // OTHER, already-existing sessions. Simplification worth knowing: a set
  // confirmed earlier in TODAY'S session isn't in this baseline, so a
  // same-session "PR of a PR" won't get a second flash. Never crosses
  // exercise substitutions, since it's filtered by this exact exercise_id.
  const historicalSets = useLiveQuery(
    () => db.sets.where('exercise_id').equals(exercise.id).filter((s) => s.workout_id !== workoutId && !s.is_warmup).toArray(),
    [exercise.id, workoutId],
  )

  const [draft, setDraft] = useState(() => seedDraft(nextSetNumber, lastPerformance, confirmedSets))
  useEffect(() => {
    setDraft(seedDraft(nextSetNumber, lastPerformance, confirmedSets))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nextSetNumber, lastPerformance])

  const header = (
    <button
      className={`exercise-row pressable ${isExpanded ? 'exercise-row-active' : ''}`}
      onClick={isExpanded ? onOpenCues : onToggleExpand}
    >
      <span>
        {exercise.name}
        {exercise.si_risk === 'caution' && <span className="warn-dot" aria-hidden />}
      </span>
      <span className="mono muted">{confirmedSets.length}/{targetSets}</span>
    </button>
  )

  if (!isExpanded) return header

  return (
    <div className="exercise-panel">
      {header}
      {confirmedSets.map((s) => (
        <SetRow
          key={s.id}
          setNumber={s.set_number}
          confirmedSet={s}
          isPR={historicalSets ? isPR(s, historicalSets) : false}
          onRemove={() => onRemoveSet(s.id)}
        />
      ))}
      <SetRow
        setNumber={nextSetNumber}
        draft={draft}
        onDraftChange={setDraft}
        onConfirm={() => onConfirmSet({ ...draft, set_number: nextSetNumber })}
      />
    </div>
  )
}

// Pre-fill priority: what you did on this exact set number last time this
// exercise was performed → otherwise whatever you just logged as the
// previous set in THIS session (so an extra added set inherits sane
// numbers) → otherwise a bare-minimum default for a cold start.
function seedDraft(setNumber, lastPerformance, confirmedSets) {
  const last = lastPerformance?.[setNumber]
  const previousConfirmed = confirmedSets[confirmedSets.length - 1]
  return {
    weight_kg: last?.weight_kg ?? previousConfirmed?.weight_kg ?? 0,
    reps: last?.reps ?? previousConfirmed?.reps ?? 0,
    rir: last?.rir ?? previousConfirmed?.rir ?? 2,
  }
}
