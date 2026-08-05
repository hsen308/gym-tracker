// useRef: a box that holds a value across re-renders WITHOUT causing a
// re-render when it changes (unlike useState). Perfect for timer ids —
// we need to remember them to cancel later, but showing them on screen
// makes no sense.
import { useRef } from 'react'

// A controlled component: it owns no state of its own. The parent passes
// `value` and a `onChange` callback; this just renders buttons that call it.
// This is the standard React pattern — data flows down via props, changes
// flow up via callbacks.
export default function Stepper({ label, value, onChange, step = 1, longPressStep, min = 0, max = Infinity, format = (v) => v }) {
  const holdTimeout = useRef(null)
  const holdInterval = useRef(null)

  const bump = (delta) => onChange(Math.min(max, Math.max(min, Math.round((value + delta) * 100) / 100)))

  // apple-design §1: react on pointer-down, not click — click waits for
  // pointer-up, which reads as laggy on a screen you're jabbing mid-set.
  // Holding repeats at the bigger step (2.5kg tap → 5kg long-press, per
  // build-plan §7 item 5) so loading a heavy bar doesn't take 20 taps.
  const startHold = (smallDelta, bigDelta) => {
    bump(smallDelta)
    if (!bigDelta) return
    holdTimeout.current = setTimeout(() => {
      holdInterval.current = setInterval(() => bump(bigDelta), 120)
    }, 400)
  }
  const endHold = () => {
    clearTimeout(holdTimeout.current)
    clearInterval(holdInterval.current)
  }

  return (
    <div className="stepper-wrap">
      {label && <span className="stepper-label">{label}</span>}
      <div className="stepper">
        <button
          type="button"
          aria-label={`decrease ${label || 'value'}`}
          className="stepper-btn pressable"
          onPointerDown={() => startHold(-step, longPressStep ? -longPressStep : null)}
          onPointerUp={endHold}
          onPointerLeave={endHold}
        >
          –
        </button>
        <span className="stepper-value mono">{format(value)}</span>
        <button
          type="button"
          aria-label={`increase ${label || 'value'}`}
          className="stepper-btn pressable"
          onPointerDown={() => startHold(step, longPressStep ?? null)}
          onPointerUp={endHold}
          onPointerLeave={endHold}
        >
          +
        </button>
      </div>
    </div>
  )
}
