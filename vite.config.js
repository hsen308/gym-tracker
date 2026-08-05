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
        theme_color: '#14181F',
        background_color: '#14181F',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: 'icon-maskable.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,ico}']
      }
    })
  ]
})
