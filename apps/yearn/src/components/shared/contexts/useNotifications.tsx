import { useYearnTransactionLifecycle } from '@shared/contexts/transactionLifecycleContext'
import { projectLifecycleNotification } from '@shared/contexts/transactionLifecycleProjection'
import { filterNotificationsForAddress } from '@shared/contexts/useNotifications.helpers'
import { useWeb3 } from '@shared/contexts/useWeb3'
import type { TNotificationsContext } from '@shared/types/notifications'
import { selectNotificationStatus } from '@shared/utils/notificationLifecycle'
import type React from 'react'
import { createContext, useContext, useMemo, useSyncExternalStore } from 'react'

const EMPTY_LIFECYCLE_RECORDS = Object.freeze([])
const noLifecycleSubscribe = () => () => undefined
const emptyLifecycleRecords = () => EMPTY_LIFECYCLE_RECORDS

const defaultProps: TNotificationsContext = {
  cachedEntries: [],
  notificationStatus: null,
  isLoading: true,
  error: null,
  acknowledge: () => undefined
}

const NotificationsContext = createContext<TNotificationsContext>(defaultProps)
export const WithNotifications = ({ children }: { children: React.ReactElement }): React.ReactElement => {
  const { address } = useWeb3()
  const lifecycle = useYearnTransactionLifecycle()
  const lifecycleRecords = useSyncExternalStore(
    lifecycle?.subscribe ?? noLifecycleSubscribe,
    lifecycle ? () => lifecycle.getSnapshot().records : emptyLifecycleRecords,
    emptyLifecycleRecords
  )
  // Filter at render time as well as hydration, so changing wallets cannot expose the previous wallet's records.
  const visibleEntries = useMemo(
    () => filterNotificationsForAddress(lifecycleRecords.map(projectLifecycleNotification), address),
    [lifecycleRecords, address]
  )
  const notificationStatus = selectNotificationStatus(visibleEntries)

  const history = useSyncExternalStore(
    lifecycle?.subscribe ?? noLifecycleSubscribe,
    () => lifecycle?.getSnapshot().history ?? 'loading',
    () => 'loading'
  )
  const contextValue: TNotificationsContext = {
    cachedEntries: visibleEntries,
    acknowledge: () => {
      if (address) void lifecycle?.acknowledge(address)
    },
    notificationStatus,
    isLoading: history === 'loading',
    error: history === 'unavailable' ? 'Failed to load transaction history' : null
  }

  return <NotificationsContext.Provider value={contextValue}>{children}</NotificationsContext.Provider>
}

export const useNotifications = (): TNotificationsContext => {
  const ctx = useContext(NotificationsContext)
  if (!ctx) {
    throw new Error('NotificationsContext not found')
  }
  return ctx
}
