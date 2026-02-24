import { getVaultView, type TKongVault } from '@pages/vaults/domain/kongVaultSelectors'
import { patchYBoldVaults } from '@pages/vaults/domain/normalizeVault'
import { KONG_REST_BASE } from '@pages/vaults/utils/kongRest'
import { useDeepCompareMemo } from '@react-hookz/web'
import { fetchWithSchema, getFetchQueryKey, useFetch } from '@shared/hooks/useFetch'
import type { TDict } from '@shared/types'
import { toAddress } from '@shared/utils'
import type { TKongVaultList, TKongVaultListItem } from '@shared/utils/schemas/kongVaultListSchema'
import { kongVaultListSchema } from '@shared/utils/schemas/kongVaultListSchema'
import type { QueryObserverResult } from '@tanstack/react-query'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo } from 'react'

/******************************************************************************
 ** The useFetchYearnVaults hook fetches the vault list from Kong REST and
 ** normalizes it into the Kong vault view shape used by the UI.
 *****************************************************************************/
const DEFAULT_CHAIN_IDS = [1, 10, 137, 146, 250, 8453, 42161, 747474]

const VAULT_LIST_ENDPOINT = `${KONG_REST_BASE}/list/vaults`

const isCatalogYearnVault = (item: TKongVaultListItem): boolean =>
  item.origin === 'yearn' && item.inclusion?.isYearn !== false

const isInclusionYearnVault = (item: TKongVaultListItem): boolean => item.inclusion?.isYearn === true

const mapKongListItemToVault = (item: TKongVaultListItem): TKongVault => getVaultView(item)

function useFetchYearnVaults(
  chainIDs?: number[] | undefined,
  options?: { enabled?: boolean }
): {
  vaults: TDict<TKongVault>
  inclusionYearnVaults: TDict<TKongVault>
  allVaults: TDict<TKongVault>
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

  const mappedVaultEntries = useDeepCompareMemo((): Array<{ item: TKongVaultListItem; vault: TKongVault }> => {
    if (!kongVaultList) {
      return []
    }
    const chainIdSet = new Set(resolvedChainIds)
    return kongVaultList.flatMap((item) => {
      if (!chainIdSet.has(item.chainId)) {
        return []
      }
      const vault = mapKongListItemToVault(item)
      return [{ item, vault }]
    })
  }, [kongVaultList, resolvedChainIds])

  const allVaultsObject = useDeepCompareMemo((): TDict<TKongVault> => {
    if (!mappedVaultEntries.length) {
      return {}
    }
    return mappedVaultEntries.reduce((acc: TDict<TKongVault>, entry): TDict<TKongVault> => {
      const vault = entry.vault
      acc[toAddress(vault.address)] = vault
      return acc
    }, {})
  }, [mappedVaultEntries])

  const catalogVaultsObject = useDeepCompareMemo((): TDict<TKongVault> => {
    if (!mappedVaultEntries.length) {
      return {}
    }
    return mappedVaultEntries.reduce((acc: TDict<TKongVault>, entry): TDict<TKongVault> => {
      if (!isCatalogYearnVault(entry.item)) {
        return acc
      }
      const vault = entry.vault
      acc[toAddress(vault.address)] = vault
      return acc
    }, {})
  }, [mappedVaultEntries])

  const inclusionYearnVaultsObject = useDeepCompareMemo((): TDict<TKongVault> => {
    if (!mappedVaultEntries.length) {
      return {}
    }
    return mappedVaultEntries.reduce((acc: TDict<TKongVault>, entry): TDict<TKongVault> => {
      if (!isInclusionYearnVault(entry.item)) {
        return acc
      }
      const vault = entry.vault
      acc[toAddress(vault.address)] = vault
      return acc
    }, {})
  }, [mappedVaultEntries])

  const patchedAllVaultsObject = useDeepCompareMemo((): TDict<TKongVault> => {
    return patchYBoldVaults(allVaultsObject)
  }, [allVaultsObject])

  const patchedCatalogVaultsObject = useDeepCompareMemo((): TDict<TKongVault> => {
    return patchYBoldVaults(catalogVaultsObject)
  }, [catalogVaultsObject])

  const patchedInclusionYearnVaultsObject = useDeepCompareMemo((): TDict<TKongVault> => {
    return patchYBoldVaults(inclusionYearnVaultsObject)
  }, [inclusionYearnVaultsObject])

  return {
    vaults: patchedCatalogVaultsObject,
    inclusionYearnVaults: patchedInclusionYearnVaultsObject,
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
