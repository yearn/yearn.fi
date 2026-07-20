import type { Chain } from 'viem'
import { mainnet } from 'viem/chains'

function normalizeCanonicalChain(chain: Chain): Chain {
  return chain.id === mainnet.id ? mainnet : chain
}

export function getWagmiConfigChains(
  walletChains: readonly Chain[],
  canonicalChains: readonly Chain[] = []
): [Chain, ...Chain[]] {
  const uniqueChains = Array.from(
    new Map(
      [...walletChains, ...canonicalChains.map(normalizeCanonicalChain)].map((chain) => [chain.id, chain])
    ).values()
  )

  return uniqueChains as [Chain, ...Chain[]]
}
