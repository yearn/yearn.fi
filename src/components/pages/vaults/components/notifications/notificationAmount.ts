import type { TNotification } from '@shared/types/notifications'

export function getNotificationReceiveLabel(notification: Pick<TNotification, 'type' | 'toAmountType'>): string {
  if (notification.type === 'swap' || notification.type === 'crosschain swap') {
    if (notification.toAmountType === 'minimum') {
      return 'Minimum receive:'
    }
    if (notification.toAmountType === 'expected') {
      return 'Expected receive:'
    }
  }

  return 'Receive:'
}
