import { type Address, formatUnits, isAddressEqual } from 'viem'

export const HIGH_PRICE_IMPACT_THRESHOLD = 5

export type DepositValueInfo = {
  vaultShareValueInAsset: bigint
  vaultShareValueUsdRaw: number
  priceImpactPercentage: number
  isHighPriceImpact: boolean
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
  vaultDecimals,
  pricePerShare,
  assetTokenDecimals,
  assetUsdPrice,
  highPriceImpactThreshold = HIGH_PRICE_IMPACT_THRESHOLD
}: {
  depositAmountBn: bigint
  inputTokenDecimals: number
  inputTokenUsdPrice: number
  normalizedVaultShares: bigint
  vaultDecimals: number
  pricePerShare: bigint
  assetTokenDecimals: number
  assetUsdPrice: number
  highPriceImpactThreshold?: number
}): DepositValueInfo {
  const vaultShareValueInAsset =
    normalizedVaultShares > 0n && pricePerShare > 0n
      ? (normalizedVaultShares * pricePerShare) / 10n ** BigInt(vaultDecimals)
      : 0n

  const vaultShareValueUsdRaw = Number(formatUnits(vaultShareValueInAsset, assetTokenDecimals)) * assetUsdPrice
  const usdValueToDeposit = Number(formatUnits(depositAmountBn, inputTokenDecimals)) * inputTokenUsdPrice
  const priceImpactPercentage =
    usdValueToDeposit > 0 && vaultShareValueUsdRaw > 0
      ? ((usdValueToDeposit - vaultShareValueUsdRaw) / usdValueToDeposit) * 100
      : 0

  return {
    vaultShareValueInAsset,
    vaultShareValueUsdRaw,
    priceImpactPercentage,
    isHighPriceImpact: priceImpactPercentage > highPriceImpactThreshold
  }
}
