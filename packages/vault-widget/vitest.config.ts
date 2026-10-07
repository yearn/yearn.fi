import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  oxc: { jsx: { runtime: 'automatic' } },
  resolve: {
    dedupe: ['react', 'react-dom'],
    alias: {
      react: fileURLToPath(new URL('../../node_modules/react', import.meta.url)),
      'react-dom': fileURLToPath(new URL('../../node_modules/react-dom', import.meta.url)),
      'use-sync-external-store': fileURLToPath(new URL('../../node_modules/use-sync-external-store', import.meta.url)),
      '@yearn/vault-widget/internal': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  test: { server: { deps: { inline: ['wagmi', '@tanstack/react-query'] } } }
})
