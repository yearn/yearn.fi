import { useNotifications } from '@shared/contexts/useNotifications'
import {
  buildEnsoBridgeNotificationUpdate,
  ENSO_BRIDGE_POLL_INTERVAL_MS,
  fetchEnsoBridgeStatus,
  isTrackableEnsoBridgeNotification,
  selectNextEnsoBridgeNotification
} from '@shared/hooks/ensoBridgeStatus'
import { useNotificationAssetRefresh } from '@shared/hooks/useNotificationAssetRefresh'
import type { TNotification } from '@shared/types/notifications'
import { useCallback, useEffect, useRef } from 'react'

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
    try {
      const result = await fetchEnsoBridgeStatus(candidate)
      const latestCandidate = latestNotificationsRef.current.find((notification) => notification.id === candidate.id)
      if (!latestCandidate || !isTrackableEnsoBridgeNotification(latestCandidate)) return
      if (result.status === 'delivered') {
        await refreshNotificationAssets(latestCandidate).catch((error) => {
          console.warn('[Enso] Bridge delivered, but asset refresh failed', error)
        })
      }
      await updateEntry(buildEnsoBridgeNotificationUpdate(result, Date.now() / 1000, latestCandidate), candidate.id)
    } catch (error) {
      await updateEntry({ lastBridgeCheckAt: Date.now() / 1000 }, candidate.id)
      console.warn('[Enso] Bridge status check failed', {
        protocol: candidate.bridgeProtocol,
        chainId: candidate.chainId,
        txHash: candidate.txHash,
        error: (error as Error)?.message || error
      })
    } finally {
      isPollingRef.current = false
    }
  }, [refreshNotificationAssets, updateEntry])

  const hasTrackableNotification = notifications.some(isTrackableEnsoBridgeNotification)
  useEffect(() => {
    if (!hasTrackableNotification) return
    const intervalId = window.setInterval(() => void checkNextBridge(), ENSO_BRIDGE_POLL_INTERVAL_MS)
    return () => window.clearInterval(intervalId)
  }, [checkNextBridge, hasTrackableNotification])
}
