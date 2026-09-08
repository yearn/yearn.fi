import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@ybold': import.meta.dirname,
      '@yearn/wallet-ui': new URL('../../packages/wallet-ui/src', import.meta.url).pathname
    }
  }
})
