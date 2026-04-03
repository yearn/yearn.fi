import { patchYBoldVaults } from '@pages/vaults/domain/normalizeVault'
import { KONG_REST_BASE } from '@pages/vaults/utils/kongRest'
import { useDeepCompareMemo } from '@react-hookz/web'
import { fetchWithSchema, getFetchQueryKey, useFetch } from '@shared/hooks/useFetch'
import type { TDict } from '@shared/types'
import { SUPPORTED_NETWORKS, toAddress } from '@shared/utils'
import type { TKongVaultList, TKongVaultListItem } from '@shared/utils/schemas/kongVaultListSchema'
import { kongVaultListSchema } from '@shared/utils/schemas/kongVaultListSchema'
import type { QueryObserverResult } from '@tanstack/react-query'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo } from 'react'

const DEFAULT_CHAIN_IDS = SUPPORTED_NETWORKS.map((network) => network.id)
const VAULT_LIST_ENDPOINT = `${KONG_REST_BASE}/list/vaults`

export const isCatalogYearnVault = (item: TKongVaultListItem): boolean =>
  item.origin === 'yearn' && item.inclusion?.isYearn !== false

function useFetchYearnVaults(
  chainIDs?: number[] | undefined,
  options?: { enabled?: boolean }
): {
  vaults: TDict<TKongVaultListItem>
  allVaults: TDict<TKongVaultListItem>
  isLoading: boolean
  refetch: () => Promise<QueryObserverResult<TKongVaultList, Error>>
} {
  const isEnabled = options?.enabled ?? true
  const resolvedChainIds = chainIDs ?? DEFAULT_CHAIN_IDS
  const {
    data: kongVaultList,
    isLoading,
    refetch
  } = useFetch<TKongVaultList>({
    endpoint: VAULT_LIST_ENDPOINT,
    schema: kongVaultListSchema,
    config: {
      cacheDuration: 15 * 60 * 1000,
      enabled: isEnabled
    }
  })

  const filteredByChain = useDeepCompareMemo((): TKongVaultListItem[] => {
    if (!kongVaultList) {
      return []
    }

    const chainIdSet = new Set(resolvedChainIds)
    return kongVaultList.filter((item) => chainIdSet.has(item.chainId))
  }, [kongVaultList, resolvedChainIds])

  const allVaultsObject = useDeepCompareMemo((): TDict<TKongVaultListItem> => {
    if (!filteredByChain.length) {
      return {}
    }

    return filteredByChain.reduce((acc: TDict<TKongVaultListItem>, item): TDict<TKongVaultListItem> => {
      acc[toAddress(item.address)] = item
      return acc
    }, {})
  }, [filteredByChain])

  const catalogVaultsObject = useDeepCompareMemo((): TDict<TKongVaultListItem> => {
    if (!filteredByChain.length) {
      return {}
    }

    return filteredByChain.reduce((acc: TDict<TKongVaultListItem>, item): TDict<TKongVaultListItem> => {
      if (!isCatalogYearnVault(item)) {
        return acc
      }
      acc[toAddress(item.address)] = item
      return acc
    }, {})
  }, [filteredByChain])

  const patchedAllVaultsObject = useDeepCompareMemo((): TDict<TKongVaultListItem> => {
    return patchYBoldVaults(allVaultsObject)
  }, [allVaultsObject])

  const patchedCatalogVaultsObject = useDeepCompareMemo((): TDict<TKongVaultListItem> => {
    return patchYBoldVaults(catalogVaultsObject)
  }, [catalogVaultsObject])

  return {
    vaults: patchedCatalogVaultsObject,
    allVaults: patchedAllVaultsObject,
    isLoading,
    refetch: refetch as unknown as () => Promise<QueryObserverResult<TKongVaultList, Error>>
  }
}

const prefetchedEndpoints = new Set<string>()

function usePrefetchYearnVaults(enabled = true): void {
  const endpoints = useMemo(() => [VAULT_LIST_ENDPOINT], [])
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!enabled) {
      return
    }

    endpoints.forEach((endpoint) => {
      if (!endpoint || prefetchedEndpoints.has(endpoint)) {
        return
      }

      prefetchedEndpoints.add(endpoint)
      const queryKey = getFetchQueryKey(endpoint)
      if (!queryKey) {
        return
      }
      void queryClient.prefetchQuery({
        queryKey,
        queryFn: () => fetchWithSchema(endpoint, kongVaultListSchema),
        staleTime: 15 * 60 * 1000
      })
    })
  }, [enabled, endpoints, queryClient])
}

export { useFetchYearnVaults, usePrefetchYearnVaults }
