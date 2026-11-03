import { RPC_URLS } from '@erc4626/lib/rpc'
import nextConfig from '@erc4626/next.config'
import { describe, expect, it } from 'vitest'

describe('4626 CSP headers', () => {
  it('enforces script sources and keeps every RPC origin report-only', async () => {
    const [route] = (await nextConfig.headers?.()) ?? []
    const enforced = route.headers.find(({ key }) => key === 'Content-Security-Policy')?.value ?? ''
    const reportOnly = route.headers.find(({ key }) => key === 'Content-Security-Policy-Report-Only')?.value ?? ''

    const scriptSrc = enforced.split('; ').find((directive) => directive.startsWith('script-src'))

    expect(route.source).toBe('/:path*')
    expect(scriptSrc).toBe("script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:")
    expect(enforced).toContain("frame-ancestors 'self' https://app.safe.global")
    expect(enforced).toContain('report-uri https://')
    expect(enforced).not.toContain('connect-src')
    expect(reportOnly).not.toContain('script-src')
    expect(reportOnly).toContain("connect-src 'self' ")
    expect(reportOnly).toContain('report-uri https://')
    expect(reportOnly).toContain('https://kong.yearn.fi')
    Object.values(RPC_URLS).map((url) => expect(reportOnly).toContain(new URL(url).origin))
  })
})
