import { defineConfig } from 'vitest/config'

export default defineConfig({
  oxc: { jsx: { runtime: 'automatic' } },
  resolve: {
    dedupe: ['react', 'react-dom'],
    alias: {
      '@ybold': import.meta.dirname
    }
  }
})
