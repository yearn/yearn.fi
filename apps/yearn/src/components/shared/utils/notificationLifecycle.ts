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
      transactionHash: notification.destinationTxHash ?? notification.txHash,
      transactionChainId: notification.toChainId ?? notification.chainId
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
