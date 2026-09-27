// Daily reminder push, run twice a day by Vercel Cron (see vercel.json).
//
// Deliberately server-side and scheduled: the point of a reminder is that it
// reaches a phone whose app is CLOSED, which a browser timer by definition
// cannot do.
//
// Four slots each day — morning (05:00 UTC), midday (10:00 UTC),
// evening (14:00 UTC), night (18:00 UTC). Each slot sends at most one
// message per user, and _messages.js + last_sent_tag keep two promises:
// never more than four of the same kind a day, and the tag guard prevents
// redundant nudges of the same type across slots.
//
// What it does NOT do is the rest timer. Getting a push to land at exactly
// T+180s needs a delayed-job service; a twice-a-day cron can't, and
// pretending otherwise would produce a rest alert that shows up tomorrow.
import webpush from 'web-push'
import { createClient } from '@supabase/supabase-js'
import { buildMessages, pickMessage } from './_messages.js'

const {
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY,
  VAPID_SUBJECT = 'mailto:husseinhmade308@gmail.com',
  VITE_SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  CRON_SECRET,
} = process.env

export default async function handler(req, res) {
  // Vercel Cron sends this header; without the check anyone who finds the URL
  // could spam every registered device.
  const auth = req.headers.authorization
  if (CRON_SECRET && auth !== `Bearer ${CRON_SECRET}`) {
    return res.status(401).json({ error: 'unauthorized' })
  }
  if (!VAPID_PRIVATE_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: 'Push is not configured on the server.' })
  }

  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)

  // Vercel Cron passes ?slot=morning|midday|evening|night via the vercel.json
  // path (e.g. /api/send-reminders?slot=morning). Read it first; fall back to
  // a coarse time-based guess only when the param is missing or invalid (e.g.
  // manual curl tests without the param).
  const VALID_SLOTS = ['morning', 'midday', 'evening', 'night']
  const paramSlot = req.query?.slot
  const hour = new Date().getUTCHours()
  const fallbackSlot = hour < 8 ? 'morning' : hour < 12 ? 'midday' : hour < 16 ? 'evening' : 'night'
  const slot = VALID_SLOTS.includes(paramSlot) ? paramSlot : fallbackSlot

  // The service role key bypasses RLS, which is required here: this runs as
  // nobody, on a schedule, and has to read across all users. It is a SERVER
  // secret and must never be exposed to the client.
  const supabase = createClient(VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  })

  const [subs, workouts, sets, bodyweight, measurements, dailyLogs, mealLogs, profiles] = await Promise.all([
    supabase.from('push_subscriptions').select('*').then((r) => r.data ?? []),
    supabase.from('workouts').select('id, user_id, date, finished_at, skipped_at, si_pain_score, sternal_pain_score, deleted_at').then((r) => r.data ?? []),
    supabase.from('sets').select('user_id, workout_id, exercise_id, weight_kg, reps, rir, is_warmup, is_drop_set, load_mode, deleted_at').then((r) => r.data ?? []),
    supabase.from('bodyweight_logs').select('user_id, date, weight_kg, deleted_at').then((r) => r.data ?? []),
    supabase.from('measurements').select('user_id, date, waist_cm, deleted_at').then((r) => r.data ?? []),
    supabase.from('daily_logs').select('user_id, date, water_litres, creatine_taken, morning_sternal_pain, morning_si_pain, morning_back_pain, morning_stiffness_minutes, deleted_at').then((r) => r.data ?? []),
    supabase.from('meal_logs').select('user_id, date, deleted_at').then((r) => r.data ?? []),
    supabase.from('profiles').select('*').then((r) => r.data ?? []),
  ])

  if (!subs.length) return res.status(200).json({ sent: 0, reason: 'no subscriptions' })

  const today = new Date().toISOString().slice(0, 10)

  const mine = (rows, userId) => rows.filter((r) => r.user_id === userId && !r.deleted_at)

  // Has the OPPOSITE slot already sent this device a message today? If so,
  // pickMessage is handed that tag and refuses to send the same kind again —
  // the "never two of the same type" half of the two-a-day cap. Guard is per
  // subscription, not per user, so a phone that joined mid-day doesn't
  // inherit a message the other one already had.
  const alreadySentTagFor = (sub) => {
    const sentToday = sub.last_sent_at && new Date(sub.last_sent_at).toISOString().slice(0, 10) === today
    return sentToday ? (sub.last_sent_tag ?? null) : null
  }

  // At most one message per user per run, and only when the data says
  // something true. Generic motivation gets swiped away inside a week.
  const messageFor = (userId, alreadySentTag) =>
    pickMessage(
      buildMessages({
        profile: profiles.find((p) => p.user_id === userId && !p.deleted_at),
        workouts: mine(workouts, userId),
        sets: mine(sets, userId),
        bodyweight: mine(bodyweight, userId),
        measurements: mine(measurements, userId),
        dailyLogs: mine(dailyLogs, userId),
        mealLogs: mine(mealLogs, userId),
        today,
      }),
      slot,
      alreadySentTag,
    )

  const cache = new Map()
  let sent = 0
  let pruned = 0

  for (const sub of subs) {
    const previousTag = alreadySentTagFor(sub)
    const cacheKey = `${sub.user_id}:${previousTag ?? ''}`
    if (!cache.has(cacheKey)) cache.set(cacheKey, messageFor(sub.user_id, previousTag))
    const message = cache.get(cacheKey)
    if (!message) continue

    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify({ ...message, tag: message.tag ?? 'gym-reminder', url: '/' }),
      )
      sent++
      await supabase
        .from('push_subscriptions')
        .update({ last_sent_at: new Date().toISOString(), last_sent_tag: message.tag ?? 'gym-reminder' })
        .eq('id', sub.id)
    } catch (err) {
      // 404/410 mean the browser threw the subscription away — uninstalled,
      // permission revoked, or data cleared. Deleting it stops us retrying a
      // dead endpoint on every run from now until forever.
      if (err.statusCode === 404 || err.statusCode === 410) {
        await supabase.from('push_subscriptions').delete().eq('id', sub.id)
        pruned++
      }
    }
  }

  return res.status(200).json({ sent, pruned, devices: subs.length, slot })
}