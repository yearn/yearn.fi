// @vitest-environment jsdom
import { getVaultView } from '@pages/vaults/domain/kongVaultSelectors'
import { useCurvePoolApySnapshot, useCurvePoolApyVaults } from '@pages/vaults/hooks/useCurvePoolApy'
import { useVaultApyData } from '@pages/vaults/hooks/useVaultApyData'
import { getIdleCurveEstimate, isIdleCurveVault, resolveCurvePoolApys } from '@pages/vaults/utils/curvePoolApy'
import { buildVaultsInitialPayload, getVaultsInitialVaultSource } from '@pages/vaults/utils/vaultsInitialPayload'
import { buildVaultSnapshotEndpoint } from '@shared/data/publicQueryEndpoints'
import { getFetchQueryKey } from '@shared/utils/fetchQuery'
import { kongVaultListItemSchema } from '@shared/utils/schemas/kongVaultListSchema'
import { kongVaultSnapshotSchema } from '@shared/utils/schemas/kongVaultSnapshotSchema'
import { calculateVaultEstimatedAPY, calculateVaultHistoricalAPY } from '@shared/utils/vaultApy'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, renderHook, waitFor } from '@testing-library/react'
import type { PropsWithChildren } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

// Reduced Kong/Curve responses for the reported stETH factory vault.
const ADDRESS = '0x5B8C556B8b2a78696F0B9B830B3d67623122E270'
const LP = '0x06325440D014e39736583c165C2963BA99fAf14E'
const POOL = '0xDC24316b9AE028F1497c275EB9192a3Ea0f67022'
const asset = { address: LP, chainId: 1, name: 'Curve.fi ETH/stETH', symbol: 'steCRV', decimals: 18 }
const snapshot = kongVaultSnapshotSchema.parse({
  address: ADDRESS,
  chainId: 1,
  apiVersion: '0.4.5',
  asset,
  meta: { category: 'Curve' },
  totalAssets: '1984679590445030959577',
  totalIdle: '1984679590445030959577',
  totalDebt: '0',
  performance: { estimated: { apy: 0, type: 'crv', components: { poolAPY: 0 } } },
  apy: { net: 0.04, weeklyNet: 0.03, monthlyNet: 0.02 },
  debts: [{ strategy: ADDRESS, totalDebt: '0', debtRatio: 0 }]
})
const vault = kongVaultListItemSchema.parse({
  address: ADDRESS,
  chainId: 1,
  apiVersion: '0.4.5',
  asset,
  name: 'Curve stETH Factory yVault',
  symbol: 'yvCurve-stETH-f',
  decimals: 18,
  tvl: 5640381,
  performance: {
    ...snapshot.performance,
    historical: { net: 0.04, weeklyNet: 0.03, monthlyNet: 0.02, inceptionNet: 0.01 }
  },
  fees: { managementFee: 0, performanceFee: 1000 },
  category: 'Curve',
  type: 'Automated Yearn Vault',
  kind: 'Legacy',
  origin: 'yearn',
  yearn: true,
  v3: false,
  isRetired: false,
  isHidden: false,
  isBoosted: false,
  isHighlighted: false,
  strategiesCount: 3,
  riskLevel: null
})
const pools = {
  success: true,
  data: { poolData: [{ address: POOL, lpTokenAddress: LP, gaugeCrvApy: [10, 25], gaugeRewards: [{ apy: 99 }] }] }
}
const apys = {
  success: true,
  data: {
    baseApys: [
      {
        address: POOL.toLowerCase(),
        latestDailyApyPcent: 1.27,
        latestWeeklyApyPcent: 1.3,
        additionalApyPcentFromLsts: 1
      }
    ]
  }
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function setup(data = snapshot) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  queryClient.setQueryData(getFetchQueryKey(buildVaultSnapshotEndpoint(1, ADDRESS))!, data)
  const fetch = vi.fn(async (url: string) => {
    if (url.includes('/getPools/all/ethereum')) return Response.json(pools)
    if (url.includes('/getBaseApys/ethereum')) return Response.json(apys)
    throw new Error(`Unexpected request: ${url}`)
  })
  vi.stubGlobal('fetch', fetch)
  const wrapper = ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
  return { wrapper, fetch, queryClient }
}

describe('idle Curve pool APY', () => {
  it('matches LP tokens to pools, converts percent to decimal, and excludes all gauge rewards and duplicate LST yield', () => {
    expect(resolveCurvePoolApys(pools, apys)).toEqual({ [LP.toLowerCase()]: 0.0127 })
    expect(getIdleCurveEstimate(snapshot, resolveCurvePoolApys(pools, apys))).toEqual({
      apy: 0.0127,
      type: 'curve-pool',
      components: { poolAPY: 0.0127 }
    })
  })

  it('prefers the verified pool estimate over any stale oracle or historical returns', () => {
    const estimated = getIdleCurveEstimate(snapshot, resolveCurvePoolApys(pools, apys))!
    const corrected = {
      ...vault,
      performance: { ...vault.performance, oracle: { apr: 0.5, apy: 0.6 }, estimated }
    }
    expect(calculateVaultEstimatedAPY(corrected)).toBe(0.0127)
    expect(calculateVaultEstimatedAPY(getVaultView(corrected))).toBe(0.0127)
  })

  it.each([
    { totalDebt: '1' },
    { totalDebt: undefined },
    { totalDebt: 'invalid' },
    { totalIdle: '1' },
    { totalIdle: undefined },
    { totalAssets: '0', totalIdle: '0' },
    { apiVersion: '3.0.4' },
    { apiVersion: '1.0.0' },
    { chainId: 999 },
    { meta: { ...snapshot.meta!, category: 'Stablecoin' } },
    { performance: { estimated: { apy: 0.1, type: 'crv', components: {} } } }
  ])('does not replace APY without explicit evidence of a funded, fully idle V2 Curve vault: %j', (overrides) => {
    expect(isIdleCurveVault({ ...snapshot, ...overrides })).toBe(false)
  })

  it('ignores missing, broken and malformed pools without treating a separate swap contract as its LP token', () => {
    const resolved = resolveCurvePoolApys(
      {
        success: true,
        data: {
          poolData: [...pools.data.poolData, null, { address: ADDRESS, isBroken: true }, { address: 'not-an-address' }]
        }
      },
      apys
    )
    expect(resolved[POOL.toLowerCase()]).toBeUndefined()
    expect(getIdleCurveEstimate(snapshot, {})).toBeUndefined()
    expect(getIdleCurveEstimate(snapshot, { [LP.toLowerCase()]: Number.NaN })).toBeUndefined()
  })

  it('supports pools whose LP token is the pool address and weekly fallback only when daily APY is missing', () => {
    const pool = { success: true, data: { poolData: [{ address: POOL }] } }
    expect(
      resolveCurvePoolApys(pool, {
        success: true,
        data: { baseApys: [{ address: POOL, latestDailyApyPcent: null, latestWeeklyApyPcent: 1.3 }] }
      })
    ).toEqual({ [POOL.toLowerCase()]: 1.3 / 100 })
    expect(
      resolveCurvePoolApys(pool, {
        success: true,
        data: { baseApys: [{ address: POOL, latestDailyApyPcent: 0, latestWeeklyApyPcent: 1.3 }] }
      })
    ).toEqual({ [POOL.toLowerCase()]: 0 })
  })

  it('updates list, detail, sorting and portfolio estimates consistently using shared cached queries', async () => {
    const { wrapper, fetch } = setup()
    const initialSource = getVaultsInitialVaultSource(buildVaultsInitialPayload([vault]))!
    const { result, rerender } = renderHook(
      () => {
        const list = useCurvePoolApyVaults([vault])
        const initialList = useCurvePoolApyVaults(Object.values(initialSource.vaults))
        const detail = useCurvePoolApySnapshot(snapshot)
        const view = getVaultView(vault, detail)
        const display = useVaultApyData(view)
        return { list, initialList, detail, view, display }
      },
      { wrapper }
    )
    await waitFor(() => expect(calculateVaultEstimatedAPY(result.current.list[0])).toBe(0.0127))
    expect(calculateVaultEstimatedAPY(result.current.view)).toBe(0.0127)
    expect(calculateVaultEstimatedAPY(result.current.initialList[0])).toBe(0.0127)
    expect(result.current.display.mode).toBe('spot')
    expect(result.current.display.baseForwardApr).toBe(0.0127)
    expect(result.current.display.rewardsAprSum).toBe(0)
    expect(result.current.view.apr.forwardAPR.composite.boost).toBe(0)
    expect(calculateVaultHistoricalAPY(result.current.view)).toBe(0.02)
    expect(fetch).toHaveBeenCalledTimes(2)
    const previous = result.current.detail
    rerender()
    expect(result.current.detail).toBe(previous)
  })

  it.each([0, -0.001])('does not fall back to stale strategy returns when the pool base APY is %s', async (apy) => {
    const { wrapper, queryClient } = setup()
    queryClient.setQueryData(['curve-base-apys', 1], { [LP.toLowerCase()]: apy })
    const { result } = renderHook(
      () => {
        const data = useCurvePoolApySnapshot(snapshot)
        const view = getVaultView(vault, data)
        return { view, display: useVaultApyData(view) }
      },
      { wrapper }
    )
    expect(calculateVaultEstimatedAPY(result.current.view)).toBe(apy)
    expect(result.current.display.mode).toBe('spot')
    expect(result.current.display.baseForwardApr).toBe(apy)
  })

  it('leaves an allocated zero-APY vault alone and avoids Curve requests', () => {
    const allocated = { ...snapshot, totalDebt: '1', totalIdle: '0' }
    const { wrapper, fetch } = setup(allocated)
    const { result } = renderHook(
      () => ({
        list: useCurvePoolApyVaults([vault]),
        detail: useCurvePoolApySnapshot(allocated)
      }),
      { wrapper }
    )
    expect(result.current.list[0]).toBe(vault)
    expect(result.current.detail).toBe(allocated)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('preserves Kong data when Curve is unavailable', async () => {
    const { wrapper, fetch, queryClient } = setup()
    fetch.mockRejectedValue(new Error('Curve unavailable'))
    const { result } = renderHook(() => useCurvePoolApySnapshot(snapshot), { wrapper })
    await waitFor(() => expect(queryClient.getQueryState(['curve-base-apys', 1])?.status).toBe('error'))
    expect(result.current).toBe(snapshot)
  })
})
