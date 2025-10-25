import { useAsyncTrigger } from '@lib/hooks/useAsyncTrigger'
import type { TNotification, TNotificationStatus, TNotificationsContext } from '@lib/types/notifications'
import { NotificationsCurtain } from '@vaults-v3/components/notifications/NotificationsCurtain'
import type React from 'react'
import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { useLocation } from 'react-router'
import { useIndexedDBStore } from 'use-indexeddb'

const defaultProps: TNotificationsContext = {
  shouldOpenCurtain: false,
  cachedEntries: [],
  notificationStatus: null,
  isLoading: true,
  error: null,
  setNotificationStatus: (): void => undefined,
  deleteByID: async (): Promise<void> => undefined,
  updateEntry: async (): Promise<void> => undefined,
  addNotification: async (): Promise<number> => 0,
  setShouldOpenCurtain: (): void => undefined
}

const NotificationsContext = createContext<TNotificationsContext>(defaultProps)
export const WithNotifications = ({ children }: { children: React.ReactElement }): React.ReactElement => {
  const [cachedEntries, setCachedEntries] = useState<TNotification[]>([])
  const [entryNonce, setEntryNonce] = useState<number>(0)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  const location = useLocation()
  const isV3 = location.pathname.includes('/v3')

  /**************************************************************************
   * State that is used to store latest added/updated notification status
   *************************************************************************/
  const [notificationStatus, setNotificationStatus] = useState<TNotificationStatus | null>(null)

  const [shouldOpenCurtain, setShouldOpenCurtain] = useState(false)
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
    entryNonce
    setIsLoading(true)
    setError(null)
    try {
      const entriesFromDB = await getAll()
      setCachedEntries(entriesFromDB || [])
    } catch (error) {
      console.error('Failed to fetch notifications from IndexedDB:', error)
      setCachedEntries([])
      setError('Failed to load notifications')
    } finally {
      setIsLoading(false)
    }
  }, [getAll, entryNonce])

  /************************************************************************************************
   * The updateEntry function is responsible for updating an existing notification in the IndexedDB.
   * It takes a partial notification object and an ID as parameters.
   *
   * The function performs the following steps:
   * 1. Retrieves the existing notification from the database using the provided ID.
   * 2. If the notification exists, it merges the new data with the existing notification.
   * 3. Updates the notification in the database.
   * 4. Increments the entryNonce to trigger a refresh of the cached entries.
   * 5. Updates the notificationStatus with the new status, if provided.
   *
   * This function is memoized using useCallback to optimize performance.
   ************************************************************************************************/
  const updateEntry = useCallback(
    async (entry: Partial<TNotification>, id: number) => {
      try {
        const notification = await getByID(id)

        if (notification) {
          await update({ ...notification, ...entry })
          setEntryNonce((nonce) => nonce + 1)
          setNotificationStatus(entry?.status || null)
        } else {
          console.warn(`Notification with id ${id} not found`)
        }
      } catch (error) {
        console.error('Failed to update notification:', error)
      }
    },
    [getByID, update]
  )

  const addNotification = useCallback(
    async (notification: TNotification): Promise<number> => {
      try {
        const id = await add(notification)
        setEntryNonce((nonce) => nonce + 1)
        setNotificationStatus(notification.status)
        return id
      } catch (error) {
        console.error('Failed to add notification:', error)

        return -1
      }
    },
    [add]
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
      shouldOpenCurtain,
      cachedEntries,
      isLoading,
      error,
      deleteByID: deleteByIDWithErrorHandling,
      updateEntry,
      addNotification,
      notificationStatus,
      setNotificationStatus,
      setShouldOpenCurtain
    }),
    [
      shouldOpenCurtain,
      cachedEntries,
      isLoading,
      error,
      deleteByIDWithErrorHandling,
      updateEntry,
      addNotification,
      notificationStatus
    ]
  )

  return (
    <NotificationsContext.Provider value={contextValue}>
      {children}
      <NotificationsCurtain
        variant={isV3 ? 'v3' : 'v2'}
        setShouldOpenCurtain={setShouldOpenCurtain}
        isOpen={shouldOpenCurtain}
      />
    </NotificationsContext.Provider>
  )
}

export const useNotifications = (): TNotificationsContext => {
  const ctx = useContext(NotificationsContext)
  if (!ctx) {
    throw new Error('NotificationsContext not found')
  }
  return ctx
}
