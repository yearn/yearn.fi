import { useNotifications } from '@shared/contexts/useNotifications'
import {
  resolvePolledTransactionStatus,
  shouldApplyPolledTransactionSettlement,
  shouldPollNotificationStatus
} from '@shared/hooks/transactionStatusPoller.helpers'
import { useNotificationAssetRefresh } from '@shared/hooks/useNotificationAssetRefresh'
import { fetchSafeTransactionDetails } from '@shared/hooks/useSafeTransactionDetails'
import type { TNotification } from '@shared/types/notifications'
import { getNetwork, retrieveConfig } from '@shared/utils/wagmi'
import { getConnectorClient, getPublicClient } from '@wagmi/core'
import {
  awaitTransactionRefresh,
  getConfirmedTransactionReceipt,
  getTransactionConfirmations
} from '@yearn/vault-widget/headless'
import { useCallback, useEffect, useRef } from 'react'
import type { Hash } from 'viem'
import { getCallsStatus } from 'viem/actions'
import { getBlock } from 'wagmi/actions'

type TSourceReference = { hash: Hash; executionFailed?: boolean } | { failed: true } | undefined

async function resolveSafeSourceReference(
  config: ReturnType<typeof retrieveConfig>,
  pollingChainId: number,
  proposalId: Hash
): Promise<TSourceReference> {
  const safeTransaction = await fetchSafeTransactionDetails(proposalId).catch((error) => {
    console.warn('Safe transaction detail lookup failed, falling back to wallet_getCallsStatus:', error)
    return undefined
  })
  // An execution hash is chain evidence to verify, even if the service also reports failure.
  if (safeTransaction?.executionTxHash)
    return {
      hash: safeTransaction.executionTxHash,
      executionFailed: safeTransaction.txStatus === 'FAILED' || safeTransaction.txStatus === 'CANCELLED'
    }
  if (safeTransaction?.txStatus === 'FAILED' || safeTransaction?.txStatus === 'CANCELLED') return { failed: true }
  if (safeTransaction) return undefined

  const connectorClient = await getConnectorClient(config, { chainId: pollingChainId, assertChainId: false })
  const callsStatus = await getCallsStatus(connectorClient, { id: proposalId })
  const executionHash = callsStatus.receipts?.[0]?.transactionHash
  if (executionHash) return { hash: executionHash, executionFailed: callsStatus.status === 'failure' }
  if (callsStatus.status === 'failure') return { failed: true }
  return undefined
}

/** Reconcile persisted source transactions, using the same confirmation policy as the widget. */
export function useTransactionStatusPoller(notification: TNotification): void {
  const { updateEntry } = useNotifications()
  const refreshNotificationAssets = useNotificationAssetRefresh()
  const isPollingRef = useRef(false)
  const isMountedRef = useRef(true)
  const latestNotificationRef = useRef(notification)
  latestNotificationRef.current = notification

  const checkTransactionStatus = useCallback(async (): Promise<void> => {
    const notificationId = notification.id
    const txHash = notification.txHash
    if (isPollingRef.current || !shouldPollNotificationStatus(notification) || !notificationId || !txHash) return

    isPollingRef.current = true
    try {
      const config = retrieveConfig()
      const pollingChainId = notification.executionChainId ?? notification.chainId
      if (!getNetwork(pollingChainId)) return
      const client = getPublicClient(config, { chainId: pollingChainId })
      if (!client) return

      const sourceReference: TSourceReference = notification.awaitingExecution
        ? await resolveSafeSourceReference(config, pollingChainId, txHash)
        : { hash: txHash }
      if (!sourceReference) return
      if (
        !isMountedRef.current ||
        !shouldApplyPolledTransactionSettlement(latestNotificationRef.current, { id: notificationId, txHash })
      )
        return
      if ('failed' in sourceReference) {
        await updateEntry(
          { status: 'error', awaitingExecution: false, timeFinished: Date.now() / 1000 },
          notificationId
        )
        return
      }

      // Resolve Safe execution IDs through the RPC too; wallet receipt metadata alone
      // does not establish the required confirmation depth.
      const receipt = await getConfirmedTransactionReceipt(
        client,
        sourceReference.hash,
        getTransactionConfirmations(notification.chainId)
      )
      if (!receipt) return
      const receiptStatus = resolvePolledTransactionStatus({
        receipt,
        requestedHash: sourceReference.hash,
        isBridgeTransaction: Boolean(notification.bridgeProtocol)
      })
      const status = sourceReference.executionFailed ? 'error' : receiptStatus
      const block = await getBlock(config, { chainId: pollingChainId, blockNumber: receipt.blockNumber })
      if (
        !isMountedRef.current ||
        !shouldApplyPolledTransactionSettlement(latestNotificationRef.current, { id: notificationId, txHash })
      )
        return

      const update: Partial<TNotification> = {
        status,
        txHash: receipt.transactionHash,
        timeFinished: Number(block.timestamp),
        blockNumber: receipt.blockNumber,
        awaitingExecution: false,
        ...(status === 'submitted' && notification.bridgeProtocol
          ? {
              bridgeStatus: 'pending',
              bridgeTrackingState: 'active',
              sourceConfirmedAt: Number(block.timestamp),
              timeFinished: undefined
            }
          : {})
      }
      await updateEntry(update, notificationId)
      if (status === 'success') {
        void awaitTransactionRefresh(() => refreshNotificationAssets({ ...notification, ...update })).catch((error) => {
          console.warn('Transaction confirmed, but asset refresh failed:', error)
        })
      }
    } catch (error) {
      console.warn('Transaction status check failed:', error)
    } finally {
      isPollingRef.current = false
    }
  }, [notification, refreshNotificationAssets, updateEntry])

  // Polling is an external timer lifecycle; cleanup also fences in-flight results on unmount.
  useEffect(() => {
    isMountedRef.current = true
    if (!shouldPollNotificationStatus(notification))
      return () => {
        isMountedRef.current = false
      }
    void checkTransactionStatus()
    const interval = setInterval(() => void checkTransactionStatus(), notification.awaitingExecution ? 15_000 : 60_000)
    return () => {
      clearInterval(interval)
      isMountedRef.current = false
    }
  }, [notification, checkTransactionStatus])
}
