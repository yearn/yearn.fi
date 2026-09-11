import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@yearn/wallet-ui': fileURLToPath(new URL('./src', import.meta.url))
    }
  }
})
