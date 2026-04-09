import { describe, expect, it } from 'vitest'
import { calculateDepositValueInfo, resolveValuationShareCount } from './valuation'

const VAULT = '0x0000000000000000000000000000000000000001'
const STAKING = '0x0000000000000000000000000000000000000002'
const OTHER = '0x0000000000000000000000000000000000000003'
const ONE_ETHER = 10n ** 18n

describe('resolveValuationShareCount', () => {
  it('keeps direct vault deposits in base vault share units', () => {
    expect(
      resolveValuationShareCount({
        expectedOut: 100n,
        destinationToken: VAULT,
        vaultAddress: VAULT,
        stakingAddress: STAKING
      })
    ).toBe(100n)
  })

  it('keeps classic staking outputs 1:1 when there is no wrapper conversion', () => {
    expect(
      resolveValuationShareCount({
        expectedOut: 75n,
        destinationToken: STAKING,
        vaultAddress: VAULT,
        stakingAddress: STAKING
      })
    ).toBe(75n)
  })

  it('uses converted wrapper assets for vault-backed staking outputs', () => {
    expect(
      resolveValuationShareCount({
        expectedOut: 94n,
        destinationToken: STAKING,
        vaultAddress: VAULT,
        stakingAddress: STAKING,
        previewedVaultShares: 99n
      })
    ).toBe(99n)
  })

  it('falls back to raw output for unrelated destinations', () => {
    expect(
      resolveValuationShareCount({
        expectedOut: 42n,
        destinationToken: OTHER,
        vaultAddress: VAULT,
        stakingAddress: STAKING,
        previewedVaultShares: 100n
      })
    ).toBe(42n)
  })
})

describe('calculateDepositValueInfo', () => {
  it('avoids the yBOLD-style false positive once wrapper shares are normalized', () => {
    const depositAmountBn = 100n * ONE_ETHER
    const legacyInfo = calculateDepositValueInfo({
      depositAmountBn,
      inputTokenDecimals: 18,
      inputTokenUsdPrice: 1,
      normalizedVaultShares: 94n * ONE_ETHER,
      vaultDecimals: 18,
      pricePerShare: ONE_ETHER,
      assetTokenDecimals: 18,
      assetUsdPrice: 1
    })

    const normalizedInfo = calculateDepositValueInfo({
      depositAmountBn,
      inputTokenDecimals: 18,
      inputTokenUsdPrice: 1,
      normalizedVaultShares: 99n * ONE_ETHER,
      vaultDecimals: 18,
      pricePerShare: ONE_ETHER,
      assetTokenDecimals: 18,
      assetUsdPrice: 1
    })

    expect(legacyInfo.isHighPriceImpact).toBe(true)
    expect(legacyInfo.priceImpactPercentage).toBeGreaterThan(5)
    expect(normalizedInfo.isHighPriceImpact).toBe(false)
    expect(normalizedInfo.priceImpactPercentage).toBeLessThan(5)
  })

  it('includes price per share when valuing normalized shares', () => {
    const valueInfo = calculateDepositValueInfo({
      depositAmountBn: 100n * ONE_ETHER,
      inputTokenDecimals: 18,
      inputTokenUsdPrice: 1.02,
      normalizedVaultShares: 100n * ONE_ETHER,
      vaultDecimals: 18,
      pricePerShare: 102n * 10n ** 16n,
      assetTokenDecimals: 18,
      assetUsdPrice: 1
    })

    expect(valueInfo.vaultShareValueInAsset).toBe(102n * ONE_ETHER)
    expect(valueInfo.priceImpactPercentage).toBe(0)
    expect(valueInfo.worstCasePriceImpactPercentage).toBe(0)
  })

  it('sets isBlockingPriceImpact when price impact exceeds 15%', () => {
    // 20% impact — should be both high and blocking
    const blockingInfo = calculateDepositValueInfo({
      depositAmountBn: 100n * ONE_ETHER,
      inputTokenDecimals: 18,
      inputTokenUsdPrice: 1,
      normalizedVaultShares: 80n * ONE_ETHER,
      vaultDecimals: 18,
      pricePerShare: ONE_ETHER,
      assetTokenDecimals: 18,
      assetUsdPrice: 1
    })
    expect(blockingInfo.priceImpactPercentage).toBe(20)
    expect(blockingInfo.isHighPriceImpact).toBe(true)
    expect(blockingInfo.isBlockingPriceImpact).toBe(true)
  })

  it('does not set isBlockingPriceImpact for impacts between 5% and 15%', () => {
    // 10% impact — high but not blocking
    const highNotBlockingInfo = calculateDepositValueInfo({
      depositAmountBn: 100n * ONE_ETHER,
      inputTokenDecimals: 18,
      inputTokenUsdPrice: 1,
      normalizedVaultShares: 90n * ONE_ETHER,
      vaultDecimals: 18,
      pricePerShare: ONE_ETHER,
      assetTokenDecimals: 18,
      assetUsdPrice: 1
    })
    expect(highNotBlockingInfo.priceImpactPercentage).toBe(10)
    expect(highNotBlockingInfo.isHighPriceImpact).toBe(true)
    expect(highNotBlockingInfo.isBlockingPriceImpact).toBe(false)
  })

  it('tracks worst-case price impact from min expected shares separately from the live quote', () => {
    const valueInfo = calculateDepositValueInfo({
      depositAmountBn: 100n * ONE_ETHER,
      inputTokenDecimals: 18,
      inputTokenUsdPrice: 1,
      normalizedVaultShares: 100n * ONE_ETHER,
      normalizedMinVaultShares: 99n * ONE_ETHER,
      vaultDecimals: 18,
      pricePerShare: ONE_ETHER,
      assetTokenDecimals: 18,
      assetUsdPrice: 1
    })

    expect(valueInfo.priceImpactPercentage).toBe(0)
    expect(valueInfo.worstCasePriceImpactPercentage).toBe(1)
  })

  it('flags incomplete USD valuation when a supported zap quote has no token price', () => {
    const valueInfo = calculateDepositValueInfo({
      depositAmountBn: 100n * ONE_ETHER,
      inputTokenDecimals: 18,
      inputTokenUsdPrice: 0,
      normalizedVaultShares: 100n * ONE_ETHER,
      normalizedMinVaultShares: 99n * ONE_ETHER,
      vaultDecimals: 18,
      pricePerShare: ONE_ETHER,
      assetTokenDecimals: 18,
      assetUsdPrice: 1
    })

    expect(valueInfo.hasIncompleteUsdValuation).toBe(true)
    expect(valueInfo.priceImpactPercentage).toBe(0)
    expect(valueInfo.worstCasePriceImpactPercentage).toBe(0)
  })
})
