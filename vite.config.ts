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
        // Dark, and deliberately not the light page background it used to be.
        // A manifest carries one colour and cannot vary by colour scheme, and
        // on Android this is the one that counts: the values here are baked
        // into the WebAPK at install time and are what paints the system bar
        // and the splash, whatever the page's own theme-color meta says
        // afterwards. Light is the worse default of the two — a light bar
        // under a dark page is unreadable and permanent, while a dark bar
        // above a light page is a moment at launch before the page paints.
        //
        // Changing this only reaches a device once Chrome re-checks the
        // manifest and updates the installed WebAPK; reinstalling the app
        // applies it immediately.
        theme_color: '#121212',
        background_color: '#121212',
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
