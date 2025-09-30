import react from '@vitejs/plugin-react'
import path from 'path'
import { defineConfig, loadEnv } from 'vite'
import webfontDownload from 'vite-plugin-webfont-dl'

function envRemapper() {
  return {
    name: 'env-remapper',
    config(_: any, { mode }: any) {
      const env = loadEnv(mode, process.cwd(), '')
      const remappedEnv: Record<string, string | any> = {}
      const rpcUriFor: Record<string, string> = {}

      // Map non-VITE_ prefixed env vars to VITE_ prefixed ones
      Object.keys(env).forEach((key) => {
        if (!key.startsWith('VITE_')) {
          // Special handling for RPC_URI_FOR_* variables
          if (key.startsWith('RPC_URI_FOR_')) {
            const chainId = key.replace('RPC_URI_FOR_', '')
            rpcUriFor[chainId] = env[key]
          } else if (key === 'INFURA_KEY') {
            // Map INFURA_KEY to VITE_INFURA_PROJECT_ID for compatibility
            // biome-ignore lint/complexity/useLiteralKeys: it's ok
            remappedEnv['VITE_INFURA_PROJECT_ID'] = env[key]
          } else {
            remappedEnv[`VITE_${key}`] = env[key]
          }
        }
      })

      // Add the aggregated RPC_URI_FOR object
      if (Object.keys(rpcUriFor).length > 0) {
        // biome-ignore lint/complexity/useLiteralKeys: it's ok
        remappedEnv['VITE_RPC_URI_FOR'] = rpcUriFor
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
      '@demo': path.resolve(__dirname, './apps/demo'),
      '@vaults': path.resolve(__dirname, './apps/vaults'),
      '@vaults-v2': path.resolve(__dirname, './apps/vaults-v2'),
      '@vaults-v3': path.resolve(__dirname, './apps/vaults-v3'),
      '@landing': path.resolve(__dirname, './apps/landing'),
      '@nextgen': path.resolve(__dirname, './apps/nextgen'),
      '@utils': path.resolve(__dirname, './apps/nextgen/utils'),
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
