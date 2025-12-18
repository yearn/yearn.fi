import path from 'path'
import { defineConfig } from 'vitest/config'

// https://vitejs.dev/config/
export default defineConfig({
  esbuild: {
    jsx: 'automatic'
  },
  resolve: {
    alias: {
      '@vaults': path.resolve(__dirname, './apps/vaults'),
      '@vaults-v2': path.resolve(__dirname, './apps/vaults-v2'),
      '@vaults-v3': path.resolve(__dirname, './apps/vaults-v3'),
      '@lib': path.resolve(__dirname, './apps/lib'),
      '@components': path.resolve(__dirname, './src/components'),
      '@hooks': path.resolve(__dirname, './src/hooks')
    }
  },
  test: {
    globals: true,
    environment: 'node',
    deps: {
      inline: ['@lib']
    }
  }
})
