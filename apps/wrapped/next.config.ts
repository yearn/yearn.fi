import type { NextConfig } from 'next'

const config: NextConfig = {
  poweredByHeader: false,
  transpilePackages: ['@yearn/wallet-ui', '@yearn/wrapped-contract', '@yearn/site-header'],
  turbopack: {
    resolveAlias: { '@safe-global/safe-apps-sdk': '../../node_modules/@safe-global/safe-apps-sdk/dist/esm' }
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Content-Security-Policy', value: "frame-ancestors 'self' https://app.safe.global" },
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' }
        ]
      }
    ]
  }
}
export default config
