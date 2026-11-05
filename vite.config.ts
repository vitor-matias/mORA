import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from "path"
import { VitePWA } from 'vite-plugin-pwa'

// The values a production build needs from where it is built (see
// .env.example). Missing, the app silently plays the demo puzzle pool and has
// no push, so the build says so: one line naming what is missing, never a
// value. It is the only trace in a CI log of which values a build received.
const BUILD_ENV = ['VITE_PALAVRA_PUBLISHER_PUBKEY', 'VITE_PUSH_SERVER_URL', 'VITE_VAPID_PUBLIC_KEY'];

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  if (command === 'build') {
    const env = loadEnv(mode, process.cwd(), 'VITE_');
    const missing = BUILD_ENV.filter((name) => !env[name]);
    if (missing.length > 0) {
      console.warn(`\n⚠ Building without ${missing.join(', ')}: this build plays the demo puzzles and has no push reminders.\n`);
    }
  }
  return {
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
        // The breviary JSON (public/lh, ~830 KB) is read at runtime for saints'
        // offices and the commons. The default glob only takes js/css/html, so
        // without this those offices failed offline.
        injectManifest: {
          // woff2: the self-hosted fonts, or an office read offline falls
          // back to Georgia and the interface to the system sans.
          globPatterns: ['**/*.{js,css,html,woff2}', 'lh/*.json'],
        },
        manifest: {
          name: 'Oremus — Oração diária',
          short_name: 'Oremus',
          description: 'A tua companhia de oração diária: Santo Terço, leituras da Missa e Liturgia das Horas.',
          // Imersivo's page colour, in both fields and in both themes. On
          // Android this is what paints the installed app's gesture-navigation
          // bar (Chromium 0a6ab4f, Aug 2026) and, before that bar is painted,
          // the splash. The manifest holds one value — its dark counterparts
          // were an experiment Chrome's parser dropped — so this cannot follow
          // the theme the user picked: Imersivo matches it, Bento gets a dark
          // strip under a near-white page. Dark both ways, because a lit strip
          // ruins the dark page while a dark one under the light page still
          // reads as chrome.
          theme_color: '#0B0B0C',
          background_color: '#0B0B0C',
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
  }
})
