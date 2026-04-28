import type { TNotification } from '@shared/types/notifications'

function getNotificationTransitionKey(entry: TNotification): string | undefined {
  if (entry.id !== undefined) {
    return String(entry.id)
  }

  if (entry.txHash) {
    return `${entry.type}-${entry.txHash}`
  }

  return undefined
}

export function getAwaitingExecutionEntries(entries: TNotification[]): TNotification[] {
  return entries.filter((entry) => entry.status === 'submitted' && entry.awaitingExecution)
}

export function getNewlyCompletedAwaitingExecutionEntries(
  previousEntries: TNotification[],
  nextEntries: TNotification[]
): TNotification[] {
  const previousEntriesByKey = new Map(
    previousEntries
      .map((entry) => [getNotificationTransitionKey(entry), entry] as const)
      .filter((entry): entry is readonly [string, TNotification] => Boolean(entry[0]))
  )

  return nextEntries.filter((entry) => {
    const key = getNotificationTransitionKey(entry)
    if (!key) {
      return false
    }

    const previousEntry = previousEntriesByKey.get(key)
    if (!previousEntry) {
      return false
    }

    return previousEntry.status === 'submitted' && previousEntry.awaitingExecution && entry.status === 'success'
  })
}
