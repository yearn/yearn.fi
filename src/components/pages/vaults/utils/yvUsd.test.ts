import { describe, expect, it } from 'vitest'
import {
  calculateHistoricalAprFromPricePerShares,
  calculateHistoricalApyFromPricePerShares,
  calculateLockedYvUsdHistoricalApy,
  convertYvUsdLockedAssetRawAmountToUnderlying,
  convertYvUsdLockedPricePerShareToUnderlying,
  convertYvUsdUnderlyingRawAmountToLockedAsset,
  convertYvUsdVariantAmountString,
  convertYvUsdVariantRawAmount,
  getWeightedYvUsdApy,
  getYvUsdLockedWithdrawDisplayMode,
  getYvUsdPositionApyBreakdown,
  getYvUsdPositionValues,
  getYvUsdUnderlyingPricePerShare,
  YVUSD_CHAIN_ID,
  YVUSD_DECIMALS,
  YVUSD_LOCKED_ADDRESS,
  YVUSD_UNLOCKED_ADDRESS
} from './yvUsd'

describe('yvUSD token metadata', () => {
  it('uses Kong vault-share decimals for balance discovery', () => {
    expect(YVUSD_DECIMALS).toBe(6)
  })
})

describe('getWeightedYvUsdApy', () => {
  it('returns the unlocked APY when only unlocked value is present', () => {
    expect(
      getWeightedYvUsdApy({
        unlockedValue: 100,
        lockedValue: 0,
        unlockedApy: 0.05,
        lockedApy: 0.09
      })
    ).toBeCloseTo(0.05, 6)
  })

  it('returns the locked APY when only locked value is present', () => {
    expect(
      getWeightedYvUsdApy({
        unlockedValue: 0,
        lockedValue: 200,
        unlockedApy: 0.05,
        lockedApy: 0.09
      })
    ).toBeCloseTo(0.09, 6)
  })

  it('weights unlocked and locked APYs by position value', () => {
    expect(
      getWeightedYvUsdApy({
        unlockedValue: 100,
        lockedValue: 100,
        unlockedApy: 0.05,
        lockedApy: 0.09
      })
    ).toBeCloseTo(0.07, 6)
  })

  it('keeps missing-APY value in the denominator for conservative weighting', () => {
    expect(
      getWeightedYvUsdApy({
        unlockedValue: 100,
        lockedValue: 100,
        unlockedApy: null,
        lockedApy: 0.09
      })
    ).toBeCloseTo(0.045, 6)
  })

  it('returns null when there is no value to weight', () => {
    expect(
      getWeightedYvUsdApy({
        unlockedValue: 0,
        lockedValue: 0,
        unlockedApy: 0.05,
        lockedApy: 0.09
      })
    ).toBeNull()
  })
})

describe('getYvUsdPositionApyBreakdown', () => {
  it('reports a 100% unlocked weight for an unlocked-only position', () => {
    const breakdown = getYvUsdPositionApyBreakdown({
      unlockedValue: 100,
      lockedValue: 0,
      unlockedApy: 0.05,
      lockedApy: 0.09
    })

    expect(breakdown.blendedApy).toBeCloseTo(0.05, 6)
    expect(breakdown.unlocked.weight).toBe(1)
    expect(breakdown.locked.weight).toBe(0)
  })

  it('reports equal weights and the midpoint APY for a 50/50 position', () => {
    const breakdown = getYvUsdPositionApyBreakdown({
      unlockedValue: 100,
      lockedValue: 100,
      unlockedApy: 0.05,
      lockedApy: 0.09
    })

    expect(breakdown.blendedApy).toBeCloseTo(0.07, 6)
    expect(breakdown.unlocked.weight).toBe(0.5)
    expect(breakdown.locked.weight).toBe(0.5)
  })
})

describe('getYvUsdPositionValues', () => {
  const makeYvUsdVault = (price: number, pricePerShare: number) =>
    ({
      chainID: YVUSD_CHAIN_ID,
      version: '3.0.4',
      type: 'Automated Yearn Vault',
      kind: 'Multi Strategy',
      symbol: 'yvUSD',
      name: 'yvUSD',
      description: '',
      category: 'Stablecoin',
      decimals: YVUSD_DECIMALS,
      token: {
        address: YVUSD_UNLOCKED_ADDRESS,
        name: 'USD yVault',
        symbol: 'yvUSD',
        decimals: YVUSD_DECIMALS
      },
      tvl: { price, tvl: 0, totalAssets: 0 },
      apr: { pricePerShare: { today: pricePerShare, weekAgo: null, monthAgo: null } },
      featuringScore: 0,
      strategies: null,
      staking: { address: '0x0000000000000000000000000000000000000000', available: false, rewards: [] },
      migration: {},
      info: {}
    }) as any

  it('uses Enso direct token values for unlocked and locked yvUSD holdings', () => {
    const tokenValues = {
      [YVUSD_UNLOCKED_ADDRESS]: 1.991627 * 1.018990889978977,
      [YVUSD_LOCKED_ADDRESS]: 4.437947 * 1.062906287897898
    }
    const rawBalances = {
      [YVUSD_UNLOCKED_ADDRESS]: 1_991_627n,
      [YVUSD_LOCKED_ADDRESS]: 4_437_947n
    }

    const values = getYvUsdPositionValues({
      getToken: ({ address }) => ({ value: tokenValues[address] ?? 0 }),
      getBalance: ({ address, chainID }) => ({
        raw: chainID === YVUSD_CHAIN_ID ? (rawBalances[address] ?? 0n) : 0n,
        normalized: chainID === YVUSD_CHAIN_ID ? Number(rawBalances[address] ?? 0n) / 10 ** YVUSD_DECIMALS : 0
      }),
      unlockedVault: makeYvUsdVault(0, 0),
      lockedVault: makeYvUsdVault(0, 0)
    })

    expect(values.unlockedValue).toBeCloseTo(2.02944976923616, 12)
    expect(values.lockedValue).toBeCloseTo(4.717121771657613, 12)
    expect(values.combinedValue).toBeCloseTo(6.746571540893774, 12)
    expect(values.hasHoldings).toBe(true)
  })

  it('falls back to vault share prices when direct token values are unavailable', () => {
    const values = getYvUsdPositionValues({
      getToken: () => ({ value: 0 }),
      getBalance: ({ address }) => ({
        raw: address === YVUSD_UNLOCKED_ADDRESS ? 2_000_000n : 3_000_000n,
        normalized: address === YVUSD_UNLOCKED_ADDRESS ? 2 : 3
      }),
      unlockedVault: makeYvUsdVault(1, 1.01),
      lockedVault: makeYvUsdVault(1, 1.05)
    })

    expect(values.unlockedValue).toBeCloseTo(2.02, 8)
    expect(values.lockedValue).toBeCloseTo(3.15, 8)
    expect(values.combinedValue).toBeCloseTo(5.17, 8)
    expect(values.hasHoldings).toBe(true)
  })

  it('ignores direct token values when no yvUSD raw balance is present', () => {
    const values = getYvUsdPositionValues({
      getToken: () => ({ value: 10 }),
      getBalance: () => ({
        raw: 0n,
        normalized: 0
      }),
      unlockedVault: makeYvUsdVault(1, 1.01),
      lockedVault: makeYvUsdVault(1, 1.05)
    })

    expect(values.combinedValue).toBe(0)
    expect(values.hasHoldings).toBe(false)
  })
})
describe('yvUSD variant amount conversion', () => {
  const unlockedPricePerShare = 1_050_000n
  const unlockedVaultDecimals = 18

  it('converts unlocked underlying assets into locked yvUSD shares', () => {
    expect(
      convertYvUsdVariantRawAmount({
        amount: 100_000_000n,
        fromVariant: 'unlocked',
        toVariant: 'locked',
        unlockedPricePerShare,
        unlockedVaultDecimals
      })
    ).toBe(95_238_095_238_095_238_095n)
  })

  it('converts locked yvUSD shares into unlocked underlying assets', () => {
    expect(
      convertYvUsdVariantRawAmount({
        amount: 95_238_095_238_095_238_095n,
        fromVariant: 'locked',
        toVariant: 'unlocked',
        unlockedPricePerShare,
        unlockedVaultDecimals
      })
    ).toBe(99_999_999n)
  })

  it('formats converted variant amounts with the destination decimals', () => {
    expect(
      convertYvUsdVariantAmountString({
        amount: '100',
        fromVariant: 'unlocked',
        toVariant: 'locked',
        fromDecimals: 6,
        toDecimals: 18,
        unlockedPricePerShare,
        unlockedVaultDecimals
      })
    ).toBe('95.238095238095238095')
  })

  it('converts locked asset amounts into unlocked underlying amounts with the helper alias', () => {
    expect(
      convertYvUsdLockedAssetRawAmountToUnderlying({
        amount: 95_238_095_238_095_238_095n,
        unlockedPricePerShare,
        unlockedVaultDecimals
      })
    ).toBe(99_999_999n)
  })

  it('converts unlocked underlying amounts into locked asset amounts with the helper alias', () => {
    expect(
      convertYvUsdUnderlyingRawAmountToLockedAsset({
        amount: 100_000_000n,
        unlockedPricePerShare,
        unlockedVaultDecimals
      })
    ).toBe(95_238_095_238_095_238_095n)
  })

  it('converts locked price per share into underlying asset terms', () => {
    expect(
      convertYvUsdLockedPricePerShareToUnderlying({
        lockedPricePerShare: 1_100_000_000_000_000_000n,
        unlockedPricePerShare,
        unlockedVaultDecimals
      })
    ).toBe(1_155_000n)
  })
})

describe('yvUSD historical PPS normalization', () => {
  it('multiplies locked PPS by unlocked PPS to get underlying-denominated locked PPS', () => {
    expect(
      getYvUsdUnderlyingPricePerShare({
        lockedPricePerShare: 1.038008,
        unlockedPricePerShare: 1.005734
      })
    ).toBeCloseTo(1.043959937872, 12)
  })

  it('annualizes PPS changes into APR and APY using the shared helper formulas', () => {
    expect(
      calculateHistoricalAprFromPricePerShares({
        currentPricePerShare: 1.005734,
        previousPricePerShare: 1.002071,
        periodDays: 30
      })
    ).toBeCloseTo(0.0444743935, 10)

    expect(
      calculateHistoricalApyFromPricePerShares({
        currentPricePerShare: 1.005734,
        previousPricePerShare: 1.002071,
        periodDays: 30
      })
    ).toBeCloseTo(0.0454753728, 10)
  })

  it('derives locked historical APY in underlying terms instead of raw yvUSD-share terms', () => {
    expect(
      calculateLockedYvUsdHistoricalApy({
        lockedPricePerShare: {
          today: 1.038008,
          weekAgo: 1.037836,
          monthAgo: 1.014987
        },
        unlockedPricePerShare: {
          today: 1.005734,
          weekAgo: 1.00489,
          monthAgo: 1.002071
        }
      })
    ).toBeCloseTo(0.3789120128, 10)
  })

  it('falls back from 30d to 7d when the locked monthly PPS lookback is unavailable', () => {
    expect(
      calculateLockedYvUsdHistoricalApy({
        lockedPricePerShare: {
          today: 1.038008,
          weekAgo: 1.037836,
          monthAgo: null
        },
        unlockedPricePerShare: {
          today: 1.005734,
          weekAgo: 1.00489,
          monthAgo: 1.002071
        }
      })
    ).toBeCloseTo(0.0538388189, 10)
  })

  it('preserves a valid 0 percent 30d APY instead of falling back to 7d', () => {
    expect(
      calculateLockedYvUsdHistoricalApy({
        lockedPricePerShare: {
          today: 1.02,
          weekAgo: 1.03,
          monthAgo: 1.02
        },
        unlockedPricePerShare: {
          today: 1.01,
          weekAgo: 1,
          monthAgo: 1.01
        }
      })
    ).toBe(0)
  })
})

describe('yvUSD locked withdraw display mode', () => {
  it('uses underlying display mode when the helper is called with Enso enabled', () => {
    expect(getYvUsdLockedWithdrawDisplayMode(true)).toBe('underlying')
  })

  it('keeps underlying display mode even when Enso is unavailable', () => {
    expect(getYvUsdLockedWithdrawDisplayMode(false)).toBe('underlying')
  })
})
