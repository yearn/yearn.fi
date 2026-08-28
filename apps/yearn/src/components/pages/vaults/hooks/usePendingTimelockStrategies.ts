import type { TPendingTimelockStrategiesResponse } from '@pages/vaults/types/timelockStrategies'
import { toAddress } from '@shared/utils'
import { useQuery } from '@tanstack/react-query'

export function buildPendingTimelockStrategiesUrl({
  chainId,
  vaultAddress
}: {
  chainId: number
  vaultAddress: `0x${string}`
}): string {
  const params = new URLSearchParams({ chainId: String(chainId), vault: vaultAddress })
  return `/api/vaults/timelock-strategies?${params}`
}

export function usePendingTimelockStrategies({
  chainId,
  vaultAddress,
  enabled = true
}: {
  chainId: number
  vaultAddress: `0x${string}`
  enabled?: boolean
}) {
  return useQuery({
    queryKey: ['pending-timelock-strategies', chainId, toAddress(vaultAddress)],
    queryFn: async () => {
      const response = await fetch(buildPendingTimelockStrategiesUrl({ chainId, vaultAddress }))
      if (!response.ok) {
        throw new Error('Failed to fetch pending timelock strategies')
      }

      return (await response.json()) as TPendingTimelockStrategiesResponse
    },
    enabled: enabled && Boolean(chainId && vaultAddress),
    staleTime: 60_000,
    refetchInterval: 60_000
  })
}
