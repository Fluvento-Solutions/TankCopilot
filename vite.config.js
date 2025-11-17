import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/TankCopilot/app/',
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      // Version für Cache-Invalidierung - erhöhen bei Updates
      version: '1.3.2',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest}'],
        // WICHTIG: base path für Service Worker
        navigateFallback: '/TankCopilot/app/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        // API-Calls nicht cachen (immer frische Daten)
        runtimeCaching: [
          {
            urlPattern: /^https?:\/\/.*\/api\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache-v1.3.2', // Version im Cache-Namen für Invalidation
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 // Nur 1 Minute Cache für API-Calls
              },
              networkTimeoutSeconds: 10
            }
          }
        ]
      },
      // Service Worker Scope muss mit base path übereinstimmen
      scope: '/TankCopilot/app/',
      manifest: {
        name: 'TankCopilot – Tankbuch & Verbrauchsplaner',
        short_name: 'TankCopilot',
        description: 'Tankbuch & Verbrauchsplaner für Autofahrer',
        theme_color: '#00A8A8',
        background_color: '#E0F7F7',
        display: 'standalone',
        start_url: '/TankCopilot/app/',
        scope: '/TankCopilot/app/',
        icons: [
          {
            src: '/TankCopilot/app/icons/icon-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/TankCopilot/app/icons/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ],
  server: {
    port: 3000,
    open: true
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets'
  }
})

