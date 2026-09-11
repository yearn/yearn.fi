import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { TSiteHealth } from '@/types/siteStatus'
import Page, { metadata } from './page'

const { mockGetSiteHealth } = vi.hoisted(() => ({
  mockGetSiteHealth: vi.fn()
}))

vi.mock('@/server/status', () => ({
  getSiteHealth: mockGetSiteHealth
}))

const health: TSiteHealth = {
  checkedAt: '2026-09-01T12:00:00.000Z',
  generatedAt: '2026-09-01T12:00:00.100Z',
  builtAt: '2026-08-31T18:30:00.000Z',
  services: {
    kong: {
      state: 'operational',
      latencyMs: 42,
      representationUpdatedAt: '2026-09-01T11:59:00.000Z'
    },
    prices: { state: 'operational', latencyMs: 35 },
    portfolio: { state: 'operational', latencyMs: 51 },
    transactions: { state: 'unavailable', latencyMs: 63 },
    cms: { state: 'operational', latencyMs: 71 },
    tokenAssets: { state: 'operational', latencyMs: 82 },
    rpc: {
      state: 'degraded',
      operational: 1,
      total: 2,
      chains: [
        { chainId: 1, name: 'Ethereum', state: 'operational', latencyMs: 84 },
        { chainId: 10, name: 'Optimism', state: 'unavailable', latencyMs: 4_000 }
      ]
    }
  }
}

describe('system status page', () => {
  beforeEach(() => {
    mockGetSiteHealth.mockResolvedValue(health)
  })

  it('renders current service state, networks, and explicit timestamp semantics in HTML', async () => {
    const html = renderToStaticMarkup(await Page())

    expect(html).toContain('<h1')
    expect(html).toContain('System status')
    expect(html).toContain('Vault data')
    expect(html).toContain('Prices')
    expect(html).toContain('Portfolio activity')
    expect(html).toContain('Transactions')
    expect(html).toContain('Yearn Prices')
    expect(html).toContain('Envio indexer')
    expect(html).toContain('Enso routing')
    expect(html).toContain('Yearn CMS')
    expect(html).toContain('Token assets')
    expect(html).toContain('Network connections')
    expect(html).toContain('Ethereum')
    expect(html).toContain('Optimism')
    expect(html).toContain('Last checked')
    expect(html).toContain('Status generated')
    expect(html).toContain('Checks are cached for 30 seconds.')
    expect(html).toContain('Vault data modified')
    expect(html).toContain('Site build created')
    expect(html).toContain('<summary')
    expect(html).toContain('Technical details')
    expect(html).not.toContain('Yearn infrastructure')
    expect(html).toContain('href="/api/status"')
    expect(html).toContain('href="/api/vaults/markdown"')
    expect(html).toContain('href="https://cms.yearn.fi"')
    expect(html).toContain('href="https://token-assets.yearn.fi"')
  })

  it('advertises a canonical HTML URL and JSON alternate', () => {
    expect(metadata.alternates).toMatchObject({
      canonical: '/status',
      types: {
        'application/json': [{ url: 'https://yearn.fi/api/status' }]
      }
    })
  })
})
