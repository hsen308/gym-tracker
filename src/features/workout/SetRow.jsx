import { formatWeightIn } from '../../lib/units'
import { useUnit } from '../../app/ProfileProvider'
import { describeLoad, supportsLoadModes } from '../../lib/loadMode'

// A set that's already been logged: one dense, tappable line.
// Tapping opens the editor (ExercisePanel owns that sheet) — the previous
// build only offered hold-to-delete, which is the wrong tool for the common
// case of "I typed 7 instead of 8".
export default function SetRow({ setNumber, confirmedSet, exercise, isPR, isWarmup, isDrop, onEdit }) {
  const unit = useUnit()
  const isDuration = confirmedSet.duration_seconds != null
  const perSide = exercise?.is_unilateral ? '/side' : ''

  return (
    <button className={`set-done pressable ${isWarmup ? 'is-warmup' : ''} ${isDrop ? 'is-drop' : ''}`} onClick={onEdit}>
      <span className="set-row-index">{isDrop ? '↳' : isWarmup ? 'W' : String(setNumber).padStart(2, '0')}</span>
      <span className="set-done-load">
        {isDuration
          ? `${confirmedSet.duration_seconds}s${perSide}`
          : supportsLoadModes(exercise)
            ? `${describeLoad(confirmedSet, (kg) => formatWeightIn(kg, unit))} × ${confirmedSet.reps}${perSide}`
            : `${formatWeightIn(confirmedSet.weight_kg, unit)} × ${confirmedSet.reps}${perSide}`}
      </span>
      {/* "2 left" reads at a glance; "RIR 2" needs decoding. Same column. */}
      {confirmedSet.rir != null && !isDuration && (
        <span className="set-done-rir">{confirmedSet.rir === 0 ? 'to failure' : `${confirmedSet.rir} left`}</span>
      )}
      {isPR && <span className="pr-chip">PR</span>}
    </button>
  )
}
