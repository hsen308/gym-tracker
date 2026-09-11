// Picks ONE notification from a user's real data.
//
// Generic motivation gets swiped away inside a week. Everything here is a
// specific, checkable fact about this person — a number they can verify by
// opening the app. That's the only kind of message an app like this can send
// that a wallpaper quote can't.
//
// Two crons run each day (morning + evening, see vercel.json). Each slot gets
// at most one message, the pools below keep morning and evening from covering
// the same ground, and pickMessage refuses to send a tag the day's earlier
// slot already sent. The cap is therefore two real notifications a day,
// never two of the same kind.
import { adherenceHabit } from './_adherence.js'

const SLOT_MORNING = 'morning'
const SLOT_EVENING = 'evening'

// What each slot may send. Health items are shared (a si-joint warning or a
// due dose can land in either half of the day); the daily-tick chores
// (creatine, meals, water, routine) and the milestones are slotted to the
// time of day they make sense.
const POOLS = {
  [SLOT_MORNING]: ['si-warning', 'medication', 'routine', 'water', 'habit'],
  [SLOT_EVENING]: [
    'si-warning', 'medication',
    'nudge',                       // the absence messages outrank everything below
    'milestone-week', 'week-check', 'milestone-waist', 'milestone-strength',
    'creatine', 'meals',
    'steps', 'habit',
  ],
}

export function pickMessage(messages, slot, alreadySentTag) {
  const pool = POOLS[slot] ?? POOLS[SLOT_EVENING]
  // Same tag already fired today, from the opposite slot → skip it. The cap
  // is "two a day", not "two briefings a day".
  return (messages ?? []).find((m) => pool.includes(m.tag) && m.tag !== alreadySentTag) ?? null
}

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

// Every candidate message, in descending order of value. The picker decides
// which one (if any) actually goes out.
export function buildMessages({ profile, workouts, sets, bodyweight, measurements, dailyLogs, mealLogs, today }) {
  const ref = today ?? new Date().toISOString().slice(0, 10)
  const name = profile?.display_name?.split(' ')[0]
  // By training day. finished_at records when the entry was SAVED, so a
  // session typed up days late would otherwise read as the most recent.
  const done = workouts.filter((w) => w.finished_at).sort((a, b) => b.date.localeCompare(a.date))
  const trainedToday = done.some((w) => w.date === ref)
  const last = done[0]
  const gap = last ? daysBetween(last.date, ref) : null
  const todayLog = dailyLogs.find((l) => l.date === ref)

  const out = []

  // ---- 1. Joint warning. Outranks everything: this is the one that ends
  // blocks, and it's the reason the programme exists in its current shape.
  const recent = done.slice(0, 3).filter((w) => w.si_pain_score != null)
  if (recent.length >= 2 && recent.every((w) => w.si_pain_score >= 4)) {
    out.push({
      title: 'SI pain is climbing',
      body: `${recent.length} sessions in a row at ${Math.min(...recent.map((w) => w.si_pain_score))}+. Drop the load 20% on whatever caused it before the next leg day.`,
      tag: 'si-warning',
    })
  }

  // ---- 1b. Medication due. Same tier as the joint warning: a fixed health
  // obligation with a deadline, and the one thing a nudge can't be late for.
  if (profile?.adalimumab_last_injection && profile?.adalimumab_interval_days) {
    const daysSince = daysBetween(profile.adalimumab_last_injection, ref)
    if (daysSince >= profile.adalimumab_interval_days - 1) {
      const overdue = daysSince >= profile.adalimumab_interval_days
      out.push({
        title: overdue ? 'Adalimumab dose is due' : 'Adalimumab due tomorrow',
        body: overdue
          ? `${daysSince} days since the last dose. Take it today — a day late is fine.`
          : `${daysSince} days since the last dose. The next 40 mg lands tomorrow; take it in that window.`,
        tag: 'medication',
      })
    }
  }

  // ---- 2. A long absence outranks every milestone below. Someone eleven
  // days out does not need a compliment about a lift they aren't doing.
  if (gap === null) {
    out.push({ title: 'Nothing logged yet', body: 'The programme is loaded and waiting. Open the app and start a day.', tag: 'nudge' })
  }
  if (gap >= 5) {
    out.push({
      title: `${gap} days off`,
      body: 'Long enough that restarting is the only thing that matters. Half a session counts.',
      tag: 'nudge',
    })
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
      out.push({
        title: `Waist down ${drop.toFixed(1)} cm`,
        body: `${first.waist_cm} → ${latest.waist_cm} cm since you started. That is the number that matters, and it is moving.`,
        tag: 'milestone-waist',
      })
    }
  }

  // ---- 3. Best week so far. Cheap to compute, and consistency is the thing
  // being fought for.
  const byWeek = {}
  for (const w of done) byWeek[weekKey(w.date)] = (byWeek[weekKey(w.date)] ?? 0) + 1
  const thisWeek = byWeek[weekKey(ref)] ?? 0
  const priorBest = Math.max(0, ...Object.entries(byWeek).filter(([k]) => k !== weekKey(ref)).map(([, v]) => v))
  if (thisWeek > 0 && thisWeek >= priorBest && priorBest > 0 && trainedToday) {
    out.push({
      title: `${thisWeek} sessions this week`,
      body: thisWeek > priorBest ? 'Your best week since you started.' : 'Matching your best week so far. Hold it.',
      tag: 'milestone-week',
    })
  }

  // ---- 4. The week it usually stops.
  // Weeks 4-8 of a cut look identical to failure from the inside: the scale
  // stalls, the mirror hasn't caught up, and quitting feels reasonable.
  const first = done[done.length - 1]
  const weeksIn = first ? Math.floor(daysBetween(first.date, ref) / 7) + 1 : 0
  if (weeksIn >= 4 && weeksIn <= 8) {
    const sessions = done.length
    const waistDrop = waist.length >= 2 ? waist[0].waist_cm - waist[waist.length - 1].waist_cm : null
    out.push({
      title: `Week ${weeksIn}`,
      body: `${sessions} sessions logged${waistDrop > 0 ? `, waist down ${waistDrop.toFixed(1)} cm` : ''}. This is the stretch where it stopped before — and it's working.`,
      tag: 'week-check',
    })
  }

  // ---- 5. A lift that's genuinely gone up. Proof that the training is
  // working even when the mirror says nothing yet.
  if (sets.length > 20) {
    const byEx = {}
    for (const s of sets) {
      if (s.is_warmup || s.is_drop_set || !s.weight_kg) continue
      const w = workouts.find((x) => x.id === s.workout_id)
      if (!w?.finished_at) continue
      // Keyed by mode as well as exercise: a belt dip and a machine dip
      // share a name and nothing else, and "up 60 kg" drawn across the two
      // would be a congratulation for switching equipment.
      ;(byEx[`${s.exercise_id}|${s.load_mode ?? 'added'}`] ??= []).push({ at: w.date, v: e1rm(s) })
    }
    for (const [, points] of Object.entries(byEx)) {
      if (points.length < 6) continue
      points.sort((a, b) => a.at.localeCompare(b.at))
      const early = Math.max(...points.slice(0, 3).map((p) => p.v))
      const late = Math.max(...points.slice(-3).map((p) => p.v))
      if (late > early * 1.05) {
        out.push({
          title: 'Getting stronger',
          body: `Your estimated max is up ${Math.round(late - early)} kg on one of your lifts since you started. Strength holding in a deficit is the whole point.`,
          tag: 'milestone-strength',
        })
        break
      }
    }
  }

  // ---- 6. Creatine, but only for someone on it and only while it's
  // unconfirmed. Nudging an already-taken dose is how a reminder becomes
  // noise, and the confirm card on Today keeps this data-driven.
  if (profile?.creatine_started_on && !todayLog?.creatine_taken) {
    out.push({
      title: 'Creatine — 5 g today',
      body: 'Not confirmed yet. Take it with a meal or around training, then tap the card on Today so it stays off tomorrow\'s list.',
      tag: 'creatine',
    })
  }

  // ---- 6b. Meals. The macro picture is only as honest as the logging, and
  // an unlogged day reads as a zero day.
  if (!mealLogs?.some((l) => l.date === ref)) {
    out.push({
      title: 'Nothing logged today',
      body: 'No meals in today\'s log. Two or three entries — even approximate — keep your macro picture honest.',
      tag: 'meals',
    })
  }

  // ---- 6c. Shorter gaps. The long ones were handled above, before
  // milestones.
  if (gap >= 2) {
    out.push({
      title: name ? `${name}, rest day over?` : 'Rest day over?',
      body: `Last session was ${gap} days ago. Today's day is queued up.`,
      tag: 'nudge',
    })
  }

  // ---- 7. The daily SI routine, morning slot — it's an every-day habit and
  // a morning reminder is the one that actually gets it done.
  if (profile?.has_si_joint) {
    if (!todayLog?.si_routine) {
      out.push({
        title: 'Daily SI routine',
        body: 'Five minutes: glute bridge, clamshell, dead bug, cat-cow. Rest days too — that\'s the point of it.',
        tag: 'routine',
      })
    }
  }

  // ---- 8. Water, morning slot. Habit-formation starts at the start of the
  // day, and the deficit is one no one ever closes at 9pm.
  if (todayLog?.water_litres != null && profile?.water_target_l && todayLog.water_litres < profile.water_target_l * 0.5) {
    out.push({
      title: `${todayLog.water_litres} L of ${profile.water_target_l} L today`,
      body: 'Under half your water target. Two glasses at each meal and the deficit disappears.',
      tag: 'water',
    })
  }

  // ---- 9. Steps, if they're being logged and are far short.
  if (todayLog?.steps != null && profile?.steps_target && todayLog.steps < profile.steps_target * 0.5) {
    out.push({
      title: `${todayLog.steps.toLocaleString()} steps today`,
      body: `Target is ${profile.steps_target.toLocaleString()}. A 30-minute walk closes most of that, and it costs nothing in recovery.`,
      tag: 'steps',
    })
  }

  // ---- 10. The habit number. Different tone from an absence nudge: it
  // reports the trend instead of the gap.
  const habit = adherenceHabit(done, profile?.sessions_per_week, ref)
  if (habit?.pct != null) {
    out.push({
      title: habit.streak > 0 ? `${habit.streak}-week habit` : `${habit.pct}% of sessions done`,
      body: habit.streak > 0
        ? `Confirmed by ${habit.pct}% over the last 8 weeks. Days off are planned — this is a streak, not luck.`
        : `That's last week's run rate. Sit under 75% and the cut quietly stalls.`,
      tag: 'habit',
    })
  }

  return out
}