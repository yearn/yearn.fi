import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@lib': path.resolve(__dirname, './apps/lib'),
      '@vaults': path.resolve(__dirname, './apps/vaults'),
      '@vaults-v2': path.resolve(__dirname, './apps/vaults-v2'),
      '@vaults-v3': path.resolve(__dirname, './apps/vaults-v3'),
      '@landing': path.resolve(__dirname, './apps/landing'),
      '@safe-global/safe-apps-sdk': path.resolve(__dirname, 'node_modules/@safe-global/safe-apps-sdk/dist/esm')
    }
  },
  define: {
    'process.env': {},
    'global': 'globalThis',
  },
  server: {
    port: 3000,
    proxy: {
      '/js/script.js': {
        target: 'https://plausible.io',
        changeOrigin: true
      },
      '/api/event': {
        target: 'https://plausible.io',
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'wagmi-vendor': ['wagmi', 'viem', '@wagmi/core', '@wagmi/connectors'],
          'rainbowkit': ['@rainbow-me/rainbowkit'],
          'ui-vendor': ['@headlessui/react', 'framer-motion', 'recharts']
        }
      }
    }
  },
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      'viem',
      'viem/chains',
      'viem/actions',
      'wagmi',
      'wagmi/actions',
      '@rainbow-me/rainbowkit',
      '@rainbow-me/rainbowkit/wallets',
      '@headlessui/react',
      '@tanstack/react-query',
      'recharts',
      'framer-motion',
      '@react-hookz/web'
    ]
  }
})