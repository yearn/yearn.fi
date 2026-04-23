import type { TKongVaultView } from '@pages/vaults/domain/kongVaultSelectors'
import {
  appendCurrentAllocationPanel,
  buildReallocationPanels,
  type TCurrentAllocationInput,
  type TReallocationPanel
} from '@pages/vaults/utils/reallocations'
import { supportsArchiveAllocationHistory } from '@shared/constants/archiveAllocationHistory'
import { fetchWithSchema } from '@shared/hooks/useFetch'
import { archiveAllocationHistorySchema } from '@shared/utils/schemas/archiveAllocationHistorySchema'
import { doaOptimizationHistorySchema } from '@shared/utils/schemas/doaOptimizationSchema'
import { reallocationPanelsSchema } from '@shared/utils/schemas/reallocationPanelsSchema'
import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'

type TUseVaultRecentReallocationsProps = {
  currentVault?: TKongVaultView
}

type TUseVaultRecentReallocationsReturn = {
  panels: TReallocationPanel[]
  isLoading: boolean
  hasUnexpectedError: boolean
}

function getErrorStatus(error: unknown): number | undefined {
  const anyError = error as { response?: { status?: number }; status?: number }
  return anyError?.response?.status ?? anyError?.status
}

function isExpectedNoDataStatus(status: number | undefined): boolean {
  return status === 404
}

function getOptimizationTimestamp(timestamp: string | null | undefined): number {
  if (!timestamp) {
    return Number.POSITIVE_INFINITY
  }

  return new Date(timestamp.replace(' UTC', 'Z').replace(' ', 'T')).getTime()
}

export function useVaultRecentReallocations({
  currentVault
}: TUseVaultRecentReallocationsProps): TUseVaultRecentReallocationsReturn {
  const isV3Vault = Boolean(currentVault?.version?.startsWith('3') || currentVault?.version?.startsWith('~3'))
  const endpoint = useMemo(() => {
    if (!currentVault?.address || !isV3Vault) {
      return null
    }

    return `/api/optimization/change?vault=${encodeURIComponent(currentVault.address)}&history=1`
  }, [currentVault?.address, isV3Vault])

  const strategyNamesByAddress = useMemo(() => {
    return (currentVault?.strategies ?? []).reduce<Record<string, string>>((acc, strategy) => {
      acc[strategy.address.toLowerCase()] = strategy.name
      return acc
    }, {})
  }, [currentVault?.strategies])
  const archiveStrategyAddresses = useMemo(() => {
    return [...new Set((currentVault?.strategies ?? []).map((strategy) => strategy.address.toLowerCase()))]
  }, [currentVault?.strategies])

  const currentAllocation = useMemo<TCurrentAllocationInput | undefined>(() => {
    if (!currentVault?.address || !isV3Vault) {
      return undefined
    }

    return {
      timestampUtc: new Date().toISOString(),
      strategies: (currentVault.strategies ?? []).map((strategy, index) => ({
        strategyAddress: strategy.address,
        name: strategy.name?.trim() || `Strategy ${index + 1}`,
        allocationPct: (strategy.details?.debtRatio ?? 0) / 100
      }))
    }
  }, [currentVault?.address, currentVault?.strategies, isV3Vault])

  const { data, error, isLoading } = useQuery({
    queryKey: ['vault-reallocations', currentVault?.address?.toLowerCase() ?? null],
    enabled: Boolean(endpoint),
    queryFn: async () => {
      if (!endpoint) {
        return []
      }

      try {
        return await fetchWithSchema(endpoint, doaOptimizationHistorySchema)
      } catch (caughtError) {
        if (isExpectedNoDataStatus(getErrorStatus(caughtError))) {
          return []
        }

        throw caughtError
      }
    },
    staleTime: 10 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: (failureCount, queryError) => {
      if (isExpectedNoDataStatus(getErrorStatus(queryError))) {
        return false
      }

      return failureCount < 1
    }
  })
  const oldestOptimizationTimestamp = useMemo(() => {
    return (data ?? []).reduce<string | null>((oldestTimestamp, optimization) => {
      const nextTimestamp = optimization.source.timestampUtc ?? optimization.source.latestMatchedTimestampUtc
      if (!nextTimestamp) {
        return oldestTimestamp
      }

      if (!oldestTimestamp || getOptimizationTimestamp(nextTimestamp) < getOptimizationTimestamp(oldestTimestamp)) {
        return nextTimestamp
      }

      return oldestTimestamp
    }, null)
  }, [data])
  const archiveHistoryEndpoint = useMemo(() => {
    if (
      !currentVault?.address ||
      !supportsArchiveAllocationHistory(currentVault.chainID, currentVault.address) ||
      !oldestOptimizationTimestamp ||
      archiveStrategyAddresses.length === 0
    ) {
      return null
    }

    const params = new URLSearchParams({
      chainId: String(currentVault.chainID),
      fromTimestamp: oldestOptimizationTimestamp,
      strategies: archiveStrategyAddresses.join(','),
      vault: currentVault.address
    })

    return `/api/optimization/archive-history?${params.toString()}`
  }, [archiveStrategyAddresses, currentVault?.address, currentVault?.chainID, oldestOptimizationTimestamp])
  const sankeyFeedEndpoint = useMemo(() => {
    if (!currentVault?.address || !supportsArchiveAllocationHistory(currentVault.chainID, currentVault.address)) {
      return null
    }

    const params = new URLSearchParams({
      chainId: String(currentVault.chainID),
      vault: currentVault.address
    })

    return `/api/optimization/sankey-feed?${params.toString()}`
  }, [currentVault?.address, currentVault?.chainID])
  const {
    data: sankeyFeedData,
    error: sankeyFeedError,
    isLoading: isSankeyFeedLoading
  } = useQuery({
    queryKey: ['vault-reallocations-sankey-feed', currentVault?.address?.toLowerCase() ?? null],
    enabled: Boolean(sankeyFeedEndpoint),
    queryFn: async () => {
      if (!sankeyFeedEndpoint) {
        return []
      }

      try {
        return await fetchWithSchema(sankeyFeedEndpoint, reallocationPanelsSchema)
      } catch (caughtError) {
        if (isExpectedNoDataStatus(getErrorStatus(caughtError))) {
          return []
        }

        console.error('[useVaultRecentReallocations] Sankey feed fetch failed:', caughtError)
        return []
      }
    },
    staleTime: 10 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: false
  })
  const { data: archiveHistoryData } = useQuery({
    queryKey: [
      'vault-reallocations-archive-history',
      currentVault?.address?.toLowerCase() ?? null,
      oldestOptimizationTimestamp
    ],
    enabled: Boolean(archiveHistoryEndpoint),
    queryFn: async () => {
      if (!archiveHistoryEndpoint) {
        return []
      }

      try {
        return await fetchWithSchema(archiveHistoryEndpoint, archiveAllocationHistorySchema)
      } catch (caughtError) {
        if (isExpectedNoDataStatus(getErrorStatus(caughtError))) {
          return []
        }

        console.error('[useVaultRecentReallocations] Archive history fetch failed:', caughtError)
        return []
      }
    },
    staleTime: 10 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: false
  })

  const sankeyPanels = useMemo(() => {
    return appendCurrentAllocationPanel(sankeyFeedData ?? [], currentAllocation)
  }, [currentAllocation, sankeyFeedData])
  const panels = useMemo(() => {
    if (sankeyPanels.length > 0) {
      return sankeyPanels
    }

    return buildReallocationPanels(data ?? [], strategyNamesByAddress, currentAllocation, archiveHistoryData ?? [])
  }, [archiveHistoryData, currentAllocation, data, sankeyPanels, strategyNamesByAddress])
  const hasUnexpectedRedisError = Boolean(error) && !isExpectedNoDataStatus(getErrorStatus(error))
  const hasUnexpectedSankeyFeedError =
    Boolean(sankeyFeedError) && !isExpectedNoDataStatus(getErrorStatus(sankeyFeedError))

  return {
    panels,
    isLoading: isLoading || isSankeyFeedLoading,
    hasUnexpectedError: panels.length === 0 && (hasUnexpectedRedisError || hasUnexpectedSankeyFeedError)
  }
}
