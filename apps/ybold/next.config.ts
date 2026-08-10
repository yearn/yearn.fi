import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  transpilePackages: ['@yearn/vault-widget'],
  turbopack: {
    resolveAlias: {
      '@safe-global/safe-apps-sdk': '../../node_modules/@safe-global/safe-apps-sdk/dist/esm'
    }
  }
}

export default nextConfig
