'use client'

import { discoverWalletVaults, parseWalletCandidates, parseYearnAllocators } from '@erc4626/lib/vaultDiscovery'
import { wagmiConfig } from '@erc4626/lib/wagmiConfig'
import { useQuery } from '@tanstack/react-query'
import { getPublicClient } from '@wagmi/core'
import type { Address } from 'viem'

async function fetchJson(url: string, signal: AbortSignal) {
  const response = await fetch(url, { signal, cache: 'no-store' })
  if (!response.ok)
    throw new Error(`Discovery service is unavailable (${response.status}). Please retry or paste a vault address.`)
  return response.json() as Promise<unknown>
}

export function useWalletVaults(owner: Address | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ['erc4626-wallet-vaults', owner?.toLowerCase()],
    enabled: enabled && !!owner,
    staleTime: 30_000,
    retry: 1,
    queryFn: async ({ signal }) => {
      const payload = await fetchJson(`https://yearn.fi/api/enso/balances?eoaAddress=${owner}`, signal)
      return discoverWalletVaults(
        parseWalletCandidates(payload),
        owner!,
        (chainId) => getPublicClient(wagmiConfig, { chainId }),
        signal
      )
    }
  })
}

export function useYearnAllocators(enabled: boolean) {
  return useQuery({
    queryKey: ['erc4626-yearn-allocators'],
    enabled,
    staleTime: 300_000,
    retry: 1,
    queryFn: async ({ signal }) =>
      parseYearnAllocators(await fetchJson('https://kong.yearn.fi/api/rest/list/vaults?origin=yearn', signal))
  })
}
