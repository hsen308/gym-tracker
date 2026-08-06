import { formatWeight } from '../../lib/format'

// A set that's already been logged: one dense, tappable line.
// Tapping opens the editor (ExercisePanel owns that sheet) — the previous
// build only offered hold-to-delete, which is the wrong tool for the common
// case of "I typed 7 instead of 8".
export default function SetRow({ setNumber, confirmedSet, isPR, isWarmup, onEdit }) {
  const isDuration = confirmedSet.duration_seconds != null

  return (
    <button className={`set-done pressable ${isWarmup ? 'is-warmup' : ''}`} onClick={onEdit}>
      <span className="set-row-index">{isWarmup ? 'W' : String(setNumber).padStart(2, '0')}</span>
      <span className="set-done-load">
        {isDuration
          ? `${confirmedSet.duration_seconds}s`
          : `${formatWeight(confirmedSet.weight_kg)} × ${confirmedSet.reps}`}
      </span>
      {/* "2 left" reads at a glance; "RIR 2" needs decoding. Same column. */}
      {confirmedSet.rir != null && !isDuration && (
        <span className="set-done-rir">{confirmedSet.rir === 0 ? 'to failure' : `${confirmedSet.rir} left`}</span>
      )}
      {isPR && <span className="pr-chip">PR</span>}
    </button>
  )
}
