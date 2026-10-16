import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  agentRules: false,
  poweredByHeader: false,
  transpilePackages: ['@yearn/vault-widget', '@yearn/wallet-ui'],
  turbopack: {
    resolveAlias: {
      '@safe-global/safe-apps-sdk': '../../node_modules/@safe-global/safe-apps-sdk/dist/esm'
    }
  }
}

export default nextConfig
