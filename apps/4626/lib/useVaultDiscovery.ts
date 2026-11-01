'use client'

import { DemoContext } from '@erc4626/lib/demoContext'
import { isDemoHolding } from '@erc4626/lib/demoHolding'
import {
  discoverWalletVaults,
  filterVisibleWalletVaults,
  parseHiddenYearnVaultTokens,
  parseIndexedVaults,
  parseWalletCandidates,
  parseYearnAllocators
} from '@erc4626/lib/vaultDiscovery'
import { queryOptions, useQuery } from '@tanstack/react-query'
import { getPublicClient } from '@wagmi/core'
import { useContext } from 'react'
import { type Address, erc20Abi } from 'viem'
import { useConfig } from 'wagmi'

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
    return {
      allocators: parseYearnAllocators(payload, { includeHidden: true }),
      vaults: parseIndexedVaults(payload),
      allVaults: parseIndexedVaults(payload, { includeHidden: true }),
      hiddenTokens: parseHiddenYearnVaultTokens(payload)
    }
  }
})

export function useWalletVaults(owner: Address | undefined, enabled: boolean) {
  const demo = useContext(DemoContext)
  const config = useConfig()
  const catalog = useQuery({ ...yearnCatalogOptions, enabled: enabled && !!owner })
  const query = useQuery({
    queryKey: ['erc4626-wallet-vaults', owner?.toLowerCase(), demo],
    enabled: enabled && !!owner && !catalog.isPending,
    staleTime: 30_000,
    retry: 1,
    queryFn: async ({ signal }) => {
      if (demo) {
        const readings = await Promise.all(
          (catalog.data?.allVaults ?? [])
            .filter((vault) => isDemoHolding(vault.chainId, vault.address))
            .map(async (vault) => {
              const client = getPublicClient(config, { chainId: vault.chainId })
              if (!client) throw new Error('Demo network unavailable')
              const [shares, decimals] = await Promise.all([
                client.readContract({
                  address: vault.address,
                  abi: erc20Abi,
                  functionName: 'balanceOf',
                  args: [owner!]
                }),
                client.readContract({ address: vault.address, abi: erc20Abi, functionName: 'decimals' })
              ])
              return { ...vault, shares, decimals }
            })
        )
        return { vaults: readings.filter((vault) => vault.shares > 0n), unreadable: 0, omitted: 0 }
      }
      const payload = await fetchJson(`https://yearn.fi/api/enso/balances?eoaAddress=${owner}`, signal)
      return discoverWalletVaults(
        parseWalletCandidates(payload),
        owner!,
        (chainId) => getPublicClient(config, { chainId }),
        signal,
        catalog.data?.allVaults
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
    isError: query.isError,
    error: query.error,
    visibilityUnavailable: catalog.isError,
    refetch: () => Promise.all([query.refetch(), catalog.refetch()])
  }
}

export function useYearnAllocators(enabled: boolean, { includeHidden = false } = {}) {
  return useQuery({
    ...yearnCatalogOptions,
    enabled,
    select: (catalog) =>
      includeHidden ? catalog.allocators : filterVisibleWalletVaults(catalog.allocators, catalog.hiddenTokens)
  })
}

export function useYearnVaultChoices(enabled: boolean) {
  return useQuery({ ...yearnCatalogOptions, enabled, select: (catalog) => catalog.vaults })
}

/** Include hidden factory metadata for deep links and retirement checks, never for picker visibility. */
export function useYearnVaultMetadata(enabled: boolean) {
  return useQuery({
    ...yearnCatalogOptions,
    enabled,
    select: (catalog) => [...catalog.allocators, ...catalog.allVaults]
  })
}

export function useIndexedVaults(enabled: boolean) {
  return useQuery({
    queryKey: ['erc4626-indexed-vaults'],
    enabled,
    staleTime: 300_000,
    retry: 1,
    queryFn: async ({ signal }) =>
      parseIndexedVaults(await fetchJson('https://kong.yearn.fi/api/rest/list/vaults', signal)).filter(
        (vault) => !vault.legacy
      )
  })
}
