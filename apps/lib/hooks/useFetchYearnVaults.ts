import { useFetch } from '@lib/hooks/useFetch'
import { useYDaemonBaseURI } from '@lib/hooks/useYDaemonBaseURI'
import type { TDict } from '@lib/types'
import { toAddress } from '@lib/utils'
import { baseFetcher } from '@lib/utils/fetchers'
import type { TYDaemonVault, TYDaemonVaults } from '@lib/utils/schemas/yDaemonVaultsSchemas'
import { yDaemonVaultsSchema } from '@lib/utils/schemas/yDaemonVaultsSchemas'
import { useDeepCompareMemo } from '@react-hookz/web'
import { patchYBoldVaults } from '@vaults/domain/normalizeVault'

import { useEffect, useMemo } from 'react'
import type { KeyedMutator } from 'swr'
import { mutate } from 'swr'

/******************************************************************************
 ** The useFetchYearnVaults hook is used to fetch the vaults from the yDaemon
 ** API.
 ** It will fetch 3 kinds of vaults:
 ** - The active vaults
 ** - The vaults that are in the migration process
 ** - The retired vaults
 *****************************************************************************/
const DEFAULT_CHAIN_IDS = [1, 10, 137, 146, 250, 8453, 42161, 747474]

const buildVaultsEndpoint = (baseUri: string, chainIDs?: number[]): string => {
  return `${baseUri}/vaults?${new URLSearchParams({
    hideAlways: 'true',
    orderBy: 'featuringScore',
    orderDirection: 'desc',
    strategiesDetails: 'withDetails',
    strategiesCondition: 'inQueue',
    chainIDs: (chainIDs ?? DEFAULT_CHAIN_IDS).join(','),
    limit: '2500'
  })}`
}

const buildVaultsMigrationsEndpoint = (baseUri: string, chainIDs?: number[]): string => {
  return `${baseUri}/vaults?${new URLSearchParams({
    chainIDs: (chainIDs ?? DEFAULT_CHAIN_IDS).join(','),
    migratable: 'nodust',
    limit: '2500'
  })}`
}

const buildVaultsRetiredEndpoint = (baseUri: string): string => {
  return `${baseUri}/vaults/retired?${new URLSearchParams({
    limit: '2500'
  })}`
}

function useFetchYearnVaults(chainIDs?: number[] | undefined): {
  vaults: TDict<TYDaemonVault>
  vaultsMigrations: TDict<TYDaemonVault>
  vaultsRetired: TDict<TYDaemonVault>
  isLoading: boolean
  mutate: KeyedMutator<TYDaemonVaults>
} {
  const { yDaemonBaseUri: yDaemonBaseUriWithoutChain } = useYDaemonBaseURI()

  const vaultsEndpoint = buildVaultsEndpoint(yDaemonBaseUriWithoutChain, chainIDs)
  const migrationsEndpoint = buildVaultsMigrationsEndpoint(yDaemonBaseUriWithoutChain, chainIDs)
  const retiredEndpoint = buildVaultsRetiredEndpoint(yDaemonBaseUriWithoutChain)

  const {
    data: vaults,
    isLoading,
    mutate
  } = useFetch<TYDaemonVaults>({
    endpoint: vaultsEndpoint,
    schema: yDaemonVaultsSchema,
    config: {
      cacheDuration: 1000 * 60 * 60 // 1 hour
    }
  })

  // const vaultsMigrations: TYDaemonVaults = useMemo(() => [], []);
  const { data: vaultsMigrations } = useFetch<TYDaemonVaults>({
    endpoint: migrationsEndpoint,
    schema: yDaemonVaultsSchema
  })

  // const vaultsRetired: TYDaemonVaults = useMemo(() => [], []);
  const { data: vaultsRetired } = useFetch<TYDaemonVaults>({
    endpoint: retiredEndpoint,
    schema: yDaemonVaultsSchema
  })

  const vaultsObject = useDeepCompareMemo((): TDict<TYDaemonVault> => {
    if (!vaults) {
      return {}
    }
    const _vaultsObject = (vaults || []).reduce((acc: TDict<TYDaemonVault>, vault): TDict<TYDaemonVault> => {
      if (!vault.migration.available) {
        acc[toAddress(vault.address)] = vault
      }
      return acc
    }, {})
    return _vaultsObject
  }, [vaults])

  const patchedVaultsObject = useDeepCompareMemo((): TDict<TYDaemonVault> => {
    return patchYBoldVaults(vaultsObject)
  }, [vaultsObject])

  const vaultsMigrationsObject = useDeepCompareMemo((): TDict<TYDaemonVault> => {
    if (!vaultsMigrations) {
      return {}
    }
    const _migratableVaultsObject = (vaultsMigrations || []).reduce(
      (acc: TDict<TYDaemonVault>, vault): TDict<TYDaemonVault> => {
        if (toAddress(vault.address) !== toAddress(vault.migration.address)) {
          acc[toAddress(vault.address)] = vault
        }
        return acc
      },
      {}
    )
    return _migratableVaultsObject
  }, [vaultsMigrations])

  const vaultsRetiredObject = useDeepCompareMemo((): TDict<TYDaemonVault> => {
    if (!vaultsRetired) {
      return {}
    }
    const _retiredVaultsObject = (vaultsRetired || []).reduce(
      (acc: TDict<TYDaemonVault>, vault): TDict<TYDaemonVault> => {
        acc[toAddress(vault.address)] = vault
        return acc
      },
      {}
    )
    return _retiredVaultsObject
  }, [vaultsRetired])

  return {
    vaults: patchedVaultsObject,
    vaultsMigrations: vaultsMigrationsObject,
    vaultsRetired: vaultsRetiredObject,
    isLoading,
    mutate
  }
}

const prefetchedEndpoints = new Set<string>()

function usePrefetchYearnVaults(chainIDs?: number[] | undefined, enabled = true): void {
  const { yDaemonBaseUri: yDaemonBaseUriWithoutChain } = useYDaemonBaseURI()
  const resolvedChainIds = chainIDs ?? DEFAULT_CHAIN_IDS

  const endpoints = useMemo(
    () => [
      buildVaultsEndpoint(yDaemonBaseUriWithoutChain, resolvedChainIds),
      buildVaultsMigrationsEndpoint(yDaemonBaseUriWithoutChain, resolvedChainIds),
      buildVaultsRetiredEndpoint(yDaemonBaseUriWithoutChain)
    ],
    [yDaemonBaseUriWithoutChain, resolvedChainIds]
  )

  useEffect(() => {
    if (!enabled) {
      return
    }

    endpoints.forEach((endpoint) => {
      if (!endpoint || prefetchedEndpoints.has(endpoint)) {
        return
      }

      prefetchedEndpoints.add(endpoint)
      void mutate(endpoint, baseFetcher(endpoint), { revalidate: false })
    })
  }, [enabled, endpoints])
}

export { useFetchYearnVaults, usePrefetchYearnVaults }
