import type { TChainTokens, TDict, TNDict, TToken } from '../types'
import { toAddress } from '../utils'

type TTokenMetadata = Pick<TToken, 'logoURI' | 'name' | 'symbol'>

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

function applyTokenMetadata(token: TToken, metadata?: TTokenMetadata): TToken {
  if (!metadata) {
    return token
  }

  return {
    ...token,
    logoURI: metadata.logoURI || token.logoURI,
    name: metadata.name || token.name,
    symbol: metadata.symbol || token.symbol
  }
}

export function applyTokenListMetadataToBalances({
  balances,
  tokenLists
}: {
  balances: TChainTokens
  tokenLists: TNDict<TDict<TToken>>
}): TChainTokens {
  return Object.fromEntries(
    Object.entries(balances).map(([chainId, tokensByAddress]) => [
      Number(chainId),
      Object.fromEntries(
        Object.entries(tokensByAddress || {}).map(([address, token]) => [
          address,
          applyTokenMetadata(
            token,
            tokenLists[Number(chainId)]?.[toAddress(token.address)] ?? tokenLists[Number(chainId)]?.[address]
          )
        ])
      )
    ])
  ) as TChainTokens
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
