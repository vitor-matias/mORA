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
        theme_color: '#FAF9F6',
        background_color: '#FAF9F6',
        // Both purposes, deliberately. Without a `maskable` entry Android
        // cannot crop the icon to the launcher's shape, so it shrinks the
        // `any` one onto a white circle instead — the artwork ends up a small
        // square floating in a plate. The maskable files are full bleed with
        // the hands inside the central 80% safe zone; the `any` files keep
        // their own rounded-square shape for surfaces that draw the icon
        // as-is. All five are built by `npm run make-app-icons`.
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'pwa-maskable-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable'
          },
          {
            src: 'pwa-maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
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
