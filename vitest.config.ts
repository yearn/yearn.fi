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
