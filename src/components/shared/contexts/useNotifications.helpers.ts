import type { TAddress } from '@shared/types/address'
import type { TNotification } from '@shared/types/notifications'

function normalizeNotificationAddress(address?: TAddress): string | undefined {
  return address?.toLowerCase()
}

export function isNotificationForAddress(notification: TNotification, address?: TAddress): boolean {
  const normalizedAddress = normalizeNotificationAddress(address)
  const normalizedNotificationAddress = normalizeNotificationAddress(notification.address)

  return Boolean(
    normalizedAddress && normalizedNotificationAddress && normalizedNotificationAddress === normalizedAddress
  )
}

export function filterNotificationsByAddress(notifications: TNotification[], address?: TAddress): TNotification[] {
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
