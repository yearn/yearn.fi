import react from '@vitejs/plugin-react'
import path from 'path'
import { defineConfig, loadEnv } from 'vite'
import webfontDownload from 'vite-plugin-webfont-dl'

const PUBLIC_ENV_ALLOWLIST = new Set([
  'NODE_ENV',
  'BASE_YEARN_ASSETS_URI',
  'YDAEMON_BASE_URI',
  'KATANA_APR_SERVICE_API',
  'PARTNER_ID_ADDRESS',
  'KNOWN_ENS',
  'SHOULD_USE_FORKNET',
  'ALCHEMY_KEY',
  'INFURA_KEY',
  'WALLETCONNECT_PROJECT_ID',
  'WALLETCONNECT_PROJECT_NAME',
  'JSON_RPC_URI',
  'JSON_RPC_URL'
])

function envRemapper() {
  return {
    name: 'env-remapper',
    config(_: unknown, { mode }: { mode: string }) {
      const env = loadEnv(mode, process.cwd(), '')
      const remappedEnv: Record<string, string | Record<string, string>> = {}
      const rpcUriFor: Record<string, string> = {}

      Object.entries(env).forEach(([key, value]) => {
        if (key.startsWith('VITE_')) {
          return
        }

        if (key.startsWith('RPC_URI_FOR_')) {
          const chainId = key.replace('RPC_URI_FOR_', '')
          if (/^\d+$/.test(chainId) && typeof value === 'string' && value.length > 0) {
            rpcUriFor[chainId] = value
          }
          return
        }

        if (!PUBLIC_ENV_ALLOWLIST.has(key) || typeof value !== 'string') {
          return
        }

        if (key === 'INFURA_KEY') {
          remappedEnv.VITE_INFURA_PROJECT_ID = value
          return
        }

        remappedEnv[`VITE_${key}`] = value
      })

      if (Object.keys(rpcUriFor).length > 0) {
        remappedEnv.VITE_RPC_URI_FOR = rpcUriFor
      }

      if (Object.keys(remappedEnv).length === 0) {
        return {}
      }

      return {
        define: Object.fromEntries(
          Object.entries(remappedEnv).map(([key, value]) => [`import.meta.env.${key}`, JSON.stringify(value)])
        )
      }
    }
  }
}

export default defineConfig({
  plugins: [
    react(),
    envRemapper(),
    webfontDownload(['https://fonts.googleapis.com/css2?family=Source+Code+Pro:wght@400;500;600;700&display=swap'], {
      injectAsStyleTag: true,
      minifyCss: true,
      async: true,
      cache: true,
      proxy: false
    })
  ],
  resolve: {
    alias: {
      '@lib': path.resolve(__dirname, './apps/lib'),
      '@components': path.resolve(__dirname, './src/components'),
      '@hooks': path.resolve(__dirname, './src/hooks'),
      '@vaults': path.resolve(__dirname, './apps/vaults'),
      '@vaults-v2': path.resolve(__dirname, './apps/vaults-v2'),
      '@vaults-v3': path.resolve(__dirname, './apps/vaults-v3'),
      '@landing': path.resolve(__dirname, './apps/landing'),
      '@safe-global/safe-apps-sdk': path.resolve(__dirname, 'node_modules/@safe-global/safe-apps-sdk/dist/esm'),
      // Polyfill node-fetch for browser
      'node-fetch': 'cross-fetch'
    }
  },
  define: {
    'process.env': {},
    global: 'globalThis'
  },
  server: {
    port: 3000,
    proxy: {
      '/proxy/plausible': {
        target: 'https://plausible.io',
        changeOrigin: true,
        rewrite: (path) => path.replace('/proxy/plausible', '')
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
          rainbowkit: ['@rainbow-me/rainbowkit'],
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
      '@react-hookz/web',
      '@cowprotocol/cow-sdk',
      'cross-fetch'
    ],
    esbuildOptions: {
      define: {
        global: 'globalThis'
      }
    }
  }
})
