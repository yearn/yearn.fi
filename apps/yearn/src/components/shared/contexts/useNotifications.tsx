import { useYearnTransactionLifecycle } from '@shared/contexts/transactionLifecycleContext'
import { projectLifecycleNotification } from '@shared/contexts/transactionLifecycleProjection'
import { filterNotificationsForAddress } from '@shared/contexts/useNotifications.helpers'
import { useWeb3 } from '@shared/contexts/useWeb3'
import type { TNotificationsContext } from '@shared/types/notifications'
import { NOTIFICATION_INDICATOR_WINDOW_SECONDS, selectNotificationStatus } from '@shared/utils/notificationLifecycle'
import type React from 'react'
import { createContext, useContext, useEffect, useMemo, useState, useSyncExternalStore } from 'react'

const EMPTY_LIFECYCLE_RECORDS = Object.freeze([])
const noLifecycleSubscribe = () => () => undefined
const emptyLifecycleRecords = () => EMPTY_LIFECYCLE_RECORDS

const defaultProps: TNotificationsContext = {
  cachedEntries: [],
  notificationStatus: null,
  isLoading: true,
  error: null
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
  const [clockSeconds, setNowSeconds] = useState(() => Date.now() / 1000)
  const nowSeconds = Math.max(clockSeconds, Date.now() / 1000)
  // Filter at render time as well as hydration, so changing wallets cannot expose the previous wallet's records.
  const visibleEntries = useMemo(
    () => filterNotificationsForAddress(lifecycleRecords.map(projectLifecycleNotification), address),
    [lifecycleRecords, address]
  )
  const notificationStatus = selectNotificationStatus(visibleEntries, nowSeconds)
  const nextExpiry = visibleEntries.reduce((next, entry) => {
    const timestamp = entry.timeFinished ?? entry.createdAt
    if (timestamp === undefined || (entry.status !== 'success' && entry.status !== 'error')) return next
    const expiry = timestamp + NOTIFICATION_INDICATOR_WINDOW_SECONDS
    return expiry > nowSeconds ? Math.min(next, expiry) : next
  }, Number.POSITIVE_INFINITY)
  // Wall-clock expiration needs a timer even when IndexedDB and React receive no new events.
  useEffect(() => {
    if (!Number.isFinite(nextExpiry)) return
    const timer = setTimeout(() => setNowSeconds(Date.now() / 1000), Math.max(0, nextExpiry * 1000 - Date.now()))
    return () => clearTimeout(timer)
  }, [nextExpiry])

  const history = useSyncExternalStore(
    lifecycle?.subscribe ?? noLifecycleSubscribe,
    () => lifecycle?.getSnapshot().history ?? 'loading',
    () => 'loading'
  )
  const contextValue: TNotificationsContext = {
    cachedEntries: visibleEntries,
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
