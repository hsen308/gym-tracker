import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { formatDuration } from '../../lib/format'

// build-plan §6d — the signature element. Bottom third of the screen,
// readable from a rack ten metres away, no interaction required.
//
// Timestamp-based per §0 rule 4: we never count seconds with setInterval —
// that drifts or simply stops firing when the screen locks, which happens
// on basically every rest period. The interval below only forces a
// re-render; `elapsed` is recomputed from real wall-clock time every tick,
// so a screen that was locked for 90 seconds just jumps straight to the
// correct remaining time the instant it wakes, instead of losing time.
export default function RestTimer({ startedAt, durationSeconds, onSkip, onComplete }) {
  const [, forceTick] = useState(0)

  useEffect(() => {
    const id = setInterval(() => forceTick((n) => n + 1), 250)
    return () => clearInterval(id)
  }, [])

  const elapsed = (Date.now() - new Date(startedAt).getTime()) / 1000
  const remaining = Math.max(0, durationSeconds - elapsed)
  const progress = Math.min(1, elapsed / durationSeconds)
  const done = remaining <= 0

  useEffect(() => {
    if (done) {
      navigator.vibrate?.(200) // feature-detected — silently no-ops where unsupported (iOS Safari)
      onComplete?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done])

  return (
    <div className={`rest-timer ${done ? 'is-done' : ''}`}>
      <motion.div
        className="rest-timer-bar"
        initial={false}
        animate={{ scaleX: Math.max(0, 1 - progress) }}
        transition={{ duration: 0.25, ease: 'linear' }}
      />
      <div className="rest-timer-content">
        <div className="numeral mono numeral-display">{formatDuration(remaining)}</div>
        <button className="btn btn-ghost pressable" onClick={onSkip}>Skip</button>
      </div>
    </div>
  )
}
