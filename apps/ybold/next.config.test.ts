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
  it('enforces script sources on every route while preserving Safe embedding', async () => {
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
            value: expect.stringContaining(
              "frame-ancestors 'self' https://app.safe.global; script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:; report-uri https://"
            )
          },
          {
            key: 'Content-Security-Policy-Report-Only',
            value: expect.stringContaining("connect-src 'self' ")
          }
        ]
      }
    ])
    const headers = configuredRoutes?.[0]?.headers ?? []
    const enforced = headers.find(({ key }) => key === 'Content-Security-Policy')?.value ?? ''
    const reportOnly = headers.find(({ key }) => key === 'Content-Security-Policy-Report-Only')?.value ?? ''

    expect(enforced.split('; ').find((directive) => directive.startsWith('script-src'))).toBe(
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:"
    )
    expect(enforced).not.toContain('connect-src')
    expect(reportOnly).not.toContain('script-src')
    expect(reportOnly).toContain('report-uri https://')
    expect(nextConfig.poweredByHeader).toBe(false)
    expect(nextConfig.transpilePackages).toEqual(['@yearn/vault-widget', '@yearn/wallet-ui', '@yearn/site-header'])
    expect(nextConfig.turbopack?.resolveAlias?.['@safe-global/safe-apps-sdk']).toBe(
      '../../node_modules/@safe-global/safe-apps-sdk/dist/esm'
    )
  })
})
