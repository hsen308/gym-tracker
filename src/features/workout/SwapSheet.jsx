// Substitute an exercise mid-session. The program plans for this explicitly
// ("if leg press bothers you, use a Belt Squat"; "hack squat — test light
// first, swap if it doesn't feel clean"), and an SI flare-up is not
// something you handle by editing config later.
//
// Filtered to the same primary_muscle (build-plan §7) so a swap can't
// quietly turn leg day into arm day. Sets record the real exercise_id, so
// history and PRs stay attached to whatever you actually lifted.
//
// A swap is normally remembered: it updates the slot's default, so the
// substitute carries into every future session rather than having to be
// re-chosen each time you train that day.
import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/dexie'
import Sheet from '../../components/Sheet'

export default function SwapSheet({
  open, onClose, exercise, onSwap, isSwapped, onRevert,
  defaultSwapId, onPersist, onClearDefault, onAddCustom,
}) {
  const alternatives = useLiveQuery(
    () => (exercise
      ? db.exercises
          .where('primary_muscle').equals(exercise.primary_muscle)
          .filter((e) => e.id !== exercise.id && !e.deleted_at)
          .sortBy('name')
      : []),
    [exercise?.id, exercise?.primary_muscle],
  )

  const hasDefault = isSwapped && defaultSwapId
  const [remember, setRemember] = useState(true)

  // "Remember" is about the swap you're making right now, not a mode left on
  // from last time — reset it whenever the sheet opens.
  useEffect(() => { if (open) setRemember(true) }, [open])

  const handleSwap = (alt) => {
    onSwap(alt)
    if (remember) onPersist(alt.id)
  }
  const handleRevert = () => {
    onRevert()
    if (remember) onClearDefault()
  }

  return (
    <Sheet open={open} onClose={onClose}>
      <h2 className="sheet-title">Swap exercise</h2>
      <p className="muted" style={{ fontSize: 13, marginBottom: 'var(--space-5)', lineHeight: 1.5 }}>
        Same muscle. {hasDefault ? 'Currently the default for this slot — pick another, or revert below.' : 'Swap this session, or remember it so the swap carries into future sessions.'}
      </p>

      {isSwapped && (
        <button className="btn btn-secondary pressable btn-block" style={{ marginBottom: 'var(--space-4)' }} onClick={handleRevert}>
          Back to {exercise?.name}
        </button>
      )}

      <div className="panel rule-list">
        {(alternatives ?? []).map((alt) => (
          <button
            key={alt.id}
            className="day-row pressable"
            style={alt.id === defaultSwapId ? { boxShadow: 'inset 0 0 0 1px var(--pr)' } : undefined}
            onClick={() => handleSwap(alt)}
          >
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

      <button
        type="button"
        className={`remember-toggle pressable ${remember ? 'is-on' : ''}`}
        onClick={() => setRemember((r) => !r)}
      >
        <span className="remember-check">{remember ? '✓' : ''}</span>
        Remember this swap for next time
      </button>

      <button type="button" className="link-action pressable" style={{ marginTop: 'var(--space-3)' }} onClick={onAddCustom}>
        Don&apos;t see it? Add your own exercise
      </button>
    </Sheet>
  )
}