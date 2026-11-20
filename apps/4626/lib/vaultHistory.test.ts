import {
  fetchVaultHistory,
  filterHistoryPeriod,
  formatHistoryValue,
  historyGeometry,
  parseVaultHistory
} from '@erc4626/lib/vaultHistory'
import { afterEach, expect, it, vi } from 'vitest'

afterEach(() => vi.unstubAllGlobals())
it('preserves missing values, genuine zeros, negative APY and sorted timestamps', () => {
  expect(
    parseVaultHistory(
      [
        { time: '200', component: 'monthlyNet', value: '-0.1' },
        { time: 100, value: null },
        { time: 300, value: '' },
        { time: 400, value: '0' }
      ],
      'apy'
    )
  ).toEqual([
    { time: 100, value: null },
    { time: 200, value: -0.1 },
    { time: 300, value: null },
    { time: 400, value: 0 }
  ])
  expect(
    parseVaultHistory(
      [
        { time: 100, value: -1 },
        { time: 200, value: false },
        { time: 300, value: 'not a number' }
      ],
      'tvl'
    ).every((point) => point.value === null)
  ).toBe(true)
  expect(() => parseVaultHistory({ error: 'unavailable' }, 'pps')).toThrow()
  expect(() => parseVaultHistory([{ time: 'bad', value: 1 }], 'pps')).toThrow()
})
it('selects the requested component and uses the final observation for a duplicate timestamp', () => {
  expect(
    parseVaultHistory(
      [
        { time: 100, component: 'raw', value: '1000000' },
        { time: 100, component: 'humanized', value: '1.03' },
        { time: 100, component: 'humanized', value: '1.04' }
      ],
      'pps'
    )
  ).toEqual([{ time: 100, value: 1.04 }])
})
it('uses the current time for ranges and excludes future observations', () => {
  const now = 1_800_000_000
  const points = [
    { time: now - 10 * 86400, value: 1 },
    { time: now - 3 * 86400, value: 2 },
    { time: now + 86400, value: 3 }
  ]
  expect(filterHistoryPeriod(points, '7d', now)).toEqual([points[1]])
  expect(filterHistoryPeriod(points, 'all', now)).toEqual(points.slice(0, 2))
})
it('breaks lines at missing values and long gaps, and plots zero and single observations without division by zero', () => {
  const points = [
    { time: 100, value: 1 },
    { time: 86500, value: null },
    { time: 172900, value: 2 },
    { time: 259300, value: 3 },
    { time: 700000, value: 4 }
  ]
  expect(historyGeometry(points).segments.map((segment) => segment.map((point) => point.index))).toEqual([
    [0],
    [2, 3],
    [4]
  ])
  expect(historyGeometry([{ time: 100, value: 0 }]).coordinates[0]).toMatchObject({ x: 240, y: 100 })
  expect(historyGeometry([{ time: 100, value: null }]).coordinates).toEqual([])
})
it('keeps share units distinct from USD and converts fractional APY into percent', () => {
  expect(formatHistoryValue(1.037336, 'pps', 'USDC')).toBe('1.037336 USDC')
  expect(formatHistoryValue(0, 'tvl')).toBe('$0')
  expect(formatHistoryValue(0.0625, 'apy')).toBe('6.25%')
})
it('uses the actual chain/address and component, distinguishes empty history from a failed request, and forwards cancellation', async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(Response.json([{ time: 100, value: '1' }]))
    .mockResolvedValueOnce(new Response('', { status: 404 }))
    .mockResolvedValueOnce(new Response('', { status: 503 }))
  vi.stubGlobal('fetch', fetcher)
  const signal = new AbortController().signal
  const args = { chainId: 8453, address: '0xAbC', metric: 'pps' as const, signal }
  expect(await fetchVaultHistory(args)).toEqual([{ time: 100, value: 1 }])
  const [url, init] = fetcher.mock.calls[0]
  expect(String(url)).toContain('/pps/8453/0xabc?components=humanized')
  expect(init.signal).toBe(signal)
  expect(await fetchVaultHistory(args)).toEqual([])
  await expect(fetchVaultHistory(args)).rejects.toThrow('Unable to load')
})
