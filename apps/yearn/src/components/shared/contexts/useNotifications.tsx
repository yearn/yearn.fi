import { applyNotificationUpdate } from '@shared/contexts/notificationTransitions'
import { useYearnTransactionLifecycle } from '@shared/contexts/transactionLifecycleContext'
import { projectLifecycleNotification } from '@shared/contexts/transactionLifecycleProjection'
import {
  appendCachedNotification,
  filterNotificationsForAddress,
  isNotificationForAddress,
  mergeCachedNotificationEntry
} from '@shared/contexts/useNotifications.helpers'
import { useWeb3 } from '@shared/contexts/useWeb3'
import { useAsyncTrigger } from '@shared/hooks/useAsyncTrigger'
import type { TNotification, TNotificationsContext } from '@shared/types/notifications'
import { NOTIFICATION_INDICATOR_WINDOW_SECONDS, selectNotificationStatus } from '@shared/utils/notificationLifecycle'
import type React from 'react'
import {
  createContext,
  startTransition,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore
} from 'react'
import { useIndexedDBStore } from 'use-indexeddb'

const EMPTY_LIFECYCLE_RECORDS = Object.freeze([])
const noLifecycleSubscribe = () => () => undefined
const emptyLifecycleRecords = () => EMPTY_LIFECYCLE_RECORDS

const defaultProps: TNotificationsContext = {
  cachedEntries: [],
  notificationStatus: null,
  isLoading: true,
  error: null,
  deleteByID: async (): Promise<void> => undefined,
  updateEntry: async (): Promise<void> => undefined,
  addNotification: async (): Promise<number> => 0
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
  const [cachedEntries, setCachedEntries] = useState<TNotification[]>([])
  const [entryNonce, setEntryNonce] = useState<number>(0)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  const [clockSeconds, setNowSeconds] = useState(() => Date.now() / 1000)
  const nowSeconds = Math.max(clockSeconds, Date.now() / 1000)
  // Filter at render time as well as hydration, so changing wallets cannot expose the previous wallet's records.
  const visibleEntries = useMemo(
    () =>
      filterNotificationsForAddress([...cachedEntries, ...lifecycleRecords.map(projectLifecycleNotification)], address),
    [cachedEntries, lifecycleRecords, address]
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

  const { add, getAll, update, deleteByID, getByID } = useIndexedDBStore<TNotification>('notifications')

  /************************************************************************************************
   * This useAsyncTrigger hook is responsible for fetching all notifications from the IndexedDB
   * and updating the cached entries state whenever the entryNonce changes. This ensures that
   * the component always displays the most up-to-date notifications.
   *
   * The entryNonce is used as a dependency to trigger the effect, allowing for manual refreshes
   * of the notification list when needed (e.g., after adding or updating a notification).
   ************************************************************************************************/
  useAsyncTrigger(async (): Promise<void> => {
    void entryNonce
    setIsLoading(true)
    setError(null)
    try {
      const entriesFromDB = await getAll()
      setCachedEntries(filterNotificationsForAddress(entriesFromDB || [], address))
    } catch (error) {
      console.error('Failed to fetch notifications from IndexedDB:', error)
      setCachedEntries([])
      setError('Failed to load notifications')
    } finally {
      setIsLoading(false)
    }
  }, [address, getAll, entryNonce])

  /************************************************************************************************
   * The updateEntry function is responsible for updating an existing notification in the IndexedDB.
   * It takes a partial notification object and an ID as parameters.
   *
   * The function performs the following steps:
   * 1. Retrieves the existing notification from the database using the provided ID.
   * 2. If the notification exists, it merges the new data with the existing notification.
   * 3. Updates the notification in the database.
   * 4. Merges the saved record into the cache; the indicator derives from that cache.
   *
   * This function is memoized using useCallback to optimize performance.
   ************************************************************************************************/
  const updateEntry = useCallback(
    async (entry: Partial<TNotification>, id: number) => {
      try {
        const notification = await getByID(id)

        if (notification) {
          const updatedNotification = applyNotificationUpdate(notification, entry)
          await update(updatedNotification)
          startTransition(() => {
            setCachedEntries((currentEntries) =>
              isNotificationForAddress(updatedNotification, address)
                ? mergeCachedNotificationEntry(currentEntries, id, updatedNotification)
                : currentEntries.filter((currentEntry) => currentEntry.id !== id)
            )
          })
        } else {
          throw new Error(`Notification with id ${id} not found`)
        }
      } catch (error) {
        console.error('Failed to update notification:', error)
        setError('Failed to update notification')
        throw error
      }
    },
    [address, getByID, update]
  )

  const addNotification = useCallback(
    async (notification: TNotification): Promise<number> => {
      try {
        const id = await add(notification)
        startTransition(() => {
          if (isNotificationForAddress(notification, address)) {
            setCachedEntries((currentEntries) => appendCachedNotification(currentEntries, { ...notification, id }))
          }
        })
        return id
      } catch (error) {
        console.error('Failed to add notification:', error)
        setError('Failed to add notification')
        throw error
      }
    },
    [add, address]
  )

  const deleteByIDWithErrorHandling = useCallback(
    async (id: number): Promise<void> => {
      try {
        // Optimistically update the local state first
        setCachedEntries((currentEntries) => currentEntries.filter((entry) => entry.id !== id))

        // Then delete from IndexedDB
        await deleteByID(id)

        // No need to increment entryNonce since we already updated the state
      } catch (error) {
        console.error('Failed to delete notification:', error)
        setError('Failed to delete notification')

        // Revert the optimistic update by refetching from DB
        setEntryNonce((nonce) => nonce + 1)
      }
    },
    [deleteByID]
  )

  /**************************************************************************
   * Context value that is passed to all children of this component.
   *************************************************************************/
  const contextValue = useMemo(
    (): TNotificationsContext => ({
      cachedEntries: visibleEntries,
      isLoading,
      error,
      deleteByID: deleteByIDWithErrorHandling,
      updateEntry,
      addNotification,
      notificationStatus
    }),
    [visibleEntries, isLoading, error, deleteByIDWithErrorHandling, updateEntry, addNotification, notificationStatus]
  )

  return <NotificationsContext.Provider value={contextValue}>{children}</NotificationsContext.Provider>
}

export const useNotifications = (): TNotificationsContext => {
  const ctx = useContext(NotificationsContext)
  if (!ctx) {
    throw new Error('NotificationsContext not found')
  }
  return ctx
}
