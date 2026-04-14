import type { TNotificationStatus } from '@shared/types/notifications'

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
