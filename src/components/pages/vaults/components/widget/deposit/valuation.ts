import { type Address, formatUnits, isAddressEqual } from 'viem'

export const HIGH_PRICE_IMPACT_THRESHOLD = 5
export const BLOCKING_PRICE_IMPACT_THRESHOLD = 15

export type DepositValueInfo = {
  vaultShareValueInAsset: bigint
  vaultShareValueUsdRaw: number
  minVaultShareValueInAsset: bigint
  minVaultShareValueUsdRaw: number
  hasIncompleteUsdValuation: boolean
  priceImpactPercentage: number
  worstCasePriceImpactPercentage: number
  isHighPriceImpact: boolean
  isBlockingPriceImpact: boolean
}

function calculatePriceImpactPercentage({
  inputUsdValue,
  outputUsdValue
}: {
  inputUsdValue: number
  outputUsdValue: number
}): number {
  return inputUsdValue > 0 && outputUsdValue > 0
    ? Math.max(0, ((inputUsdValue - outputUsdValue) / inputUsdValue) * 100)
    : 0
}

export function resolveValuationShareCount({
  expectedOut,
  destinationToken,
  vaultAddress,
  stakingAddress,
  previewedVaultShares
}: {
  expectedOut: bigint
  destinationToken: Address
  vaultAddress: Address
  stakingAddress?: Address
  previewedVaultShares?: bigint
}): bigint {
  if (isAddressEqual(destinationToken, vaultAddress)) {
    return expectedOut
  }

  if (stakingAddress && isAddressEqual(destinationToken, stakingAddress) && previewedVaultShares !== undefined) {
    return previewedVaultShares
  }

  return expectedOut
}

export function calculateDepositValueInfo({
  depositAmountBn,
  inputTokenDecimals,
  inputTokenUsdPrice,
  normalizedVaultShares,
  normalizedMinVaultShares = normalizedVaultShares,
  vaultDecimals,
  pricePerShare,
  assetTokenDecimals,
  assetUsdPrice,
  highPriceImpactThreshold = HIGH_PRICE_IMPACT_THRESHOLD,
  blockingPriceImpactThreshold = BLOCKING_PRICE_IMPACT_THRESHOLD
}: {
  depositAmountBn: bigint
  inputTokenDecimals: number
  inputTokenUsdPrice: number
  normalizedVaultShares: bigint
  normalizedMinVaultShares?: bigint
  vaultDecimals: number
  pricePerShare: bigint
  assetTokenDecimals: number
  assetUsdPrice: number
  highPriceImpactThreshold?: number
  blockingPriceImpactThreshold?: number
}): DepositValueInfo {
  const vaultShareValueInAsset =
    normalizedVaultShares > 0n && pricePerShare > 0n
      ? (normalizedVaultShares * pricePerShare) / 10n ** BigInt(vaultDecimals)
      : 0n
  const minVaultShareValueInAsset =
    normalizedMinVaultShares > 0n && pricePerShare > 0n
      ? (normalizedMinVaultShares * pricePerShare) / 10n ** BigInt(vaultDecimals)
      : 0n

  const vaultShareValueUsdRaw = Number(formatUnits(vaultShareValueInAsset, assetTokenDecimals)) * assetUsdPrice
  const minVaultShareValueUsdRaw = Number(formatUnits(minVaultShareValueInAsset, assetTokenDecimals)) * assetUsdPrice
  const usdValueToDeposit = Number(formatUnits(depositAmountBn, inputTokenDecimals)) * inputTokenUsdPrice
  const hasIncompleteUsdValuation =
    depositAmountBn > 0n &&
    (normalizedVaultShares > 0n || normalizedMinVaultShares > 0n) &&
    (inputTokenUsdPrice <= 0 || assetUsdPrice <= 0)
  const priceImpactPercentage = calculatePriceImpactPercentage({
    inputUsdValue: usdValueToDeposit,
    outputUsdValue: vaultShareValueUsdRaw
  })
  const worstCasePriceImpactPercentage = calculatePriceImpactPercentage({
    inputUsdValue: usdValueToDeposit,
    outputUsdValue: minVaultShareValueUsdRaw
  })

  return {
    vaultShareValueInAsset,
    vaultShareValueUsdRaw,
    minVaultShareValueInAsset,
    minVaultShareValueUsdRaw,
    hasIncompleteUsdValuation,
    priceImpactPercentage,
    worstCasePriceImpactPercentage,
    isHighPriceImpact: priceImpactPercentage > highPriceImpactThreshold,
    isBlockingPriceImpact: priceImpactPercentage > blockingPriceImpactThreshold
  }
}
