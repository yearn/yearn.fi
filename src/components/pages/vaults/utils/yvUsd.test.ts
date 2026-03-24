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
  getYvUsdUnderlyingPricePerShare,
  YVUSD_CUSTOM_RISK_SCORE,
  YVUSD_RISK_SCORE_ITEMS
} from './yvUsd'

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

describe('yvUSD risk override', () => {
  it('uses the provisional custom score for the detail risk section', () => {
    expect(YVUSD_CUSTOM_RISK_SCORE).toBe('3/5')
    expect(YVUSD_RISK_SCORE_ITEMS[0]?.score).toBe('3/5')
  })

  it('keeps the current published risk sections intact', () => {
    expect(YVUSD_RISK_SCORE_ITEMS.map((item) => item.label)).toEqual([
      'Overall Risk Score',
      'Leverage Looping',
      'Duration and PT Strategies',
      'Cross-Chain Routing'
    ])
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
    ).toBeCloseTo(1.043960757872, 12)
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
})

describe('yvUSD locked withdraw display mode', () => {
  it('uses underlying display mode when the helper is called with Enso enabled', () => {
    expect(getYvUsdLockedWithdrawDisplayMode(true)).toBe('underlying')
  })

  it('keeps underlying display mode even when Enso is unavailable', () => {
    expect(getYvUsdLockedWithdrawDisplayMode(false)).toBe('underlying')
  })
})
