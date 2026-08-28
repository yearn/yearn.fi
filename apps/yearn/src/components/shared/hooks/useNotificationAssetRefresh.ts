import { useWalletActions } from '@shared/contexts/useWallet'
import {
  getNotificationRefreshTargets,
  shouldInvalidateNotificationTokenQuery
} from '@shared/hooks/notificationRefresh'
import type { TNotification } from '@shared/types/notifications'
import { useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'

export function useNotificationAssetRefresh(): (notification: TNotification) => Promise<void> {
  const { onRefresh } = useWalletActions()
  const queryClient = useQueryClient()

  return useCallback(
    async (notification: TNotification): Promise<void> => {
      const targets = getNotificationRefreshTargets(notification)
      await Promise.all([
        targets.length > 0 ? onRefresh(targets) : Promise.resolve(),
        queryClient.invalidateQueries({
          predicate: (query) => shouldInvalidateNotificationTokenQuery(query.queryKey, notification)
        })
      ])
    },
    [onRefresh, queryClient]
  )
}
