import { useNotifications } from '@shared/contexts/useNotifications'
import { useWallet } from '@shared/contexts/useWallet'
import type { TChainTokens } from '@shared/types'
import type { TNotification } from '@shared/types/notifications'
import { toAddress } from '@shared/utils'
import {
  hasKatanaBridgeBalanceDeltaArrived,
  KATANA_BRIDGE_TRACKING_URL,
  type TKatanaBridgeTransaction,
  type TKatanaBridgeTransactionsResponse
} from '@shared/utils/katanaBridge'
import { retrieveConfig } from '@shared/utils/wagmi'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import { getBlock, waitForTransactionReceipt } from 'wagmi/actions'

const KATANA_BRIDGE_STATUS_POLL_INTERVAL = 30_000

function isTrackableBridgeNotification(notification: TNotification): boolean {
  return (
    notification.type === 'bridge' &&
    Boolean(notification.id) &&
    Boolean(notification.txHash) &&
    Boolean(notification.toAddress) &&
    Boolean(notification.toChainId) &&
    Boolean(notification.rawAmount) &&
    (notification.status === 'pending' || notification.status === 'submitted')
  )
}

function canUseBalanceArrivalFallback(notification: TNotification): boolean {
  return notification.bridgeDirection === 'to-katana' && Boolean(notification.toAddress && notification.toChainId)
}

function getRawAmount(notification: TNotification): bigint {
  try {
    return notification.rawAmount ? BigInt(notification.rawAmount) : 0n
  } catch (_error) {
    return 0n
  }
}

function getDestinationBalanceBaseline(notification: TNotification): bigint {
  try {
    return notification.destinationBalanceRaw ? BigInt(notification.destinationBalanceRaw) : 0n
  } catch (_error) {
    return 0n
  }
}

function getBalanceForNotification({
  notification,
  balances
}: {
  notification: TNotification
  balances?: TChainTokens
}): bigint {
  if (!notification.toAddress || !notification.toChainId || !balances?.[notification.toChainId]) {
    return 0n
  }

  return balances[notification.toChainId]?.[toAddress(notification.toAddress)]?.balance.raw || 0n
}

export function KatanaBridgeNotificationsPoller(): null {
  const { cachedEntries, updateEntry } = useNotifications()
  const { getToken, onRefresh } = useWallet()
  const isSyncingRef = useRef(false)

  const trackedNotifications = useMemo(() => cachedEntries.filter(isTrackableBridgeNotification), [cachedEntries])

  const hasBridgeBalanceArrived = useCallback(
    (notification: TNotification, refreshedBalances?: TChainTokens): boolean => {
      if (!canUseBalanceArrivalFallback(notification) || !notification.toAddress || !notification.toChainId) {
        return false
      }

      const currentBalance =
        getBalanceForNotification({ notification, balances: refreshedBalances }) ||
        getToken({
          address: toAddress(notification.toAddress),
          chainID: notification.toChainId
        }).balance.raw

      return hasKatanaBridgeBalanceDeltaArrived({
        baselineBalance: getDestinationBalanceBaseline(notification),
        currentBalance,
        requiredAmount: getRawAmount(notification)
      })
    },
    [getToken]
  )

  const confirmBridgeSourceTransaction = useCallback(
    async (notification: TNotification): Promise<TNotification> => {
      if (notification.status !== 'pending' || !notification.id || !notification.txHash) {
        return notification
      }

      try {
        const config = retrieveConfig()
        const pollingChainId = notification.executionChainId ?? notification.chainId
        const receipt = await waitForTransactionReceipt(config, {
          chainId: pollingChainId,
          hash: notification.txHash,
          timeout: 5_000
        })

        if (receipt.status !== 'success') {
          const timeFinished = Date.now() / 1000
          await updateEntry(
            {
              status: 'error',
              blockNumber: receipt.blockNumber,
              timeFinished,
              bridgeLifecycleStatus: 'FAILED',
              trackingUrl: notification.trackingUrl || KATANA_BRIDGE_TRACKING_URL
            },
            notification.id
          )

          return {
            ...notification,
            status: 'error',
            blockNumber: receipt.blockNumber,
            timeFinished,
            bridgeLifecycleStatus: 'FAILED',
            trackingUrl: notification.trackingUrl || KATANA_BRIDGE_TRACKING_URL
          }
        }

        const block = await getBlock(config, {
          chainId: pollingChainId,
          blockNumber: receipt.blockNumber
        })
        const timeFinished = Number(block.timestamp)

        await updateEntry(
          {
            status: 'submitted',
            blockNumber: receipt.blockNumber,
            timeFinished,
            bridgeLifecycleStatus: 'SOURCE_CONFIRMED',
            trackingUrl: notification.trackingUrl || KATANA_BRIDGE_TRACKING_URL
          },
          notification.id
        )

        return {
          ...notification,
          status: 'submitted',
          blockNumber: receipt.blockNumber,
          timeFinished,
          bridgeLifecycleStatus: 'SOURCE_CONFIRMED',
          trackingUrl: notification.trackingUrl || KATANA_BRIDGE_TRACKING_URL
        }
      } catch (error) {
        if (error instanceof Error && !error.message.includes('timeout')) {
          console.warn('Katana bridge source receipt polling failed:', error.message)
        }

        return notification
      }
    },
    [updateEntry]
  )

  const fetchTransactionsForAddress = useCallback(async (address: string): Promise<TKatanaBridgeTransaction[]> => {
    try {
      const response = await fetch(`/api/katana-bridge/transactions?${new URLSearchParams({ userAddress: address })}`)

      if (!response.ok) {
        const errorBody = await response.text()
        console.warn('Katana bridge status fetch failed:', response.status, errorBody)
        return []
      }

      const payload = (await response.json()) as TKatanaBridgeTransactionsResponse
      return payload.transactions || []
    } catch (error) {
      console.warn('Katana bridge status request failed:', error)
      return []
    }
  }, [])

  const syncBridgeNotification = useCallback(
    async ({
      notification,
      transactions
    }: {
      notification: TNotification
      transactions: TKatanaBridgeTransaction[]
    }): Promise<void> => {
      if (!notification.id || !notification.txHash) {
        return
      }

      const matchingTransaction = transactions.find(
        (transaction) => transaction.sourceTxHash.toLowerCase() === notification.txHash?.toLowerCase()
      )
      const shouldRefreshDestinationBalance =
        canUseBalanceArrivalFallback(notification) &&
        notification.status === 'submitted' &&
        Boolean(notification.toAddress && notification.toChainId) &&
        (!matchingTransaction ||
          matchingTransaction.status === 'READY_TO_CLAIM' ||
          matchingTransaction.status === 'COMPLETED')
      const refreshedBalances =
        shouldRefreshDestinationBalance && notification.toAddress && notification.toChainId
          ? await onRefresh([{ address: toAddress(notification.toAddress), chainID: notification.toChainId }])
          : undefined
      const balanceArrived = hasBridgeBalanceArrived(notification, refreshedBalances)

      if (matchingTransaction?.status === 'FAILED') {
        await updateEntry(
          {
            status: 'error',
            timeFinished: Date.now() / 1000,
            claimTxHash: matchingTransaction.claimTxHash,
            bridgeLifecycleStatus: 'FAILED',
            trackingUrl: notification.trackingUrl || KATANA_BRIDGE_TRACKING_URL
          },
          notification.id
        )
        return
      }

      if (balanceArrived || matchingTransaction?.status === 'COMPLETED') {
        await updateEntry(
          {
            status: 'success',
            timeFinished: Date.now() / 1000,
            claimTxHash: matchingTransaction?.claimTxHash,
            bridgeLifecycleStatus: 'COMPLETED',
            trackingUrl: notification.trackingUrl || KATANA_BRIDGE_TRACKING_URL
          },
          notification.id
        )
        return
      }

      if (
        matchingTransaction &&
        (matchingTransaction.status !== notification.bridgeLifecycleStatus ||
          matchingTransaction.claimTxHash !== notification.claimTxHash)
      ) {
        await updateEntry(
          {
            status: 'submitted',
            claimTxHash: matchingTransaction.claimTxHash,
            bridgeLifecycleStatus: matchingTransaction.status,
            trackingUrl: notification.trackingUrl || KATANA_BRIDGE_TRACKING_URL
          },
          notification.id
        )
      }
    },
    [hasBridgeBalanceArrived, onRefresh, updateEntry]
  )

  const pollBridgeNotifications = useCallback(async (): Promise<void> => {
    if (isSyncingRef.current || trackedNotifications.length === 0) {
      return
    }

    isSyncingRef.current = true

    try {
      const sourceConfirmedNotifications = await Promise.all(trackedNotifications.map(confirmBridgeSourceTransaction))
      const notificationsByAddress = sourceConfirmedNotifications.reduce<Record<string, TNotification[]>>(
        (groupedNotifications, notification) => {
          const address = notification.address.toLowerCase()
          groupedNotifications[address] = [...(groupedNotifications[address] || []), notification]
          return groupedNotifications
        },
        {}
      )

      const transactionsByAddress = Object.fromEntries(
        await Promise.all(
          Object.entries(notificationsByAddress).map(async ([address]) => [
            address,
            await fetchTransactionsForAddress(address)
          ])
        )
      ) as Record<string, TKatanaBridgeTransaction[]>

      await Promise.all(
        sourceConfirmedNotifications
          .filter((notification) => notification.status === 'submitted')
          .map((notification) =>
            syncBridgeNotification({
              notification,
              transactions: transactionsByAddress[notification.address.toLowerCase()] || []
            })
          )
      )
    } finally {
      isSyncingRef.current = false
    }
  }, [confirmBridgeSourceTransaction, fetchTransactionsForAddress, syncBridgeNotification, trackedNotifications])

  useEffect(() => {
    if (trackedNotifications.length === 0) {
      return
    }

    void pollBridgeNotifications()

    const interval = window.setInterval(() => {
      void pollBridgeNotifications()
    }, KATANA_BRIDGE_STATUS_POLL_INTERVAL)

    return () => {
      window.clearInterval(interval)
    }
  }, [pollBridgeNotifications, trackedNotifications.length])

  return null
}
