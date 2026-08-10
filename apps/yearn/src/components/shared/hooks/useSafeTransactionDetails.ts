import { type UseQueryResult, useQuery } from '@tanstack/react-query'

export type SafeTransactionStatus = 'AWAITING_CONFIRMATIONS' | 'AWAITING_EXECUTION' | 'CANCELLED' | 'FAILED' | 'SUCCESS'

export type TSafeTransactionDetails = {
  safeTxHash: `0x${string}`
  txStatus: SafeTransactionStatus
  executionTxHash?: `0x${string}`
}

export async function fetchSafeTransactionDetails(
  safeTxHash: `0x${string}`
): Promise<TSafeTransactionDetails | undefined> {
  const { default: SafeAppsSDK } = await import('@safe-global/safe-apps-sdk')
  const sdk = new SafeAppsSDK()
  const transaction = await sdk.txs.getBySafeTxHash(safeTxHash)

  return {
    safeTxHash,
    txStatus: transaction.txStatus as SafeTransactionStatus,
    executionTxHash: transaction.txHash ? (transaction.txHash as `0x${string}`) : undefined
  }
}

export function useSafeTransactionDetails({
  safeTxHash,
  enabled
}: {
  safeTxHash?: `0x${string}`
  enabled: boolean
}): UseQueryResult<TSafeTransactionDetails | undefined> {
  return useQuery({
    queryKey: ['safeTransactionDetails', safeTxHash],
    enabled: enabled && Boolean(safeTxHash) && typeof window !== 'undefined',
    queryFn: async () => {
      if (!safeTxHash) {
        return undefined
      }

      return await fetchSafeTransactionDetails(safeTxHash)
    },
    refetchInterval: (query) => {
      const status = query.state.data?.txStatus
      if (status === 'SUCCESS' || status === 'FAILED' || status === 'CANCELLED') {
        return false
      }
      return 1500
    },
    retry: false
  })
}
