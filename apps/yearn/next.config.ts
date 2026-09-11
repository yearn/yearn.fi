import { fileURLToPath } from 'node:url'
import { loadEnvConfig } from '@next/env'
import type { NextConfig } from 'next'

const WORKSPACE_ROOT = fileURLToPath(new URL('../..', import.meta.url))
loadEnvConfig(WORKSPACE_ROOT, process.env.NODE_ENV !== 'production', console, true)
const siteUpdatedAt = process.env.NEXT_PUBLIC_SITE_UPDATED_AT || new Date().toISOString()

const CSP_REPORT_URI =
  'https://o4510960324837376.ingest.us.sentry.io/api/4510960614375424/security/?sentry_key=6b1b2932f1532eff2227d01a122adbb4'

/**
 * Origins allowed to frame yearn.fi.
 *
 * Derived from `Content-Security-Policy-Report-Only` telemetry in the Sentry `yearnfi` project.
 * Only vetted integrations are listed; other observed origins were reviewed and excluded.
 * Additions should be verified individually, not bulk-added from reports.
 */
const FRAME_ANCESTORS = [
  "'self'",
  'https://app.safe.global',
  'https://eth.blockscout.com',
  'https://polygon.blockscout.com',
  'https://base.blockscout.com',
  'https://arbitrum.blockscout.com',
  'https://explorer.optimism.io',
  'https://dapps.coin98.com'
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
    // X-Frame-Options is intentionally omitted: it cannot express a multi-origin allowlist and
    // would break the Safe App and Blockscout embeds.
    key: 'Content-Security-Policy',
    value: [`frame-ancestors ${FRAME_ANCESTORS.join(' ')}`, `report-uri ${CSP_REPORT_URI}`].join('; ')
  }
]

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ['@yearn/vault-widget'],
  env: {
    NEXT_PUBLIC_SITE_UPDATED_AT: siteUpdatedAt
  },
  turbopack: {
    resolveAlias: {
      '@safe-global/safe-apps-sdk': '../../node_modules/@safe-global/safe-apps-sdk/dist/esm'
    }
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'assets.yearn.fi' },
      { protocol: 'https', hostname: 'cdn.jsdelivr.net' },
      { protocol: 'https', hostname: 'raw.githubusercontent.com' },
      { protocol: 'https', hostname: 'yearn.fi' },
      { protocol: 'https', hostname: 'og.yearn.fi' }
    ]
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders
      }
    ]
  },
  async redirects() {
    return [
      { source: '/v2', destination: '/vaults?type=lp', permanent: false },
      { source: '/v2/:path*', destination: '/vaults?type=lp', permanent: false },
      { source: '/v3', destination: '/vaults', permanent: false },
      { source: '/ybribe/:path*', destination: 'https://ybribe.yearn.fi/:path*', permanent: false },
      { source: '/ycrv/:path*', destination: 'https://ycrv.yearn.fi/:path*', permanent: false },
      { source: '/veyfi/:path*', destination: 'https://veyfi.yearn.fi/:path*', permanent: false },
      { source: '/twitter', destination: 'https://twitter.com/yearnfi', permanent: false },
      { source: '/telegram', destination: 'https://t.me/yearnfinance/', permanent: false },
      { source: '/medium', destination: 'https://medium.com/iearn', permanent: false },
      { source: '/governance', destination: 'https://gov.yearn.fi/', permanent: false },
      { source: '/snapshot', destination: 'https://snapshot.org/#/styfi.eth', permanent: false },
      { source: '/github', destination: 'https://github.com/yearn/yearn.fi', permanent: false },
      { source: '/security.txt', destination: '/.well-known/security.txt', permanent: false }
    ]
  },
  async rewrites() {
    return [
      {
        source: '/proxy/plausible/:path*',
        destination: 'https://plausible.io/:path*'
      }
    ]
  }
}

export default nextConfig
