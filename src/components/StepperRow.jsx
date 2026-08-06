import { useEffect, useRef } from 'react'
import Icon from './Icon'

// One labelled input row: what it is on the left, what it means underneath,
// and a big −/value/+ control on the right.
//
// Replaces the three cramped side-by-side steppers the logging screen used
// to have. Those fit on one line but gave each field a three-letter label
// ("kg", "rir") with no room to say what the number meant — which is exactly
// what made "is 60 kg one dumbbell or two?" and "what is RIR?" unanswerable
// at a glance. Vertical costs a little scroll and buys clarity.
export default function StepperRow({
  label, hint, value, onChange, step = 1, longPressStep,
  min = 0, max = Infinity, format = (v) => v, onHelp,
}) {
  const holdTimeout = useRef(null)
  const holdInterval = useRef(null)
  // Held in a ref, not state: the repeat callback is created once per press,
  // so reading `value` from props inside it would capture a stale value and
  // every repeat would apply to the same starting number.
  const latest = useRef(value)
  latest.current = value

  const bump = (delta) => {
    const next = Math.min(max, Math.max(min, Math.round((latest.current + delta) * 100) / 100))
    latest.current = next
    onChange(next)
  }

  // apple-design §1: react on pointer-down, not click — click waits for
  // pointer-up, which reads as laggy on a screen you're jabbing mid-set.
  const startHold = (smallDelta, bigDelta) => {
    bump(smallDelta)
    if (!bigDelta) return
    holdTimeout.current = setTimeout(() => {
      holdInterval.current = setInterval(() => bump(bigDelta), 110)
    }, 380)
  }
  const endHold = () => {
    clearTimeout(holdTimeout.current)
    clearInterval(holdInterval.current)
  }
  // Without this, unmounting mid-hold (confirming a set, closing a sheet)
  // leaves an interval running forever against a dead component.
  useEffect(() => endHold, [])

  return (
    <div className="steprow">
      <div className="steprow-meta">
        <span className="steprow-label">{label}</span>
        {hint && (
          onHelp
            ? <button type="button" className="steprow-hint is-tappable" onClick={onHelp}>{hint} <Icon name="info" size={12} /></button>
            : <span className="steprow-hint">{hint}</span>
        )}
      </div>
      <div className="steprow-control">
        <button
          type="button"
          aria-label={`decrease ${label}`}
          className="steprow-btn pressable"
          onPointerDown={() => startHold(-step, longPressStep ? -longPressStep : null)}
          onPointerUp={endHold}
          onPointerLeave={endHold}
          onPointerCancel={endHold}
        >
          <Icon name="minus" size={20} strokeWidth={2} />
        </button>
        <span className="steprow-value">{format(value)}</span>
        <button
          type="button"
          aria-label={`increase ${label}`}
          className="steprow-btn pressable"
          onPointerDown={() => startHold(step, longPressStep ?? null)}
          onPointerUp={endHold}
          onPointerLeave={endHold}
          onPointerCancel={endHold}
        >
          <Icon name="plus" size={20} strokeWidth={2} />
        </button>
      </div>
    </div>
  )
}
