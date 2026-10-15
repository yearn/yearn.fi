// @vitest-environment jsdom

import StatusPage from '@pages/status'
import { HeaderSiteStatus, MobileSiteStatus } from '@shared/components/SiteStatus'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { TSiteHealth } from '@/types/siteStatus'

const initialHealth: TSiteHealth = {
  checkedAt: '2026-09-01T12:00:00.000Z',
  generatedAt: '2026-09-01T12:00:00.100Z',
  services: {
    kong: { state: 'operational', latencyMs: 42, cacheRefreshedAt: '2026-09-01T11:59:00.000Z' },
    prices: { state: 'operational', latencyMs: 35 },
    portfolio: { state: 'operational', latencyMs: 51 },
    transactions: { state: 'operational', latencyMs: 63 },
    cms: { state: 'operational', latencyMs: 71 },
    tokenAssets: { state: 'operational', latencyMs: 82 },
    rpc: {
      state: 'operational',
      operational: 2,
      total: 2,
      chains: [
        { chainId: 1, name: 'Ethereum', state: 'operational', latencyMs: 84 },
        { chainId: 10, name: 'Optimism', state: 'operational', latencyMs: 90 }
      ]
    }
  }
}

const fetchHealth = vi.fn()

function renderStatus(client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } })) {
  return render(
    <QueryClientProvider client={client}>
      <HeaderSiteStatus />
      <MobileSiteStatus onNavigate={() => undefined} />
      <StatusPage initialHealth={initialHealth} />
    </QueryClientProvider>
  )
}

async function advancePolling(milliseconds = 60_000): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(milliseconds)
  })
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1)
  })
}

function expectConsistentStatus(state: string, summary: string): void {
  expect(screen.getByRole('link', { name: `Site status: ${state}` })).toBeTruthy()
  expect(within(screen.getByRole('complementary', { name: 'Site status details' })).getByText(summary)).toBeTruthy()
  expect(within(screen.getByRole('complementary', { name: 'Site status' })).getByText(summary)).toBeTruthy()
}

describe('live system status', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(initialHealth.checkedAt))
    fetchHealth.mockReset()
    vi.stubGlobal('fetch', fetchHealth)
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('polls outage and recovery into service rows, networks, timestamps, and both indicators', async () => {
    const outage: TSiteHealth = {
      ...initialHealth,
      checkedAt: '2026-09-01T12:01:00.000Z',
      generatedAt: '2026-09-01T12:01:00.100Z',
      services: {
        ...initialHealth.services,
        kong: { state: 'unavailable', latencyMs: 4_000 },
        rpc: {
          ...initialHealth.services.rpc,
          state: 'degraded',
          operational: 1,
          chains: [
            { chainId: 1, name: 'Ethereum', state: 'unavailable', latencyMs: 4_000 },
            initialHealth.services.rpc.chains[1]
          ]
        }
      }
    }
    const recovery: TSiteHealth = {
      ...initialHealth,
      checkedAt: '2026-09-01T12:02:00.000Z',
      generatedAt: '2026-09-01T12:02:00.100Z',
      services: {
        ...initialHealth.services,
        kong: { state: 'operational', latencyMs: 27, cacheRefreshedAt: '2026-09-01T12:01:59.000Z' }
      }
    }
    fetchHealth.mockResolvedValueOnce({ ok: true, json: async () => outage })
    fetchHealth.mockResolvedValue({ ok: true, json: async () => recovery })
    const { container } = renderStatus()

    expect(screen.getByText('2 of 2 responding')).toBeTruthy()
    expect(fetchHealth).not.toHaveBeenCalled()
    await advancePolling(1)
    expectConsistentStatus('operational', 'All services operational')

    await advancePolling()

    expect(fetchHealth).toHaveBeenCalledTimes(1)
    expectConsistentStatus('degraded', 'Some services degraded')
    expect(screen.getAllByText('Unavailable')).toHaveLength(2)
    expect(screen.getByText('1 of 2 responding')).toBeTruthy()
    expect(screen.getByText('4000 ms response')).toBeTruthy()
    expect(screen.getByRole('row', { name: /Ethereum/ }).textContent).toContain('Unavailable')
    expect(container.querySelectorAll(`time[datetime="${outage.checkedAt}"]`)).toHaveLength(3)
    expect(container.querySelector(`time[datetime="${outage.generatedAt}"]`)).toBeTruthy()
    expect(screen.getByText('Not reported by Kong')).toBeTruthy()

    await advancePolling()

    expect(fetchHealth).toHaveBeenCalledTimes(2)
    expectConsistentStatus('operational', 'All services operational')
    expect(screen.queryByText('Unavailable')).toBeNull()
    expect(screen.getByText('2 of 2 responding')).toBeTruthy()
    expect(screen.getByText('27 ms response')).toBeTruthy()
    expect(screen.getByRole('row', { name: /Ethereum/ }).textContent).toContain('Operational')
    expect(container.querySelectorAll(`time[datetime="${recovery.checkedAt}"]`)).toHaveLength(3)
    expect(container.querySelector(`time[datetime="${recovery.generatedAt}"]`)).toBeTruthy()
    expect(container.querySelector(`time[datetime="${recovery.services.kong.cacheRefreshedAt}"]`)).toBeTruthy()
  })

  it('shows unavailable status after a failed refresh and resumes details after recovery', async () => {
    fetchHealth.mockResolvedValue({ ok: false, status: 503 })
    renderStatus()

    await advancePolling(61_001)

    expectConsistentStatus('unknown', 'Status unavailable')
    expect(screen.getByRole('status').textContent).toContain('Unable to refresh status')
    expect(screen.queryByRole('region', { name: 'Services' })).toBeNull()
    expect(screen.queryByText('Operational')).toBeNull()

    fetchHealth.mockResolvedValue({ ok: true, json: async () => initialHealth })
    await advancePolling()

    expectConsistentStatus('operational', 'All services operational')
    expect(screen.getByRole('region', { name: 'Services' })).toBeTruthy()
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('uses the existing shared snapshot when navigating to the page with cached status', () => {
    const client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } })
    const cachedHealth: TSiteHealth = {
      ...initialHealth,
      services: { ...initialHealth.services, prices: { state: 'unavailable', latencyMs: 4_000 } }
    }
    client.setQueryData(['site-status'], cachedHealth)
    renderStatus(client)

    expectConsistentStatus('degraded', 'Some services degraded')
    expect(screen.getByText('Unavailable')).toBeTruthy()
    expect(screen.getByText('4000 ms response')).toBeTruthy()
    expect(fetchHealth).not.toHaveBeenCalled()
  })
})
