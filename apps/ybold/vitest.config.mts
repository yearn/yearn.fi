import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@ybold': import.meta.dirname
    }
  }
})
