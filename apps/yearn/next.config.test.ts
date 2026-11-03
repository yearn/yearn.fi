import { getRewrittenUrl, unstable_getResponseFromNextConfig } from 'next/experimental/testing/server'
import { describe, expect, it } from 'vitest'
import { canonicalChains } from '@/config/chainDefinitions'
import nextConfig from './next.config'

describe('Yearn CSP headers', () => {
  it('enforces script sources and keeps connection restrictions report-only', async () => {
    const [route] = (await nextConfig.headers?.()) ?? []
    const enforced = route.headers.find(({ key }) => key === 'Content-Security-Policy')?.value
    const reportOnly = route.headers.find(({ key }) => key === 'Content-Security-Policy-Report-Only')?.value ?? ''
    const connectSrc = reportOnly.split('; ').find((directive) => directive.startsWith('connect-src')) ?? ''
    const scriptSrc = enforced?.split('; ').find((directive) => directive.startsWith('script-src'))

    expect(route.source).toBe('/:path*')
    expect(scriptSrc).toBe("script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:")
    expect(enforced).toContain("frame-ancestors 'self' https://app.safe.global")
    expect(enforced).toContain('report-uri https://')
    expect(enforced).not.toContain('connect-src')
    expect(reportOnly).not.toContain('script-src')
    expect(reportOnly).toContain('report-uri https://')
    canonicalChains.map((chain) => expect(connectSrc).toContain(new URL(chain.rpcUrls.default.http[0]).origin))
  })
})

describe('Yearn Plausible proxy', () => {
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
})
