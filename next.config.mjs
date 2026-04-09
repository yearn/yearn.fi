import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const externalRedirects = [
  { source: '/twitter', destination: 'https://twitter.com/yearnfi' },
  { source: '/telegram', destination: 'https://t.me/yearnfinance/' },
  { source: '/medium', destination: 'https://medium.com/iearn' },
  { source: '/governance', destination: 'https://gov.yearn.fi/' },
  { source: '/snapshot', destination: 'https://snapshot.org/#/veyfi.eth' },
  { source: '/github', destination: 'https://github.com/yearn/yearn.fi' },
  { source: '/ybribe/:path*', destination: 'https://ybribe.yearn.fi/:path*' },
  { source: '/ycrv/:path*', destination: 'https://ycrv.yearn.fi/:path*' },
  { source: '/veyfi/:path*', destination: 'https://veyfi.yearn.fi/:path*' }
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
    key: 'Content-Security-Policy-Report-Only',
    value:
      "frame-ancestors 'self'; report-uri https://o4510960324837376.ingest.us.sentry.io/api/4510960614375424/security/?sentry_key=6b1b2932f1532eff2227d01a122adbb4;"
  }
]

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'cdn.jsdelivr.net'
      },
      {
        protocol: 'https',
        hostname: 'token-assets.yearn.fi'
      },
      {
        protocol: 'https',
        hostname: 'cdn.clusters.xyz'
      },
      {
        protocol: 'https',
        hostname: 'brand.yearn.fi'
      },
      {
        protocol: 'https',
        hostname: 'og.yearn.fi'
      }
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
      {
        source: '/v2',
        destination: '/vaults?type=lp',
        permanent: false
      },
      {
        source: '/v2/:path*',
        destination: '/vaults?type=lp',
        permanent: false
      },
      {
        source: '/v3',
        destination: '/vaults',
        permanent: false
      },
      {
        source: '/v3/:chainID/:address',
        destination: '/vaults/:chainID/:address',
        permanent: false
      },
      {
        source: '/v3/:path*',
        destination: '/vaults',
        permanent: false
      },
      ...externalRedirects.map((redirect) => ({
        ...redirect,
        permanent: false
      }))
    ]
  },
  async rewrites() {
    return [
      {
        source: '/proxy/plausible/:path*',
        destination: 'https://plausible.io/:path*'
      }
    ]
  },
  webpack(config) {
    config.resolve = config.resolve ?? {}
    config.resolve.alias = {
      ...(config.resolve.alias ?? {}),
      '@safe-global/safe-apps-sdk': path.resolve(__dirname, 'node_modules/@safe-global/safe-apps-sdk/dist/esm'),
      '@react-native-async-storage/async-storage': false
    }
    config.resolve.fallback = {
      ...(config.resolve.fallback ?? {}),
      fs: false,
      net: false,
      tls: false
    }

    return config
  }
}

export default nextConfig
