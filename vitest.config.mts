import path from 'path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  esbuild: {
    jsx: 'automatic'
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@shared': path.resolve(__dirname, './src/components/shared'),
      '@pages': path.resolve(__dirname, './src/components/pages'),
      '@components': path.resolve(__dirname, './src/components'),
      '@hooks': path.resolve(__dirname, './src/hooks'),
      '@plausible-analytics/tracker': path.resolve(
        __dirname,
        './node_modules/@plausible-analytics/tracker/plausible.js'
      )
    }
  },
  test: {
    globals: true,
    environment: 'node',
    server: {
      deps: {
        inline: ['@shared']
      }
    }
  }
})
