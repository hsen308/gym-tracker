// Picks ONE notification from a user's real data.
//
// Generic motivation gets swiped away inside a week. Everything here is a
// specific, checkable fact about this person — a number they can verify by
// opening the app. That's the only kind of message an app like this can send
// that a wallpaper quote can't.
//
// Ordered by value, first match wins. Sending two is how you train someone to
// ignore both.

const DAY = 86_400_000
const daysBetween = (iso, ref) => Math.floor((new Date(ref).getTime() - new Date(iso).getTime()) / DAY)

// Monday-anchored, matching the app's own adherence weeks.
const weekKey = (date) => {
  const d = new Date(date)
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  d.setHours(0, 0, 0, 0)
  return d.toISOString().slice(0, 10)
}

const e1rm = (s) => (s.weight_kg ?? 0) * (1 + ((s.reps ?? 0) + (s.rir ?? 0)) / 30)

export function buildMessage({ profile, workouts, sets, bodyweight, measurements, dailyLogs, today }) {
  const ref = today ?? new Date().toISOString().slice(0, 10)
  const name = profile?.display_name?.split(' ')[0]
  // By training day. finished_at records when the entry was SAVED, so a
  // session typed up days late would otherwise read as the most recent.
  const done = workouts.filter((w) => w.finished_at).sort((a, b) => b.date.localeCompare(a.date))
  const trainedToday = done.some((w) => w.date === ref)
  const last = done[0]
  const gap = last ? daysBetween(last.date, ref) : null

  // ---- 1. Joint warning. Outranks everything: this is the one that ends
  // blocks, and it's the reason the programme exists in its current shape.
  const recent = done.slice(0, 3).filter((w) => w.si_pain_score != null)
  if (recent.length >= 2 && recent.every((w) => w.si_pain_score >= 4)) {
    return {
      title: 'SI pain is climbing',
      body: `${recent.length} sessions in a row at ${Math.min(...recent.map((w) => w.si_pain_score))}+. Drop the load 20% on whatever caused it before the next leg day.`,
      tag: 'si-warning',
    }
  }

  // ---- 2. A long absence outranks every milestone below. Someone eleven
  // days out does not need a compliment about a lift they aren't doing.
  if (gap === null) {
    return { title: 'Nothing logged yet', body: 'The programme is loaded and waiting. Open the app and start a day.', tag: 'nudge' }
  }
  if (gap >= 5) {
    return {
      title: `${gap} days off`,
      body: 'Long enough that restarting is the only thing that matters. Half a session counts.',
      tag: 'nudge',
    }
  }

  // ---- 3. Waist milestone. The metric that actually tracks the goal, and
  // the one that moves while the scale sits still.
  const waist = measurements.filter((m) => m.waist_cm != null).sort((a, b) => a.date.localeCompare(b.date))
  if (waist.length >= 2) {
    const first = waist[0]
    const latest = waist[waist.length - 1]
    const drop = first.waist_cm - latest.waist_cm
    // Fat does not leave a waist in 48 hours. Readings this close together
    // are measuring tape position and breath, so celebrating the difference
    // would teach exactly the wrong lesson about which numbers to trust.
    const spanDays = (new Date(latest.date) - new Date(first.date)) / DAY
    if (drop >= 1 && spanDays >= 10) {
      return {
        title: `Waist down ${drop.toFixed(1)} cm`,
        body: `${first.waist_cm} → ${latest.waist_cm} cm since you started. That is the number that matters, and it is moving.`,
        tag: 'milestone-waist',
      }
    }
  }

  // ---- 3. Best week so far. Cheap to compute, and consistency is the thing
  // being fought for.
  const byWeek = {}
  for (const w of done) byWeek[weekKey(w.date)] = (byWeek[weekKey(w.date)] ?? 0) + 1
  const thisWeek = byWeek[weekKey(ref)] ?? 0
  const priorBest = Math.max(0, ...Object.entries(byWeek).filter(([k]) => k !== weekKey(ref)).map(([, v]) => v))
  if (thisWeek > 0 && thisWeek >= priorBest && priorBest > 0 && trainedToday) {
    return {
      title: `${thisWeek} sessions this week`,
      body: thisWeek > priorBest ? 'Your best week since you started.' : 'Matching your best week so far. Hold it.',
      tag: 'milestone-week',
    }
  }

  // ---- 4. The week it usually stops.
  // Weeks 4-8 of a cut look identical to failure from the inside: the scale
  // stalls, the mirror hasn't caught up, and quitting feels reasonable.
  // Saying so, with the evidence, is the single most useful message here.
  const first = done[done.length - 1]
  const weeksIn = first ? Math.floor(daysBetween(first.date, ref) / 7) + 1 : 0
  if (weeksIn >= 4 && weeksIn <= 8) {
    const sessions = done.length
    const waistDrop = waist.length >= 2 ? waist[0].waist_cm - waist[waist.length - 1].waist_cm : null
    return {
      title: `Week ${weeksIn}`,
      body: `${sessions} sessions logged${waistDrop > 0 ? `, waist down ${waistDrop.toFixed(1)} cm` : ''}. This is the stretch where it stopped before — and it's working.`,
      tag: 'week-check',
    }
  }

  // ---- 5. A lift that's genuinely gone up. Proof that the training is
  // working even when the mirror says nothing yet.
  if (sets.length > 20) {
    const byEx = {}
    for (const s of sets) {
      if (s.is_warmup || s.is_drop_set || !s.weight_kg) continue
      const w = workouts.find((x) => x.id === s.workout_id)
      if (!w?.finished_at) continue
      ;(byEx[s.exercise_id] ??= []).push({ at: w.date, v: e1rm(s) })
    }
    for (const [, points] of Object.entries(byEx)) {
      if (points.length < 6) continue
      points.sort((a, b) => a.at.localeCompare(b.at))
      const early = Math.max(...points.slice(0, 3).map((p) => p.v))
      const late = Math.max(...points.slice(-3).map((p) => p.v))
      if (late > early * 1.05) {
        return {
          title: 'Getting stronger',
          body: `Your estimated max is up ${Math.round(late - early)} kg on one of your lifts since you started. Strength holding in a deficit is the whole point.`,
          tag: 'milestone-strength',
        }
      }
    }
  }

  if (trainedToday) return null // trained today and nothing notable — say nothing

  // ---- Shorter gaps. The long ones were handled above, before milestones.
  if (gap >= 2) {
    return {
      title: name ? `${name}, rest day over?` : 'Rest day over?',
      body: `Last session was ${gap} days ago. Today's day is queued up.`,
      tag: 'nudge',
    }
  }

  // ---- 7. The daily routine, but only for the people it applies to and only
  // once the obvious stuff is handled.
  if (profile?.has_si_joint) {
    const log = dailyLogs.find((l) => l.date === ref)
    if (!log?.si_routine) {
      return {
        title: 'Daily SI routine',
        body: 'Five minutes: glute bridge, clamshell, dead bug, cat-cow. Rest days too — that\'s the point of it.',
        tag: 'routine',
      }
    }
  }

  // ---- 8. Steps, if they're being logged and are far short.
  const todayLog = dailyLogs.find((l) => l.date === ref)
  if (todayLog?.steps != null && profile?.steps_target && todayLog.steps < profile.steps_target * 0.5) {
    return {
      title: `${todayLog.steps.toLocaleString()} steps today`,
      body: `Target is ${profile.steps_target.toLocaleString()}. A 30-minute walk closes most of that, and it costs nothing in recovery.`,
      tag: 'steps',
    }
  }

  return null
}
