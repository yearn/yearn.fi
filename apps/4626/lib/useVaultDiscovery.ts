'use client'

import {
  discoverWalletVaults,
  filterVisibleWalletVaults,
  parseHiddenYearnVaultTokens,
  parseWalletCandidates,
  parseYearnAllocators
} from '@erc4626/lib/vaultDiscovery'
import { wagmiConfig } from '@erc4626/lib/wagmiConfig'
import { queryOptions, useQuery } from '@tanstack/react-query'
import { getPublicClient } from '@wagmi/core'
import type { Address } from 'viem'

async function fetchJson(url: string, signal: AbortSignal) {
  const response = await fetch(url, { signal, cache: 'no-store' })
  if (!response.ok)
    throw new Error(`Discovery service is unavailable (${response.status}). Please retry or paste a vault address.`)
  return response.json() as Promise<unknown>
}

const yearnCatalogOptions = queryOptions({
  queryKey: ['erc4626-yearn-catalog'],
  staleTime: 300_000,
  retry: 1,
  queryFn: async ({ signal }) => {
    const payload = await fetchJson('https://kong.yearn.fi/api/rest/list/vaults?origin=yearn', signal)
    return { allocators: parseYearnAllocators(payload), hiddenTokens: parseHiddenYearnVaultTokens(payload) }
  }
})

export function useWalletVaults(owner: Address | undefined, enabled: boolean) {
  const catalog = useQuery({ ...yearnCatalogOptions, enabled: enabled && !!owner })
  const query = useQuery({
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
  return {
    ...query,
    // Wait for the first visibility lookup so hidden rows never flash while it loads.
    // Like yearn.fi, unavailable metadata does not classify unknown vaults as hidden.
    data:
      query.data && !catalog.isPending
        ? {
            ...query.data,
            vaults: filterVisibleWalletVaults(query.data.vaults, catalog.data?.hiddenTokens ?? [])
          }
        : undefined,
    isFetching: query.isFetching || catalog.isFetching,
    isSuccess: query.isSuccess && !catalog.isPending,
    visibilityUnavailable: catalog.isError,
    refetch: () => Promise.all([query.refetch(), catalog.refetch()])
  }
}

export function useYearnAllocators(enabled: boolean) {
  return useQuery({ ...yearnCatalogOptions, enabled, select: (catalog) => catalog.allocators })
}
