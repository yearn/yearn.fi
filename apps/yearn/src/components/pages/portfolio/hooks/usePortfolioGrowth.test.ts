import {
  comparePortfolioGrowthVaults,
  getPortfolioGrowthVaultKey,
  mapPortfolioGrowthVaults,
  toPortfolioGrowthDisplay
} from '@pages/portfolio/hooks/usePortfolioGrowth'
import type { TPortfolioGrowthVault } from '@pages/portfolio/types/api'
import { YBOLD_STAKING_ADDRESS, YBOLD_VAULT_ADDRESS } from '@pages/vaults/domain/normalizeVault'
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
    growthUnderlying: 10,
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
      growthUnderlying: 10,
      growthUsd: 10,
      metadata: {
        symbol: 'USDC',
        decimals: 18,
        assetDecimals: 6,
        tokenAddress: '0x0000000000000000000000000000000000000001'
      }
    })
    const locked = makeGrowthVault(YVUSD_LOCKED_ADDRESS, {
      baselineUsd: 50,
      baselineExposureUsdYears: 25,
      growthUnderlying: 5,
      growthUsd: 5,
      metadata: {
        symbol: 'USDC',
        decimals: 18,
        assetDecimals: 6,
        tokenAddress: '0x0000000000000000000000000000000000000001'
      }
    })

    const mapped = mapPortfolioGrowthVaults([unlocked, locked])
    const combined = mapped.get(getPortfolioGrowthVaultKey(unlocked))

    expect(combined).toMatchObject({
      vaultAddress: YVUSD_UNLOCKED_ADDRESS,
      status: 'ok',
      baselineUsd: 150,
      baselineExposureUsdYears: 75,
      growthUnderlying: 15,
      assetGrowth: [{ amount: 15, symbol: 'USDC' }],
      growthUsd: 15,
      growthPct: 10,
      annualizedProtocolReturnPct: 20
    })
    expect(combined?.metadata.symbol).toBe('USDC')
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

  it('shows yvUSD growth when only one complete variant was returned', () => {
    const unlocked = makeGrowthVault(YVUSD_UNLOCKED_ADDRESS, {
      baselineExposureUsdYears: 50,
      metadata: {
        symbol: 'USDC',
        decimals: 18,
        assetDecimals: 6,
        tokenAddress: '0x0000000000000000000000000000000000000001'
      }
    })

    const mapped = mapPortfolioGrowthVaults([unlocked])
    const combined = mapped.get(getPortfolioGrowthVaultKey(unlocked))

    expect(combined?.status).toBe('ok')
    expect(toPortfolioGrowthDisplay(combined)).toEqual({
      usd: 10,
      assetGrowth: [{ amount: 10, symbol: 'USDC' }],
      isUsdEstimated: false,
      annualizedPercent: 20
    })
  })

  it('marks combined USD growth as estimated when any variant used the missing exit-price fallback', () => {
    const unlocked = makeGrowthVault(YVUSD_UNLOCKED_ADDRESS)
    const locked = makeGrowthVault(YVUSD_LOCKED_ADDRESS, {
      issues: ['missing_exit_price']
    })

    const combined = mapPortfolioGrowthVaults([unlocked, locked]).get(getPortfolioGrowthVaultKey(unlocked))

    expect(combined?.status).toBe('ok')
    expect(toPortfolioGrowthDisplay(combined)?.isUsdEstimated).toBe(true)
  })

  it.each([
    [5, 3, 8],
    [0, 0.11064584489111587, 0.11064584489111587]
  ])('combines unstaked and staked yBOLD growth of %s and %s BOLD', (unstakedGrowth, stakedGrowth, totalGrowth) => {
    const unstaked = makeGrowthVault(YBOLD_VAULT_ADDRESS, {
      baselineUsd: 100,
      baselineExposureUsdYears: 50,
      growthUnderlying: unstakedGrowth,
      growthUsd: 0,
      growthPct: 5,
      annualizedProtocolReturnPct: 8,
      metadata: {
        symbol: 'BOLD',
        decimals: 18,
        assetDecimals: 18,
        tokenAddress: '0x00000000000000000000000000000000000000Ab'
      }
    })
    const staked = makeGrowthVault(YBOLD_STAKING_ADDRESS, {
      baselineUsd: 200,
      baselineExposureUsdYears: 100,
      growthUnderlying: stakedGrowth,
      growthUsd: 30,
      growthPct: 20,
      annualizedProtocolReturnPct: 26,
      metadata: {
        symbol: 'BOLD',
        decimals: 18,
        assetDecimals: 18,
        tokenAddress: '0x00000000000000000000000000000000000000ab'
      }
    })

    const mapped = mapPortfolioGrowthVaults([unstaked, staked])
    const combined = mapped.get(getPortfolioGrowthVaultKey(unstaked))

    expect(combined).toMatchObject({
      vaultAddress: YBOLD_VAULT_ADDRESS,
      status: 'ok',
      baselineUsd: 300,
      baselineExposureUsdYears: 150,
      growthUnderlying: totalGrowth,
      assetGrowth: [{ amount: totalGrowth, symbol: 'BOLD' }],
      growthUsd: 30,
      growthPct: 15,
      annualizedProtocolReturnPct: 20
    })
    expect(combined?.metadata.symbol).toBe('BOLD')
  })

  it.each(['0x0000000000000000000000000000000000000002', null])(
    'keeps matching symbols separate when the second terminal token is different or unknown (%s)',
    (tokenAddress) => {
      const unstaked = makeGrowthVault(YBOLD_VAULT_ADDRESS, {
        growthUnderlying: 5,
        metadata: {
          symbol: 'BOLD',
          decimals: 18,
          assetDecimals: 18,
          tokenAddress: '0x0000000000000000000000000000000000000001'
        }
      })
      const staked = makeGrowthVault(YBOLD_STAKING_ADDRESS, {
        growthUnderlying: 3,
        metadata: { ...unstaked.metadata, tokenAddress }
      })

      const combined = mapPortfolioGrowthVaults([unstaked, staked]).get(getPortfolioGrowthVaultKey(unstaked))

      expect(combined).toMatchObject({
        growthUnderlying: null,
        assetGrowth: [
          { amount: 5, symbol: 'BOLD' },
          { amount: 3, symbol: 'BOLD' }
        ],
        growthUsd: 20
      })
    }
  )

  it('does not derive combined protocol returns from hybrid USD growth', () => {
    const unlocked = makeGrowthVault(YVUSD_UNLOCKED_ADDRESS, {
      baselineUsd: 100,
      baselineExposureUsdYears: 50,
      growthUsd: 80,
      growthPct: 10,
      annualizedProtocolReturnPct: 20
    })
    const locked = makeGrowthVault(YVUSD_LOCKED_ADDRESS, {
      baselineUsd: 300,
      baselineExposureUsdYears: 150,
      growthUsd: -20,
      growthPct: 30,
      annualizedProtocolReturnPct: 40
    })

    const combined = mapPortfolioGrowthVaults([unlocked, locked]).get(getPortfolioGrowthVaultKey(unlocked))

    expect(combined).toMatchObject({
      growthUsd: 60,
      growthPct: 25,
      annualizedProtocolReturnPct: 35
    })
  })

  it('requires finite component returns only for variants with positive weights', () => {
    const unstaked = makeGrowthVault(YBOLD_VAULT_ADDRESS, {
      baselineUsd: 100,
      baselineExposureUsdYears: 50,
      growthPct: 10,
      annualizedProtocolReturnPct: null
    })
    const staked = makeGrowthVault(YBOLD_STAKING_ADDRESS, {
      baselineUsd: 0,
      baselineExposureUsdYears: 0,
      growthPct: null,
      annualizedProtocolReturnPct: null
    })

    const combined = mapPortfolioGrowthVaults([unstaked, staked]).get(getPortfolioGrowthVaultKey(unstaked))

    expect(combined?.growthPct).toBe(10)
    expect(combined?.annualizedProtocolReturnPct).toBeNull()
  })

  it('maps staking-only yBOLD growth to the displayed vault', () => {
    const staked = makeGrowthVault(YBOLD_STAKING_ADDRESS, {
      baselineUsd: 200,
      baselineExposureUsdYears: 100,
      growthUsd: 30
    })

    const mapped = mapPortfolioGrowthVaults([staked])
    const combined = mapped.get(`1_${YBOLD_VAULT_ADDRESS}`)

    expect(combined).toMatchObject({
      vaultAddress: YBOLD_VAULT_ADDRESS,
      status: 'ok',
      baselineUsd: 200,
      baselineExposureUsdYears: 100,
      growthUsd: 30,
      growthPct: 10,
      annualizedProtocolReturnPct: 20
    })
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
