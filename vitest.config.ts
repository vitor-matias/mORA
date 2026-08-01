import { defineConfig } from 'vitest/config'

// Standalone config (not merged with vite.config.ts): the unit tests cover
// pure TS modules, so the React and PWA plugins would only slow them down.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
  },
})
