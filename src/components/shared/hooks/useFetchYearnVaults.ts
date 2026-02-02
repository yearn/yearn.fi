import { patchYBoldVaults } from '@pages/vaults/domain/normalizeVault'
import { KONG_REST_BASE } from '@pages/vaults/utils/kongRest'
import { normalizeVaultCategory } from '@pages/vaults/utils/normalizeVaultCategory'
import { deriveAssetCategory } from '@pages/vaults/utils/vaultListFacets'
import { useDeepCompareMemo } from '@react-hookz/web'
import { fetchWithSchema, getFetchQueryKey, useFetch } from '@shared/hooks/useFetch'
import type { TDict } from '@shared/types'
import { toAddress } from '@shared/utils'
import type { TKongVaultList, TKongVaultListItem } from '@shared/utils/schemas/kongVaultListSchema'
import { kongVaultListSchema } from '@shared/utils/schemas/kongVaultListSchema'
import type { TYDaemonVault } from '@shared/utils/schemas/yDaemonVaultsSchemas'
import { yDaemonVaultSchema } from '@shared/utils/schemas/yDaemonVaultsSchemas'
import type { QueryObserverResult } from '@tanstack/react-query'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo } from 'react'
import { zeroAddress } from 'viem'

/******************************************************************************
 ** The useFetchYearnVaults hook fetches the vault list from Kong REST and
 ** normalizes it into the yDaemon vault shape used by the UI.
 *****************************************************************************/
const DEFAULT_CHAIN_IDS = [1, 10, 137, 146, 250, 8453, 42161, 747474]

const VAULT_LIST_ENDPOINT = `${KONG_REST_BASE}/list/vaults?origin=yearn`

const normalizeNumber = (value: number | null | undefined, fallback = 0): number => {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return fallback
  }
  return value
}

const normalizeFee = (value: number | null | undefined): number => {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return 0
  }
  if (value > 1) {
    return value / 10000
  }
  return value
}

const resolveDecimals = (...values: Array<number | null | undefined>): number => {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
      return value
    }
  }
  return 18
}

const isV3Item = (item: TKongVaultListItem): boolean => {
  if (item.v3) {
    return true
  }
  const apiVersion = item.apiVersion ?? ''
  return apiVersion.startsWith('3') || apiVersion.startsWith('~3')
}

const isKnownKind = (value: string | null | undefined): value is TYDaemonVault['kind'] => {
  return value === 'Legacy' || value === 'Multi Strategy' || value === 'Single Strategy'
}

const resolveVaultKind = (item: TKongVaultListItem): TYDaemonVault['kind'] => {
  if (isKnownKind(item.kind)) {
    return item.kind
  }
  if (isV3Item(item)) {
    return item.strategiesCount > 0 ? 'Multi Strategy' : 'Single Strategy'
  }
  return 'Legacy'
}

const isKnownType = (value: string | null | undefined): value is TYDaemonVault['type'] => {
  return (
    value === 'Automated' ||
    value === 'Automated Yearn Vault' ||
    value === 'Experimental' ||
    value === 'Experimental Yearn Vault' ||
    value === 'Standard' ||
    value === 'Yearn Vault'
  )
}

const resolveVaultType = (item: TKongVaultListItem): TYDaemonVault['type'] => {
  if (isKnownType(item.type)) {
    return item.type
  }
  const name = item.name.toLowerCase()
  if (name.includes('factory')) {
    return 'Automated Yearn Vault'
  }
  return 'Standard'
}

const mapKongListItemToVault = (item: TKongVaultListItem): TYDaemonVault | null => {
  const tokenDecimals = resolveDecimals(item.asset?.decimals ?? null, item.decimals ?? null)
  const tokenSymbol = item.asset?.symbol ?? item.symbol ?? ''
  const tokenName = item.asset?.name ?? item.name ?? ''
  const tokenAddress = item.asset?.address ?? zeroAddress
  const historical = item.performance?.historical
  const oracleApy = item.performance?.oracle?.apy
  const estimated = item.performance?.estimated
  const hasOracleApy = typeof oracleApy === 'number'
  const hasEstimatedApy = typeof estimated?.apy === 'number'
  const aprType = hasOracleApy ? 'oracle' : (estimated?.type ?? 'unknown')
  const forwardAprType = hasOracleApy || hasEstimatedApy ? aprType : ''
  const vaultKind = resolveVaultKind(item)
  const vaultType = resolveVaultType(item)
  const forwardApr = (() => {
    const candidates = [oracleApy, estimated?.apy, historical?.net]
    for (const candidate of candidates) {
      if (candidate === null || candidate === undefined) {
        continue
      }
      return normalizeNumber(candidate)
    }
    return 0
  })()

  const parsed = yDaemonVaultSchema.safeParse({
    address: item.address,
    version: item.apiVersion ?? (item.v3 ? '3' : '2'),
    type: vaultType,
    kind: vaultKind,
    symbol: item.symbol ?? tokenSymbol ?? '',
    name: item.name ?? '',
    description: '',
    category: normalizeVaultCategory(item.category) || 'Unknown',
    decimals: resolveDecimals(item.decimals ?? null, tokenDecimals),
    chainID: item.chainId,
    token: {
      address: tokenAddress,
      name: tokenName,
      symbol: tokenSymbol,
      description: '',
      decimals: tokenDecimals
    },
    tvl: {
      totalAssets: '0',
      tvl: normalizeNumber(item.tvl),
      price: 0
    },
    apr: {
      type: aprType,
      netAPR: normalizeNumber(historical?.net),
      fees: {
        performance: normalizeFee(item.fees?.performanceFee),
        withdrawal: 0,
        management: normalizeFee(item.fees?.managementFee)
      },
      points: {
        weekAgo: normalizeNumber(historical?.weeklyNet),
        monthAgo: normalizeNumber(historical?.monthlyNet),
        inception: normalizeNumber(historical?.inceptionNet)
      },
      pricePerShare: {
        today: 0,
        weekAgo: 0,
        monthAgo: 0
      },
      forwardAPR: {
        type: forwardAprType,
        netAPR: forwardApr,
        composite: undefined
      }
    },
    featuringScore: 0,
    strategies: [],
    staking: undefined,
    migration: {
      available: Boolean(item.migration),
      address: zeroAddress,
      contract: zeroAddress
    },
    info: {
      sourceURL: '',
      riskLevel: item.riskLevel ?? -1,
      riskScore: [],
      riskScoreComment: '',
      uiNotice: '',
      isRetired: item.isRetired,
      isBoosted: item.isBoosted,
      isHighlighted: item.isHighlighted,
      isHidden: item.isHidden
    }
  })

  if (!parsed.success) {
    console.error('[useFetchYearnVaults] Failed to map Kong vault list item', parsed.error, item)
    return null
  }

  if (!item.category) {
    const derivedCategory = deriveAssetCategory({ ...parsed.data, category: '' })
    return {
      ...parsed.data,
      category: derivedCategory
    }
  }

  return parsed.data
}

function useFetchYearnVaults(
  chainIDs?: number[] | undefined,
  options?: { enabled?: boolean }
): {
  vaults: TDict<TYDaemonVault>
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

  const mappedVaults = useDeepCompareMemo((): TYDaemonVault[] => {
    if (!kongVaultList) {
      return []
    }
    const chainIdSet = new Set(resolvedChainIds)
    return kongVaultList
      .filter((item) => item.inclusion?.isYearn !== false)
      .filter((item) => chainIdSet.has(item.chainId))
      .map((item) => mapKongListItemToVault(item))
      .filter((item): item is TYDaemonVault => Boolean(item))
  }, [kongVaultList, resolvedChainIds])

  const vaultsObject = useDeepCompareMemo((): TDict<TYDaemonVault> => {
    if (!mappedVaults.length) {
      return {}
    }
    return mappedVaults.reduce((acc: TDict<TYDaemonVault>, vault): TDict<TYDaemonVault> => {
      acc[toAddress(vault.address)] = vault
      return acc
    }, {})
  }, [mappedVaults])

  const patchedVaultsObject = useDeepCompareMemo((): TDict<TYDaemonVault> => {
    return patchYBoldVaults(vaultsObject)
  }, [vaultsObject])

  return {
    vaults: patchedVaultsObject,
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
