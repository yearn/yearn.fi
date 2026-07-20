import { type UseQueryResult, useQuery } from '@tanstack/react-query'
import { useVaultWidgetRuntime, type VaultWidgetSafeTransactionDetails } from '@yearn/vault-widget/runtime'
import type { Hash } from 'viem'

export function useSafeTransactionDetails({
  safeTxHash,
  enabled
}: {
  safeTxHash?: Hash
  enabled: boolean
}): UseQueryResult<VaultWidgetSafeTransactionDetails | undefined> {
  const runtime = useVaultWidgetRuntime()

  return useQuery({
    queryKey: ['vault-widget-safe-transaction', safeTxHash],
    enabled: enabled && Boolean(safeTxHash) && typeof window !== 'undefined',
    queryFn: () => (safeTxHash ? runtime.safe.getTransactionDetails(safeTxHash) : undefined),
    refetchInterval: (query) => {
      const status = query.state.data?.status
      return status === 'success' || status === 'failed' || status === 'cancelled' ? false : 1500
    },
    retry: false
  })
}
