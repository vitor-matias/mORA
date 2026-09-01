import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from "path"
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  // Relative asset paths so the build also works when hosted in a subfolder.
  base: command === 'build' ? './' : '/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // Custom SW (src/sw.ts) so we can handle Web Push events; it
      // reproduces generateSW's precache + auto-update behaviour.
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      includeAssets: ['apple-touch-icon.png', 'favicon.svg'],
      manifest: {
        name: 'mORA — Oração diária',
        short_name: 'mORA',
        description: 'A sua companhia de oração diária: Santo Terço, leituras da Missa e Liturgia das Horas.',
        // The launch colour only: a manifest carries one, and cannot vary by
        // colour scheme. It is the light page background because that is what
        // an unconfigured first launch looks like; the page's own theme-color
        // meta takes the system bar from here once it paints.
        theme_color: '#FAF9F6',
        background_color: '#FAF9F6',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // Honour an assigned port (e.g. from tooling that sets PORT) so multiple
  // dev servers can run against this folder without fighting over 5173.
  server: {
    port: process.env.PORT ? Number(process.env.PORT) : undefined,
  },
}))
