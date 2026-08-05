import { useEffect, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { formatDuration } from '../../lib/format'
import Button from '../../components/Button'

// Two short tones synthesised on the fly — no audio asset to ship, cache or
// fail to load. Wrapped in try/catch because Safari refuses to create an
// AudioContext until the page has had a user gesture, and a rest timer that
// throws on some devices is worse than one that's silent on them.
function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    ;[0, 0.18].forEach((offset) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = 880
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + offset)
      gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + offset + 0.01)
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + offset + 0.14)
      osc.connect(gain).connect(ctx.destination)
      osc.start(ctx.currentTime + offset)
      osc.stop(ctx.currentTime + offset + 0.15)
    })
    setTimeout(() => ctx.close(), 800)
  } catch {
    // No audio available — the vibration and the inverted screen still fire.
  }
}

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
      beep() // vibration alone is easy to miss with headphones in
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
