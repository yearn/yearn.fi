import { RPC_URLS } from '@erc4626/lib/rpc'
import type { NextConfig } from 'next'

const CSP_REPORT_URI =
  'https://o4510960324837376.ingest.us.sentry.io/api/4510960614375424/security/?sentry_key=6b1b2932f1532eff2227d01a122adbb4'

const SCRIPT_SRC = ["'self'", "'unsafe-inline'", "'unsafe-eval'", 'blob:']

const CONNECT_SRC = [
  ...new Set([
    "'self'",
    ...Object.values(RPC_URLS).map((url) => new URL(url).origin),
    'https://kong.yearn.fi',
    'https://yearn.fi',
    'wss://relay.walletconnect.org',
    'https://pulse.walletconnect.org',
    'https://verify.walletconnect.org',
    'https://verify.walletconnect.com',
    'https://rpc.walletconnect.org'
  ])
]

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
  },
  {
    key: 'Content-Security-Policy-Report-Only',
    value: [
      `script-src ${SCRIPT_SRC.join(' ')}`,
      `connect-src ${CONNECT_SRC.join(' ')}`,
      `report-uri ${CSP_REPORT_URI}`
    ].join('; ')
  }
]

const nextConfig: NextConfig = {
  poweredByHeader: false,
  transpilePackages: ['@yearn/vault-widget', '@yearn/site-header', '@yearn/wallet-ui'],
  turbopack: {
    resolveAlias: {
      '@safe-global/safe-apps-sdk': '../../node_modules/@safe-global/safe-apps-sdk/dist/esm'
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
