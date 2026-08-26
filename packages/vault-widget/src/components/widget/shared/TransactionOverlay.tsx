import { useQuery } from '@tanstack/react-query'
import { getPublicClient } from '@wagmi/core'
import type { VaultWidgetTransactionPlan } from '@yearn/vault-widget/headless'
import { Button } from '@yearn/vault-widget/internal/components/shared/Button'
import {
  executePlannedStyledWidgetTransaction,
  getPlannedTransactionErrorPresentation,
  type TPlannedTransactionFailureKind
} from '@yearn/vault-widget/internal/components/widget/shared/plannedTransactionController'
import { cl } from '@yearn/vault-widget/internal/utils/index'
import {
  useVaultWidgetRuntime,
  type VaultWidgetBridgeStatus,
  type VaultWidgetNotificationId,
  type VaultWidgetNotificationInput
} from '@yearn/vault-widget/runtime'
import {
  getContractTransactionRequest,
  getTransactionPreparationChainId,
  isRawTransactionPreparation,
  isTransactionPreparationReady,
  type TTransactionPreparation
} from '@yearn/vault-widget/types'
import { type FC, useCallback, useEffect, useId, useRef, useState } from 'react'
import { useReward } from 'react-rewards'
import type { Address, TransactionReceipt, TypedData, TypedDataDomain } from 'viem'
import {
  useAccount,
  useCallsStatus,
  useChainId,
  useConfig,
  useSendCalls,
  useSignTypedData,
  useSwitchChain,
  useWriteContract
} from 'wagmi'
import { getConfirmedTransactionReceipt } from './submittedTransactionReceipt'
import { AnimatedCheckmark, ErrorIcon, Spinner } from './TransactionStateIndicators'
import {
  AUTO_CONTINUE_SUCCESS_DELAY_MS,
  type CompletionDeferral,
  getAutoContinueConfirmDelayMs,
  getBridgeTrackerLink,
  getInitialOverlayState,
  getPendingTransactionTitle,
  getSubmittedTransactionCopy,
  hasExecutableWalletConnector,
  isConfirmedSafeTransactionFailure,
  type OverlayState,
  resolveCompletionDeferral,
  resolveCrossChainSourceCompletion,
  resolveExecutionTrackingHash,
  resolveOverlayConnectedChainId,
  resolvePendingSafeOverlayState,
  resolveTransactionReceiptOutcome,
  shouldAutoContinueFromSuccessState,
  shouldAutoContinuePermitSuccess,
  shouldRefetchNextStepAfterReceipt,
  shouldRunDeferredCompletion,
  shouldStartStepOnOpen
} from './transactionOverlay.helpers'

export type PermitDataDirect = {
  domain: TypedDataDomain
  types: TypedData
  message: Record<string, unknown>
  primaryType: string
}

export type PermitDataAsync = {
  getPermitData: () => Promise<PermitDataDirect | undefined>
}

export type PermitData = PermitDataDirect | PermitDataAsync

export type TransactionBatchCall = {
  to: Address
  data: `0x${string}`
  value?: bigint
}

export type TransactionStep = {
  id: string
  prepare: TTransactionPreparation
  label: string
  confirmMessage: string
  successTitle: string
  successMessage: string
  isEnabled?: boolean
  completesFlow?: boolean
  showConfetti?: boolean
  notification?: VaultWidgetNotificationInput
  // Permit-specific fields
  isPermit?: boolean
  permitData?: PermitData
  onPermitSigned?: (signature: `0x${string}`) => void
  batch?: {
    chainId: number
    calls: readonly TransactionBatchCall[]
  }
}

function resolveCanonicalChainId(
  resolve: (chainId: number | undefined) => number | undefined,
  chainId: number | undefined
): number | undefined {
  return resolve(chainId) ?? chainId
}

function resolveExecutionChainId(
  resolveCanonical: (chainId: number | undefined) => number | undefined,
  resolveExecution: (chainId: number | undefined) => number | undefined,
  chainId: number | undefined
): number | undefined {
  const canonicalChainId = resolveCanonicalChainId(resolveCanonical, chainId)
  return resolveExecution(canonicalChainId) ?? chainId
}

type TPrepareDebugInfo = {
  isSuccess: boolean
  isError: boolean
  isLoading: boolean
  isFetching: boolean
  status: string
  error?: string
  request?: {
    chainId?: number
    address?: unknown
    functionName?: unknown
  }
}

function getPrepareDebugInfo(prepare?: TTransactionPreparation): TPrepareDebugInfo | undefined {
  if (!prepare) return undefined
  const request = getContractTransactionRequest(prepare) as any

  return {
    isSuccess: prepare.isSuccess,
    isError: prepare.isError,
    isLoading: prepare.isLoading,
    isFetching: prepare.isFetching,
    status: prepare.status,
    error: prepare.error ? (prepare.error as Error).message || String(prepare.error) : undefined,
    request: request
      ? {
          chainId: request.chainId,
          address: request.address,
          functionName: request.functionName
        }
      : undefined
  }
}

function getStepDebugInfo(
  step?: TransactionStep
): { step: 'missing' } | { label: string; isPermit?: boolean; prepare?: TPrepareDebugInfo } {
  if (!step) return { step: 'missing' }
  return {
    label: step.label,
    isPermit: step.isPermit,
    prepare: getPrepareDebugInfo(step.prepare)
  }
}

function getSuccessButtonLabel(params: {
  isCrossChainNotification: boolean
  isTerminalSuccess: boolean
  isAutoContinuing: boolean
  executedStepAutoContinues: boolean
  currentStepLabel?: string
}): string {
  if (params.isCrossChainNotification) {
    return 'Got it'
  }

  if (params.isTerminalSuccess) {
    return 'Nice'
  }

  if (params.executedStepAutoContinues || params.isAutoContinuing) {
    return 'Continuing...'
  }

  return params.currentStepLabel || 'Continue'
}

function isCrossChainNotification(notification?: VaultWidgetNotificationInput): boolean {
  return notification?.type === 'crosschain zap' || notification?.type === 'crosschain withdraw zap'
}

const BRIDGE_TRACKING_UNAVAILABLE_MESSAGE =
  'Automatic bridge tracking could not be started. Check the source transaction for progress.'
type LocalBridgeTrackingState = { status: 'idle' | 'active' } | { status: 'unavailable'; message: string }

function isUserRejectionError(error: any): boolean {
  return (
    error?.message?.toLowerCase().includes('rejected') ||
    error?.message?.toLowerCase().includes('denied') ||
    error?.code === 4001
  )
}

function getTransactionErrorMessage(error: any): string {
  const errorMsg = error?.shortMessage || error?.message || 'Transaction failed. Please try again.'
  return errorMsg.length > 100 ? 'Transaction failed. Please try again.' : errorMsg
}

type TransactionOverlayProps = {
  isOpen: boolean
  onClose: () => void
  plan?: VaultWidgetTransactionPlan
  step?: TransactionStep
  isLastStep?: boolean
  onAllComplete?: () => void
  deferOnAllCompleteUntilClose?: boolean
  deferOnAllCompleteUntilConfettiEnd?: boolean
  onStepSuccess?: (stepId: string) => void | Promise<void>
  /**
   * Called after the final transaction is confirmed, before the success screen
   * is shown. The overlay stays in a "refreshing" state while this resolves.
   * Use this to await balance/data refetches so the success screen renders
   * with fresh data and no background work remaining.
   */
  onBeforeSuccess?: (stepId: string) => Promise<void>
  topOffset?: string
  contentAlign?: 'center' | 'start'
  autoContinueToNextStep?: boolean
  autoContinueStepIds?: string[]
}

export const TransactionOverlay: FC<TransactionOverlayProps> = ({
  isOpen,
  onClose,
  plan,
  step,
  isLastStep = true,
  onAllComplete,
  deferOnAllCompleteUntilClose = false,
  deferOnAllCompleteUntilConfettiEnd = false,
  onStepSuccess,
  onBeforeSuccess,
  contentAlign = 'center',
  autoContinueToNextStep = false,
  autoContinueStepIds = []
}) => {
  const [overlayState, setOverlayState] = useState<OverlayState>(getInitialOverlayState())
  const [errorMessage, setErrorMessage] = useState<string>('')
  const [hasCompletedFlow, setHasCompletedFlow] = useState(false)
  const [completedStepSnapshot, setCompletedStepSnapshot] = useState<TransactionStep | null>(null)
  const [plannedTxHash, setPlannedTxHash] = useState<`0x${string}` | undefined>()
  const [plannedFailureKind, setPlannedFailureKind] = useState<TPlannedTransactionFailureKind>('pre-submission')

  const runtime = useVaultWidgetRuntime()
  const wagmiConfig = useConfig()
  const writeContract = useWriteContract()
  const sendCalls = useSendCalls()
  const { signTypedDataAsync } = useSignTypedData()
  const connectedExecutionChainId = useChainId()
  const currentChainId =
    resolveCanonicalChainId(runtime.chains.resolveCanonicalChainId, connectedExecutionChainId) ??
    connectedExecutionChainId
  const { switchChainAsync } = useSwitchChain()
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>()
  const [submittedExecutionChainId, setSubmittedExecutionChainId] = useState<number | undefined>()
  const { address: account, chain, connector, status: accountStatus } = useAccount()
  const isWalletSafe = runtime.safe.isSafe
  const isWalletConnectionReady =
    accountStatus === 'connected' && Boolean(account) && hasExecutableWalletConnector(connector)
  const targetChainId = step?.batch?.chainId ?? getTransactionPreparationChainId(step?.prepare)
  const targetExecutionChainId = resolveExecutionChainId(
    runtime.chains.resolveCanonicalChainId,
    runtime.chains.resolveExecutionChainId,
    targetChainId
  )
  const connectedChainId = resolveOverlayConnectedChainId({
    accountChainId: chain?.id,
    currentChainId: connectedExecutionChainId,
    targetChainId: targetExecutionChainId,
    isWalletSafe
  })

  // Notification system integration
  const { createSubmitted: createSubmittedNotification, update: updateNotification } = runtime.notifications
  const [notificationId, setNotificationId] = useState<VaultWidgetNotificationId | undefined>()
  const notificationIdRef = useRef<VaultWidgetNotificationId | undefined>(undefined)
  const trackedNotification = runtime.notifications.get(notificationId)
  const [localBridgeTracking, setLocalBridgeTracking] = useState<LocalBridgeTrackingState>({ status: 'idle' })

  const setActiveNotificationId = useCallback((id: VaultWidgetNotificationId | undefined) => {
    notificationIdRef.current = id
    setNotificationId(id)
  }, [])

  const submittedCanonicalChainId = resolveCanonicalChainId(
    runtime.chains.resolveCanonicalChainId,
    submittedExecutionChainId
  )
  // Fast chains like Base need extra confirmations.
  const confirmations = submittedCanonicalChainId === 8453 ? 2 : 1

  // Track the step that was just executed (for showing success messages)
  const executedStepRef = useRef<TransactionStep | null>(null)

  const explorerChainId =
    plan?.intent.calls[0]?.request.chainId ??
    executedStepRef.current?.batch?.chainId ??
    getTransactionPreparationChainId(executedStepRef.current?.prepare) ??
    undefined
  const canonicalExplorerChainId = resolveCanonicalChainId(runtime.chains.resolveCanonicalChainId, explorerChainId)
  const safeTransactionDetails = useQuery({
    queryKey: ['vault-widget', 'safe-transaction-details', txHash],
    enabled:
      Boolean(isWalletSafe && txHash && (overlayState === 'pending' || overlayState === 'submitted')) &&
      typeof window !== 'undefined',
    queryFn: async () => (txHash ? await runtime.safe.getTransactionDetails(txHash) : undefined),
    refetchInterval: (query) => {
      const status = query.state.data?.status
      return status === 'success' || status === 'failed' || status === 'cancelled' ? false : 1500
    },
    retry: false
  })
  const safeCallsStatus = useCallsStatus({
    id: txHash || '0x',
    query: {
      enabled: Boolean(
        isWalletSafe &&
          txHash &&
          (overlayState === 'pending' || overlayState === 'submitted') &&
          !safeTransactionDetails.data?.executionTxHash
      ),
      refetchInterval: 1500
    }
  })
  const executionTrackingHash = resolveExecutionTrackingHash({
    isWalletSafe,
    submittedTxHash: txHash,
    safeExecutionTxHash: safeTransactionDetails.data?.executionTxHash,
    callsReceiptTxHash: safeCallsStatus.data?.receipts?.[0]?.transactionHash
  })
  const receipt = useQuery({
    queryKey: ['vault-widget', 'submitted-transaction-receipt', submittedExecutionChainId, executionTrackingHash],
    enabled: Boolean(executionTrackingHash && submittedExecutionChainId),
    queryFn: async () => {
      if (!executionTrackingHash || !submittedExecutionChainId) return null
      const client = getPublicClient(wagmiConfig, { chainId: submittedExecutionChainId as any })
      if (!client) throw new Error(`No receipt client available for chain ${submittedExecutionChainId}`)
      return await getConfirmedTransactionReceipt(client, executionTrackingHash, confirmations)
    },
    refetchInterval: (query) => (query.state.data ? false : 1_000),
    retry: false
  })
  const receiptOutcome = resolveTransactionReceiptOutcome({
    isSuccess: receipt.isSuccess,
    // A failed lookup is an RPC/tracking error, not proof that the transaction reverted.
    // Keep polling until the submitted chain returns a receipt with a terminal status.
    isError: false,
    status: receipt.data?.status
  })
  const blockExplorer = runtime.chains.getChain(canonicalExplorerChainId ?? currentChainId)?.blockExplorerUrl
  const explorerDisplayHash = plannedTxHash ?? executionTrackingHash
  const explorerTxUrl = explorerDisplayHash && blockExplorer ? `${blockExplorer}/tx/${explorerDisplayHash}` : ''

  // Track if the executed step was the last step (captured at execution time)
  const wasLastStepRef = useRef(false)
  const executedStepBlockRef = useRef<bigint | undefined>(undefined)

  // Check if current step is ready to execute
  const isStepEnabled = step?.isEnabled ?? true
  const isStepReady = Boolean(
    isWalletConnectionReady &&
      isStepEnabled &&
      (step?.batch ? step.batch.calls.length > 0 : isTransactionPreparationReady(step?.prepare))
  )
  const executedStepId = executedStepRef.current?.id
  const executedStepLabel = executedStepRef.current?.label
  const executedStepFunctionName = (
    getContractTransactionRequest(executedStepRef.current?.prepare) as { functionName?: unknown } | undefined
  )?.functionName
  const executedStepAutoContinues = Boolean(
    executedStepId &&
      autoContinueToNextStep &&
      (autoContinueStepIds.length === 0 || autoContinueStepIds.includes(executedStepId))
  )

  // Track if we've started execution to prevent re-triggering
  const hasStartedRef = useRef(false)
  const hasAutoContinuedFromStepRef = useRef<string | null>(null)
  const hasReportedStepSuccessRef = useRef(false)
  const hasAdvancedFromStepRef = useRef<string | null>(null)
  const autoContinueNonceRef = useRef(0)
  const writeContractResetRef = useRef(writeContract.reset)
  const sendCallsResetRef = useRef(sendCalls.reset)
  const pendingCompletionRef = useRef<CompletionDeferral>('none')
  const completionFlowRef = useRef({ hasBridgeFailed: false })
  const hasRunAllCompleteRef = useRef(false)
  const isOpenRef = useRef(isOpen)
  const handledConfettiRequestRef = useRef(0)
  const handledSuccessReceiptRef = useRef<`0x${string}` | null>(null)
  const processingSuccessReceiptRef = useRef<`0x${string}` | null>(null)
  const [isAutoContinuing, setIsAutoContinuing] = useState(false)
  const [confettiRequestNonce, setConfettiRequestNonce] = useState(0)
  const [isWaitingForNextStep, setIsWaitingForNextStep] = useState(false)
  const [failedStepSuccessId, setFailedStepSuccessId] = useState<string | null>(null)

  // Async source-confirmation work can finish after the overlay closes, so keep
  // the latest visibility available without restarting receipt processing.
  useEffect(() => {
    isOpenRef.current = isOpen
  }, [isOpen])

  useEffect(() => {
    writeContractResetRef.current = writeContract.reset
  }, [writeContract.reset])

  useEffect(() => {
    sendCallsResetRef.current = sendCalls.reset
  }, [sendCalls.reset])

  const runAllComplete = useCallback(
    (completionFlow = completionFlowRef.current) => {
      if (
        completionFlow !== completionFlowRef.current ||
        completionFlow.hasBridgeFailed ||
        hasRunAllCompleteRef.current
      ) {
        return
      }

      hasRunAllCompleteRef.current = true
      pendingCompletionRef.current = 'none'
      onAllComplete?.()
    },
    [onAllComplete]
  )

  const runAllCompleteIfPending = useCallback(
    (trigger: 'close' | 'confetti') => {
      if (
        !shouldRunDeferredCompletion({
          completionDeferral: pendingCompletionRef.current,
          trigger,
          hasBridgeFailed: completionFlowRef.current.hasBridgeFailed
        })
      ) {
        return
      }

      runAllComplete()
    },
    [runAllComplete]
  )

  const confettiId = useId()
  const { reward } = useReward(confettiId, 'confetti', {
    spread: 80,
    elementCount: 80,
    startVelocity: 35,
    decay: 0.91,
    lifetime: 200,
    colors: ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'],
    onAnimationComplete: () => runAllCompleteIfPending('confetti')
  })

  const requestConfetti = useCallback(() => {
    setConfettiRequestNonce((nonce) => nonce + 1)
  }, [])

  const reportStepSuccess = useCallback(
    async (stepId: string): Promise<boolean> => {
      try {
        await onStepSuccess?.(stepId)
        setFailedStepSuccessId(null)
        return true
      } catch (error) {
        console.error('[TransactionOverlay] Failed to prepare the next transaction step', {
          step: stepId,
          error: (error as Error)?.message || error
        })
        setFailedStepSuccessId(stepId)
        setOverlayState('error')
        setErrorMessage((error as Error)?.message || 'Transaction confirmed, but the next step could not be prepared.')
        return false
      }
    },
    [onStepSuccess]
  )

  useEffect(() => {
    if (
      !isOpen ||
      overlayState !== 'success' ||
      confettiRequestNonce === 0 ||
      handledConfettiRequestRef.current === confettiRequestNonce
    ) {
      return
    }

    let animationFrameId: number | undefined
    let isCancelled = false

    const runWhenTargetExists = (attempt = 0) => {
      if (isCancelled) {
        return
      }

      if (document.getElementById(confettiId)) {
        handledConfettiRequestRef.current = confettiRequestNonce
        reward()
        return
      }

      if (attempt >= 5) {
        handledConfettiRequestRef.current = confettiRequestNonce
        runAllCompleteIfPending('confetti')
        return
      }

      animationFrameId = window.requestAnimationFrame(() => runWhenTargetExists(attempt + 1))
    }

    animationFrameId = window.requestAnimationFrame(() => runWhenTargetExists())

    return () => {
      isCancelled = true
      if (animationFrameId !== undefined) {
        window.cancelAnimationFrame(animationFrameId)
      }
    }
  }, [confettiId, confettiRequestNonce, isOpen, overlayState, reward, runAllCompleteIfPending])

  const finalizeSuccessState = useCallback(
    (completedAllSteps: boolean, completedStep?: TransactionStep | null) => {
      setOverlayState('success')
      setHasCompletedFlow(completedAllSteps)
      setCompletedStepSnapshot(completedAllSteps ? (completedStep ?? executedStepRef.current ?? null) : null)

      if (!completedAllSteps) {
        pendingCompletionRef.current = 'none'
        return
      }

      const completionDeferral = resolveCompletionDeferral({
        completedAllSteps,
        deferOnAllCompleteUntilClose,
        deferOnAllCompleteUntilConfettiEnd,
        stepShowsConfetti: Boolean((completedStep ?? executedStepRef.current)?.showConfetti)
      })

      if (completionDeferral === 'after-close' || completionDeferral === 'after-confetti') {
        pendingCompletionRef.current = completionDeferral
        return
      }

      runAllComplete()
    },
    [deferOnAllCompleteUntilClose, deferOnAllCompleteUntilConfettiEnd, runAllComplete]
  )

  const setStepExecutionContext = useCallback((nextStep: TransactionStep, nextIsLastStep: boolean) => {
    executedStepRef.current = nextStep
    wasLastStepRef.current = nextStep.completesFlow ?? nextIsLastStep
    hasReportedStepSuccessRef.current = false
    hasAdvancedFromStepRef.current = null
    setCompletedStepSnapshot(null)
    setFailedStepSuccessId(null)
    setLocalBridgeTracking({ status: 'idle' })
    completionFlowRef.current = { hasBridgeFailed: false }
    hasRunAllCompleteRef.current = false
  }, [])

  const resetTxState = useCallback(
    (clearNotification = false) => {
      writeContractResetRef.current()
      sendCallsResetRef.current()
      setTxHash(undefined)
      setSubmittedExecutionChainId(undefined)
      if (clearNotification) {
        setActiveNotificationId(undefined)
      }
    },
    [setActiveNotificationId]
  )

  // Reset state when overlay closes
  useEffect(() => {
    if (!isOpen) {
      runAllCompleteIfPending('close')
      setOverlayState('idle')
      setErrorMessage('')
      setHasCompletedFlow(false)
      setCompletedStepSnapshot(null)
      setPlannedTxHash(undefined)
      setPlannedFailureKind('pre-submission')
      resetTxState(true)
      hasStartedRef.current = false
      hasAutoContinuedFromStepRef.current = null
      hasReportedStepSuccessRef.current = false
      hasAdvancedFromStepRef.current = null
      executedStepRef.current = null
      wasLastStepRef.current = false
      executedStepBlockRef.current = undefined
      handledSuccessReceiptRef.current = null
      processingSuccessReceiptRef.current = null
      pendingCompletionRef.current = 'none'
      autoContinueNonceRef.current += 1
      setIsAutoContinuing(false)
      setIsWaitingForNextStep(false)
      setFailedStepSuccessId(null)
      setLocalBridgeTracking({ status: 'idle' })
      handledConfettiRequestRef.current = 0
      setConfettiRequestNonce(0)
    }
  }, [isOpen, resetTxState, runAllCompleteIfPending])

  // Persist the submitted hash before receipt polling can observe it.
  const handleCreateSubmittedNotification = useCallback(
    async (
      txHash: `0x${string}`,
      notification?: VaultWidgetNotificationInput,
      executionChainId?: number,
      status: 'pending' | 'submitted' = 'pending'
    ): Promise<VaultWidgetNotificationId | undefined> => {
      if (!notification || !account) return undefined

      try {
        const id = await createSubmittedNotification({
          ...notification,
          executionChainId: executionChainId ?? notification.executionChainId,
          ownerAddress: account,
          status,
          txHash
        })
        if (id === undefined) return undefined
        setActiveNotificationId(id)
        return id
      } catch (error) {
        console.error('Failed to create notification:', error)
        return undefined
      }
    },
    [account, createSubmittedNotification, setActiveNotificationId]
  )

  // Update notification with new status/receipt
  const updateNotificationById = useCallback(
    async (
      activeNotificationId: VaultWidgetNotificationId | undefined,
      params: {
        status?: 'pending' | 'submitted' | 'success' | 'error'
        receipt?: TransactionReceipt
        awaitingExecution?: boolean
        bridgeStatus?: VaultWidgetBridgeStatus
      }
    ): Promise<boolean> => {
      if (activeNotificationId === undefined) return false

      try {
        await updateNotification({
          id: activeNotificationId,
          status: params.status,
          receipt: params.receipt,
          awaitingExecution: params.awaitingExecution,
          bridgeStatus: params.bridgeStatus
        })
        return true
      } catch (error) {
        console.error('Failed to update notification:', error)
        return false
      }
    },
    [updateNotification]
  )

  const beginSubmittedTransaction = useCallback(
    async (hash: `0x${string}`, currentStep: TransactionStep, executionChainId: number | undefined): Promise<void> => {
      const submittedNotificationId = await handleCreateSubmittedNotification(
        hash,
        currentStep.notification,
        executionChainId
      )
      if (isCrossChainNotification(currentStep.notification)) {
        if (!currentStep.notification?.bridgeProtocol) {
          setLocalBridgeTracking({
            status: 'unavailable',
            message:
              'Automatic bridge tracking is unavailable for this route. Check the source transaction for progress.'
          })
        } else if (submittedNotificationId === undefined) {
          setLocalBridgeTracking({ status: 'unavailable', message: BRIDGE_TRACKING_UNAVAILABLE_MESSAGE })
        }
      }

      // Receipt polling starts only after the notification write has either
      // committed or failed explicitly, so a fast receipt cannot outrun its ID.
      setSubmittedExecutionChainId(executionChainId)
      setTxHash(hash)
      setOverlayState('pending')
    },
    [handleCreateSubmittedNotification]
  )

  const executePlannedStep = useCallback(async () => {
    if (!plan || !step || !account) {
      setOverlayState('error')
      setErrorMessage('Transaction not ready. Please try again.')
      return
    }

    setStepExecutionContext(step, isLastStep)
    setOverlayState('confirming')
    setErrorMessage('')
    setPlannedTxHash(undefined)
    setPlannedFailureKind('pre-submission')
    const canonicalExecutionChainId = plan.intent.calls[0]?.request.chainId
    const notificationExecutionChainId = runtime.chains.resolveExecutionChainId(canonicalExecutionChainId)
    const result = await executePlannedStyledWidgetTransaction({
      account,
      adapter: runtime.execution,
      notification: step.notification,
      notificationExecutionChainId,
      notifications: {
        createSubmitted: createSubmittedNotification,
        update: updateNotification
      },
      onNotificationError: (error) => console.error('Failed to update transaction notification:', error),
      onState: (state) => {
        if (state.status === 'confirming') {
          setOverlayState('confirming')
          return
        }
        if (state.status === 'pending') {
          setPlannedTxHash(state.hash)
          setOverlayState('pending')
          return
        }
        if (state.status === 'refreshing') {
          setPlannedTxHash(state.hash)
          setOverlayState('refreshing')
        }
      },
      onTransactionConfirmed: () => {
        if (hasReportedStepSuccessRef.current || !step.id) return
        hasReportedStepSuccessRef.current = true
        void reportStepSuccess(step.id)
      },
      plan,
      refresh: async () => {
        if (!onBeforeSuccess) return
        await onBeforeSuccess(step.id)
        await new Promise((resolve) => setTimeout(resolve, 500))
      }
    })

    if (result.status === 'error') {
      if (isUserRejectionError(result.error) || isUserRejectionError(result.error.cause)) {
        onClose()
        return
      }

      const presentation = getPlannedTransactionErrorPresentation(
        result.failureKind,
        getTransactionErrorMessage(result.error)
      )
      if (result.hash) setPlannedTxHash(result.hash)
      setPlannedFailureKind(result.failureKind)
      setErrorMessage(presentation.message)
      setOverlayState('error')
      return
    }

    if (result.hash) setPlannedTxHash(result.hash)
    const completedAllSteps = step.completesFlow ?? isLastStep
    finalizeSuccessState(completedAllSteps, step)
    if (step.showConfetti) requestConfetti()
  }, [
    account,
    createSubmittedNotification,
    finalizeSuccessState,
    isLastStep,
    onBeforeSuccess,
    onClose,
    reportStepSuccess,
    plan,
    requestConfetti,
    runtime.chains,
    runtime.execution,
    setStepExecutionContext,
    step,
    updateNotification
  ])

  const executePermitStep = useCallback(
    async (currentStep: TransactionStep) => {
      setStepExecutionContext(currentStep, isLastStep)
      setOverlayState('confirming')
      setErrorMessage('')

      try {
        const permitData =
          currentStep.permitData && 'getPermitData' in currentStep.permitData
            ? await currentStep.permitData.getPermitData()
            : currentStep.permitData

        if (!permitData) {
          console.error('[TransactionOverlay] Missing permit data', getStepDebugInfo(currentStep))
          throw new Error('Failed to get permit data')
        }

        const signature = await signTypedDataAsync({
          domain: permitData.domain,
          types: permitData.types,
          primaryType: permitData.primaryType,
          message: permitData.message
        })

        currentStep.onPermitSigned?.(signature)
        const completedAllSteps = currentStep.completesFlow ?? isLastStep
        if (!hasReportedStepSuccessRef.current && currentStep.id) {
          hasReportedStepSuccessRef.current = true
          if (!(await reportStepSuccess(currentStep.id))) return
        }
        finalizeSuccessState(completedAllSteps, currentStep)

        if (currentStep.showConfetti) {
          requestConfetti()
        }
      } catch (error: any) {
        if (isUserRejectionError(error)) {
          onClose()
          return
        }
        console.error('Permit signing failed:', error)
        setOverlayState('error')
        setErrorMessage('Failed to sign permit. Please try again.')
      }
    },
    [
      finalizeSuccessState,
      isLastStep,
      onClose,
      reportStepSuccess,
      requestConfetti,
      setStepExecutionContext,
      signTypedDataAsync
    ]
  )

  const executeContractStep = useCallback(
    async (currentStep: TransactionStep) => {
      if (currentStep.batch) {
        if (!isWalletSafe) {
          setOverlayState('error')
          setErrorMessage('Batch transactions are only available in Safe.')
          return
        }
        if (!account || currentStep.batch.calls.length === 0) {
          setOverlayState('error')
          setErrorMessage('Transaction not ready. Please try again.')
          return
        }

        setStepExecutionContext(currentStep, isLastStep)
        setOverlayState('confirming')
        setErrorMessage('')

        const txChainId = currentStep.batch.chainId
        const canonicalTxChainId = resolveCanonicalChainId(runtime.chains.resolveCanonicalChainId, txChainId)
        const executionTxChainId = resolveExecutionChainId(
          runtime.chains.resolveCanonicalChainId,
          runtime.chains.resolveExecutionChainId,
          txChainId
        )
        if (!runtime.chains.isConnectedToExecutionChain(connectedChainId, canonicalTxChainId)) {
          try {
            if (executionTxChainId === undefined) throw new Error(`Chain ${txChainId} is not enabled for execution`)
            await switchChainAsync({ chainId: executionTxChainId as any })
          } catch (error: any) {
            if (isUserRejectionError(error)) {
              onClose()
              return
            }
            console.warn('[TransactionOverlay] Safe batch chain switch failed', {
              to: txChainId,
              step: currentStep.label,
              error: error?.message || error
            })
            setOverlayState('error')
            setErrorMessage(
              'Unable to switch networks for this transaction. Please confirm your Safe is opened on the correct chain.'
            )
            return
          }
        }

        try {
          const result = await sendCalls.sendCallsAsync({
            account,
            chainId: executionTxChainId as any,
            forceAtomic: true,
            calls: currentStep.batch.calls
          })
          const hash = result.id as `0x${string}`
          await beginSubmittedTransaction(hash, currentStep, executionTxChainId)
        } catch (error: any) {
          if (isUserRejectionError(error)) {
            onClose()
            return
          }
          console.error('Safe batch transaction failed:', error)
          setOverlayState('error')
          setErrorMessage(getTransactionErrorMessage(error))
        }
        return
      }

      if (!isTransactionPreparationReady(currentStep.prepare)) {
        console.warn('[TransactionOverlay] Transaction not ready', getStepDebugInfo(currentStep))
        setOverlayState('error')
        setErrorMessage('Transaction not ready. Please try again.')
        return
      }

      setStepExecutionContext(currentStep, isLastStep)
      setOverlayState('confirming')
      setErrorMessage('')

      const rawPreparation = isRawTransactionPreparation(currentStep.prepare) ? currentStep.prepare : undefined
      const request = getContractTransactionRequest(currentStep.prepare) as any
      const txChainId = getTransactionPreparationChainId(currentStep.prepare)
      const canonicalTxChainId = resolveCanonicalChainId(runtime.chains.resolveCanonicalChainId, txChainId)
      const executionTxChainId = resolveExecutionChainId(
        runtime.chains.resolveCanonicalChainId,
        runtime.chains.resolveExecutionChainId,
        txChainId
      )
      const wrongNetwork =
        canonicalTxChainId && !runtime.chains.isConnectedToExecutionChain(connectedChainId, canonicalTxChainId)

      if (wrongNetwork && txChainId) {
        try {
          if (executionTxChainId === undefined) throw new Error(`Chain ${txChainId} is not enabled for execution`)
          await switchChainAsync({ chainId: executionTxChainId as any })
        } catch (error: any) {
          if (isUserRejectionError(error)) {
            onClose()
            return
          }
          console.warn('[TransactionOverlay] Chain switch failed', {
            to: txChainId,
            step: currentStep.label,
            error: error?.message || error
          })
          setOverlayState('error')
          setErrorMessage(
            'Unable to switch networks for this transaction. Please confirm your Safe is opened on the correct chain.'
          )
          return
        }
      }

      try {
        if (rawPreparation) {
          const hash = await rawPreparation.execute()
          await beginSubmittedTransaction(hash, currentStep, executionTxChainId)
          return
        }

        if (!request) throw new Error('Transaction request is unavailable')

        const gasEstimateClient = executionTxChainId
          ? getPublicClient(wagmiConfig, { chainId: executionTxChainId as any })
          : undefined
        const gasOverrides: { gas?: bigint } = gasEstimateClient
          ? await gasEstimateClient
              .estimateContractGas(request)
              .then((gasEstimate: bigint) => ({
                gas: (gasEstimate * BigInt(110)) / BigInt(100)
              }))
              .catch((error: unknown) => {
                console.warn('[TransactionOverlay] Gas estimation failed', {
                  step: currentStep.label,
                  error: (error as Error)?.message || error
                })
                return {}
              })
          : {}

        const hash = await writeContract.writeContractAsync({
          ...request,
          ...gasOverrides,
          connector
        })
        await beginSubmittedTransaction(hash, currentStep, executionTxChainId)
      } catch (error: any) {
        if (isUserRejectionError(error)) {
          onClose()
          return
        }
        console.error('Transaction failed:', error)
        setOverlayState('error')
        setErrorMessage(getTransactionErrorMessage(error))
      }
    },
    [
      connectedChainId,
      runtime.chains,
      beginSubmittedTransaction,
      account,
      isLastStep,
      isWalletSafe,
      onClose,
      sendCalls,
      setStepExecutionContext,
      switchChainAsync,
      wagmiConfig,
      writeContract
    ]
  )

  const executeStep = useCallback(async () => {
    if (!step) {
      console.warn('[TransactionOverlay] Execute called without step')
      return
    }

    if (step.isEnabled === false) {
      console.warn('[TransactionOverlay] Transaction not enabled', getStepDebugInfo(step))
      setOverlayState('error')
      setErrorMessage('Transaction not ready. Please try again.')
      return
    }

    if (!isWalletConnectionReady) {
      setOverlayState('error')
      setErrorMessage('Wallet is reconnecting. Please try again in a moment.')
      return
    }

    if (step.isPermit && step.permitData) {
      await executePermitStep(step)
      return
    }

    await executeContractStep(step)
  }, [executeContractStep, executePermitStep, isWalletConnectionReady, step])

  const advanceToNextStep = useCallback(() => {
    const executedStepId = executedStepRef.current?.id
    if (!executedStepId) return
    if (hasAdvancedFromStepRef.current === executedStepId) return

    hasAdvancedFromStepRef.current = executedStepId
    autoContinueNonceRef.current += 1
    setIsAutoContinuing(false)
    setIsWaitingForNextStep(true)

    // Reset for next step. The parent provides a fresh step after allowance or
    // balance state updates, so wait for that prepared step before executing.
    resetTxState()
  }, [resetTxState])

  const waitForAutoContinueBlock = useCallback(
    async (executedStepId?: string) => {
      // Most flows can continue immediately once the next simulation is ready.
      // Unstake -> withdraw can race state propagation, so wait one block there.
      if (executedStepId !== 'unstake') return

      const executedBlockNumber = executedStepBlockRef.current
      const executedChainId = getTransactionPreparationChainId(executedStepRef.current?.prepare)
      const executionChainId = resolveExecutionChainId(
        runtime.chains.resolveCanonicalChainId,
        runtime.chains.resolveExecutionChainId,
        executedChainId
      )
      const blockClient = executionChainId
        ? getPublicClient(wagmiConfig, { chainId: executionChainId as any })
        : undefined
      if (!blockClient || executedBlockNumber === undefined) return

      const targetBlock = executedBlockNumber + 1n
      const timeoutMs = 20_000
      const pollIntervalMs = 1_000
      const startedAt = Date.now()

      const waitForNextBlock = async (): Promise<void> => {
        if (Date.now() - startedAt >= timeoutMs) return

        try {
          const latestBlock = await blockClient.getBlockNumber()
          if (latestBlock >= targetBlock) {
            return
          }
        } catch (error) {
          console.warn('[TransactionOverlay] Auto-continue block polling failed', {
            step: executedStepRef.current?.label,
            error: (error as Error)?.message || error
          })
          return
        }

        await new Promise((resolve) => {
          window.setTimeout(resolve, pollIntervalMs)
        })
        await waitForNextBlock()
      }

      await waitForNextBlock()
    },
    [runtime.chains, wagmiConfig]
  )

  useEffect(() => {
    if (step?.prepare.isError) {
      console.error('[TransactionOverlay] Prepare failed', getStepDebugInfo(step))
    }
  }, [step?.prepare.isError, step?.prepare.error, step?.label])

  const successStep = completedStepSnapshot ?? executedStepRef.current
  const executedStepCompletesFlow = successStep?.completesFlow ?? wasLastStepRef.current
  const isTerminalSuccess = overlayState === 'success' && (hasCompletedFlow || executedStepCompletesFlow)
  const isPreparingNextStep =
    overlayState === 'pending' && receiptOutcome === 'success' && !wasLastStepRef.current && executedStepAutoContinues
  const isSuccessButtonBusy = !isTerminalSuccess && (!isStepReady || isAutoContinuing)
  const successButtonLabel = getSuccessButtonLabel({
    isCrossChainNotification: isCrossChainNotification(successStep?.notification),
    isTerminalSuccess,
    isAutoContinuing,
    executedStepAutoContinues,
    currentStepLabel: step?.label
  })
  const isCrossChainStep = isCrossChainNotification(successStep?.notification)
  const hasRecoveredBridgeTracking = Boolean(
    trackedNotification?.bridgeStatus && trackedNotification.bridgeTrackingState === 'active'
  )
  const localBridgeTrackingFailure =
    !hasRecoveredBridgeTracking && localBridgeTracking.status === 'unavailable'
      ? localBridgeTracking.message
      : undefined
  const bridgeTrackingUnavailable = Boolean(
    !hasRecoveredBridgeTracking &&
      (localBridgeTrackingFailure || trackedNotification?.bridgeTrackingState === 'unavailable')
  )
  const isTrackingBridge =
    isCrossChainStep &&
    !bridgeTrackingUnavailable &&
    (localBridgeTracking.status === 'active' || hasRecoveredBridgeTracking)
  const sourceChain = runtime.chains.getChain(successStep?.notification?.fromChainId ?? 0)
  const destinationChain = runtime.chains.getChain(successStep?.notification?.toChainId ?? 0)
  const sourceChainName = sourceChain?.name ?? 'the source network'
  const destinationChainName = destinationChain?.name ?? 'the destination network'
  const bridgeAction = successStep?.notification?.type.includes('withdraw') ? 'withdrawal' : 'deposit'
  const isBridgeDelivered =
    trackedNotification?.status === 'success' && trackedNotification.bridgeStatus === 'delivered'
  const needsManualBridgeExecution = trackedNotification?.bridgeStatus === 'ready_for_manual_execution'
  const destinationExplorerTxUrl =
    trackedNotification?.destinationTxHash && destinationChain?.blockExplorerUrl
      ? `${destinationChain.blockExplorerUrl}/tx/${trackedNotification.destinationTxHash}`
      : ''
  const bridgeTrackerLink =
    isTrackingBridge || needsManualBridgeExecution
      ? getBridgeTrackerLink({
          bridgeProtocol: trackedNotification?.bridgeProtocol,
          bridgeRequestId: trackedNotification?.bridgeRequestId,
          sourceTxHash: trackedNotification?.sourceTxHash
        })
      : undefined
  const { title: submittedTitle, detail: submittedDetail } = getSubmittedTransactionCopy({
    isCrossChain: isCrossChainStep,
    isBridgeTrackingActive: isTrackingBridge,
    isBridgeTrackingUnavailable: bridgeTrackingUnavailable,
    bridgeStatus: trackedNotification?.bridgeStatus,
    bridgeTrackingError: localBridgeTrackingFailure || trackedNotification?.bridgeError,
    sourceChainName,
    destinationChainName,
    bridgeAction
  })
  const successTitle = isBridgeDelivered ? `Bridge and ${bridgeAction} complete` : successStep?.successTitle
  const successMessage = isBridgeDelivered
    ? `Your ${successStep?.notification?.toSymbol ?? 'assets'} arrived on ${destinationChainName}.`
    : successStep?.successMessage

  const handleNextStep = useCallback(() => {
    if (isAutoContinuing) return

    if (isTerminalSuccess) {
      onClose()
    } else {
      advanceToNextStep()
    }
  }, [isAutoContinuing, isTerminalSuccess, onClose, advanceToNextStep])

  const handleRetry = useCallback(() => {
    if (failedStepSuccessId) {
      setOverlayState('pending')
      setErrorMessage('')
      void reportStepSuccess(failedStepSuccessId)
      return
    }

    resetTxState()
    if (plan) {
      hasStartedRef.current = true
      void executePlannedStep()
      return
    }
    executeStep()
  }, [executePlannedStep, failedStepSuccessId, plan, reportStepSuccess, resetTxState, executeStep])

  const handleClose = useCallback(() => {
    onClose()
  }, [onClose])

  // Start step when overlay opens
  useEffect(() => {
    // A frozen plan is an imperative wallet operation; there is no declarative
    // React primitive that can start it while retaining the existing overlay.
    if (plan) {
      if (!isOpen || !step || hasStartedRef.current || !isWalletConnectionReady || !account) return
      hasStartedRef.current = true
      void executePlannedStep()
      return
    }

    if (
      shouldStartStepOnOpen({
        isOpen,
        overlayState,
        hasStep: Boolean(step),
        hasStarted: hasStartedRef.current,
        isStepReady,
        isPermitStepReady: Boolean(isWalletConnectionReady && step?.isPermit && step.permitData),
        hasPrepareError: Boolean(step?.prepare.isError)
      })
    ) {
      hasStartedRef.current = true
      executeStep()
    }
  }, [account, executePlannedStep, executeStep, isOpen, isStepReady, isWalletConnectionReady, overlayState, plan, step])

  useEffect(() => {
    if (!isOpen || !isWaitingForNextStep || !step) return
    if (step.id === executedStepRef.current?.id) return
    if (!isStepReady) return

    setIsWaitingForNextStep(false)
    executeStep()
  }, [executeStep, isOpen, isStepReady, isWaitingForNextStep, step])

  useEffect(() => {
    const nextOverlayState = resolvePendingSafeOverlayState({
      overlayState,
      isWalletSafe,
      hasExecutionReceipt: Boolean(receipt.data?.transactionHash),
      safeTxStatus: safeTransactionDetails.data?.status,
      callsStatus: safeCallsStatus.data?.status
    })

    if (nextOverlayState === 'submitted') {
      setOverlayState('submitted')
      void updateNotificationById(notificationIdRef.current, { status: 'submitted', awaitingExecution: true })
      return
    }

    if (nextOverlayState === 'error') {
      const isConfirmedSafeFailure = isConfirmedSafeTransactionFailure({
        isWalletSafe,
        submittedTxHash: txHash,
        safeTxHash: safeTransactionDetails.data?.safeTxHash,
        safeTxStatus: safeTransactionDetails.data?.status
      })
      setOverlayState('error')
      setErrorMessage(
        isConfirmedSafeFailure
          ? 'Transaction failed in Safe. Please review your Safe queue and try again.'
          : 'Transaction failed. Please try again.'
      )
      resetTxState()
      void updateNotificationById(notificationIdRef.current, { status: 'error' })
      setActiveNotificationId(undefined)
    }
  }, [
    overlayState,
    isWalletSafe,
    txHash,
    receipt.data?.transactionHash,
    safeTransactionDetails.data?.safeTxHash,
    safeTransactionDetails.data?.status,
    safeCallsStatus.data?.status,
    updateNotificationById,
    resetTxState,
    setActiveNotificationId
  ])

  // Handle transaction success
  useEffect(() => {
    // For multi-step flows, wait until next step is ready before showing success
    // Check that step has changed (different label) and is ready
    const receiptHash = receipt.data?.transactionHash
    const isUnhandledReceipt = Boolean(
      receiptHash &&
        handledSuccessReceiptRef.current !== receiptHash &&
        processingSuccessReceiptRef.current !== receiptHash
    )

    if (receiptOutcome === 'success' && receiptHash && (overlayState === 'pending' || overlayState === 'submitted')) {
      executedStepBlockRef.current = receipt.data?.blockNumber
      if (!hasReportedStepSuccessRef.current && executedStepId) {
        hasReportedStepSuccessRef.current = true
        void reportStepSuccess(executedStepId)
      }
    }

    const isNextStepReady = step?.id !== executedStepRef.current?.id && isStepReady
    const canShowSuccess = wasLastStepRef.current || isNextStepReady
    if (
      receiptOutcome === 'success' &&
      receiptHash &&
      isUnhandledReceipt &&
      (overlayState === 'pending' || overlayState === 'submitted') &&
      canShowSuccess
    ) {
      processingSuccessReceiptRef.current = receiptHash

      if (
        shouldAutoContinueFromSuccessState({
          canShowSuccess,
          executedStepAutoContinues,
          wasLastStep: wasLastStepRef.current
        }) &&
        executedStepId
      ) {
        if (hasAdvancedFromStepRef.current === executedStepId) {
          processingSuccessReceiptRef.current = null
          return
        }
        if (hasAutoContinuedFromStepRef.current === executedStepId) {
          processingSuccessReceiptRef.current = null
          return
        }

        const persistAndAdvance = async () => {
          await updateNotificationById(notificationIdRef.current, {
            receipt: receipt.data ?? undefined,
            status: 'success'
          })
          setActiveNotificationId(undefined)
          handledSuccessReceiptRef.current = receiptHash
          processingSuccessReceiptRef.current = null

          hasAutoContinuedFromStepRef.current = executedStepId
          const nonceAtSchedule = autoContinueNonceRef.current
          setIsAutoContinuing(true)
          finalizeSuccessState(false, executedStepRef.current)
          await new Promise((resolve) => {
            window.setTimeout(resolve, AUTO_CONTINUE_SUCCESS_DELAY_MS)
          })
          if (autoContinueNonceRef.current !== nonceAtSchedule) {
            setIsAutoContinuing(false)
            return
          }
          const confirmDelayMs = getAutoContinueConfirmDelayMs({ isWalletSafe })
          if (confirmDelayMs > 0) {
            setOverlayState('confirming')
            await new Promise((resolve) => {
              window.setTimeout(resolve, confirmDelayMs)
            })
            if (autoContinueNonceRef.current !== nonceAtSchedule) {
              setIsAutoContinuing(false)
              return
            }
          }
          await waitForAutoContinueBlock(executedStepId)
          if (autoContinueNonceRef.current !== nonceAtSchedule) {
            setIsAutoContinuing(false)
            return
          }
          advanceToNextStep()
        }
        void persistAndAdvance()
        return
      }

      const completedAllSteps = executedStepRef.current?.completesFlow ?? wasLastStepRef.current
      const capturedStep = executedStepRef.current
      const capturedReceipt = receipt.data ?? undefined
      const isCrossChain = isCrossChainNotification(capturedStep?.notification)
      autoContinueNonceRef.current += 1
      setIsAutoContinuing(false)
      setIsWaitingForNextStep(false)

      if (isCrossChain) {
        const completionFlow = completionFlowRef.current
        void (async () => {
          const didPersistSourceConfirmation = await updateNotificationById(notificationIdRef.current, {
            receipt: capturedReceipt,
            status: 'submitted',
            bridgeStatus: 'pending'
          })
          const isBridgeTrackingAvailable = Boolean(
            didPersistSourceConfirmation && capturedStep?.notification?.bridgeProtocol
          )
          if (isBridgeTrackingAvailable) {
            setLocalBridgeTracking({ status: 'active' })
          } else {
            setLocalBridgeTracking({ status: 'unavailable', message: BRIDGE_TRACKING_UNAVAILABLE_MESSAGE })
          }
          handledSuccessReceiptRef.current = receiptHash
          processingSuccessReceiptRef.current = null
          setOverlayState('submitted')

          if (completedAllSteps && onBeforeSuccess) {
            try {
              await onBeforeSuccess(capturedStep?.id ?? '')
            } catch (error) {
              console.warn('[TransactionOverlay] Failed to refresh source-chain balances after confirmation', error)
            }
          }

          // Delivery may finish while the source-chain refresh is still running.
          // Preserve the delivery completion policy in that race.
          if (
            completionFlow !== completionFlowRef.current ||
            hasRunAllCompleteRef.current ||
            pendingCompletionRef.current !== 'none'
          ) {
            return
          }

          const completionDeferral = resolveCrossChainSourceCompletion({
            completedAllSteps,
            isBridgeTrackingAvailable,
            isOpen: isOpenRef.current,
            hasBridgeFailed: completionFlow.hasBridgeFailed
          })
          if (completionDeferral === 'after-close') {
            pendingCompletionRef.current = completionDeferral
          } else if (completionDeferral === 'immediate') {
            runAllComplete(completionFlow)
          }
        })()
        return
      }

      resetTxState()
      void (async () => {
        await updateNotificationById(notificationIdRef.current, { receipt: capturedReceipt, status: 'success' })
        setActiveNotificationId(undefined)
        handledSuccessReceiptRef.current = receiptHash
        processingSuccessReceiptRef.current = null

        if (completedAllSteps && onBeforeSuccess) {
          setOverlayState('refreshing')
          await onBeforeSuccess(capturedStep?.id ?? '')
          await new Promise((resolve) => setTimeout(resolve, 500))
          finalizeSuccessState(completedAllSteps, capturedStep)
          if (capturedStep?.showConfetti) {
            requestConfetti()
          }
        } else {
          finalizeSuccessState(completedAllSteps, capturedStep)
          if (capturedStep?.showConfetti) {
            requestConfetti()
          }
        }
      })()
    }
  }, [
    receiptOutcome,
    receipt.data?.transactionHash,
    overlayState,
    requestConfetti,
    updateNotificationById,
    reportStepSuccess,
    onBeforeSuccess,
    isStepReady,
    step?.id,
    resetTxState,
    autoContinueNonceRef,
    executedStepAutoContinues,
    executedStepId,
    executedStepLabel,
    advanceToNextStep,
    finalizeSuccessState,
    runAllComplete,
    isWalletSafe,
    waitForAutoContinueBlock,
    setActiveNotificationId
  ])

  // Bridge settlement is host-owned and arrives asynchronously through the notification runtime.
  useEffect(() => {
    if (overlayState !== 'submitted' || !trackedNotification?.bridgeStatus) return
    if (trackedNotification.status !== 'error' && trackedNotification.bridgeStatus !== 'failed') return

    completionFlowRef.current.hasBridgeFailed = true
    pendingCompletionRef.current = 'none'
    setOverlayState('error')
    setErrorMessage(trackedNotification.bridgeError || 'The cross-chain transaction failed.')
    setActiveNotificationId(undefined)
  }, [overlayState, setActiveNotificationId, trackedNotification])

  // Delivery can complete after navigation or a reload, so derive terminal UI from persisted host state.
  useEffect(() => {
    if (overlayState !== 'submitted') return
    if (trackedNotification?.status !== 'success' || trackedNotification.bridgeStatus !== 'delivered') return

    const completedStep = executedStepRef.current
    const completedAllSteps = completedStep?.completesFlow ?? wasLastStepRef.current
    finalizeSuccessState(completedAllSteps, completedStep)
    if (completedStep?.showConfetti) requestConfetti()
  }, [finalizeSuccessState, overlayState, requestConfetti, trackedNotification])

  useEffect(() => {
    if (
      !shouldAutoContinuePermitSuccess({
        overlayState,
        executedStepIsPermit: executedStepRef.current?.isPermit,
        executedStepAutoContinues,
        executedStepCompletesFlow,
        currentStepId: step?.id,
        executedStepId,
        isStepReady,
        hasAdvancedFromStep: hasAdvancedFromStepRef.current,
        hasAutoContinuedFromStep: hasAutoContinuedFromStepRef.current
      })
    ) {
      return
    }

    hasAutoContinuedFromStepRef.current = executedStepId ?? null
    setIsAutoContinuing(true)
    advanceToNextStep()
  }, [
    advanceToNextStep,
    executedStepAutoContinues,
    executedStepCompletesFlow,
    executedStepId,
    isStepReady,
    overlayState,
    step?.id
  ])

  // Handle transaction error
  useEffect(() => {
    if (receiptOutcome === 'error' && (overlayState === 'pending' || overlayState === 'submitted')) {
      setOverlayState('error')
      setErrorMessage('Transaction failed. Please try again.')
      resetTxState()

      // Update notification to error
      void updateNotificationById(notificationIdRef.current, { status: 'error' })
      setActiveNotificationId(undefined)
    }
  }, [receiptOutcome, overlayState, resetTxState, setActiveNotificationId, updateNotificationById])

  // When step 1 succeeds in a multi-step flow, the next step simulation may need a refetch
  // to pick up post-transaction state (e.g. unstake -> withdraw).
  useEffect(() => {
    if (
      !shouldRefetchNextStepAfterReceipt({
        isOpen,
        overlayState,
        hasReceiptTransactionHash: Boolean(receipt.data?.transactionHash),
        wasLastStep: wasLastStepRef.current,
        currentStepId: step?.id,
        executedStepId: executedStepRef.current?.id,
        isStepReady
      })
    ) {
      return
    }

    const refetch = step?.prepare.refetch
    if (!refetch) return

    void refetch()
    const intervalId = window.setInterval(() => {
      void refetch()
    }, 1500)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [isOpen, overlayState, receipt.data?.transactionHash, step?.id, step?.prepare.refetch, isStepReady])

  const transactionErrorPresentation = getPlannedTransactionErrorPresentation(
    plan ? plannedFailureKind : 'pre-submission',
    errorMessage
  )
  const displayedErrorPresentation = failedStepSuccessId
    ? {
        title: 'Next step unavailable',
        message: errorMessage,
        actionLabel: 'Retry next step',
        canRetry: true
      }
    : transactionErrorPresentation

  if (!isOpen) {
    return null
  }

  return (
    <div
      className="absolute z-50"
      style={{
        top: 0, // Cover the tabs
        left: 0,
        right: 0,
        bottom: 0,
        pointerEvents: 'auto'
      }}
    >
      {/* Semi-transparent backdrop with fade animation */}
      <div className="absolute inset-0 bg-black/5 rounded-lg transition-opacity duration-200 opacity-100" />
      {/* Overlay content with slide and fade animation */}
      <div className="absolute inset-0 bg-surface rounded-lg transition-all duration-300 ease-out flex flex-col opacity-100 translate-y-0">
        {/* Close button - only shown in success/error/submitted states */}
        {(overlayState === 'success' || overlayState === 'error' || overlayState === 'submitted') && (
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 p-1 hover:bg-surface-secondary rounded-lg transition-colors z-10"
            type="button"
          >
            <svg className="w-5 h-5 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}

        {/* Content */}
        <div
          className={cl(
            'flex-1 flex flex-col items-center p-6 text-center',
            contentAlign === 'center' ? 'justify-center' : 'justify-start pt-8'
          )}
        >
          {/* Confirming State */}
          {overlayState === 'confirming' && (
            <>
              <Spinner />
              <h3 className="text-lg font-semibold text-text-primary mt-6 mb-2">Confirm in your wallet</h3>
              <p className="text-sm text-text-secondary whitespace-pre-line">
                {executedStepRef.current?.confirmMessage}
              </p>
            </>
          )}

          {/* Pending State */}
          {overlayState === 'pending' && (
            <>
              <Spinner />
              <h3 className="text-lg font-semibold text-text-primary mt-6 mb-2">
                {getPendingTransactionTitle({
                  isPreparingNextStep,
                  functionName: executedStepFunctionName,
                  fallbackLabel: executedStepLabel
                })}
              </h3>
              <p className="text-sm text-text-secondary">
                {isPreparingNextStep ? 'Preparing next step...' : 'Waiting for confirmation...'}
              </p>
              {explorerTxUrl ? (
                <a
                  href={explorerTxUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 text-sm font-semibold text-text-primary underline"
                >
                  View on block explorer
                </a>
              ) : null}
            </>
          )}

          {/* Refreshing State */}
          {overlayState === 'refreshing' && (
            <>
              <Spinner />
              <h3 className="text-lg font-semibold text-text-primary mt-6 mb-2">Transaction confirmed</h3>
              <p className="text-sm text-text-secondary">Updating balances...</p>
              {explorerTxUrl ? (
                <a
                  href={explorerTxUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 text-sm font-semibold text-text-primary underline"
                >
                  View on block explorer
                </a>
              ) : null}
            </>
          )}

          {/* Submitted State */}
          {overlayState === 'submitted' && (
            <>
              {bridgeTrackingUnavailable ? <AnimatedCheckmark isVisible /> : <Spinner />}
              <h3 className="text-lg font-semibold text-text-primary mt-6 mb-2">{submittedTitle}</h3>
              <p className="text-sm text-text-secondary whitespace-pre-line">{submittedDetail}</p>
              {bridgeTrackerLink ? (
                <a
                  href={bridgeTrackerLink.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 text-sm font-semibold text-text-primary underline"
                >
                  {bridgeTrackerLink.label}
                </a>
              ) : null}
              {explorerTxUrl ? (
                <a
                  href={explorerTxUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 text-sm font-semibold text-text-primary underline"
                >
                  View source transaction
                </a>
              ) : null}
            </>
          )}

          {/* Success State */}
          {overlayState === 'success' && (
            <>
              <div className="relative">
                <span id={confettiId} className="absolute top-1/2 left-1/2" />
                <AnimatedCheckmark isVisible />
              </div>
              <h3 className="text-lg font-semibold text-text-primary mt-6 mb-2">{successTitle}</h3>
              <p className="text-sm text-text-secondary whitespace-pre-line mb-6">{successMessage}</p>
              {isBridgeDelivered && destinationExplorerTxUrl ? (
                <a
                  href={destinationExplorerTxUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mb-6 text-sm font-semibold text-text-primary underline"
                >
                  View destination transaction
                </a>
              ) : null}
              <Button
                onClick={handleNextStep}
                variant={isSuccessButtonBusy ? 'busy' : 'filled'}
                isBusy={isSuccessButtonBusy}
                disabled={isSuccessButtonBusy}
                className="w-full max-w-xs"
                classNameOverride="yearn--button--nextgen w-full"
              >
                {successButtonLabel}
              </Button>
            </>
          )}

          {/* Error State */}
          {overlayState === 'error' && (
            <>
              <ErrorIcon />
              <h3 className="text-lg font-semibold text-text-primary mt-6 mb-2">{displayedErrorPresentation.title}</h3>
              <p className={cl('text-sm text-text-secondary', explorerTxUrl ? 'mb-3' : 'mb-6')}>
                {displayedErrorPresentation.message}
              </p>
              {explorerTxUrl ? (
                <a
                  href={explorerTxUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mb-6 text-sm font-semibold text-text-primary underline"
                >
                  View on block explorer
                </a>
              ) : null}
              <Button
                onClick={displayedErrorPresentation.canRetry ? handleRetry : handleClose}
                variant="filled"
                className="w-full max-w-xs"
                classNameOverride="yearn--button--nextgen w-full"
              >
                {displayedErrorPresentation.actionLabel}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
