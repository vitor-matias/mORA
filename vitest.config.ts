import { defineConfig } from 'vitest/config'
import path from 'path'

// Standalone config (not merged with vite.config.ts): the unit tests cover
// pure TS modules, so the React and PWA plugins would only slow them down.
// The "@" alias still has to be repeated here — a module under test may import
// through it even when the test itself does not.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    include: ['src/**/*.test.ts'],
  },
})
