import { useEffect, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { formatDuration } from '../../lib/format'
import Button from '../../components/Button'

// build-plan §6d — the signature element. Bottom third of the screen,
// readable from a rack ten metres away, no interaction required.
//
// Timestamp-based per §0 rule 4: we never count seconds with setInterval —
// that drifts or stops firing when the screen locks, which happens on
// basically every rest period. The interval below only forces a re-render;
// `elapsed` is recomputed from wall-clock time every tick, so a phone locked
// for 90 seconds jumps straight to the correct remaining time on wake.
export default function RestTimer({ startedAt, durationSeconds, onSkip }) {
  const [, forceTick] = useState(0)
  const buzzed = useRef(false)

  useEffect(() => {
    const id = setInterval(() => forceTick((n) => n + 1), 250)
    return () => clearInterval(id)
  }, [])

  const elapsed = (Date.now() - new Date(startedAt).getTime()) / 1000
  const remaining = Math.max(0, durationSeconds - elapsed)
  const progress = Math.min(1, elapsed / durationSeconds)
  const done = remaining <= 0

  // Fires once, on the transition to zero. Previously this also cleared the
  // timer immediately, which meant the inverted "rest over" state never got
  // to render at all — the whole bottom third just vanished. It now stays up
  // until the next set is confirmed or it's dismissed, which is also what
  // makes it useful: you can see how far PAST your rest target you are.
  useEffect(() => {
    if (done && !buzzed.current) {
      buzzed.current = true
      navigator.vibrate?.(200) // feature-detected — silently no-ops on iOS Safari
    }
  }, [done])

  const over = elapsed - durationSeconds

  return (
    <div className={`rest ${done ? 'is-done' : ''}`}>
      <motion.div
        className="rest-fill"
        initial={false}
        animate={{ scaleX: done ? 1 : Math.max(0, 1 - progress) }}
        transition={{ duration: 0.25, ease: 'linear' }}
      />
      <div className="rest-inner">
        <span className="label rest-label">{done ? 'Rest complete' : 'Rest'}</span>
        <span className="readout readout-xl rest-time">
          {done ? `+${formatDuration(over)}` : formatDuration(remaining)}
        </span>
        <Button variant="ghost" onClick={onSkip}>{done ? 'Dismiss' : 'Skip rest'}</Button>
      </div>
    </div>
  )
}
