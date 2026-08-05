import { useRef, useState } from 'react'
import Stepper from '../../components/Stepper'
import Icon from '../../components/Icon'
import { formatWeight } from '../../lib/format'
import { WEIGHT_STEP_KG, WEIGHT_STEP_KG_LONG_PRESS, HOLD_TO_DELETE_MS } from '../../lib/constants'

export default function SetRow({ setNumber, draft, onDraftChange, onConfirm, confirmedSet, isPR, onRemove, tracks = 'weight_reps' }) {
  const isDuration = tracks === 'duration'

  // build-plan §9: "double-tap on confirm creates duplicate sets." A short
  // disable window after the first tap absorbs the second.
  const [confirming, setConfirming] = useState(false)
  const handleConfirm = () => {
    if (confirming) return
    setConfirming(true)
    onConfirm()
    setTimeout(() => setConfirming(false), 400)
  }

  // Removing a logged set requires a HOLD, not a tap (§9: "sweaty thumbs
  // mis-tap; destructive actions require a swipe, not a tap"). The row fills
  // from the left while held so the action is visible before it commits —
  // a silent 600ms timer gives no way to realise you're about to delete.
  const holdTimer = useRef(null)
  const holdStart = useRef(0)
  const holdRaf = useRef(null)
  const [holdPct, setHoldPct] = useState(0)

  const beginHold = () => {
    holdStart.current = Date.now()
    holdTimer.current = setTimeout(onRemove, HOLD_TO_DELETE_MS)
    const tick = () => {
      const pct = Math.min(100, ((Date.now() - holdStart.current) / HOLD_TO_DELETE_MS) * 100)
      setHoldPct(pct)
      if (pct < 100) holdRaf.current = requestAnimationFrame(tick)
    }
    holdRaf.current = requestAnimationFrame(tick)
  }
  const cancelHold = () => {
    clearTimeout(holdTimer.current)
    cancelAnimationFrame(holdRaf.current)
    setHoldPct(0)
  }

  if (confirmedSet) {
    return (
      <div
        className={`set-done ${holdPct > 0 ? 'is-holding' : ''}`}
        style={{ '--hold': `${holdPct}%` }}
        onPointerDown={beginHold}
        onPointerUp={cancelHold}
        onPointerLeave={cancelHold}
        onPointerCancel={cancelHold}
      >
        <span className="set-row-index">{String(setNumber).padStart(2, '0')}</span>
        <span className="set-done-load">
          {confirmedSet.duration_seconds != null
            ? `${confirmedSet.duration_seconds}s`
            : `${formatWeight(confirmedSet.weight_kg)} × ${confirmedSet.reps}`}
        </span>
        {confirmedSet.rir != null && <span className="set-done-rir">RIR {confirmedSet.rir}</span>}
        {isPR && <span className="pr-chip">PR</span>}
      </div>
    )
  }

  return (
    <div className="set-row">
      <span className="set-row-index">{String(setNumber).padStart(2, '0')}</span>
      {isDuration ? (
        // Planks, side planks and farmer's holds are prescribed in seconds by
        // the program — a weight × reps input would be meaningless for them.
        <Stepper
          label="secs" value={draft.duration_seconds} step={5} longPressStep={15} min={0}
          onChange={(duration_seconds) => onDraftChange({ ...draft, duration_seconds })}
        />
      ) : (
        <>
          <Stepper
            label="kg" value={draft.weight_kg} step={WEIGHT_STEP_KG} longPressStep={WEIGHT_STEP_KG_LONG_PRESS}
            format={formatWeight} onChange={(weight_kg) => onDraftChange({ ...draft, weight_kg })}
          />
          <Stepper label="reps" value={draft.reps} step={1} min={0} onChange={(reps) => onDraftChange({ ...draft, reps })} />
          <Stepper label="rir" value={draft.rir} step={1} min={0} max={10} onChange={(rir) => onDraftChange({ ...draft, rir })} />
        </>
      )}
      <button
        className="btn btn-primary pressable set-confirm"
        onClick={handleConfirm}
        disabled={confirming}
        aria-label={`confirm set ${setNumber}`}
      >
        <Icon name="check" size={20} strokeWidth={2} />
      </button>
    </div>
  )
}
