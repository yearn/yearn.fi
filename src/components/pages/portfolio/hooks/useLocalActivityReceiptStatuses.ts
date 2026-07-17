import type { TNotification } from '@shared/types/notifications'
import { retrieveConfig } from '@shared/utils/wagmi'
import { useQueries } from '@tanstack/react-query'
import { useMemo } from 'react'
import { getTransactionReceipt } from 'wagmi/actions'

export type TLocalActivityReceiptStatus = 'success' | 'reverted'

export function getLocalActivityTransactionKey(notification: Pick<TNotification, 'chainId' | 'txHash'>): string | null {
  return notification.txHash ? `${notification.chainId}:${notification.txHash.toLowerCase()}` : null
}

export function getReceiptValidatedLocalActivityNotifications(
  notifications: TNotification[],
  receiptStatuses: ReadonlyMap<string, TLocalActivityReceiptStatus>
): TNotification[] {
  return notifications.flatMap((notification) => {
    if (notification.status !== 'success') {
      return [notification]
    }

    const transactionKey = getLocalActivityTransactionKey(notification)
    const receiptStatus = transactionKey ? receiptStatuses.get(transactionKey) : undefined

    if (receiptStatus === 'reverted') {
      return [{ ...notification, status: 'error' as const }]
    }

    return receiptStatus === 'success' ? [notification] : []
  })
}

export function useLocalActivityReceiptStatuses(
  notifications: TNotification[],
  enabled: boolean
): ReadonlyMap<string, TLocalActivityReceiptStatus> {
  const candidates = useMemo(
    () => notifications.filter((notification) => notification.status === 'success' && notification.txHash),
    [notifications]
  )
  const queries = useQueries({
    queries: candidates.map((notification) => ({
      queryKey: ['portfolio', 'local-activity-receipt', notification.chainId, notification.txHash],
      queryFn: () =>
        getTransactionReceipt(retrieveConfig(), {
          chainId: notification.chainId,
          hash: notification.txHash!
        }),
      enabled,
      staleTime: Number.POSITIVE_INFINITY,
      retry: 1
    }))
  })

  return useMemo(
    () =>
      candidates.reduce<Map<string, TLocalActivityReceiptStatus>>((statuses, notification, index) => {
        const transactionKey = getLocalActivityTransactionKey(notification)
        const receiptStatus = queries[index]?.data?.status

        if (transactionKey && receiptStatus) {
          statuses.set(transactionKey, receiptStatus)
        }

        return statuses
      }, new Map()),
    [candidates, queries]
  )
}
