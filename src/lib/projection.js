// "Is this actually working, and when does it finish?"
//
// The two questions that decide whether someone sticks with a cut. Both are
// answerable from data the app already has, and both are invisible without
// doing the arithmetic — which is precisely why five months of slow progress
// feels like no progress and gets abandoned at week six.
import { slope } from './calc'

const DAY_MS = 86_400_000

// Least-squares trend in units per week over a trailing window. Used for both
// bodyweight and waist, because the honest read on a cut is the direction of
// a line, never the difference between two individual readings.
export function trendPerWeek(points, days = 28, today = new Date()) {
  if (!points?.length) return null
  const cutoff = today.getTime() - days * DAY_MS
  const recent = points
    .filter((p) => p.value != null && new Date(p.date).getTime() >= cutoff)
    .map((p) => ({ x: new Date(p.date).getTime() / DAY_MS, y: p.value }))

  // Two points is a line through noise, not a trend. Four is the minimum
  // that survives one bad reading.
  if (recent.length < 4) return null
  return slope(recent) * 7
}

// Weeks to a target at the current rate. Returns null rather than a number
// when the trend is flat or pointing the wrong way — "at this rate, never"
// is information, and a made-up date would be worse than silence.
export function weeksToTarget(current, target, perWeek) {
  if (current == null || target == null || !perWeek) return null
  const remaining = target - current
  if (Math.abs(remaining) < 0.1) return 0
  // Trend must point toward the target.
  if (Math.sign(remaining) !== Math.sign(perWeek)) return null
  const weeks = remaining / perWeek
  return weeks > 0 && weeks < 260 ? Math.round(weeks) : null
}

export const addWeeks = (weeks, today = new Date()) =>
  new Date(today.getTime() + weeks * 7 * DAY_MS)

// Whether the rate is in the range that actually preserves muscle.
// Losing faster than ~1% of bodyweight a week costs lean mass; gaining
// faster than ~0.5% is mostly fat. Being too fast is a real failure mode,
// not an achievement, and nothing else in the app says so.
export function rateVerdict(perWeek, bodyweightKg, goal) {
  if (perWeek == null || !bodyweightKg) return null
  const pct = (perWeek / bodyweightKg) * 100

  if (goal === 'lose' || goal === 'recomp') {
    if (pct > 0.15) return { state: 'wrong-way', text: 'Trending up. Not a deficit yet.' }
    if (pct > -0.15) return { state: 'flat', text: 'Flat. Hold the deficit or cut ~150 kcal.' }
    if (pct < -1.1) return { state: 'too-fast', text: 'Too fast — this costs muscle. Eat a bit more.' }
    return { state: 'good', text: 'Good rate. Keep it exactly here.' }
  }
  if (goal === 'gain') {
    if (pct < -0.1) return { state: 'wrong-way', text: 'Trending down. Not a surplus yet.' }
    if (pct < 0.1) return { state: 'flat', text: 'Flat. Add ~200 kcal.' }
    if (pct > 0.6) return { state: 'too-fast', text: 'Too fast — mostly fat. Ease off ~200 kcal.' }
    return { state: 'good', text: 'Good rate. Keep it exactly here.' }
  }
  return null
}
