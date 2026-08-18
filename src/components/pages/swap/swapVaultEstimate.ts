import { formatUnits } from 'viem'

export type TSwapVaultEstimate = {
  expectedUnderlying: number | null
  minimumUnderlying: number | null
  expectedUnderlyingUsd: number | null
  minimumUnderlyingUsd: number | null
  estimatedAnnualReturn: number | null
  estimatedAnnualReturnUsd: number | null
}

export function getSwapVaultEstimate({
  expectedShares,
  minimumShares,
  shareDecimals,
  pricePerShare,
  underlyingPrice,
  annualRate
}: {
  expectedShares: bigint
  minimumShares: bigint
  shareDecimals: number
  pricePerShare: number
  underlyingPrice?: number
  annualRate?: number
}): TSwapVaultEstimate {
  if (!Number.isFinite(pricePerShare) || pricePerShare <= 0) {
    return {
      expectedUnderlying: null,
      minimumUnderlying: null,
      expectedUnderlyingUsd: null,
      minimumUnderlyingUsd: null,
      estimatedAnnualReturn: null,
      estimatedAnnualReturnUsd: null
    }
  }

  const expectedUnderlying = Number(formatUnits(expectedShares, shareDecimals)) * pricePerShare
  const minimumUnderlying = Number(formatUnits(minimumShares, shareDecimals)) * pricePerShare
  const hasUnderlyingPrice = Number.isFinite(underlyingPrice) && (underlyingPrice ?? 0) > 0
  const hasAnnualRate = Number.isFinite(annualRate) && annualRate !== undefined && annualRate >= 0
  const estimatedAnnualReturn = hasAnnualRate ? minimumUnderlying * annualRate : null

  return {
    expectedUnderlying,
    minimumUnderlying,
    expectedUnderlyingUsd: hasUnderlyingPrice ? expectedUnderlying * (underlyingPrice ?? 0) : null,
    minimumUnderlyingUsd: hasUnderlyingPrice ? minimumUnderlying * (underlyingPrice ?? 0) : null,
    estimatedAnnualReturn,
    estimatedAnnualReturnUsd:
      estimatedAnnualReturn !== null && hasUnderlyingPrice ? estimatedAnnualReturn * (underlyingPrice ?? 0) : null
  }
}
