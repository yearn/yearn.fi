import type { TNotification, TNotificationStatus } from '@shared/types/notifications'
import { isTransactionAcknowledged, selectTransaction } from '@yearn/vault-widget/lifecycle'
import type { Hash } from 'viem'

export type TNotificationLifecyclePresentation = {
  label: string
  detail?: string
  styleStatus: TNotificationStatus
  transactionHash?: Hash
  transactionChainId: number
}

export function getNotificationLifecyclePresentation(notification: TNotification): TNotificationLifecyclePresentation {
  if (notification.lifecycleRecord) {
    const view = selectTransaction(notification.lifecycleRecord)
    return {
      label: view.outcome === 'success' ? 'Success' : view.label,
      detail: view.detail,
      styleStatus: view.outcome === 'unknown' ? 'submitted' : view.outcome,
      transactionHash: view.reference.hash,
      transactionChainId: view.reference.executionChainId
    }
  }
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

export function selectNotificationStatus(notifications: TNotification[]): TNotificationStatus | null {
  const unread = notifications.filter(
    (entry) => !entry.lifecycleRecord || !isTransactionAcknowledged(entry.lifecycleRecord)
  )
  if (unread.some((entry) => entry.status === 'pending')) return 'pending'
  if (unread.some((entry) => entry.status === 'submitted')) return 'submitted'
  if (unread.some((entry) => entry.status === 'error')) return 'error'
  if (unread.some((entry) => entry.status === 'success')) return 'success'
  return null
}
