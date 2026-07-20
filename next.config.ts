import type { NextConfig } from 'next'

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
    key: 'Content-Security-Policy-Report-Only',
    value:
      "frame-ancestors 'self'; report-uri https://o4510960324837376.ingest.us.sentry.io/api/4510960614375424/security/?sentry_key=6b1b2932f1532eff2227d01a122adbb4;"
  }
]

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  turbopack: {
    resolveAlias: {
      '@safe-global/safe-apps-sdk': './node_modules/@safe-global/safe-apps-sdk/dist/esm'
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
      { source: '/github', destination: 'https://github.com/yearn/yearn.fi', permanent: false }
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
