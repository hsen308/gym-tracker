// Adherence — sessions you actually did against sessions the programme
// asked for.
//
// This exists because "training on and off for four years" is a pattern that
// is invisible from inside it. Every individual week feels reasonable; the
// gaps only show up when you count. A number you can see is harder to argue
// with than a memory.

const DAY_MS = 86_400_000

// Monday-anchored week key, so weeks line up with the programme's own layout
// rather than with whatever day you happened to start.
export function weekKey(date) {
  const d = new Date(date)
  const dayOfWeek = (d.getDay() + 6) % 7 // 0 = Monday
  d.setDate(d.getDate() - dayOfWeek)
  d.setHours(0, 0, 0, 0)
  return d.toISOString().slice(0, 10)
}

// `workouts` = every non-deleted workout. `sessionsPerWeek` = how many the
// programme expects (6 for the PPL, 4 for upper/lower).
//
// Only completed sessions count. A skipped session is honest record-keeping,
// not credit — counting it would defeat the entire point of measuring this.
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
      // Capped at 100: doing seven sessions in a six-session week is not
      // 117% adherent, it's a week you'll pay for later.
      pct: Math.min(100, Math.round((completed / sessionsPerWeek) * 100)),
      isCurrent: i === 0,
    })
  }
  return out
}

// The headline number. Excludes the current week, which is always partial
// and would drag the average down every Monday for no reason.
export function overallAdherence(weeks) {
  const complete = weeks.filter((w) => !w.isCurrent)
  if (!complete.length) return null
  const done = complete.reduce((s, w) => s + w.completed, 0)
  const target = complete.reduce((s, w) => s + w.target, 0)
  return target ? Math.round((done / target) * 100) : null
}

// Consecutive weeks hitting at least `threshold` of the target, counting back
// from the most recent COMPLETE week. Consistency is the thing being measured,
// so a streak of good weeks is the honest unit — not a streak of days.
export function weekStreak(weeks, threshold = 0.75) {
  let streak = 0
  for (let i = weeks.length - 1; i >= 0; i--) {
    if (weeks[i].isCurrent) continue
    if (weeks[i].completed / weeks[i].target >= threshold) streak++
    else break
  }
  return streak
}
