'use client'

import {
  parseYboldWalletActivities,
  prependYboldWalletActivity,
  type TYboldWalletActivity,
  updateYboldWalletActivity
} from '@ybold/lib/walletActivity'
import type {
  VaultWidgetNotificationInput,
  VaultWidgetNotificationStatus,
  VaultWidgetNotificationsRuntime,
  VaultWidgetSubmittedNotificationInput,
  VaultWidgetTrackedNotification
} from '@yearn/vault-widget/runtime'
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { Address, Hash } from 'viem'
import { useAccount } from 'wagmi'

const WALLET_ACTIVITY_STORAGE_KEY = 'ybold-wallet-activity-v1'

type TWalletActivityContext = {
  activities: readonly TYboldWalletActivity[]
  notifications: VaultWidgetNotificationsRuntime
}

const WalletActivityContext = createContext<TWalletActivityContext | undefined>(undefined)

function readStoredWalletActivities(): TYboldWalletActivity[] {
  try {
    return parseYboldWalletActivities(localStorage.getItem(WALLET_ACTIVITY_STORAGE_KEY))
  } catch {
    return []
  }
}

export function useWalletActivity(): TWalletActivityContext {
  const context = useContext(WalletActivityContext)

  if (!context) {
    throw new Error('useWalletActivity must be used within WalletActivityProvider')
  }

  return context
}

export function WalletActivityProvider({ children }: { children: ReactNode }) {
  const { address } = useAccount()
  const [activities, setActivities] = useState<TYboldWalletActivity[]>([])
  const [hasLoadedStorage, setHasLoadedStorage] = useState(false)
  const activitiesRef = useRef<TYboldWalletActivity[]>([])
  const activitySequenceRef = useRef(0)

  const commitActivities = useCallback((nextActivities: TYboldWalletActivity[]) => {
    activitiesRef.current = nextActivities
    setActivities(nextActivities)
  }, [])

  // Activity is browser-local account history, so hydrate it once after mounting.
  useEffect(() => {
    const storedActivities = readStoredWalletActivities()
    activitiesRef.current = storedActivities
    setActivities(storedActivities)
    setHasLoadedStorage(true)
  }, [])

  // Keep confirmed yBOLD actions available after a reload without adding a remote account-history service.
  useEffect(() => {
    if (!hasLoadedStorage) {
      return
    }

    try {
      localStorage.setItem(WALLET_ACTIVITY_STORAGE_KEY, JSON.stringify(activities))
    } catch {
      // Account history remains available for the current session when storage is unavailable.
    }
  }, [activities, hasLoadedStorage])

  const addActivity = useCallback(
    ({
      awaitingExecution,
      notification,
      ownerAddress,
      status,
      txHash
    }: {
      awaitingExecution?: boolean
      notification: VaultWidgetNotificationInput
      ownerAddress: Address | undefined
      status: VaultWidgetNotificationStatus
      txHash?: Hash
    }) => {
      if (!ownerAddress) {
        return undefined
      }

      activitySequenceRef.current += 1
      const id = `${Date.now()}-${activitySequenceRef.current}`
      const nextActivities = prependYboldWalletActivity(activitiesRef.current, {
        amount: notification.amount,
        awaitingExecution,
        chainId: notification.executionChainId ?? notification.fromChainId,
        createdAt: Date.now(),
        fromSymbol: notification.fromSymbol,
        id,
        ownerAddress,
        status,
        txHash,
        type: notification.type
      })
      commitActivities(nextActivities)
      return id
    },
    [commitActivities]
  )

  const create = useCallback(
    (notification: VaultWidgetNotificationInput) =>
      Promise.resolve(addActivity({ notification, ownerAddress: address, status: 'pending' })),
    [addActivity, address]
  )

  const createSubmitted = useCallback(
    (notification: VaultWidgetSubmittedNotificationInput) =>
      Promise.resolve(
        addActivity({
          awaitingExecution: notification.awaitingExecution,
          notification,
          ownerAddress: notification.ownerAddress,
          status: notification.status,
          txHash: notification.txHash
        })
      ),
    [addActivity]
  )

  const update = useCallback(
    (notification: Parameters<VaultWidgetNotificationsRuntime['update']>[0]) => {
      commitActivities(updateYboldWalletActivity(activitiesRef.current, notification, Date.now()))
      return Promise.resolve()
    },
    [commitActivities]
  )

  const get = useCallback((id: Parameters<VaultWidgetNotificationsRuntime['get']>[0]) => {
    const activity = activitiesRef.current.find((candidate) => candidate.id === id)

    if (!activity) {
      return undefined
    }

    return {
      awaitingExecution: activity.awaitingExecution,
      id: activity.id,
      sourceChainId: activity.chainId,
      sourceTxHash: activity.txHash,
      status: activity.status
    } satisfies VaultWidgetTrackedNotification
  }, [])

  const notifications = useMemo<VaultWidgetNotificationsRuntime>(
    () => ({ create, createSubmitted, get, update }),
    [create, createSubmitted, get, update]
  )
  const contextValue = useMemo(() => ({ activities, notifications }), [activities, notifications])

  return <WalletActivityContext.Provider value={contextValue}>{children}</WalletActivityContext.Provider>
}
