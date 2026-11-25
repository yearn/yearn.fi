import nextConfig from '@ybold/next.config'
import { getRewrittenUrl, unstable_getResponseFromNextConfig } from 'next/experimental/testing/server'
import { describe, expect, it } from 'vitest'

describe('yBOLD Next configuration', () => {
  it('keeps analytics event requests on the app origin', async () => {
    const response = await unstable_getResponseFromNextConfig({
      url: 'https://yearn.fi/proxy/plausible/api/event?probe=1',
      nextConfig
    })

    expect(getRewrittenUrl(response)).toBe(null)
  })

  it.each([
    '/proxy/plausible/js/script.js',
    '/proxy/plausible/js/pa-example.js',
    '/proxy/plausible/api/event/script.js'
  ])('does not proxy vendor content at %s', async (pathname) => {
    const response = await unstable_getResponseFromNextConfig({
      url: `https://yearn.fi${pathname}`,
      nextConfig
    })

    expect(getRewrittenUrl(response)).toBe(null)
  })
  it('configures security headers and shared packages', async () => {
    const configuredRoutes = await nextConfig.headers?.()

    expect(configuredRoutes).toEqual([
      {
        source: '/:path*',
        headers: expect.arrayContaining([
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
          }
        ])
      }
    ])
    expect(nextConfig.poweredByHeader).toBe(false)
    expect(nextConfig.transpilePackages).toEqual(['@yearn/vault-widget', '@yearn/wallet-ui', '@yearn/site-header'])
    expect(nextConfig.turbopack?.resolveAlias?.['@safe-global/safe-apps-sdk']).toBe(
      '../../node_modules/@safe-global/safe-apps-sdk/dist/esm'
    )
  })
})
