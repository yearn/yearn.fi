import { buildNotificationEntry, buildNotificationUpdate } from '@shared/contexts/notificationActions.helpers'
import { TransactionTrackingCoordinator } from '@shared/hooks/useTransactionTrackingCoordinator'
import type {
  TCreateNotificationParams,
  TCreateSubmittedNotificationParams,
  TNotificationsActionsContext,
  TUpdateNotificationParams
} from '@shared/types/notifications'
import type React from 'react'
import { createContext, useCallback, useContext, useMemo } from 'react'

import { useNotifications } from './useNotifications'
import { useWeb3 } from './useWeb3'

const defaultProps: TNotificationsActionsContext = {
  createNotification: async (): Promise<number> => 0,
  createSubmittedNotification: async (): Promise<number> => 0,
  updateNotification: async (): Promise<void> => undefined
}

const NotificationsActionsContext = createContext<TNotificationsActionsContext>(defaultProps)

export const WithNotificationsActions = ({ children }: { children: React.ReactElement }): React.ReactElement => {
  const { addNotification, cachedEntries, updateEntry } = useNotifications()
  const { address } = useWeb3()

  const createNotification = useCallback(
    async (params: TCreateNotificationParams): Promise<number> => {
      return await addNotification(buildNotificationEntry(params, address, Date.now() / 1000))
    },
    [addNotification, address]
  )

  const createSubmittedNotification = useCallback(
    async (params: TCreateSubmittedNotificationParams): Promise<number> => {
      return await addNotification(buildNotificationEntry(params, address, Date.now() / 1000))
    },
    [addNotification, address]
  )

  const updateNotification = useCallback(
    async (params: TUpdateNotificationParams): Promise<void> => {
      await updateEntry(buildNotificationUpdate(params, Date.now() / 1000), params.id)
    },
    [updateEntry]
  )

  const contextValue = useMemo(
    (): TNotificationsActionsContext => ({
      createNotification,
      createSubmittedNotification,
      updateNotification
    }),
    [createNotification, createSubmittedNotification, updateNotification]
  )

  return (
    <NotificationsActionsContext.Provider value={contextValue}>
      <TransactionTrackingCoordinator notifications={cachedEntries} />
      {children}
    </NotificationsActionsContext.Provider>
  )
}

export const useNotificationsActions = (): TNotificationsActionsContext => {
  const ctx = useContext(NotificationsActionsContext)
  if (!ctx) {
    throw new Error('NotificationsActionsContext not found')
  }
  return ctx
}
