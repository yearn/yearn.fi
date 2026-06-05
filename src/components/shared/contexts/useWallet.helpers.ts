import type { TChainTokens } from '../types'

type TShouldExposeWalletLoadingParams = {
  userAddress?: string
  hasVisibleBalances: boolean
  isLoading: boolean
  isBalancesPending: boolean
}

type TShouldUpdateVisibleBalanceSnapshotParams = {
  currentBalances: TChainTokens
  nextBalances: TChainTokens
  isLoading: boolean
}

export function hasWalletBalanceSnapshot(balances: TChainTokens): boolean {
  return Object.values(balances).some((tokensByChain) => Object.keys(tokensByChain || {}).length > 0)
}

export function shouldUpdateVisibleBalanceSnapshot({
  currentBalances,
  nextBalances,
  isLoading
}: TShouldUpdateVisibleBalanceSnapshotParams): boolean {
  if (!isLoading) {
    return true
  }

  return !hasWalletBalanceSnapshot(currentBalances) && hasWalletBalanceSnapshot(nextBalances)
}

export function shouldExposeWalletLoading({
  userAddress,
  hasVisibleBalances,
  isLoading,
  isBalancesPending
}: TShouldExposeWalletLoadingParams): boolean {
  if (!userAddress) {
    return false
  }

  return !hasVisibleBalances && (isLoading || isBalancesPending)
}
