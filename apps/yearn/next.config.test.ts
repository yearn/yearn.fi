import { describe, expect, it } from 'vitest'
import { canonicalChains } from '@/config/chainDefinitions'
import nextConfig from './next.config'

describe('Yearn CSP headers', () => {
  it('reports script-src and connect-src without enforcing them', async () => {
    const [route] = (await nextConfig.headers?.()) ?? []
    const enforced = route.headers.find(({ key }) => key === 'Content-Security-Policy')?.value
    const reportOnly = route.headers.find(({ key }) => key === 'Content-Security-Policy-Report-Only')?.value ?? ''
    const connectSrc = reportOnly.split('; ').find((directive) => directive.startsWith('connect-src')) ?? ''

    expect(enforced).not.toContain('connect-src')
    expect(reportOnly).toContain("script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:")
    expect(reportOnly).toContain('report-uri https://')
    canonicalChains.map((chain) => expect(connectSrc).toContain(new URL(chain.rpcUrls.default.http[0]).origin))
  })
})
