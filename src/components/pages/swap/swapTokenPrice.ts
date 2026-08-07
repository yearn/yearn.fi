export function resolveSwapTokenPrice({
  contextPrice,
  walletValue,
  walletBalance,
  vaultUnderlyingPrice,
  vaultPricePerShare
}: {
  contextPrice: number
  walletValue: number
  walletBalance: number
  vaultUnderlyingPrice?: number
  vaultPricePerShare?: number
}): number {
  if (Number.isFinite(contextPrice) && contextPrice > 0) {
    return contextPrice
  }

  const walletPrice = walletBalance > 0 ? walletValue / walletBalance : 0
  if (Number.isFinite(walletPrice) && walletPrice > 0) {
    return walletPrice
  }

  const vaultSharePrice = (vaultUnderlyingPrice ?? 0) * (vaultPricePerShare ?? 0)
  return Number.isFinite(vaultSharePrice) && vaultSharePrice > 0 ? vaultSharePrice : 0
}
