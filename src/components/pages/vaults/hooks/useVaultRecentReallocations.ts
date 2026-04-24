import type { TKongVaultView } from '@pages/vaults/domain/kongVaultSelectors'
import {
  buildReallocationPanels,
  type TCurrentAllocationInput,
  type TReallocationPanel
} from '@pages/vaults/utils/reallocations'
import { fetchWithSchema } from '@shared/hooks/useFetch'
import { doaOptimizationHistorySchema } from '@shared/utils/schemas/doaOptimizationSchema'
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

  const panels = useMemo(() => {
    return buildReallocationPanels(data ?? [], strategyNamesByAddress, currentAllocation)
  }, [currentAllocation, data, strategyNamesByAddress])

  return {
    panels,
    isLoading,
    hasUnexpectedError: Boolean(error) && !isExpectedNoDataStatus(getErrorStatus(error))
  }
}
