import { isEnsoBridgeStatus, type TEnsoBridgeStatusResponse } from '@shared/types/ensoBridge'
import type { TNotification } from '@shared/types/notifications'
import { isHash } from 'viem'

export const ENSO_BRIDGE_POLL_INTERVAL_MS = 10_000
export const ENSO_BRIDGE_UNKNOWN_TIMEOUT_SECONDS = 10 * 60
export const ENSO_BRIDGE_TRACKING_TIMEOUT_MESSAGE =
  'The bridge status could not be verified automatically. Check the source transaction for progress.'

export function isTrackableEnsoBridgeNotification(notification: TNotification): boolean {
  const hasSourceReference = Boolean(
    notification.txHash || (notification.bridgeProtocol === 'relay' && notification.bridgeRequestId)
  )
  return Boolean(
    notification.id &&
      notification.status === 'submitted' &&
      notification.bridgeProtocol &&
      hasSourceReference &&
      notification.bridgeTrackingState !== 'unavailable'
  )
}

export function selectNextEnsoBridgeNotification(notifications: TNotification[]): TNotification | undefined {
  return notifications.filter(isTrackableEnsoBridgeNotification).toSorted((left, right) => {
    const recencyDifference =
      (right.sourceConfirmedAt ?? right.createdAt ?? right.id ?? 0) -
      (left.sourceConfirmedAt ?? left.createdAt ?? left.id ?? 0)
    return recencyDifference || (left.lastBridgeCheckAt ?? 0) - (right.lastBridgeCheckAt ?? 0)
  })[0]
}

export function normalizeEnsoBridgeStatusResponse(data: unknown): TEnsoBridgeStatusResponse | undefined {
  if (!data || typeof data !== 'object') return undefined
  const candidate = data as Record<string, unknown>
  const status = typeof candidate.status === 'string' ? candidate.status.toLowerCase() : undefined
  if (!isEnsoBridgeStatus(status)) return undefined

  return {
    status,
    bridgeRequestId:
      typeof candidate.bridgeRequestId === 'string' && isHash(candidate.bridgeRequestId)
        ? candidate.bridgeRequestId
        : undefined,
    sourceChainId: typeof candidate.sourceChainId === 'number' ? candidate.sourceChainId : undefined,
    sourceTxHash:
      typeof candidate.sourceTxHash === 'string' && isHash(candidate.sourceTxHash) ? candidate.sourceTxHash : undefined,
    destinationChainId: typeof candidate.destinationChainId === 'number' ? candidate.destinationChainId : undefined,
    destinationTxHash:
      typeof candidate.destinationTxHash === 'string' && isHash(candidate.destinationTxHash)
        ? candidate.destinationTxHash
        : undefined,
    error: typeof candidate.error === 'string' ? candidate.error : undefined
  }
}

export function buildEnsoBridgeNotificationUpdate(
  result: TEnsoBridgeStatusResponse,
  nowSeconds: number,
  notification: Pick<TNotification, 'createdAt' | 'sourceConfirmedAt'>
): Partial<TNotification> {
  const trackingStartedAt = notification.sourceConfirmedAt ?? notification.createdAt ?? nowSeconds
  const isUnknownTimedOut =
    result.status === 'unknown' && nowSeconds - trackingStartedAt >= ENSO_BRIDGE_UNKNOWN_TIMEOUT_SECONDS
  const isDelivered = result.status === 'delivered'
  const isFailed = result.status === 'failed'

  return {
    status: isDelivered ? 'success' : isFailed ? 'error' : 'submitted',
    bridgeStatus: result.status,
    bridgeTrackingState: isUnknownTimedOut ? 'unavailable' : 'active',
    lastBridgeCheckAt: nowSeconds,
    ...(result.bridgeRequestId ? { bridgeRequestId: result.bridgeRequestId } : {}),
    ...(result.sourceTxHash ? { txHash: result.sourceTxHash } : {}),
    ...(result.destinationChainId !== undefined ? { toChainId: result.destinationChainId } : {}),
    ...(result.destinationTxHash ? { destinationTxHash: result.destinationTxHash } : {}),
    ...(isUnknownTimedOut
      ? { bridgeError: ENSO_BRIDGE_TRACKING_TIMEOUT_MESSAGE }
      : result.error
        ? { bridgeError: result.error }
        : {}),
    timeFinished: isDelivered || isFailed || isUnknownTimedOut ? nowSeconds : undefined
  }
}

export async function fetchEnsoBridgeStatus(
  notification: TNotification,
  signal?: AbortSignal
): Promise<TEnsoBridgeStatusResponse> {
  const canTrackByRelayRequestId = notification.bridgeProtocol === 'relay' && notification.bridgeRequestId
  if (!notification.bridgeProtocol || (!notification.txHash && !canTrackByRelayRequestId)) {
    throw new Error('Missing bridge tracking metadata')
  }
  const params = new URLSearchParams({
    protocol: notification.bridgeProtocol,
    chainId: String(notification.chainId)
  })
  if (notification.txHash) params.set('txHash', notification.txHash)
  if (notification.bridgeRequestId) params.set('requestId', notification.bridgeRequestId)
  const response = await fetch(`/api/enso/bridge-status?${params}`, { signal })
  const data = await response.json()
  if (!response.ok) throw new Error(typeof data?.error === 'string' ? data.error : 'Unable to check bridge status')
  const normalized = normalizeEnsoBridgeStatusResponse(data)
  if (!normalized) throw new Error('Invalid bridge status response')
  return normalized
}
