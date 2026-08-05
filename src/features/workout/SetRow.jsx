import { useRef, useState } from 'react'
import Stepper from '../../components/Stepper'
import { formatWeight } from '../../lib/format'
import { WEIGHT_STEP_KG, WEIGHT_STEP_KG_LONG_PRESS } from '../../lib/constants'

export default function SetRow({ setNumber, draft, onDraftChange, onConfirm, confirmedSet, isPR, onRemove }) {
  const holdTimer = useRef(null)
  // build-plan §9 known trap: "double-tap on confirm creates duplicate
  // sets." A 400ms disable window after the first tap absorbs the second.
  const [confirming, setConfirming] = useState(false)
  const handleConfirm = () => {
    if (confirming) return
    setConfirming(true)
    onConfirm()
    setTimeout(() => setConfirming(false), 400)
  }

  // Already logged: render a compact, read-only line instead of steppers —
  // this is what lets an ExercisePanel show "3/4 sets" and stay scannable.
  // Removing a mis-tap requires a HOLD, not a tap (build-plan §9: "sweaty
  // thumbs mis-tap... destructive actions require a swipe/hold, not a tap").
  if (confirmedSet) {
    return (
      <div
        className={`set-row set-row-done ${isPR ? 'is-pr' : ''}`}
        onPointerDown={() => { holdTimer.current = setTimeout(onRemove, 600) }}
        onPointerUp={() => clearTimeout(holdTimer.current)}
        onPointerLeave={() => clearTimeout(holdTimer.current)}
      >
        <span className="mono">#{setNumber}</span>
        <span className="mono">{formatWeight(confirmedSet.weight_kg)} × {confirmedSet.reps}</span>
        <span className="mono" style={{ color: 'var(--text-muted)' }}>RIR {confirmedSet.rir}</span>
        {isPR && <span style={{ color: 'var(--pr)', fontWeight: 700, fontSize: 13 }}>PR</span>}
      </div>
    )
  }

  return (
    <div className="set-row set-row-active">
      <span className="mono" style={{ width: 22 }}>#{setNumber}</span>
      <Stepper
        label="kg" value={draft.weight_kg} step={WEIGHT_STEP_KG} longPressStep={WEIGHT_STEP_KG_LONG_PRESS}
        format={formatWeight} onChange={(weight_kg) => onDraftChange({ ...draft, weight_kg })}
      />
      <Stepper label="reps" value={draft.reps} step={1} min={0} onChange={(reps) => onDraftChange({ ...draft, reps })} />
      <Stepper label="RIR" value={draft.rir} step={1} min={0} max={10} onChange={(rir) => onDraftChange({ ...draft, rir })} />
      <button className="btn btn-primary pressable set-confirm" onClick={handleConfirm} disabled={confirming} aria-label="confirm set">✓</button>
    </div>
  )
}
