import { defineConfig } from 'vitest/config'

export default defineConfig({
  oxc: { jsx: { runtime: 'automatic' } },
  resolve: {
    dedupe: ['react', 'react-dom'],
    alias: {
      '@ybold': import.meta.dirname,
      '@plausible-analytics/tracker': `${import.meta.dirname}/../../node_modules/@plausible-analytics/tracker/plausible.js`
    }
  }
})
