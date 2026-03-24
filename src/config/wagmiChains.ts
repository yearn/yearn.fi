import type { Chain } from 'viem'
import { mainnet } from 'viem/chains'

export function getWagmiConfigChains(
  walletChains: readonly Chain[],
  canonicalChains: readonly Chain[] = []
): [Chain, ...Chain[]] {
  const uniqueChains = Array.from(
    new Map(
      [...walletChains, ...canonicalChains.filter((chain) => chain.id !== mainnet.id)].map((chain) => [chain.id, chain])
    ).values()
  )

  if (!uniqueChains.some((chain) => chain.id === mainnet.id)) {
    uniqueChains.push(mainnet)
  }

  return uniqueChains as [Chain, ...Chain[]]
}
