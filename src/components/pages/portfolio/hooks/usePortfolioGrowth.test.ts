import {
  comparePortfolioGrowthVaults,
  getPortfolioGrowthVaultKey,
  mapPortfolioGrowthVaults,
  toPortfolioGrowthDisplay
} from '@pages/portfolio/hooks/usePortfolioGrowth'
import type { TPortfolioGrowthVault } from '@pages/portfolio/types/api'
import { YVUSD_LOCKED_ADDRESS, YVUSD_UNLOCKED_ADDRESS } from '@pages/vaults/utils/yvUsd'
import { describe, expect, it } from 'vitest'

function makeGrowthVault(vaultAddress: string, overrides: Partial<TPortfolioGrowthVault> = {}): TPortfolioGrowthVault {
  return {
    chainId: 1,
    vaultAddress,
    status: 'ok',
    issues: [],
    baselineUsd: 100,
    baselineExposureUsdYears: 0.5,
    growthUsd: 10,
    growthPct: 10,
    annualizedProtocolReturnPct: 20,
    metadata: {
      symbol: 'yvTEST',
      decimals: 18,
      assetDecimals: 6,
      tokenAddress: '0x0000000000000000000000000000000000000001'
    },
    ...overrides
  }
}

describe('portfolio growth helpers', () => {
  it('normalizes vault addresses in lookup keys', () => {
    const vault = makeGrowthVault('0x00000000000000000000000000000000000000aa')

    expect(getPortfolioGrowthVaultKey(vault)).toBe('1_0x00000000000000000000000000000000000000AA')
  })

  it('combines locked and unlocked yvUSD growth under the displayed vault', () => {
    const unlocked = makeGrowthVault(YVUSD_UNLOCKED_ADDRESS, {
      baselineUsd: 100,
      baselineExposureUsdYears: 50,
      growthUsd: 10
    })
    const locked = makeGrowthVault(YVUSD_LOCKED_ADDRESS, {
      baselineUsd: 50,
      baselineExposureUsdYears: 25,
      growthUsd: 5,
      metadata: {
        symbol: 'styvUSD',
        decimals: 18,
        assetDecimals: 6,
        tokenAddress: '0x0000000000000000000000000000000000000002'
      }
    })

    const mapped = mapPortfolioGrowthVaults([unlocked, locked])
    const combined = mapped.get(getPortfolioGrowthVaultKey(unlocked))

    expect(combined).toMatchObject({
      vaultAddress: YVUSD_UNLOCKED_ADDRESS,
      status: 'ok',
      baselineUsd: 150,
      baselineExposureUsdYears: 75,
      growthUsd: 15,
      growthPct: 10,
      annualizedProtocolReturnPct: 20
    })
    expect(combined?.metadata.symbol).toBe('yvTEST')
  })

  it('does not present a combined yvUSD result as complete when one variant is partial', () => {
    const unlocked = makeGrowthVault(YVUSD_UNLOCKED_ADDRESS)
    const locked = makeGrowthVault(YVUSD_LOCKED_ADDRESS, {
      status: 'partial',
      issues: ['unmatched_exit']
    })

    const mapped = mapPortfolioGrowthVaults([unlocked, locked])
    const combined = mapped.get(getPortfolioGrowthVaultKey(unlocked))

    expect(combined?.status).toBe('partial')
    expect(combined?.issues).toEqual(['unmatched_exit'])
    expect(toPortfolioGrowthDisplay(combined)).toBeNull()
  })

  it('does not mark yvUSD complete when only one variant was returned', () => {
    const unlocked = makeGrowthVault(YVUSD_UNLOCKED_ADDRESS)

    const mapped = mapPortfolioGrowthVaults([unlocked])
    const combined = mapped.get(getPortfolioGrowthVaultKey(unlocked))

    expect(combined?.status).toBe('partial')
    expect(toPortfolioGrowthDisplay(combined)).toBeNull()
  })

  it('sorts complete USD growth values and leaves unavailable results last', () => {
    const high = makeGrowthVault('0x0000000000000000000000000000000000000001', { growthUsd: 20 })
    const low = makeGrowthVault('0x0000000000000000000000000000000000000002', { growthUsd: -5 })
    const unavailable = makeGrowthVault('0x0000000000000000000000000000000000000003', {
      status: 'missing_pps',
      issues: ['missing_pps']
    })

    expect(
      [unavailable, low, high].toSorted((left, right) => comparePortfolioGrowthVaults(left, right, 'desc'))
    ).toEqual([high, low, unavailable])
    expect(
      [unavailable, high, low].toSorted((left, right) => comparePortfolioGrowthVaults(left, right, 'asc'))
    ).toEqual([low, high, unavailable])
  })
})
