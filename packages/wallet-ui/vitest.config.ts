import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  esbuild: { jsx: 'automatic' },
  resolve: { alias: { '@yearn/wallet-ui': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: { environment: 'jsdom' }
})
