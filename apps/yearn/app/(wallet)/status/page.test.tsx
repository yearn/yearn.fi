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
    expect(html).toContain('Kong vault data')
    expect(html).toContain('Ethereum')
    expect(html).toContain('Optimism')
    expect(html).toContain('Health checked')
    expect(html).toContain('Status snapshot generated')
    expect(html).toContain('Most recent direct checks, cached for 30 seconds.')
    expect(html).toContain('Kong representation modified')
    expect(html).toContain('Site build created')
    expect(html).toContain('href="/api/status"')
    expect(html).toContain('href="/api/vaults/markdown"')
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
