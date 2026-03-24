import type { Chain } from 'viem'
import { mainnet } from 'viem/chains'

export function getWagmiConfigChains(chains: readonly Chain[]): [Chain, ...Chain[]] {
  const uniqueChains = Array.from(new Map(chains.map((chain) => [chain.id, chain])).values())

  if (!uniqueChains.some((chain) => chain.id === mainnet.id)) {
    uniqueChains.push(mainnet)
  }

  return uniqueChains as [Chain, ...Chain[]]
}
