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
        // Exclude heavy lazy-loaded chunks from the initial offline precache.
        // Barcode scanner (ZXing ~450kB) and Recharts (~350kB) should only load
        // when their respective screens are opened.
        globIgnores: ['**/vendor-scanner*.js', '**/vendor-charts*.js', '**/BarcodeScanner*.js', '**/LineChart*.js'],
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        importScripts: ['/push-sw.js'],
      }
    })
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('@supabase')) return 'vendor-supabase'
            if (id.includes('dexie')) return 'vendor-dexie'
            if (id.includes('motion')) return 'vendor-motion'
            if (id.includes('date-fns')) return 'vendor-date-fns'
            if (id.includes('recharts') || id.includes('d3-')) return 'vendor-charts'
            if (id.includes('@zxing')) return 'vendor-scanner'
            return 'vendor-core'
          }
        }
      }
    },
    chunkSizeWarningLimit: 600,
  }
})
