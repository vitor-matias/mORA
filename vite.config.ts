import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import legacy from '@vitejs/plugin-legacy'
import path from "path"
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  // Relative assets work in KaiOS packaged apps and still work when hosted in a subfolder.
  base: command === 'build' ? './' : '/',
  plugins: [
    legacy({
      // KaiOS 2.x uses Gecko engine based on Firefox 48
      targets: ['Firefox 48'],
      modernPolyfills: true,
      additionalLegacyPolyfills: [
        'regenerator-runtime/runtime',
      ],
    }),
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
      manifest: {
        name: 'mORA - Organização, Rezar e Ação',
        short_name: 'mORA',
        description: 'Um canivete suíço católico para a sua vida espiritual.',
        theme_color: '#ffffff',
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
}))
