// Daily reminder push, run by Vercel Cron (see vercel.json).
//
// Deliberately server-side and scheduled: the point of a reminder is that it
// reaches a phone whose app is CLOSED, which a browser timer by definition
// cannot do.
//
// What it does NOT do is the rest timer. Getting a push to land at exactly
// T+180s needs a delayed-job service; a once-a-day cron can't, and pretending
// otherwise would produce a rest alert that shows up tomorrow morning.
import webpush from 'web-push'
import { createClient } from '@supabase/supabase-js'
import { buildMessage } from './_messages.js'

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

  // The service role key bypasses RLS, which is required here: this runs as
  // nobody, on a schedule, and has to read across all users. It is a SERVER
  // secret and must never be exposed to the client.
  const supabase = createClient(VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  })

  const [subs, workouts, sets, bodyweight, measurements, dailyLogs, profiles] = await Promise.all([
    supabase.from('push_subscriptions').select('*').then((r) => r.data ?? []),
    supabase.from('workouts').select('id, user_id, date, finished_at, skipped_at, si_pain_score, deleted_at').then((r) => r.data ?? []),
    supabase.from('sets').select('user_id, workout_id, exercise_id, weight_kg, reps, rir, is_warmup, is_drop_set, deleted_at').then((r) => r.data ?? []),
    supabase.from('bodyweight_logs').select('user_id, date, weight_kg, deleted_at').then((r) => r.data ?? []),
    supabase.from('measurements').select('user_id, date, waist_cm, deleted_at').then((r) => r.data ?? []),
    supabase.from('daily_logs').select('user_id, date, si_routine, steps, deleted_at').then((r) => r.data ?? []),
    supabase.from('profiles').select('*').then((r) => r.data ?? []),
  ])

  if (!subs.length) return res.status(200).json({ sent: 0, reason: 'no subscriptions' })

  const today = new Date().toISOString().slice(0, 10)

  const mine = (rows, userId) => rows.filter((r) => r.user_id === userId && !r.deleted_at)

  // One message per user, and only when there's something true to say.
  // Two notifications is how you teach someone to ignore both.
  const messageFor = (userId) => buildMessage({
    profile: profiles.find((p) => p.user_id === userId && !p.deleted_at),
    workouts: mine(workouts, userId),
    sets: mine(sets, userId),
    bodyweight: mine(bodyweight, userId),
    measurements: mine(measurements, userId),
    dailyLogs: mine(dailyLogs, userId),
    today,
  })

  const cache = new Map()
  let sent = 0
  let pruned = 0

  for (const sub of subs) {
    if (!cache.has(sub.user_id)) cache.set(sub.user_id, messageFor(sub.user_id))
    const message = cache.get(sub.user_id)
    if (!message) continue

    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify({ ...message, tag: message.tag ?? 'gym-reminder', url: '/' }),
      )
      sent++
      await supabase.from('push_subscriptions').update({ last_sent_at: new Date().toISOString() }).eq('id', sub.id)
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

  return res.status(200).json({ sent, pruned, devices: subs.length })
}
