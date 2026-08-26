import { useNotifications } from '@shared/contexts/useNotifications'
import {
  buildEnsoBridgeCheckFailureUpdate,
  buildEnsoBridgeNotificationUpdate,
  ENSO_BRIDGE_POLL_INTERVAL_MS,
  fetchEnsoBridgeStatus,
  isTrackableEnsoBridgeNotification,
  selectNextEnsoBridgeNotification
} from '@shared/hooks/ensoBridgeStatus'
import { useNotificationAssetRefresh } from '@shared/hooks/useNotificationAssetRefresh'
import type { TNotification } from '@shared/types/notifications'
import { useCallback, useEffect, useRef } from 'react'

const BRIDGE_STATUS_REQUEST_TIMEOUT_MS = 9_000

export function useEnsoBridgeStatusPoller(notifications: TNotification[]): void {
  const { updateEntry } = useNotifications()
  const refreshNotificationAssets = useNotificationAssetRefresh()
  const isPollingRef = useRef(false)
  const latestNotificationsRef = useRef(notifications)
  latestNotificationsRef.current = notifications

  const checkNextBridge = useCallback(async (): Promise<void> => {
    if (isPollingRef.current) return
    const candidate = selectNextEnsoBridgeNotification(latestNotificationsRef.current)
    if (!candidate?.id) return

    isPollingRef.current = true
    const controller = new AbortController()
    const timeoutId = window.setTimeout(() => controller.abort(), BRIDGE_STATUS_REQUEST_TIMEOUT_MS)
    try {
      const result = await fetchEnsoBridgeStatus(candidate, controller.signal)
      const latestCandidate = latestNotificationsRef.current.find((notification) => notification.id === candidate.id)
      if (!latestCandidate || !isTrackableEnsoBridgeNotification(latestCandidate)) return
      if (result.status === 'delivered') {
        await refreshNotificationAssets(latestCandidate).catch((error) => {
          console.warn('[Enso] Bridge delivered, but asset refresh failed', error)
        })
      }
      const update = buildEnsoBridgeNotificationUpdate(result, Date.now() / 1000, latestCandidate)
      await updateEntry(update, candidate.id)
    } catch (error) {
      const latestCandidate = latestNotificationsRef.current.find((notification) => notification.id === candidate.id)
      if (latestCandidate && isTrackableEnsoBridgeNotification(latestCandidate)) {
        await updateEntry(buildEnsoBridgeCheckFailureUpdate(Date.now() / 1000, latestCandidate), candidate.id).catch(
          (persistenceError) => {
            console.warn('[Enso] Failed to persist bridge tracking error', persistenceError)
          }
        )
      }
      console.warn('[Enso] Bridge status check failed', {
        protocol: candidate.bridgeProtocol,
        chainId: candidate.chainId,
        txHash: candidate.txHash,
        error: (error as Error)?.message || error
      })
    } finally {
      window.clearTimeout(timeoutId)
      isPollingRef.current = false
    }
  }, [refreshNotificationAssets, updateEntry])

  const hasTrackableNotification = notifications.some(isTrackableEnsoBridgeNotification)
  useEffect(() => {
    if (!hasTrackableNotification) return
    void checkNextBridge()
    const intervalId = window.setInterval(() => void checkNextBridge(), ENSO_BRIDGE_POLL_INTERVAL_MS)
    return () => window.clearInterval(intervalId)
  }, [checkNextBridge, hasTrackableNotification])
}
