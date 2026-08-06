import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // Sync-on-open, not background sync (iOS has no Background Sync API) —
      // this plugin only handles the install/offline-shell part, not data sync.
      manifest: {
        name: 'Gym Tracker',
        short_name: 'Gym',
        description: 'Personal training log',
        // Must track tokens.css — this is the colour the OS paints around the
        // installed app and behind the splash, so a stale value here shows as
        // a black frame round a light app.
        theme_color: '#F5F3EE',
        background_color: '#F5F3EE',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: 'icon-maskable.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,ico}'],
        // Without these, a deploy doesn't show up until the app has been
        // fully closed and reopened — the old worker keeps serving the old
        // cached bundle, so a fresh deploy looks like nothing happened.
        // skipWaiting activates the new worker immediately; clientsClaim
        // hands it the already-open page.
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
      }
    })
  ]
})
