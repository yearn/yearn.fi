import { formatUnits } from 'viem'

export const HIGH_PRICE_IMPACT_THRESHOLD = 5
export const BLOCKING_PRICE_IMPACT_THRESHOLD = 15

export type WithdrawValueInfo = {
  withdrawUsdValueRaw: number
  expectedOutUsdValueRaw: number
  priceImpactPercentage: number
  isHighPriceImpact: boolean
  isBlockingPriceImpact: boolean
}

export function calculateWithdrawValueInfo({
  withdrawAmountBn,
  assetTokenDecimals,
  assetUsdPrice,
  expectedOut,
  outputDecimals,
  outputUsdPrice,
  highPriceImpactThreshold = HIGH_PRICE_IMPACT_THRESHOLD,
  blockingPriceImpactThreshold = BLOCKING_PRICE_IMPACT_THRESHOLD
}: {
  withdrawAmountBn: bigint
  assetTokenDecimals: number
  assetUsdPrice: number
  expectedOut: bigint
  outputDecimals: number
  outputUsdPrice: number
  highPriceImpactThreshold?: number
  blockingPriceImpactThreshold?: number
}): WithdrawValueInfo {
  const withdrawUsdValueRaw = Number(formatUnits(withdrawAmountBn, assetTokenDecimals)) * assetUsdPrice
  const expectedOutUsdValueRaw = Number(formatUnits(expectedOut, outputDecimals)) * outputUsdPrice

  const priceImpactPercentage =
    withdrawUsdValueRaw <= 0
      ? 0
      : expectedOut === 0n
        ? 100
        : expectedOutUsdValueRaw > 0
          ? Math.max(0, ((withdrawUsdValueRaw - expectedOutUsdValueRaw) / withdrawUsdValueRaw) * 100)
          : 0

  return {
    withdrawUsdValueRaw,
    expectedOutUsdValueRaw,
    priceImpactPercentage,
    isHighPriceImpact: priceImpactPercentage > highPriceImpactThreshold,
    isBlockingPriceImpact: priceImpactPercentage > blockingPriceImpactThreshold
  }
}
