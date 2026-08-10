// Web Push subscription management.
//
// A push subscription is a triple the browser gives you — an endpoint URL
// plus two keys — that a server can use to wake this specific device. It
// belongs to the DEVICE, not the account, which is why it goes straight to
// Supabase rather than through the Dexie sync engine: copying it to another
// device would just send that device's notifications to this one.
import { supabase, isSupabaseConfigured } from '../db/supabase'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY

// The subscribe() call wants the key as a Uint8Array, and VAPID keys are
// distributed base64url. Padding and the two swapped characters both have to
// be undone or the browser rejects the key with a very unhelpful error.
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)))
}

export const pushSupported = () =>
  'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

export const pushConfigured = () => !!VAPID_PUBLIC_KEY && isSupabaseConfigured

// iOS only allows this for a PWA added to the Home Screen — in Safari proper
// the API exists but subscribing always fails, so it's worth telling the user
// why rather than showing them an error.
export const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true

export const permission = () => (pushSupported() ? Notification.permission : 'unsupported')

export async function currentSubscription() {
  if (!pushSupported()) return null
  const reg = await navigator.serviceWorker.ready
  return reg.pushManager.getSubscription()
}

export async function subscribe(userId) {
  if (!pushSupported()) throw new Error('This browser has no push support.')
  if (!VAPID_PUBLIC_KEY) throw new Error('No VAPID key configured. Add VITE_VAPID_PUBLIC_KEY.')

  const result = await Notification.requestPermission()
  if (result !== 'granted') throw new Error('Notifications were blocked. Enable them in your browser settings.')

  const reg = await navigator.serviceWorker.ready
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({
      // Non-negotiable on the web: every push must be visible to the user.
      // Silent pushes are not allowed and subscribing without this fails.
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    }))

  const json = sub.toJSON()
  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      user_id: userId,
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
      user_agent: navigator.userAgent.slice(0, 300),
    },
    { onConflict: 'endpoint' },
  )
  if (error) throw new Error(error.message)
  return sub
}

export async function unsubscribe() {
  const sub = await currentSubscription()
  if (!sub) return
  const endpoint = sub.endpoint
  await sub.unsubscribe()
  // Remove it server-side too, or the cron keeps pushing to a dead endpoint
  // until the push service starts returning 410 and we prune it.
  if (isSupabaseConfigured) await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint)
}

// Fired locally, not through the server — used to prove the whole chain
// (permission, worker, handler) works without waiting for a cron run.
export async function sendTestNotification() {
  const reg = await navigator.serviceWorker.ready
  await reg.showNotification('Gym Tracker', {
    body: 'Notifications are working. This is what a reminder looks like.',
    icon: '/icon.svg',
    tag: 'gym-tracker-test',
  })
}
