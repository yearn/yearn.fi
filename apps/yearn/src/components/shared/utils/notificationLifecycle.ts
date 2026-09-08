import type { TNotification, TNotificationStatus } from '@shared/types/notifications'
import type { Hash } from 'viem'

export type TNotificationLifecyclePresentation = {
  label: string
  detail?: string
  styleStatus: TNotificationStatus
  transactionHash?: Hash
  transactionChainId: number
}

export function getNotificationLifecyclePresentation(notification: TNotification): TNotificationLifecyclePresentation {
  const sourceTransaction = {
    transactionHash: notification.txHash,
    transactionChainId: notification.executionChainId ?? notification.chainId
  }
  if (notification.status === 'error') {
    return { label: 'Failed', detail: notification.bridgeError, styleStatus: 'error', ...sourceTransaction }
  }
  if (notification.status === 'success' && notification.bridgeStatus === 'delivered') {
    return {
      label: 'Bridge complete',
      detail: 'Assets arrived on the destination chain.',
      styleStatus: 'success',
      ...(notification.destinationTxHash && notification.toChainId && notification.toChainId > 0
        ? { transactionHash: notification.destinationTxHash, transactionChainId: notification.toChainId }
        : sourceTransaction)
    }
  }
  if (notification.status === 'success') return { label: 'Success', styleStatus: 'success', ...sourceTransaction }
  if (notification.awaitingExecution) {
    return {
      label: 'Awaiting Safe',
      detail: 'Waiting for the required Safe confirmations and execution.',
      styleStatus: 'submitted',
      ...sourceTransaction
    }
  }
  if (notification.bridgeStatus === 'ready_for_manual_execution') {
    return {
      label: 'Manual action required',
      detail: 'The destination action needs manual completion. Check the bridge tracker or source transaction.',
      styleStatus: 'submitted',
      ...sourceTransaction
    }
  }
  if (notification.bridgeTrackingState === 'unavailable') {
    return {
      label: 'Tracking unavailable',
      detail: notification.bridgeError,
      styleStatus: 'submitted',
      ...sourceTransaction
    }
  }
  if (notification.bridgeStatus === 'inflight') {
    return {
      label: 'Bridging',
      detail: 'Waiting for confirmation on the destination chain.',
      styleStatus: 'submitted',
      ...sourceTransaction
    }
  }
  if (notification.bridgeStatus === 'unknown') {
    return {
      label: 'Checking bridge',
      detail: 'The bridge has not reported a final status yet.',
      styleStatus: 'submitted',
      ...sourceTransaction
    }
  }
  if (notification.bridgeStatus === 'pending') {
    return {
      label: 'Source transaction complete',
      detail: 'Bridging to the destination chain.',
      styleStatus: 'submitted',
      ...sourceTransaction
    }
  }
  if (notification.status === 'submitted') return { label: 'Submitted', styleStatus: 'submitted', ...sourceTransaction }
  return { label: 'Pending', styleStatus: 'pending', ...sourceTransaction }
}

// Until acknowledgement is part of the record model, terminal indicators expire after five minutes.
export const NOTIFICATION_INDICATOR_WINDOW_SECONDS = 5 * 60

export function selectNotificationStatus(
  notifications: TNotification[],
  nowSeconds: number
): TNotificationStatus | null {
  if (notifications.some((entry) => entry.status === 'pending')) return 'pending'
  if (notifications.some((entry) => entry.status === 'submitted')) return 'submitted'
  const recent = notifications.filter((entry) => {
    const timestamp = entry.timeFinished ?? entry.createdAt
    return timestamp !== undefined && nowSeconds < timestamp + NOTIFICATION_INDICATOR_WINDOW_SECONDS
  })
  if (recent.some((entry) => entry.status === 'error')) return 'error'
  if (recent.some((entry) => entry.status === 'success')) return 'success'
  return null
}
