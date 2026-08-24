import { useNotifications } from '@shared/contexts/useNotifications'
import { useNotificationAssetRefresh } from '@shared/hooks/useNotificationAssetRefresh'
import { fetchSafeTransactionDetails } from '@shared/hooks/useSafeTransactionDetails'
import type { TNotification } from '@shared/types/notifications'
import { getNetwork, retrieveConfig } from '@shared/utils/wagmi'
import { getConnectorClient, getPublicClient } from '@wagmi/core'
import { useCallback, useEffect, useRef } from 'react'
import { TransactionReceiptNotFoundError } from 'viem'
import { getCallsStatus } from 'viem/actions'
import { getBlock, waitForTransactionReceipt } from 'wagmi/actions'
import {
  resolvePolledTransactionStatus,
  shouldApplyPolledTransactionSettlement,
  shouldPollNotificationStatus,
  shouldRefreshBeforeNotificationSettlement
} from './transactionStatusPoller.helpers'

/************************************************************************************************
 * Custom hook to poll transaction status for pending notifications every minute.
 * This hook checks if a pending transaction has been completed and updates the notification
 * status accordingly using receipt lookups and Safe transaction status APIs.
 *
 * @param notification - The notification to poll for status updates
 ************************************************************************************************/
export function useTransactionStatusPoller(notification: TNotification): void {
  const { updateEntry } = useNotifications()
  const refreshNotificationAssets = useNotificationAssetRefresh()
  const pollIntervalRef = useRef<NodeJS.Timeout | undefined>(undefined)
  const latestNotificationRef = useRef(notification)
  latestNotificationRef.current = notification

  const refreshBeforeSettlement = useCallback(async (): Promise<void> => {
    await refreshNotificationAssets(notification).catch((error) => {
      console.error('Failed to refresh transaction assets before settlement:', error)
    })
  }, [notification, refreshNotificationAssets])

  /************************************************************************************************
   * Function to check the transaction status and update the notification accordingly.
   * Looks up the transaction receipt and determines whether it succeeded or failed.
   ************************************************************************************************/
  const checkTransactionStatus = useCallback(async (): Promise<void> => {
    if (!shouldPollNotificationStatus(notification)) {
      return
    }

    const notificationId = notification.id
    const txHash = notification.txHash
    if (!notificationId || !txHash) {
      return
    }
    try {
      const config = retrieveConfig()
      const pollingChainId = notification.executionChainId ?? notification.chainId
      const chain = getNetwork(pollingChainId)

      if (!chain) {
        console.warn(`Chain ${pollingChainId} not supported for transaction polling`)
        return
      }

      if (notification.status === 'submitted' && notification.awaitingExecution) {
        try {
          const safeTransaction = await fetchSafeTransactionDetails(txHash)

          if (
            safeTransaction?.txStatus === 'AWAITING_CONFIRMATIONS' ||
            safeTransaction?.txStatus === 'AWAITING_EXECUTION' ||
            safeTransaction?.txStatus === undefined
          ) {
            if (!safeTransaction?.executionTxHash) {
              return
            }
          }

          if (safeTransaction?.txStatus === 'FAILED' || safeTransaction?.txStatus === 'CANCELLED') {
            await updateEntry(
              {
                status: 'error',
                awaitingExecution: false
              },
              notificationId
            )

            if (pollIntervalRef.current) {
              clearInterval(pollIntervalRef.current)
            }
            return
          }

          if (safeTransaction?.executionTxHash) {
            const receipt = await waitForTransactionReceipt(config, {
              chainId: pollingChainId,
              hash: safeTransaction.executionTxHash,
              timeout: 5000
            })

            if (receipt) {
              const block = await getBlock(config, {
                chainId: pollingChainId,
                blockNumber: receipt.blockNumber
              })

              if (
                !notification.bridgeProtocol &&
                shouldRefreshBeforeNotificationSettlement({
                  currentStatus: notification.status,
                  awaitingExecution: notification.awaitingExecution,
                  nextStatus: receipt.status === 'success' ? 'success' : 'error'
                })
              ) {
                await refreshBeforeSettlement()
              }

              await updateEntry(
                {
                  status:
                    receipt.status === 'success' ? (notification.bridgeProtocol ? 'submitted' : 'success') : 'error',
                  txHash: receipt.transactionHash,
                  timeFinished: Number(block.timestamp),
                  blockNumber: receipt.blockNumber,
                  awaitingExecution: false,
                  ...(receipt.status === 'success' && notification.bridgeProtocol
                    ? {
                      bridgeStatus: 'pending' as const,
                      bridgeTrackingState: 'active' as const,
                      sourceConfirmedAt: Number(block.timestamp),
                      timeFinished: undefined
                    }
                    : {})
                },
                notificationId
              )

              if (pollIntervalRef.current) {
                clearInterval(pollIntervalRef.current)
              }
              return
            }
          }
        } catch (safeDetailError) {
          console.warn('Safe transaction detail lookup failed, falling back to wallet_getCallsStatus:', safeDetailError)
        }

        const connectorClient = await getConnectorClient(config, {
          chainId: pollingChainId,
          assertChainId: false
        })
        const callsStatus = await getCallsStatus(connectorClient, { id: txHash })

        if (callsStatus.status === 'pending') {
          return
        }

        if (callsStatus.status === 'failure') {
          await updateEntry(
            {
              status: 'error',
              awaitingExecution: false
            },
            notificationId
          )

          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current)
          }
          return
        }

        const receipt = callsStatus.receipts?.[0]
        if (!receipt) {
          return
        }

        const block = await getBlock(config, {
          chainId: pollingChainId,
          blockNumber: receipt.blockNumber
        })

        if (
          !notification.bridgeProtocol &&
          shouldRefreshBeforeNotificationSettlement({
            currentStatus: notification.status,
            awaitingExecution: notification.awaitingExecution,
            nextStatus: receipt.status === 'success' ? 'success' : 'error'
          })
        ) {
          await refreshBeforeSettlement()
        }

        await updateEntry(
          {
            status: receipt.status === 'success' ? (notification.bridgeProtocol ? 'submitted' : 'success') : 'error',
            txHash: receipt.transactionHash,
            timeFinished: Number(block.timestamp),
            blockNumber: receipt.blockNumber,
            awaitingExecution: false,
            ...(receipt.status === 'success' && notification.bridgeProtocol
              ? {
                bridgeStatus: 'pending' as const,
                bridgeTrackingState: 'active' as const,
                sourceConfirmedAt: Number(block.timestamp),
                timeFinished: undefined
              }
              : {})
          },
          notificationId
        )

        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current)
        }
        return
      }

      const publicClient = getPublicClient(config, { chainId: pollingChainId })
      if (!publicClient) return
      // The widget controller owns active replacement tracking. This poller only
      // reconciles a persisted notification by its recorded transaction hash.
      const receipt = await publicClient.getTransactionReceipt({ hash: txHash }).catch((error) => {
        if (error instanceof TransactionReceiptNotFoundError) return undefined
        throw error
      })

      if (receipt) {
        const status = resolvePolledTransactionStatus({
          receipt,
          requestedHash: txHash
        })
        const block = await getBlock(config, {
          chainId: pollingChainId,
          blockNumber: receipt.blockNumber
        })
        const timeFinished = Number(block.timestamp)
        if (
          !shouldApplyPolledTransactionSettlement(latestNotificationRef.current, {
            id: notificationId,
            txHash
          })
        ) {
          return
        }

        if (receipt.status === 'success' && !notification.bridgeProtocol) {
          await refreshBeforeSettlement()
        }

        await updateEntry(
          {
            status,
            timeFinished,
            blockNumber: receipt.blockNumber,
            awaitingExecution: false,
            ...(receipt.status === 'success' && notification.bridgeProtocol
              ? {
                bridgeStatus: 'pending' as const,
                bridgeTrackingState: 'active' as const,
                sourceConfirmedAt: timeFinished,
                timeFinished: undefined
              }
              : {})
          },
          notificationId
        )

        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current)
        }
      }
    } catch (error) {
      if (error instanceof Error && !error.message.includes('timeout')) {
        console.warn('Transaction status check failed:', error.message)
      }
    }
  }, [notification, refreshBeforeSettlement, updateEntry])

  /************************************************************************************************
   * Effect to set up polling for pending transactions. Polls every minute (60000ms) to check
   * if the transaction has been completed. Cleans up the interval when the notification
   * status changes or the component unmounts.
   ************************************************************************************************/
  useEffect(() => {
    if (shouldPollNotificationStatus(notification)) {
      checkTransactionStatus()

      const pollIntervalMs = notification.awaitingExecution ? 15000 : 60000
      pollIntervalRef.current = setInterval(() => {
        checkTransactionStatus()
      }, pollIntervalMs)
    }

    if (pollIntervalRef.current && !shouldPollNotificationStatus(notification)) {
      clearInterval(pollIntervalRef.current)
    }

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
      }
    }
  }, [notification, checkTransactionStatus])

  /************************************************************************************************
   * Cleanup effect to clear the polling interval when the hook unmounts
   ************************************************************************************************/
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
      }
    }
  }, [])
}
