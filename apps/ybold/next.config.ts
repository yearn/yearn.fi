import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadEnvConfig } from '@next/env'
import type { NextConfig } from 'next'

export const YBOLD_ENV_DIRECTORY = fileURLToPath(new URL('../..', import.meta.url))
loadEnvConfig(YBOLD_ENV_DIRECTORY, process.env.NODE_ENV !== 'production', console, true)

const DISABLED_BASE_ACCOUNT_MODULE = resolve(import.meta.dirname, 'lib/disabledBaseAccount.ts')
const DISABLED_BASE_ACCOUNT_TURBOPACK_ALIAS = './lib/disabledBaseAccount.ts'
const requireFromYbold = createRequire(import.meta.url)
const YBOLD_WAGMI_MODULE = dirname(requireFromYbold.resolve('wagmi/package.json'))
const YBOLD_WAGMI_TURBOPACK_ALIAS = './node_modules/wagmi'

const securityHeaders = [
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload'
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff'
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin'
  },
  {
    key: 'Content-Security-Policy',
    value: "frame-ancestors 'self' https://app.safe.global"
  }
]

const nextConfig: NextConfig = {
  poweredByHeader: false,
  transpilePackages: ['@yearn/vault-widget'],
  turbopack: {
    resolveAlias: {
      '@base-org/account': DISABLED_BASE_ACCOUNT_TURBOPACK_ALIAS,
      '@safe-global/safe-apps-sdk': '../../node_modules/@safe-global/safe-apps-sdk/dist/esm',
      wagmi: YBOLD_WAGMI_TURBOPACK_ALIAS
    }
  },
  webpack(config) {
    return {
      ...config,
      resolve: {
        ...config.resolve,
        alias: {
          ...config.resolve.alias,
          '@base-org/account': DISABLED_BASE_ACCOUNT_MODULE,
          wagmi: YBOLD_WAGMI_MODULE
        }
      }
    }
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders
      }
    ]
  }
}

export default nextConfig
