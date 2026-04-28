import { Button } from '@shared/components/Button'
import { useNotificationsActions } from '@shared/contexts/useNotificationsActions'
import {
  type AppUseSimulateContractReturnType,
  useChainId,
  useSwitchChain,
  useWaitForTransactionReceipt
} from '@shared/hooks/useAppWagmi'
import { useSafeTransactionDetails } from '@shared/hooks/useSafeTransactionDetails'
import type { TCreateNotificationParams } from '@shared/types/notifications'
import { cl } from '@shared/utils'
import { getNetwork, retrieveConfig } from '@shared/utils/wagmi'
import { getPublicClient } from '@wagmi/core'
import { type FC, useCallback, useEffect, useId, useRef, useState } from 'react'
import { useReward } from 'react-rewards'
import type { TypedData, TypedDataDomain } from 'viem'
import { useAccount, useCallsStatus, useSignTypedData, useWriteContract } from 'wagmi'
import { isConnectedToExecutionChain } from '@/config/tenderly'
import { AnimatedCheckmark, ErrorIcon, Spinner } from './TransactionStateIndicators'
import {
  type CompletionDeferral,
  getPendingTransactionTitle,
  type OverlayState,
  resolveCompletionDeferral,
  resolveExecutionTrackingHash,
  resolveOverlayConnectedChainId,
  resolvePendingSafeOverlayState,
  shouldAutoContinuePermitSuccess,
  shouldRunDeferredCompletion
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

export type TransactionStep = {
  prepare: AppUseSimulateContractReturnType
  label: string
  confirmMessage: string
  successTitle: string
  successMessage: string
  completesFlow?: boolean
  showConfetti?: boolean
  notification?: TCreateNotificationParams
  // Permit-specific fields
  isPermit?: boolean
  permitData?: PermitData
  onPermitSigned?: (signature: `0x${string}`) => void
}

type TPrepareDebugInfo = {
  isSuccess: boolean
  isError: boolean
  isLoading: boolean
  isFetching: boolean
  status: AppUseSimulateContractReturnType['status']
  error?: string
  request?: {
    chainId?: number
    address?: unknown
    functionName?: unknown
  }
}

function getPrepareDebugInfo(prepare?: AppUseSimulateContractReturnType): TPrepareDebugInfo | undefined {
  if (!prepare) return undefined
  const request = prepare.data?.request as any

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
  step?: TransactionStep
  isLastStep?: boolean
  onAllComplete?: () => void
  deferOnAllCompleteUntilClose?: boolean
  deferOnAllCompleteUntilConfettiEnd?: boolean
  onStepSuccess?: (label: string) => void
  /**
   * Called after the final transaction is confirmed, before the success screen
   * is shown. The overlay stays in a "refreshing" state while this resolves.
   * Use this to await balance/data refetches so the success screen renders
   * with fresh data and no background work remaining.
   */
  onBeforeSuccess?: (label: string) => Promise<void>
  topOffset?: string
  contentAlign?: 'center' | 'start'
  autoContinueToNextStep?: boolean
  autoContinueStepLabels?: string[]
}

export const TransactionOverlay: FC<TransactionOverlayProps> = ({
  isOpen,
  onClose,
  step,
  isLastStep = true,
  onAllComplete,
  deferOnAllCompleteUntilClose = false,
  deferOnAllCompleteUntilConfettiEnd = false,
  onStepSuccess,
  onBeforeSuccess,
  contentAlign = 'center',
  autoContinueToNextStep = false,
  autoContinueStepLabels = []
}) => {
  const [overlayState, setOverlayState] = useState<OverlayState>('success')
  const [errorMessage, setErrorMessage] = useState<string>('')
  const [hasCompletedFlow, setHasCompletedFlow] = useState(false)
  const [completedStepSnapshot, setCompletedStepSnapshot] = useState<TransactionStep | null>(null)

  const writeContract = useWriteContract()
  const { signTypedDataAsync } = useSignTypedData()
  const currentChainId = useChainId()
  const { switchChainAsync } = useSwitchChain()
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>()
  const { address: account, chain, connector } = useAccount()
  const isWalletSafe = connector?.id.toLowerCase().includes('safe') ?? false
  const connectedChainId = resolveOverlayConnectedChainId({
    accountChainId: chain?.id,
    currentChainId,
    targetChainId: ((step?.prepare.data?.request as any)?.chainId as number | undefined) ?? undefined,
    isWalletSafe
  })

  // Notification system integration
  const { createNotification, updateNotification } = useNotificationsActions()
  const [notificationId, setNotificationId] = useState<number | undefined>()

  // Fast chains like BASE need extra confirmations
  const confirmations = currentChainId === 8453 ? 2 : 1

  // Track the step that was just executed (for showing success messages)
  const executedStepRef = useRef<TransactionStep | null>(null)

  const explorerChainId =
    ((executedStepRef.current?.prepare.data?.request as any)?.chainId as number | undefined) ?? undefined
  const safeTransactionDetails = useSafeTransactionDetails({
    safeTxHash: isWalletSafe ? txHash : undefined,
    enabled: Boolean(isWalletSafe && txHash && (overlayState === 'pending' || overlayState === 'submitted'))
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
  const receipt = useWaitForTransactionReceipt({ hash: executionTrackingHash, chainId: explorerChainId, confirmations })
  const blockExplorer = getNetwork(explorerChainId ?? currentChainId).defaultBlockExplorer
  const explorerTxUrl = executionTrackingHash && blockExplorer ? `${blockExplorer}/tx/${executionTrackingHash}` : ''

  // Track if the executed step was the last step (captured at execution time)
  const wasLastStepRef = useRef(false)
  const executedStepBlockRef = useRef<bigint | undefined>(undefined)

  // Check if current step is ready to execute
  const isStepReady = Boolean(step?.prepare.isSuccess && step?.prepare.data?.request)
  const executedStepLabel = executedStepRef.current?.label
  const executedStepFunctionName = (
    executedStepRef.current?.prepare.data?.request as { functionName?: unknown } | undefined
  )?.functionName
  const executedStepAutoContinues = Boolean(
    executedStepLabel &&
      autoContinueToNextStep &&
      (autoContinueStepLabels.length === 0 || autoContinueStepLabels.includes(executedStepLabel))
  )

  // Track if we've started execution to prevent re-triggering
  const hasStartedRef = useRef(false)
  const hasAutoContinuedFromStepRef = useRef<string | null>(null)
  const hasReportedStepSuccessRef = useRef(false)
  const hasAdvancedFromStepRef = useRef<string | null>(null)
  const autoContinueNonceRef = useRef(0)
  const writeContractResetRef = useRef(writeContract.reset)
  const pendingCompletionRef = useRef<CompletionDeferral>('none')
  const [isAutoContinuing, setIsAutoContinuing] = useState(false)

  useEffect(() => {
    writeContractResetRef.current = writeContract.reset
  }, [writeContract.reset])

  const runAllCompleteIfPending = useCallback(
    (trigger: 'close' | 'confetti') => {
      if (
        !shouldRunDeferredCompletion({
          completionDeferral: pendingCompletionRef.current,
          trigger
        })
      ) {
        return
      }

      pendingCompletionRef.current = 'none'
      onAllComplete?.()
    },
    [onAllComplete]
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

      pendingCompletionRef.current = 'none'
      onAllComplete?.()
    },
    [deferOnAllCompleteUntilClose, deferOnAllCompleteUntilConfettiEnd, onAllComplete]
  )

  const setStepExecutionContext = useCallback((nextStep: TransactionStep, nextIsLastStep: boolean) => {
    executedStepRef.current = nextStep
    wasLastStepRef.current = nextStep.completesFlow ?? nextIsLastStep
    hasReportedStepSuccessRef.current = false
    hasAdvancedFromStepRef.current = null
    setCompletedStepSnapshot(null)
  }, [])

  const resetTxState = useCallback((clearNotification = false) => {
    writeContractResetRef.current()
    setTxHash(undefined)
    if (clearNotification) {
      setNotificationId(undefined)
    }
  }, [])

  // Reset state when overlay closes
  useEffect(() => {
    if (!isOpen) {
      runAllCompleteIfPending('close')
      setOverlayState('idle')
      setErrorMessage('')
      setHasCompletedFlow(false)
      setCompletedStepSnapshot(null)
      resetTxState(true)
      hasStartedRef.current = false
      hasAutoContinuedFromStepRef.current = null
      hasReportedStepSuccessRef.current = false
      hasAdvancedFromStepRef.current = null
      executedStepRef.current = null
      wasLastStepRef.current = false
      executedStepBlockRef.current = undefined
      pendingCompletionRef.current = 'none'
      autoContinueNonceRef.current += 1
      setIsAutoContinuing(false)
    }
  }, [isOpen, resetTxState, runAllCompleteIfPending])

  // Create notification with txHash (called after signing succeeds)
  const handleCreateNotification = useCallback(
    async (
      txHash: `0x${string}`,
      notification?: TCreateNotificationParams,
      executionChainId?: number,
      status: 'pending' | 'submitted' = 'pending'
    ): Promise<number | undefined> => {
      if (!notification || !account) return undefined

      try {
        const id = await createNotification({
          ...notification,
          executionChainId: executionChainId ?? notification.executionChainId
        })
        setNotificationId(id)
        await updateNotification({ id, txHash, status })
        return id
      } catch (error) {
        console.error('Failed to create notification:', error)
        return undefined
      }
    },
    [account, createNotification, updateNotification]
  )

  // Update notification with new status/receipt
  const handleUpdateNotification = useCallback(
    async (params: {
      status?: 'pending' | 'submitted' | 'success' | 'error'
      receipt?: any
      awaitingExecution?: boolean
    }) => {
      if (!notificationId) return

      try {
        await updateNotification({
          id: notificationId,
          status: params.status,
          receipt: params.receipt,
          awaitingExecution: params.awaitingExecution
        })
      } catch (error) {
        console.error('Failed to update notification:', error)
      }
    },
    [notificationId, updateNotification]
  )

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
        if (!hasReportedStepSuccessRef.current && currentStep.label) {
          hasReportedStepSuccessRef.current = true
          onStepSuccess?.(currentStep.label)
        }
        finalizeSuccessState(completedAllSteps, currentStep)

        if (currentStep.showConfetti) {
          setTimeout(() => reward(), 100)
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
    [finalizeSuccessState, isLastStep, onClose, onStepSuccess, reward, setStepExecutionContext, signTypedDataAsync]
  )

  const executeContractStep = useCallback(
    async (currentStep: TransactionStep) => {
      if (!currentStep.prepare.isSuccess || !currentStep.prepare.data?.request) {
        console.warn('[TransactionOverlay] Transaction not ready', getStepDebugInfo(currentStep))
        setOverlayState('error')
        setErrorMessage('Transaction not ready. Please try again.')
        return
      }

      setStepExecutionContext(currentStep, isLastStep)
      setOverlayState('confirming')
      setErrorMessage('')

      const request = currentStep.prepare.data.request as any
      const txChainId = request.chainId
      const wrongNetwork = txChainId && !isConnectedToExecutionChain(connectedChainId, txChainId)

      if (wrongNetwork && txChainId) {
        try {
          await switchChainAsync({ chainId: txChainId })
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

      const isEnsoOrder = Boolean(request.__isEnsoOrder)
      const isCrossChain = currentStep.notification?.type === 'crosschain zap'

      try {
        if (isEnsoOrder) {
          const customWriteAsync = request.writeContractAsync
          const result = await customWriteAsync()
          if (!result.hash) {
            return
          }

          if (isCrossChain) {
            await handleCreateNotification(result.hash, currentStep.notification, txChainId, 'submitted')
            if (currentStep.showConfetti) {
              setTimeout(() => reward(), 100)
            }
            setNotificationId(undefined)
            const completedAllSteps = executedStepRef.current?.completesFlow ?? wasLastStepRef.current
            finalizeSuccessState(completedAllSteps, currentStep)
            return
          }

          setTxHash(result.hash)
          setOverlayState('pending')
          await handleCreateNotification(result.hash, currentStep.notification, txChainId)
          return
        }

        const gasEstimateClient = txChainId ? getPublicClient(retrieveConfig(), { chainId: txChainId }) : undefined
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
          ...gasOverrides
        })
        setTxHash(hash)
        setOverlayState('pending')
        await handleCreateNotification(hash, currentStep.notification, txChainId)
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
      finalizeSuccessState,
      handleCreateNotification,
      isLastStep,
      onClose,
      reward,
      setStepExecutionContext,
      switchChainAsync,
      writeContract
    ]
  )

  const executeStep = useCallback(async () => {
    if (!step) {
      console.warn('[TransactionOverlay] Execute called without step')
      return
    }

    if (step.isPermit && step.permitData) {
      await executePermitStep(step)
      return
    }

    await executeContractStep(step)
  }, [executeContractStep, executePermitStep, step])

  const advanceToNextStep = useCallback(() => {
    const executedStepLabel = executedStepRef.current?.label
    if (!executedStepLabel) return
    if (hasAdvancedFromStepRef.current === executedStepLabel) return

    hasAdvancedFromStepRef.current = executedStepLabel
    autoContinueNonceRef.current += 1
    setIsAutoContinuing(false)

    // Reset for next step - parent will provide the new step
    resetTxState()
    executeStep()
  }, [resetTxState, executeStep])

  const waitForAutoContinueBlock = useCallback(async (executedStepLabel?: string) => {
    // Most flows can continue immediately once the next simulation is ready.
    // Unstake -> withdraw can race state propagation, so wait one block there.
    if (executedStepLabel !== 'Unstake') return

    const executedBlockNumber = executedStepBlockRef.current
    const executedChainId =
      ((executedStepRef.current?.prepare.data?.request as any)?.chainId as number | undefined) ?? undefined
    const blockClient = executedChainId ? getPublicClient(retrieveConfig(), { chainId: executedChainId }) : undefined
    if (!blockClient || executedBlockNumber === undefined) return

    const targetBlock = executedBlockNumber + 1n
    const timeoutMs = 20_000
    const pollIntervalMs = 1_000
    const startedAt = Date.now()

    while (Date.now() - startedAt < timeoutMs) {
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
    }
  }, [])

  useEffect(() => {
    if (step?.prepare.isError) {
      console.error('[TransactionOverlay] Prepare failed', getStepDebugInfo(step))
    }
  }, [step?.prepare.isError, step?.prepare.error, step?.label])

  const successStep = completedStepSnapshot ?? executedStepRef.current
  const executedStepCompletesFlow = successStep?.completesFlow ?? wasLastStepRef.current
  const isTerminalSuccess = overlayState === 'success' && (hasCompletedFlow || executedStepCompletesFlow)
  const isPreparingNextStep =
    overlayState === 'pending' && receipt.isSuccess && !wasLastStepRef.current && executedStepAutoContinues
  const isSuccessButtonBusy = !isTerminalSuccess && (!isStepReady || isAutoContinuing)
  const successButtonLabel = getSuccessButtonLabel({
    isCrossChainNotification: successStep?.notification?.type === 'crosschain zap',
    isTerminalSuccess,
    isAutoContinuing,
    executedStepAutoContinues,
    currentStepLabel: step?.label
  })

  const handleNextStep = useCallback(() => {
    if (isAutoContinuing) return

    if (isTerminalSuccess) {
      onClose()
    } else {
      advanceToNextStep()
    }
  }, [isAutoContinuing, isTerminalSuccess, onClose, advanceToNextStep])

  const handleRetry = useCallback(() => {
    resetTxState()
    executeStep()
  }, [resetTxState, executeStep])

  const handleClose = useCallback(() => {
    onClose()
  }, [onClose])

  // Start step when overlay opens
  useEffect(() => {
    if (isOpen && overlayState === 'idle' && step && !hasStartedRef.current) {
      hasStartedRef.current = true
      executeStep()
    }
  }, [isOpen, overlayState, step, executeStep])

  useEffect(() => {
    const nextOverlayState = resolvePendingSafeOverlayState({
      overlayState,
      isWalletSafe,
      hasExecutionReceipt: Boolean(receipt.data?.transactionHash),
      safeTxStatus: safeTransactionDetails.data?.txStatus,
      callsStatus: safeCallsStatus.data?.status
    })

    if (nextOverlayState === 'submitted') {
      setOverlayState('submitted')
      void handleUpdateNotification({ status: 'submitted', awaitingExecution: true })
      return
    }

    if (nextOverlayState === 'error') {
      setOverlayState('error')
      setErrorMessage('Transaction failed in Safe. Please review your Safe queue and try again.')
      resetTxState()
      void handleUpdateNotification({ status: 'error' })
      setNotificationId(undefined)
    }
  }, [
    overlayState,
    isWalletSafe,
    receipt.data?.transactionHash,
    safeTransactionDetails.data?.txStatus,
    safeCallsStatus.data?.status,
    handleUpdateNotification,
    resetTxState
  ])

  // Handle transaction success
  useEffect(() => {
    // For multi-step flows, wait until next step is ready before showing success
    // Check that step has changed (different label) and is ready
    if (
      receipt.isSuccess &&
      receipt.data?.transactionHash &&
      (overlayState === 'pending' || overlayState === 'submitted')
    ) {
      executedStepBlockRef.current = receipt.data.blockNumber
      const executedStepLabel = executedStepRef.current?.label
      if (!hasReportedStepSuccessRef.current && executedStepLabel) {
        hasReportedStepSuccessRef.current = true
        onStepSuccess?.(executedStepLabel)
      }
    }

    const isNextStepReady = step?.label !== executedStepRef.current?.label && isStepReady
    const canShowSuccess = wasLastStepRef.current || isNextStepReady
    if (
      receipt.isSuccess &&
      receipt.data?.transactionHash &&
      (overlayState === 'pending' || overlayState === 'submitted') &&
      canShowSuccess
    ) {
      if (executedStepLabel && executedStepAutoContinues && !wasLastStepRef.current) {
        if (hasAdvancedFromStepRef.current === executedStepLabel) {
          return
        }
        if (hasAutoContinuedFromStepRef.current === executedStepLabel) {
          return
        }

        handleUpdateNotification({ receipt: receipt.data, status: 'success' })
        setNotificationId(undefined)

        hasAutoContinuedFromStepRef.current = executedStepLabel
        const nonceAtSchedule = autoContinueNonceRef.current
        setIsAutoContinuing(true)
        const advance = async () => {
          await waitForAutoContinueBlock(executedStepLabel)
          if (autoContinueNonceRef.current !== nonceAtSchedule) {
            setIsAutoContinuing(false)
            return
          }
          advanceToNextStep()
        }
        void advance()
        return
      }

      const completedAllSteps = executedStepRef.current?.completesFlow ?? wasLastStepRef.current
      const capturedStep = executedStepRef.current
      const capturedReceipt = receipt.data
      resetTxState()

      // Update notification to success
      handleUpdateNotification({ receipt: capturedReceipt, status: 'success' })
      setNotificationId(undefined)

      if (completedAllSteps && onBeforeSuccess) {
        setOverlayState('refreshing')
        void (async () => {
          await onBeforeSuccess(capturedStep?.label ?? '')
          await new Promise((resolve) => setTimeout(resolve, 500))
          finalizeSuccessState(completedAllSteps, capturedStep)
          if (capturedStep?.showConfetti) {
            setTimeout(() => reward(), 100)
          }
        })()
      } else {
        finalizeSuccessState(completedAllSteps, capturedStep)
        if (capturedStep?.showConfetti) {
          setTimeout(() => reward(), 100)
        }
      }
    }
  }, [
    receipt.isSuccess,
    receipt.data?.transactionHash,
    overlayState,
    reward,
    handleUpdateNotification,
    onStepSuccess,
    onBeforeSuccess,
    isStepReady,
    step?.label,
    resetTxState,
    autoContinueNonceRef,
    executedStepAutoContinues,
    executedStepLabel,
    advanceToNextStep,
    finalizeSuccessState,
    waitForAutoContinueBlock
  ])

  useEffect(() => {
    if (
      !shouldAutoContinuePermitSuccess({
        overlayState,
        executedStepIsPermit: executedStepRef.current?.isPermit,
        executedStepAutoContinues,
        executedStepCompletesFlow,
        currentStepLabel: step?.label,
        executedStepLabel,
        isStepReady,
        hasAdvancedFromStep: hasAdvancedFromStepRef.current,
        hasAutoContinuedFromStep: hasAutoContinuedFromStepRef.current
      })
    ) {
      return
    }

    hasAutoContinuedFromStepRef.current = executedStepLabel ?? null
    setIsAutoContinuing(true)
    advanceToNextStep()
  }, [
    advanceToNextStep,
    executedStepAutoContinues,
    executedStepCompletesFlow,
    executedStepLabel,
    isStepReady,
    overlayState,
    step?.label
  ])

  // Handle transaction error
  useEffect(() => {
    if (receipt.isError && receipt.error && (overlayState === 'pending' || overlayState === 'submitted')) {
      setOverlayState('error')
      setErrorMessage('Transaction failed. Please try again.')
      resetTxState()

      // Update notification to error
      handleUpdateNotification({ status: 'error' })
      setNotificationId(undefined)
    }
  }, [receipt.isError, receipt.error, overlayState, handleUpdateNotification, resetTxState])

  // When step 1 succeeds in a multi-step flow, the next step simulation may need a refetch
  // to pick up post-transaction state (e.g. unstake -> withdraw).
  useEffect(() => {
    if (!isOpen || overlayState !== 'pending') return
    if (!receipt.isSuccess || !receipt.data?.transactionHash) return
    if (wasLastStepRef.current) return
    if (!step?.label || step.label === executedStepRef.current?.label) return
    if (isStepReady) return

    const refetch = step.prepare.refetch
    if (!refetch) return

    void refetch()
    const intervalId = window.setInterval(() => {
      void refetch()
    }, 1500)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [
    isOpen,
    overlayState,
    receipt.isSuccess,
    receipt.data?.transactionHash,
    step?.label,
    step?.prepare.refetch,
    isStepReady
  ])

  return (
    <div
      className="absolute z-50"
      style={{
        top: 0, // Cover the tabs
        left: 0,
        right: 0,
        bottom: 0,
        pointerEvents: isOpen ? 'auto' : 'none'
      }}
    >
      {/* Semi-transparent backdrop with fade animation */}
      <div
        className={cl(
          'absolute inset-0 bg-black/5 rounded-lg transition-opacity duration-200',
          isOpen ? 'opacity-100' : 'opacity-0'
        )}
      />
      {/* Overlay content with slide and fade animation */}
      <div
        className={cl(
          'absolute inset-0 bg-surface rounded-lg transition-all duration-300 ease-out flex flex-col',
          isOpen ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
        )}
      >
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
              <AnimatedCheckmark isVisible />
              <h3 className="text-lg font-semibold text-text-primary mt-6 mb-2">Transaction submitted</h3>
              <p className="text-sm text-text-secondary whitespace-pre-line mb-6">
                {`Your transaction has been submitted to your Safe.
Execution may happen separately after the required confirmations are collected.`}
              </p>
              <Button
                onClick={handleClose}
                variant="filled"
                className="w-full max-w-xs"
                classNameOverride="yearn--button--nextgen w-full"
              >
                Done
              </Button>
            </>
          )}

          {/* Success State */}
          {overlayState === 'success' && (
            <>
              <div className="relative">
                <span id={confettiId} className="absolute top-1/2 left-1/2" />
                <AnimatedCheckmark isVisible />
              </div>
              <h3 className="text-lg font-semibold text-text-primary mt-6 mb-2">{successStep?.successTitle}</h3>
              <p className="text-sm text-text-secondary whitespace-pre-line mb-6">{successStep?.successMessage}</p>
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
              <h3 className="text-lg font-semibold text-text-primary mt-6 mb-2">Transaction failed</h3>
              <p className="text-sm text-text-secondary mb-6">{errorMessage}</p>
              <Button
                onClick={handleRetry}
                variant="filled"
                className="w-full max-w-xs"
                classNameOverride="yearn--button--nextgen w-full"
              >
                Try Again
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
