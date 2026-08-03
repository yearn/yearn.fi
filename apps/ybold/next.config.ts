import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_BASE_YEARN_ASSETS_URI:
      process.env.NEXT_PUBLIC_BASE_YEARN_ASSETS_URI ?? 'https://cdn.jsdelivr.net/gh/yearn/tokenassets@main'
  },
  transpilePackages: ['@yearn/vault-widget'],
  turbopack: {
    resolveAlias: {
      '@safe-global/safe-apps-sdk': '../../node_modules/@safe-global/safe-apps-sdk/dist/esm'
    }
  }
}

export default nextConfig
