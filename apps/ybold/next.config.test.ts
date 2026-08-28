import { describe, expect, it } from 'vitest'
import nextConfig from './next.config'

describe('yBOLD Next configuration', () => {
  it('protects every route from untrusted framing while preserving Safe embedding', async () => {
    const configuredRoutes = await nextConfig.headers?.()

    expect(configuredRoutes).toEqual([
      {
        source: '/:path*',
        headers: [
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
      }
    ])
    expect(nextConfig.poweredByHeader).toBe(false)
    expect(nextConfig.transpilePackages).toEqual(['@yearn/vault-widget'])
    expect(nextConfig.turbopack?.resolveAlias?.['@safe-global/safe-apps-sdk']).toBe(
      '../../node_modules/@safe-global/safe-apps-sdk/dist/esm'
    )
  })
})
