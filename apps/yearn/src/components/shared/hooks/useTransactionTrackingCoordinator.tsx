import { useEnsoBridgeStatusPoller } from '@shared/hooks/useEnsoBridgeStatusPoller'
import { useTransactionStatusPoller } from '@shared/hooks/useTransactionStatusPoller'
import type { TNotification } from '@shared/types/notifications'
import type { ReactElement } from 'react'

function SourceTransactionTracker({ notification }: { notification: TNotification }): null {
  useTransactionStatusPoller(notification)
  return null
}

export function TransactionTrackingCoordinator({ notifications }: { notifications: TNotification[] }): ReactElement {
  useEnsoBridgeStatusPoller(notifications)
  return (
    <>
      {notifications.map((notification) => (
        <SourceTransactionTracker
          key={notification.id ?? `${notification.type}-${notification.txHash}`}
          notification={notification}
        />
      ))}
    </>
  )
}
