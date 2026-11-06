import type { TNotification } from '@shared/types/notifications'

export function isNotificationForAddress(notification: TNotification, address?: string): boolean {
  return Boolean(address) && notification.address.toLowerCase() === address?.toLowerCase()
}

export function filterNotificationsForAddress(notifications: TNotification[], address?: string): TNotification[] {
  if (!address) {
    return []
  }

  return notifications.filter((notification) => isNotificationForAddress(notification, address))
}
