import { formatUnits } from 'viem'

export const HIGH_PRICE_IMPACT_THRESHOLD = 5
export const BLOCKING_PRICE_IMPACT_THRESHOLD = 15

export type WithdrawValueInfo = {
  withdrawUsdValueRaw: number
  expectedOutUsdValueRaw: number
  minExpectedOutUsdValueRaw: number
  priceImpactPercentage: number
  worstCasePriceImpactPercentage: number
  isHighPriceImpact: boolean
  isBlockingPriceImpact: boolean
}

function calculatePriceImpactPercentage({
  withdrawUsdValueRaw,
  outputAmount,
  outputUsdValueRaw
}: {
  withdrawUsdValueRaw: number
  outputAmount: bigint
  outputUsdValueRaw: number
}): number {
  if (withdrawUsdValueRaw <= 0) {
    return 0
  }

  if (outputAmount === 0n) {
    return 100
  }

  return outputUsdValueRaw > 0
    ? Math.max(0, ((withdrawUsdValueRaw - outputUsdValueRaw) / withdrawUsdValueRaw) * 100)
    : 0
}

export function calculateWithdrawValueInfo({
  withdrawAmountBn,
  assetTokenDecimals,
  assetUsdPrice,
  expectedOut,
  minExpectedOut = expectedOut,
  outputDecimals,
  outputUsdPrice,
  highPriceImpactThreshold = HIGH_PRICE_IMPACT_THRESHOLD,
  blockingPriceImpactThreshold = BLOCKING_PRICE_IMPACT_THRESHOLD
}: {
  withdrawAmountBn: bigint
  assetTokenDecimals: number
  assetUsdPrice: number
  expectedOut: bigint
  minExpectedOut?: bigint
  outputDecimals: number
  outputUsdPrice: number
  highPriceImpactThreshold?: number
  blockingPriceImpactThreshold?: number
}): WithdrawValueInfo {
  const withdrawUsdValueRaw = Number(formatUnits(withdrawAmountBn, assetTokenDecimals)) * assetUsdPrice
  const expectedOutUsdValueRaw = Number(formatUnits(expectedOut, outputDecimals)) * outputUsdPrice
  const minExpectedOutUsdValueRaw = Number(formatUnits(minExpectedOut, outputDecimals)) * outputUsdPrice

  const priceImpactPercentage = calculatePriceImpactPercentage({
    withdrawUsdValueRaw,
    outputAmount: expectedOut,
    outputUsdValueRaw: expectedOutUsdValueRaw
  })
  const worstCasePriceImpactPercentage = calculatePriceImpactPercentage({
    withdrawUsdValueRaw,
    outputAmount: minExpectedOut,
    outputUsdValueRaw: minExpectedOutUsdValueRaw
  })

  return {
    withdrawUsdValueRaw,
    expectedOutUsdValueRaw,
    minExpectedOutUsdValueRaw,
    priceImpactPercentage,
    worstCasePriceImpactPercentage,
    isHighPriceImpact: priceImpactPercentage > highPriceImpactThreshold,
    isBlockingPriceImpact: priceImpactPercentage > blockingPriceImpactThreshold
  }
}
