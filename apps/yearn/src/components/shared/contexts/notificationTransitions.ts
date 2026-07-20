import type { TNotification } from '@shared/types/notifications'

export function isTerminalNotification(notification: TNotification): boolean {
  return notification.status === 'success' || notification.status === 'error'
}

export function applyNotificationUpdate(notification: TNotification, update: Partial<TNotification>): TNotification {
  if (!isTerminalNotification(notification)) {
    return { ...notification, ...update }
  }

  const preservesTerminalState = update.status === undefined || update.status === notification.status
  const preservesTerminalBridge =
    update.bridgeStatus === undefined ||
    notification.bridgeStatus === undefined ||
    update.bridgeStatus === notification.bridgeStatus
  return preservesTerminalState && preservesTerminalBridge
    ? { ...notification, ...update, status: notification.status }
    : notification
}
