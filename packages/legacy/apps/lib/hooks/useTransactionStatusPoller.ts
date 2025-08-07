import { useNotifications } from '@lib/contexts/useNotifications'
import type { TNotification } from '@lib/types/notifications'
import { SUPPORTED_NETWORKS } from '@lib/utils'
import { retrieveConfig } from '@lib/utils/wagmi'
import { useCallback, useEffect, useRef } from 'react'
import { getBlock, waitForTransactionReceipt } from 'wagmi/actions'

/************************************************************************************************
 * Custom hook to poll transaction status for pending notifications every minute.
 * This hook checks if a pending transaction has been completed and updates the notification
 * status accordingly using waitForTransactionReceipt from wagmi.
 *
 * @param notification - The notification to poll for status updates
 ************************************************************************************************/
export function useTransactionStatusPoller(notification: TNotification): void {
  const { updateEntry } = useNotifications()
  const pollIntervalRef = useRef<NodeJS.Timeout | undefined>(undefined)

  /************************************************************************************************
   * Function to check the transaction status and update the notification accordingly.
   * Uses waitForTransactionReceipt to get the transaction receipt and determine if the
   * transaction was successful or failed.
   ************************************************************************************************/
  const checkTransactionStatus = useCallback(async (): Promise<void> => {
    if (!notification.txHash || !notification.id || notification.status !== 'pending') {
      return
    }

    try {
      const config = retrieveConfig()
      const chain = SUPPORTED_NETWORKS.find((network) => network.id === notification.chainId)

      if (!chain) {
        console.warn(`Chain ${notification.chainId} not supported for transaction polling`)
        return
      }

      // Wait for transaction receipt with a short timeout to avoid blocking
      const receipt = await waitForTransactionReceipt(config, {
        chainId: notification.chainId,
        hash: notification.txHash,
        timeout: 5000 // 5 second timeout to avoid long waits
      })

      if (receipt) {
        const newStatus = receipt.status === 'success' ? 'success' : 'error'

        // Get the block information to retrieve the timestamp
        const block = await getBlock(config, {
          chainId: notification.chainId,
          blockNumber: receipt.blockNumber
        })

        // Use the actual block timestamp instead of current time
        const timeFinished = Number(block.timestamp)

        // Update the notification with the new status and transaction details
        await updateEntry(
          {
            status: newStatus,
            timeFinished,
            blockNumber: receipt.blockNumber
          },
          notification.id
        )

        // Clear the polling interval since transaction is complete
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current)
        }
      }
    } catch (error) {
      // If the transaction is not found or still pending, continue polling
      // Only log actual errors, not timeout or not-found errors
      if (error instanceof Error && !error.message.includes('timeout')) {
        console.warn('Transaction status check failed:', error.message)
      }
    }
  }, [notification, updateEntry])

  /************************************************************************************************
   * Effect to set up polling for pending transactions. Polls every minute (60000ms) to check
   * if the transaction has been completed. Cleans up the interval when the notification
   * status changes or the component unmounts.
   ************************************************************************************************/
  useEffect(() => {
    if (notification.status === 'pending' && notification.txHash && notification.id) {
      // Check immediately
      checkTransactionStatus()

      // Then poll every minute
      pollIntervalRef.current = setInterval(() => {
        checkTransactionStatus()
      }, 60000)
    }

    // Clear interval if notification is no longer pending
    if (pollIntervalRef.current && notification.status !== 'pending') {
      clearInterval(pollIntervalRef.current)
    }

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
      }
    }
  }, [notification.status, notification.txHash, notification.id, checkTransactionStatus])

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
