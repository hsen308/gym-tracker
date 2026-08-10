// Push handling, imported into the generated service worker (see
// vite.config.js -> workbox.importScripts).
//
// Kept as a separate file rather than switching the PWA plugin to
// injectManifest: that would hand us the whole service worker to maintain,
// including the precache logic that already works. This adds the two
// handlers we need and leaves the rest alone.

self.addEventListener('push', (event) => {
  let payload = {}
  try {
    payload = event.data ? event.data.json() : {}
  } catch {
    payload = { body: event.data ? event.data.text() : '' }
  }

  const title = payload.title || 'Gym Tracker'
  const options = {
    body: payload.body || '',
    // Same icon as the installed app, so the notification is recognisable.
    icon: '/icon.svg',
    badge: '/icon.svg',
    // A tag replaces an earlier notification with the same one rather than
    // stacking: three "you haven't trained" reminders is nagging, one is
    // information.
    tag: payload.tag || 'gym-tracker',
    renotify: !!payload.renotify,
    requireInteraction: false,
    data: { url: payload.url || '/' },
  }

  // waitUntil keeps the worker alive until the notification is actually
  // shown — without it the browser can kill it mid-flight and nothing
  // appears.
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = event.notification.data?.url || '/'

  // Focus an already-open window rather than opening a second copy of the
  // app, which is what happens if you just call openWindow every time.
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          client.navigate?.(target)
          return client.focus()
        }
      }
      return self.clients.openWindow(target)
    }),
  )
})
