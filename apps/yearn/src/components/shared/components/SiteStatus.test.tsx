import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { TSiteHealth } from '@/types/siteStatus'
import { HeaderSiteStatus } from './SiteStatus'

const { mockUseQuery } = vi.hoisted(() => ({
  mockUseQuery: vi.fn()
}))

vi.mock('@tanstack/react-query', () => ({
  useQuery: mockUseQuery
}))

const operationalHealth: TSiteHealth = {
  checkedAt: '2026-09-01T12:00:00.000Z',
  generatedAt: '2026-09-01T12:00:00.100Z',
  services: {
    kong: {
      state: 'operational',
      latencyMs: 42
    },
    rpc: {
      state: 'operational',
      operational: 8,
      total: 8,
      chains: [
        {
          chainId: 1,
          name: 'Ethereum',
          state: 'operational',
          latencyMs: 84
        }
      ]
    }
  }
}

function renderStatus(): string {
  return renderToStaticMarkup(<HeaderSiteStatus />)
}

describe('HeaderSiteStatus', () => {
  beforeEach(() => {
    mockUseQuery.mockReset()
  })

  it('renders an operational trigger and the full status reveal', () => {
    mockUseQuery.mockReturnValue({
      data: operationalHealth,
      isError: false,
      isPending: false
    })

    const html = renderStatus()

    expect(html).toContain('data-header-site-status="true"')
    expect(html).toContain('aria-label="Site status: operational"')
    expect(html).toContain('href="/status"')
    expect(html).toContain('bg-success')
    expect(html).toContain('data-header-site-status-panel="true"')
    expect(html).toContain('Kong')
    expect(html).toContain('online')
    expect(html).toContain('RPCs')
    expect(html).toContain('8/8 online')
    expect(html).toContain('Checked 12:00 UTC')
    expect(html).toContain('translate-x-full')
    expect(html).toContain('group-focus-within/site-status:translate-x-0')
  })

  it('uses a neutral dot and explicit unknown copy when the status request fails', () => {
    mockUseQuery.mockReturnValue({
      data: undefined,
      isError: true,
      isPending: false
    })

    const html = renderStatus()

    expect(html).toContain('aria-label="Site status: unknown"')
    expect(html).toContain('bg-text-tertiary')
    expect(html).toContain('unknown')
    expect(html).toContain('aria-busy="false"')
  })

  it('does not present stale health as current after a background refresh fails', () => {
    mockUseQuery.mockReturnValue({
      data: operationalHealth,
      isError: true,
      isPending: false
    })

    const html = renderStatus()

    expect(html).toContain('aria-label="Site status: unknown"')
    expect(html).toContain('bg-text-tertiary')
    expect(html).not.toContain('8/8 online')
    expect(html).not.toContain('aria-live')
  })

  it('announces pending health checks without relying on the dot color', () => {
    mockUseQuery.mockReturnValue({
      data: undefined,
      isError: false,
      isPending: true
    })

    const html = renderStatus()

    expect(html).toContain('aria-label="Site status: checking"')
    expect(html).toContain('aria-busy="true"')
    expect(html).toContain('checking')
  })
})
