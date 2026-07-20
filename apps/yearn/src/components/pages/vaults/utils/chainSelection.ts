export function resolveNextSingleChainSelection(
  currentChains: number[] | null | undefined,
  chainId: number
): number[] | null {
  if (currentChains && currentChains.length === 1 && currentChains[0] === chainId) {
    return null
  }

  return [chainId]
}
