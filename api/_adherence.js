// Adherence helpers for the message server — the same definitions the app
// uses in src/lib/adherence.js, duplicated here so the API folder never
// imports across into client source (they ship as separate units).
const DAY_MS = 86_400_000

// Monday-anchored week key in UTC. The `T12:00:00Z` guard keeps a stored
// date from ever landing on the wrong side of a midnight/dst boundary.
export function weekKey(date) {
  const d = new Date(String(date).length === 10 ? date + 'T12:00:00Z' : date)
  const dayOfWeek = (d.getUTCDay() + 6) % 7 // 0 = Monday
  d.setUTCDate(d.getUTCDate() - dayOfWeek)
  d.setUTCHours(0, 0, 0, 0)
  return d.toISOString().slice(0, 10)
}

export function weeklyAdherence(workouts, sessionsPerWeek, weeks = 8, today = new Date()) {
  if (!sessionsPerWeek) return []

  const done = {}
  for (const w of workouts ?? []) {
    if (w.deleted_at || !w.finished_at) continue
    const k = weekKey(w.date)
    done[k] = (done[k] ?? 0) + 1
  }

  const out = []
  for (let i = weeks - 1; i >= 0; i--) {
    const monday = new Date(today.getTime() - i * 7 * DAY_MS)
    const k = weekKey(monday)
    const completed = done[k] ?? 0
    out.push({
      week: k,
      completed,
      target: sessionsPerWeek,
      pct: Math.min(100, Math.round((completed / sessionsPerWeek) * 100)),
      isCurrent: i === 0,
    })
  }
  return out
}

export function weekStreak(weeks, threshold = 0.75) {
  let streak = 0
  for (let i = weeks.length - 1; i >= 0; i--) {
    if (weeks[i].isCurrent) continue
    if (weeks[i].completed / weeks[i].target >= threshold) streak++
    else break
  }
  return streak
}

// { pct, streak } over the completed weeks, or null when there is no
// finished week to measure yet.
export function adherenceHabit(done, sessionsPerWeek, ref) {
  const weeks = weeklyAdherence(done, sessionsPerWeek, 8, new Date(ref + 'T12:00:00Z'))
  const complete = weeks.filter((w) => !w.isCurrent)
  if (!complete.length) return null
  const doneCount = complete.reduce((s, w) => s + w.completed, 0)
  const target = complete.reduce((s, w) => s + w.target, 0)
  if (!target) return null
  return { pct: Math.round((doneCount / target) * 100), streak: weekStreak(weeks) }
}