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

export function appendCachedNotification(cachedEntries: TNotification[], notification: TNotification): TNotification[] {
  return [...cachedEntries, notification]
}

export function mergeCachedNotificationEntry(
  cachedEntries: TNotification[],
  id: number,
  entry: Partial<TNotification>
): TNotification[] {
  let found = false
  const updatedEntries = cachedEntries.map((notification) => {
    if (notification.id !== id) {
      return notification
    }

    found = true
    return { ...notification, ...entry }
  })

  if (found) {
    return updatedEntries
  }

  return [...updatedEntries, { ...entry, id } as TNotification]
}
