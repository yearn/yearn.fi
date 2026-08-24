import type { TNotificationType, TUpdateNotificationParams } from '@shared/types/notifications'

export function isCrossChainNotificationType(type: TNotificationType): boolean {
  return type === 'crosschain zap' || type === 'crosschain withdraw zap'
}

export function shouldSetNotificationFinishedAt(params: TUpdateNotificationParams): boolean {
  const isBridgeInProgress = params.status === 'submitted' && Boolean(params.bridgeStatus)
  if (isBridgeInProgress) return false
  return Boolean(
    params.receipt ||
      params.status === 'success' ||
      params.status === 'error' ||
      (params.status === 'submitted' && !params.awaitingExecution)
  )
}
