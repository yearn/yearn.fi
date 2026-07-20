type TYvUsdcRewardPriceParams = {
  directSharePrice: number
  underlyingPrice: number
  pricePerShare: number
}

export function resolveYvUsdcRewardPriceUsd({
  directSharePrice,
  underlyingPrice,
  pricePerShare
}: TYvUsdcRewardPriceParams): number {
  if (Number.isFinite(directSharePrice) && directSharePrice > 0) {
    return directSharePrice
  }

  const resolvedUnderlyingPrice = Number.isFinite(underlyingPrice) && underlyingPrice > 0 ? underlyingPrice : 1
  return Number.isFinite(pricePerShare) && pricePerShare > 0
    ? resolvedUnderlyingPrice * pricePerShare
    : resolvedUnderlyingPrice
}
