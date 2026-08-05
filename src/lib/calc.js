// build-plan.md §8 — the only math in the app that matters for progress tracking.

// Estimated 1RM, Epley adjusted for reps left in reserve.
// Comparable across different rep/effort combinations — this is the
// real progress signal, not top-set weight.
export const e1rm = ({ weight_kg, reps, rir = 0 }) =>
  weight_kg * (1 + (reps + rir) / 30)

// Weekly volume: a set counts fully for its primary muscle,
// half for each secondary. Matches how the meta-analyses count.
export const setContribution = (exercise) => [
  [exercise.primary_muscle, 1.0],
  ...exercise.secondary_muscles.map((m) => [m, 0.5]),
]

// Least-squares slope. Used for bodyweight trend and stall detection.
export const slope = (points) => {
  const n = points.length
  if (n < 2) return 0
  const mx = points.reduce((s, p) => s + p.x, 0) / n
  const my = points.reduce((s, p) => s + p.y, 0) / n
  const num = points.reduce((s, p) => s + (p.x - mx) * (p.y - my), 0)
  const den = points.reduce((s, p) => s + (p.x - mx) ** 2, 0)
  return den === 0 ? 0 : num / den
}

export const movingAverage = (series, window = 7) =>
  series.map((_, i) => {
    const slice = series.slice(Math.max(0, i - window + 1), i + 1)
    return { ...series[i], avg: slice.reduce((s, d) => s + d.value, 0) / slice.length }
  })

// A set is a PR if its e1RM exceeds every previous non-warmup set for that
// exercise. `previousSets` should already be filtered to the same exercise_id.
export const isPR = (newSet, previousSets) => {
  const candidateE1rm = e1rm(newSet)
  return previousSets
    .filter((s) => !s.is_warmup)
    .every((s) => e1rm(s) < candidateE1rm)
}
