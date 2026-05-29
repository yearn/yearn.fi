import { useNotifications } from '@shared/contexts/useNotifications'
import { useWallet } from '@shared/contexts/useWallet'
import { useWeb3 } from '@shared/contexts/useWeb3'
import { fetchSafeTransactionDetails } from '@shared/hooks/useSafeTransactionDetails'
import type { TNotification } from '@shared/types/notifications'
import { getNetwork, retrieveConfig } from '@shared/utils/wagmi'
import { useQueryClient } from '@tanstack/react-query'
import { getConnectorClient } from '@wagmi/core'
import { useCallback, useEffect, useRef } from 'react'
import { getCallsStatus } from 'viem/actions'
import { getBlock, waitForTransactionReceipt } from 'wagmi/actions'
import {
  shouldPollNotificationStatus,
  shouldRefreshBeforeNotificationSettlement
} from './transactionStatusPoller.helpers'

/************************************************************************************************
 * Custom hook to poll transaction status for pending notifications every minute.
 * This hook checks if a pending transaction has been completed and updates the notification
 * status accordingly using waitForTransactionReceipt from wagmi.
 *
 * @param notification - The notification to poll for status updates
 ************************************************************************************************/
export function useTransactionStatusPoller(notification: TNotification): void {
  const { updateEntry } = useNotifications()
  const { onRefresh } = useWallet()
  const { address } = useWeb3()
  const queryClient = useQueryClient()
  const pollIntervalRef = useRef<NodeJS.Timeout | undefined>(undefined)

  const refreshBeforeSettlement = useCallback(async (): Promise<void> => {
    await queryClient.invalidateQueries()
    if (address) {
      await onRefresh().catch((error) => {
        console.error('Failed to refresh wallet balances after Safe execution:', error)
      })
    }
  }, [address, onRefresh, queryClient])

  /************************************************************************************************
   * Function to check the transaction status and update the notification accordingly.
   * Uses waitForTransactionReceipt to get the transaction receipt and determine if the
   * transaction was successful or failed.
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
                  status: receipt.status === 'success' ? 'success' : 'error',
                  txHash: receipt.transactionHash,
                  timeFinished: Number(block.timestamp),
                  blockNumber: receipt.blockNumber,
                  awaitingExecution: false
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
            status: receipt.status === 'success' ? 'success' : 'error',
            txHash: receipt.transactionHash,
            timeFinished: Number(block.timestamp),
            blockNumber: receipt.blockNumber,
            awaitingExecution: false
          },
          notificationId
        )

        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current)
        }
        return
      }

      const receipt = await waitForTransactionReceipt(config, {
        chainId: pollingChainId,
        hash: txHash,
        timeout: 5000
      })

      if (receipt) {
        const newStatus = receipt.status === 'success' ? 'success' : 'error'
        const block = await getBlock(config, {
          chainId: pollingChainId,
          blockNumber: receipt.blockNumber
        })
        const timeFinished = Number(block.timestamp)

        await updateEntry(
          {
            status: newStatus,
            timeFinished,
            blockNumber: receipt.blockNumber,
            awaitingExecution: false
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
