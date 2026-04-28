import type { TNotification } from '@shared/types/notifications'

export function getAwaitingExecutionEntries(entries: TNotification[]): TNotification[] {
  return entries.filter((entry) => entry.status === 'submitted' && entry.awaitingExecution)
}
