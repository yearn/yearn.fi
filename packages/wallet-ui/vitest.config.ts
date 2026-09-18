import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  esbuild: { jsx: 'automatic' },
  resolve: { alias: { '@yearn/wallet-ui': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    environment: 'jsdom',
    // Let the transport regression test stub the network while exercising RainbowKit's real wallet factories.
    server: { deps: { inline: ['@rainbow-me/rainbowkit'] } }
  }
})
