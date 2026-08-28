import type { TNotificationStatus } from '@shared/types/notifications'
import { type Hash, isHash, type TransactionReceipt } from 'viem'

type TPolledNotification = {
  id?: number
  status: TNotificationStatus
  txHash?: string
  awaitingExecution?: boolean
}

export function shouldPollNotificationStatus(params: {
  id?: number
  status: TNotificationStatus
  txHash?: string
  awaitingExecution?: boolean
}): boolean {
  if (!params.id || !params.txHash) {
    return false
  }

  if (params.status === 'pending') {
    return true
  }

  if (params.status === 'submitted' && params.awaitingExecution) {
    return true
  }

  return false
}

export function shouldRefreshBeforeNotificationSettlement(params: {
  currentStatus: TNotificationStatus
  awaitingExecution?: boolean
  nextStatus: 'success' | 'error'
}): boolean {
  return params.currentStatus === 'submitted' && params.awaitingExecution === true && params.nextStatus === 'success'
}

export function resolvePolledTransactionStatus(params: {
  receipt: TransactionReceipt
  requestedHash: Hash
}): 'error' | 'success' {
  const receiptHash = params.receipt.transactionHash
  if (!isHash(receiptHash)) throw new Error('Transaction poller received an invalid receipt hash')
  if (receiptHash.toLowerCase() !== params.requestedHash.toLowerCase()) {
    throw new Error('Transaction poller received a receipt for an unexpected transaction')
  }

  return params.receipt.status === 'success' ? 'success' : 'error'
}

export function shouldApplyPolledTransactionSettlement(
  notification: TPolledNotification,
  expected: { id: number; txHash: Hash }
): boolean {
  return (
    shouldPollNotificationStatus(notification) &&
    notification.id === expected.id &&
    notification.txHash?.toLowerCase() === expected.txHash.toLowerCase()
  )
}
