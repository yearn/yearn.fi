import react from '@vitejs/plugin-react'
import path from 'path'
import { defineConfig, loadEnv } from 'vite'

const DEFAULT_HOST = '127.0.0.1'
const DEFAULT_API_SERVER_PORT = '3001'
const API_HEALTHCHECK_PATH = '/api/enso/balances'
const API_HEALTHCHECK_EXPECTED_ERROR = 'Missing eoaAddress'
const API_HEALTHCHECK_TIMEOUT_MS = 500
const API_HEALTHCHECK_RETRIES = 10
const API_HEALTHCHECK_DELAY_MS = 300

function resolveApiProxyTarget(env: Record<string, string>) {
  return env.API_PROXY_TARGET || `http://${env.API_PROXY_HOST || DEFAULT_HOST}:${env.API_SERVER_PORT || DEFAULT_API_SERVER_PORT}`
}

function resolveClientHost(env: Record<string, string>) {
  return env.HOST || DEFAULT_HOST
}

function resolveClientPort(env: Record<string, string>) {
  const configuredPort = Number(env.PORT)
  return Number.isInteger(configuredPort) && configuredPort > 0 ? configuredPort : 3000
}

function buildProxy(apiProxyTarget: string) {
  return {
    '/api': {
      target: apiProxyTarget,
      changeOrigin: true
    },
    '/proxy/plausible': {
      target: 'https://plausible.io',
      changeOrigin: true,
      rewrite: (path: string) => path.replace('/proxy/plausible', '')
    }
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function pingApi(apiProxyTarget: string) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), API_HEALTHCHECK_TIMEOUT_MS)

  try {
    const response = await fetch(`${apiProxyTarget}${API_HEALTHCHECK_PATH}`, { signal: controller.signal })
    const data = await response.json().catch(() => null)
    if (response.status !== 400 || data?.error !== API_HEALTHCHECK_EXPECTED_ERROR) {
      throw new Error('Unexpected API healthcheck response')
    }
  } finally {
    clearTimeout(timeout)
  }
}

function previewApiGuard(apiProxyTarget: string) {
  return {
    name: 'preview-api-guard',
    async configurePreviewServer(server: { config: { logger: { error: (msg: string) => void } } }) {
      for (let attempt = 0; attempt < API_HEALTHCHECK_RETRIES; attempt += 1) {
        try {
          await pingApi(apiProxyTarget)
          return
        } catch (_error) {
          if (attempt < API_HEALTHCHECK_RETRIES - 1) {
            await sleep(API_HEALTHCHECK_DELAY_MS)
          }
        }
      }

      const message = `Preview requires the API server running at ${apiProxyTarget}. Start it with: bun run dev:server`
      server.config.logger.error(message)
      throw new Error(message)
    }
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiProxyTarget = resolveApiProxyTarget(env)
  const host = resolveClientHost(env)
  const port = resolveClientPort(env)
  const proxy = buildProxy(apiProxyTarget)

  return {
    plugins: [react(), previewApiGuard(apiProxyTarget)],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        '@shared': path.resolve(__dirname, './src/components/shared'),
        '@pages': path.resolve(__dirname, './src/components/pages'),
        '@components': path.resolve(__dirname, './src/components'),
        '@hooks': path.resolve(__dirname, './src/hooks'),
        '@safe-global/safe-apps-sdk': path.resolve(__dirname, 'node_modules/@safe-global/safe-apps-sdk/dist/esm')
      }
    },
    define: {
      'process.env': {},
      global: 'globalThis'
    },
    server: {
      host,
      port,
      proxy
    },
    preview: {
      host,
      port,
      proxy
    },
    build: {
      outDir: 'dist',
      sourcemap: true,
      rollupOptions: {
        output: {
          manualChunks: {
            'react-vendor': ['react', 'react-dom', 'react-router'],
            'wagmi-vendor': ['wagmi', 'viem'],
            rainbowkit: ['@rainbow-me/rainbowkit'],
            'ui-vendor': ['@headlessui/react'],
            'motion-vendor': ['framer-motion'],
            'charts-vendor': ['recharts']
          }
        }
      }
    },
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'react-router',
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
      ],
      esbuildOptions: {
        define: {
          global: 'globalThis'
        }
      }
    }
  }
})
