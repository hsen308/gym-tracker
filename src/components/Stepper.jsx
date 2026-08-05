// useRef: a box that holds a value across re-renders WITHOUT causing a
// re-render when it changes (unlike useState). Perfect for timer ids — we
// need to remember them to cancel later, but showing them on screen makes
// no sense.
import { useEffect, useRef } from 'react'
import Icon from './Icon'

// A controlled component: it owns no state of its own. The parent passes
// `value` and an `onChange` callback; this just renders buttons that call it.
// Standard React pattern — data flows down via props, changes flow up via
// callbacks.
export default function Stepper({ label, value, onChange, step = 1, longPressStep, min = 0, max = Infinity, format = (v) => v }) {
  const holdTimeout = useRef(null)
  const holdInterval = useRef(null)
  // Held in a ref, not state: the repeat callback below is created once per
  // press, so reading `value` from props inside it would capture a stale
  // value and every repeat would apply to the same starting number.
  const latest = useRef(value)
  latest.current = value

  const bump = (delta) => {
    const next = Math.min(max, Math.max(min, Math.round((latest.current + delta) * 100) / 100))
    latest.current = next
    onChange(next)
  }

  // apple-design §1: react on pointer-down, not click — click waits for
  // pointer-up, which reads as laggy on a screen you're jabbing mid-set.
  // Holding repeats at the bigger step (2.5kg tap → 5kg long-press, per
  // build-plan §7) so loading a heavy bar doesn't take twenty taps.
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
    <div className="stepper-wrap">
      {label && <span className="label" style={{ display: 'block', marginBottom: 6 }}>{label}</span>}
      <div className="stepper">
        <button
          type="button"
          aria-label={`decrease ${label || 'value'}`}
          className="stepper-btn pressable"
          onPointerDown={() => startHold(-step, longPressStep ? -longPressStep : null)}
          onPointerUp={endHold}
          onPointerLeave={endHold}
          onPointerCancel={endHold}
        >
          <Icon name="minus" size={18} />
        </button>
        <span className="stepper-value">{format(value)}</span>
        <button
          type="button"
          aria-label={`increase ${label || 'value'}`}
          className="stepper-btn pressable"
          onPointerDown={() => startHold(step, longPressStep ?? null)}
          onPointerUp={endHold}
          onPointerLeave={endHold}
          onPointerCancel={endHold}
        >
          <Icon name="plus" size={18} />
        </button>
      </div>
    </div>
  )
}
