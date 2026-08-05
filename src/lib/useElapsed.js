import { useEffect, useState } from 'react'

// build-plan §0 rule 4, same pattern as RestTimer: never count with
// setInterval directly. The interval here only forces a re-render — the
// actual elapsed value is recomputed fresh from `startedAt` every time, so
// a screen lock that pauses JS for 10 minutes just means the next tick
// jumps straight to the correct value instead of drifting.
export function useElapsedSeconds(startedAt, intervalMs = 1000) {
  const [, tick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  if (!startedAt) return 0
  return (Date.now() - new Date(startedAt).getTime()) / 1000
}
