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

  const [{ data: subs }, { data: workouts }, { data: dailyLogs }, { data: profiles }] = await Promise.all([
    supabase.from('push_subscriptions').select('*'),
    supabase.from('workouts').select('user_id, date, finished_at, skipped_at, deleted_at'),
    supabase.from('daily_logs').select('user_id, date, si_routine, deleted_at'),
    supabase.from('profiles').select('user_id, display_name, has_si_joint, deleted_at'),
  ])

  if (!subs?.length) return res.status(200).json({ sent: 0, reason: 'no subscriptions' })

  const today = new Date().toISOString().slice(0, 10)
  const daysSince = (iso) => Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)

  // One message per user, chosen by what's actually true for them — a
  // reminder that fires regardless of whether you already trained is the
  // fastest way to teach someone to swipe notifications away unread.
  const messageFor = (userId) => {
    const profile = (profiles ?? []).find((p) => p.user_id === userId && !p.deleted_at)
    const name = profile?.display_name?.split(' ')[0]
    const mine = (workouts ?? []).filter((w) => w.user_id === userId && !w.deleted_at)
    const trained = mine.filter((w) => w.finished_at)
    const last = trained.sort((a, b) => new Date(b.finished_at) - new Date(a.finished_at))[0]

    if (trained.some((w) => w.date === today)) return null // already trained today

    const gap = last ? daysSince(last.finished_at) : null

    if (gap === null) {
      return { title: 'Log your first session', body: 'The programme is loaded and waiting. Open the app and start a day.' }
    }
    if (gap >= 4) {
      return {
        title: `${gap} days since your last session`,
        body: 'Long enough that getting back in is the only thing that matters. Anything counts.',
      }
    }
    if (gap >= 2) {
      return {
        title: name ? `${name}, rest day over?` : 'Rest day over?',
        body: `Last session was ${gap} days ago. Today's day is queued up.`,
      }
    }

    // Trained recently — only worth a nudge if the daily routine they're
    // supposed to do EVERY day, including rest days, is still unticked.
    if (profile?.has_si_joint) {
      const todayLog = (dailyLogs ?? []).find((l) => l.user_id === userId && l.date === today && !l.deleted_at)
      if (!todayLog?.si_routine) {
        return { title: 'Daily SI routine', body: 'Five minutes: glute bridge, clamshell, dead bug, cat-cow. Rest days too.' }
      }
    }
    return null
  }

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
        JSON.stringify({ ...message, tag: 'gym-reminder', url: '/' }),
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
