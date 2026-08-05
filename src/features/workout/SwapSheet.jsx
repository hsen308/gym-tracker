// Substitute an exercise mid-session. The program plans for this explicitly
// ("if leg press bothers you, use a Belt Squat"; "hack squat — test light
// first, swap if it doesn't feel clean"), and an SI flare-up is not
// something you handle by editing config later.
//
// Filtered to the same primary_muscle (build-plan §7) so a swap can't
// quietly turn leg day into arm day. Sets record the real exercise_id, so
// history and PRs stay attached to whatever you actually lifted.
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/dexie'
import Sheet from '../../components/Sheet'

export default function SwapSheet({ open, onClose, exercise, onSwap, isSwapped, onRevert }) {
  const alternatives = useLiveQuery(
    () => (exercise
      ? db.exercises
          .where('primary_muscle').equals(exercise.primary_muscle)
          .filter((e) => e.id !== exercise.id && !e.deleted_at)
          .toArray()
      : []),
    [exercise?.id, exercise?.primary_muscle],
  )

  return (
    <Sheet open={open} onClose={onClose}>
      <h2 className="sheet-title">Swap exercise</h2>
      <p className="muted" style={{ fontSize: 13, marginBottom: 'var(--space-5)', lineHeight: 1.5 }}>
        Same muscle, this session only. Your program stays as written.
      </p>

      {isSwapped && (
        <button className="btn btn-secondary pressable btn-block" style={{ marginBottom: 'var(--space-4)' }} onClick={onRevert}>
          Back to {exercise?.name}
        </button>
      )}

      <div className="panel rule-list">
        {(alternatives ?? []).map((alt) => (
          <button key={alt.id} className="day-row pressable" onClick={() => onSwap(alt)}>
            <span className="day-row-name">{alt.name}</span>
            {alt.si_risk === 'caution' && <span className="si-mark">SI</span>}
            <span className="mono faint" style={{ fontSize: 11 }}>{alt.equipment}</span>
          </button>
        ))}
        {alternatives?.length === 0 && (
          <p className="empty" style={{ padding: 'var(--space-5)' }}>
            No other exercise in the library targets {exercise?.primary_muscle?.replace(/_/g, ' ')}.
          </p>
        )}
      </div>
    </Sheet>
  )
}
