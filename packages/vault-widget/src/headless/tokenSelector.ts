import type { VaultWidgetToken, VaultWidgetTokenReference } from '../types'

export function getTokenReferenceKey(token: VaultWidgetTokenReference): string {
  return `${token.chainId}:${token.address.toLowerCase()}`
}

export function getTokenSelectorChainIds(tokens: readonly VaultWidgetToken[]): number[] {
  return [...new Set(tokens.map((token) => token.chainId))]
}

export function getTokenSelectorTokens({
  tokens,
  chainId,
  searchText,
  defaultTokens
}: {
  tokens: readonly VaultWidgetToken[]
  chainId: number
  searchText: string
  defaultTokens?: readonly VaultWidgetTokenReference[]
}): VaultWidgetToken[] {
  const normalizedSearchText = searchText.trim().toLowerCase()
  const chainTokens = tokens.filter((token) => token.chainId === chainId)

  if (normalizedSearchText) {
    return chainTokens.filter(
      (token) =>
        token.symbol.toLowerCase().includes(normalizedSearchText) ||
        token.name?.toLowerCase().includes(normalizedSearchText) ||
        token.address.toLowerCase().includes(normalizedSearchText)
    )
  }

  if (!defaultTokens) return chainTokens

  const defaultOrder = new Map(defaultTokens.map((token, index) => [getTokenReferenceKey(token), index]))

  return chainTokens
    .filter((token) => defaultOrder.has(getTokenReferenceKey(token)))
    .sort(
      (left, right) =>
        (defaultOrder.get(getTokenReferenceKey(left)) ?? Number.POSITIVE_INFINITY) -
        (defaultOrder.get(getTokenReferenceKey(right)) ?? Number.POSITIVE_INFINITY)
    )
}
