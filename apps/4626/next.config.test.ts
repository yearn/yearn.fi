import { RPC_URLS } from '@erc4626/lib/rpc'
import nextConfig from '@erc4626/next.config'
import { describe, expect, it } from 'vitest'

describe('4626 CSP headers', () => {
  it('reports script-src and connect-src for every RPC origin', async () => {
    const [route] = (await nextConfig.headers?.()) ?? []
    const reportOnly = route.headers.find(({ key }) => key === 'Content-Security-Policy-Report-Only')?.value ?? ''

    expect(reportOnly).toContain("script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:")
    expect(reportOnly).toContain('https://kong.yearn.fi')
    Object.values(RPC_URLS).map((url) => expect(reportOnly).toContain(new URL(url).origin))
  })
})
