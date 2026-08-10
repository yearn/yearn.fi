import type { TPortfolioLedgerGrowthVault } from '@pages/portfolio/types/api'
import { describe, expect, it } from 'vitest'
import {
  buildPortfolioLedgerGrowthEndpoint,
  comparePortfolioLedgerGrowthVaults,
  getPortfolioLedgerGrowthCacheKey,
  getPortfolioLedgerGrowthVaultKey,
  mapPortfolioLedgerGrowthVaults,
  toPortfolioLedgerGrowthDisplay
} from './usePortfolioLedgerGrowth'

const ADDRESS = '0x1111111111111111111111111111111111111111'
const VAULT_ADDRESS = '0x2222222222222222222222222222222222222222'
const SNAPSHOT_ID = `snapshot_${'a'.repeat(32)}`

function createGrowthVault(): TPortfolioLedgerGrowthVault {
  return {
    chainId: 1,
    vaultAddress: VAULT_ADDRESS,
    status: 'ok',
    issues: [],
    shares: '1000000',
    sharesFormatted: 1,
    pricePerShare: 1.2,
    currentUnderlying: 1.2,
    baselineUnderlying: 1,
    realizedBaselineUnderlying: 0,
    unrealizedBaselineUnderlying: 1,
    realizedGrowthUnderlying: 0,
    unrealizedGrowthUnderlying: 0.2,
    growthUnderlying: 0.2,
    growthPct: 20,
    baselineExposureUnderlyingYears: 0.5,
    annualizedProtocolReturnPct: 40,
    receiptCount: 1,
    exitCount: 0,
    deposits: 1,
    withdrawals: 0,
    transfersIn: 0,
    transfersOut: 0,
    unmatchedExitShares: '0',
    unmatchedExitSharesFormatted: 0,
    metadata: {
      symbol: 'USDC',
      decimals: 6,
      assetDecimals: 6,
      tokenAddress: '0x3333333333333333333333333333333333333333'
    }
  }
}

describe('portfolio ledger growth helpers', () => {
  it('builds a snapshot-pinned growth endpoint and cache key', () => {
    const endpoint = buildPortfolioLedgerGrowthEndpoint({ address: ADDRESS, snapshotId: SNAPSHOT_ID })

    expect(endpoint).toBe(`/api/holdings/ledger/growth?address=${ADDRESS}&snapshotId=${SNAPSHOT_ID}&version=all`)
    expect(getPortfolioLedgerGrowthCacheKey(endpoint, SNAPSHOT_ID)).toEqual([
      'fetch',
      endpoint,
      'portfolio-ledger-growth',
      SNAPSHOT_ID
    ])
  })

  it('maps response rows to the same chain/address key used by portfolio vault rows', () => {
    const vault = createGrowthVault()
    const key = getPortfolioLedgerGrowthVaultKey(vault)
    const vaultsByKey = mapPortfolioLedgerGrowthVaults([vault])

    expect(key).toBe(`1_${VAULT_ADDRESS}`)
    expect(vaultsByKey.get(key)).toEqual(vault)
  })

  it('maps complete rows to underlying asset growth without rescaling percentage points', () => {
    const display = toPortfolioLedgerGrowthDisplay(createGrowthVault())

    expect(display).toEqual({
      amount: 0.2,
      percent: 20,
      annualizedPercent: 40,
      symbol: 'USDC',
      decimals: 6
    })
  })

  it('does not turn an absent or incomplete row into fake zero growth', () => {
    const missingPps = { ...createGrowthVault(), status: 'missing_pps' as const, growthUnderlying: 0, growthPct: 0 }

    expect(toPortfolioLedgerGrowthDisplay(undefined)).toBeNull()
    expect(toPortfolioLedgerGrowthDisplay(missingPps)).toBeNull()
  })

  it('preserves a genuine zero from a complete row', () => {
    const zeroGrowth = {
      ...createGrowthVault(),
      growthUnderlying: 0,
      growthPct: 0,
      annualizedProtocolReturnPct: 0
    }

    expect(toPortfolioLedgerGrowthDisplay(zeroGrowth)).toMatchObject({ amount: 0, percent: 0, annualizedPercent: 0 })
  })

  it('sorts by comparable growth percentage and keeps unavailable rows last in both directions', () => {
    const lowGrowth = { ...createGrowthVault(), vaultAddress: `${VAULT_ADDRESS.slice(0, -1)}3`, growthPct: -5 }
    const highGrowth = { ...createGrowthVault(), vaultAddress: `${VAULT_ADDRESS.slice(0, -1)}4`, growthPct: 50 }
    const unavailable = {
      ...createGrowthVault(),
      vaultAddress: `${VAULT_ADDRESS.slice(0, -1)}5`,
      status: 'missing_pps' as const,
      growthPct: null
    }

    expect(
      [unavailable, lowGrowth, highGrowth]
        .toSorted((left, right) => comparePortfolioLedgerGrowthVaults(left, right, 'desc'))
        .map((vault) => vault.vaultAddress)
    ).toEqual([highGrowth.vaultAddress, lowGrowth.vaultAddress, unavailable.vaultAddress])
    expect(
      [unavailable, highGrowth, lowGrowth]
        .toSorted((left, right) => comparePortfolioLedgerGrowthVaults(left, right, 'asc'))
        .map((vault) => vault.vaultAddress)
    ).toEqual([lowGrowth.vaultAddress, highGrowth.vaultAddress, unavailable.vaultAddress])
  })
})
