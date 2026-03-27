import type { TNotification } from '@shared/types/notifications'

export function appendCachedNotification(
  cachedEntries: TNotification[],
  notification: TNotification
): TNotification[] {
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
