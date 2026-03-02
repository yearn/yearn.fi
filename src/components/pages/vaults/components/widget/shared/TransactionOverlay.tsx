import { Button } from '@shared/components/Button'
import { useNotificationsActions } from '@shared/contexts/useNotificationsActions'
import type { TCreateNotificationParams } from '@shared/types/notifications'
import { cl } from '@shared/utils'
import { getNetwork } from '@shared/utils/wagmi'
import { type FC, useCallback, useEffect, useId, useRef, useState } from 'react'
import { useReward } from 'react-rewards'
import type { TypedData, TypedDataDomain } from 'viem'
import {
  type UseSimulateContractReturnType,
  useAccount,
  useChainId,
  usePublicClient,
  useSignTypedData,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWriteContract
} from 'wagmi'
import { AnimatedCheckmark, ErrorIcon, Spinner } from './TransactionStateIndicators'

type OverlayState = 'idle' | 'confirming' | 'pending' | 'success' | 'error'

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
  prepare: UseSimulateContractReturnType
  label: string
  confirmMessage: string
  successTitle: string
  successMessage: string
  showConfetti?: boolean
  notification?: TCreateNotificationParams
  // Permit-specific fields
  isPermit?: boolean
  permitData?: PermitData
  onPermitSigned?: (signature: `0x${string}`) => void
}

const getPrepareDebugInfo = (prepare?: UseSimulateContractReturnType) => {
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

const getStepDebugInfo = (step?: TransactionStep) => {
  if (!step) return { step: 'missing' }
  return {
    label: step.label,
    isPermit: step.isPermit,
    prepare: getPrepareDebugInfo(step.prepare)
  }
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
  onStepSuccess?: (label: string) => void
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
  onStepSuccess,
  contentAlign = 'center',
  autoContinueToNextStep = false,
  autoContinueStepLabels = []
}) => {
  const [overlayState, setOverlayState] = useState<OverlayState>('success')
  const [errorMessage, setErrorMessage] = useState<string>('')

  const writeContract = useWriteContract()
  const { signTypedDataAsync } = useSignTypedData()
  const currentChainId = useChainId()
  const { switchChainAsync } = useSwitchChain()
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>()
  const client = usePublicClient()
  const { address: account } = useAccount()

  // Notification system integration
  const { createNotification, updateNotification } = useNotificationsActions()
  const [notificationId, setNotificationId] = useState<number | undefined>()

  // Fast chains like BASE need extra confirmations
  const confirmations = currentChainId === 8453 ? 2 : 1

  // Track the step that was just executed (for showing success messages)
  const executedStepRef = useRef<TransactionStep | null>(null)

  const receipt = useWaitForTransactionReceipt({ hash: txHash, confirmations })
  const explorerChainId =
    ((executedStepRef.current?.prepare.data?.request as any)?.chainId as number | undefined) ?? currentChainId
  const blockExplorer = explorerChainId ? getNetwork(explorerChainId).defaultBlockExplorer : ''
  const explorerTxUrl = txHash && blockExplorer ? `${blockExplorer}/tx/${txHash}` : ''

  // Track if the executed step was the last step (captured at execution time)
  const wasLastStepRef = useRef(false)
  const executedStepBlockRef = useRef<bigint | undefined>(undefined)

  // Check if current step is ready to execute
  const isStepReady = step?.prepare.isSuccess && !!step?.prepare.data?.request

  const confettiId = useId()
  const { reward } = useReward(confettiId, 'confetti', {
    spread: 80,
    elementCount: 80,
    startVelocity: 35,
    decay: 0.91,
    lifetime: 200,
    colors: ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899']
  })

  // Track if we've started execution to prevent re-triggering
  const hasStartedRef = useRef(false)
  const hasAutoContinuedFromStepRef = useRef<string | null>(null)
  const hasReportedStepSuccessRef = useRef(false)
  const hasAdvancedFromStepRef = useRef<string | null>(null)
  const autoContinueNonceRef = useRef(0)
  const writeContractResetRef = useRef(writeContract.reset)
  const [isAutoContinuing, setIsAutoContinuing] = useState(false)

  useEffect(() => {
    writeContractResetRef.current = writeContract.reset
  }, [writeContract.reset])

  const setStepExecutionContext = useCallback((nextStep: TransactionStep, nextIsLastStep: boolean) => {
    executedStepRef.current = nextStep
    wasLastStepRef.current = nextIsLastStep
    hasReportedStepSuccessRef.current = false
    hasAdvancedFromStepRef.current = null
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
      setOverlayState('idle')
      setErrorMessage('')
      resetTxState(true)
      hasStartedRef.current = false
      hasAutoContinuedFromStepRef.current = null
      hasReportedStepSuccessRef.current = false
      hasAdvancedFromStepRef.current = null
      executedStepRef.current = null
      wasLastStepRef.current = false
      executedStepBlockRef.current = undefined
      autoContinueNonceRef.current += 1
      setIsAutoContinuing(false)
    }
  }, [isOpen, resetTxState])

  // Create notification with txHash (called after signing succeeds)
  const handleCreateNotification = useCallback(
    async (
      txHash: `0x${string}`,
      notification?: TCreateNotificationParams,
      status: 'pending' | 'submitted' = 'pending'
    ): Promise<number | undefined> => {
      if (!notification || !account) return undefined

      try {
        const id = await createNotification(notification)
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
    async (params: { status?: 'pending' | 'success' | 'error'; receipt?: any }) => {
      if (!notificationId) return

      try {
        await updateNotification({
          id: notificationId,
          status: params.status,
          receipt: params.receipt
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
        setOverlayState('success')

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
    [isLastStep, onClose, reward, setStepExecutionContext, signTypedDataAsync]
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
      const wrongNetwork = txChainId && currentChainId !== txChainId

      if (wrongNetwork && txChainId) {
        try {
          console.info('[TransactionOverlay] Switching chain', {
            from: currentChainId,
            to: txChainId,
            step: currentStep.label
          })
          await switchChainAsync({ chainId: txChainId })
        } catch {
          console.warn('[TransactionOverlay] Chain switch rejected', { to: txChainId, step: currentStep.label })
          onClose()
          return
        }
      }

      const isEnsoOrder = Boolean(request.__isEnsoOrder)
      const isCrossChain = currentStep.notification?.type === 'crosschain zap'

      try {
        if (isEnsoOrder) {
          console.info('[TransactionOverlay] Executing Enso order', {
            step: currentStep.label,
            isCrossChain
          })

          const customWriteAsync = request.writeContractAsync
          const result = await customWriteAsync()
          if (!result.hash) {
            return
          }

          if (isCrossChain) {
            await handleCreateNotification(result.hash, currentStep.notification, 'submitted')
            setOverlayState('success')
            if (currentStep.showConfetti) {
              setTimeout(() => reward(), 100)
            }
            setNotificationId(undefined)
            if (wasLastStepRef.current) {
              onAllComplete?.()
            }
            return
          }

          setTxHash(result.hash)
          setOverlayState('pending')
          await handleCreateNotification(result.hash, currentStep.notification)
          return
        }

        const gasOverrides: { gas?: bigint } = client
          ? await client
              .estimateContractGas(request)
              .then((gasEstimate) => ({
                gas: (gasEstimate * BigInt(110)) / BigInt(100)
              }))
              .catch((error) => {
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
        await handleCreateNotification(hash, currentStep.notification)
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
      client,
      currentChainId,
      handleCreateNotification,
      isLastStep,
      onAllComplete,
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

  const waitForAutoContinueBlock = useCallback(
    async (executedStepLabel?: string) => {
      // Most flows can continue immediately once the next simulation is ready.
      // Unstake -> withdraw can race state propagation, so wait one block there.
      if (executedStepLabel !== 'Unstake') return

      const executedBlockNumber = executedStepBlockRef.current
      if (!client || executedBlockNumber === undefined) return

      const targetBlock = executedBlockNumber + 1n
      const timeoutMs = 20_000
      const pollIntervalMs = 1_000
      const startedAt = Date.now()

      while (Date.now() - startedAt < timeoutMs) {
        try {
          const latestBlock = await client.getBlockNumber()
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
    },
    [client]
  )

  useEffect(() => {
    if (step?.prepare.isError) {
      console.error('[TransactionOverlay] Prepare failed', getStepDebugInfo(step))
    }
  }, [step?.prepare.isError, step?.prepare.error, step?.label])

  const isEffectiveLastStep = wasLastStepRef.current || step?.label === executedStepRef.current?.label || !step?.label

  const handleNextStep = useCallback(() => {
    if (isAutoContinuing) return

    if (isEffectiveLastStep) {
      onClose()
    } else {
      advanceToNextStep()
    }
  }, [isAutoContinuing, isEffectiveLastStep, onClose, advanceToNextStep])

  const handleRetry = useCallback(() => {
    resetTxState()
    executeStep()
  }, [resetTxState, executeStep])

  const handleClose = useCallback(() => {
    onClose()
  }, [onClose])

  useEffect(() => {
    if (!isOpen || overlayState !== 'success') return
    if (!autoContinueToNextStep || isEffectiveLastStep || !isStepReady) return

    const executedStepLabel = executedStepRef.current?.label
    if (!executedStepLabel) return
    if (!step?.label || step.label === executedStepLabel) return
    if (autoContinueStepLabels.length > 0 && !autoContinueStepLabels.includes(executedStepLabel)) return
    if (hasAdvancedFromStepRef.current === executedStepLabel) return
    if (hasAutoContinuedFromStepRef.current === executedStepLabel) return

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
  }, [
    isOpen,
    overlayState,
    autoContinueToNextStep,
    autoContinueStepLabels,
    isEffectiveLastStep,
    isStepReady,
    step?.label,
    advanceToNextStep,
    waitForAutoContinueBlock
  ])

  // Start step when overlay opens
  useEffect(() => {
    if (isOpen && overlayState === 'idle' && step && !hasStartedRef.current) {
      hasStartedRef.current = true
      executeStep()
    }
  }, [isOpen, overlayState, step, executeStep])

  // Handle transaction success
  useEffect(() => {
    // For multi-step flows, wait until next step is ready before showing success
    // Check that step has changed (different label) and is ready
    if (receipt.isSuccess && receipt.data?.transactionHash && overlayState === 'pending') {
      executedStepBlockRef.current = receipt.data.blockNumber
      const executedStepLabel = executedStepRef.current?.label
      if (!hasReportedStepSuccessRef.current && executedStepLabel) {
        hasReportedStepSuccessRef.current = true
        onStepSuccess?.(executedStepLabel)
      }
    }

    const isNextStepReady = step?.label !== executedStepRef.current?.label && isStepReady
    const canShowSuccess = wasLastStepRef.current || isNextStepReady
    if (receipt.isSuccess && receipt.data?.transactionHash && overlayState === 'pending' && canShowSuccess) {
      setOverlayState('success')
      resetTxState()

      // Update notification to success
      handleUpdateNotification({ receipt: receipt.data, status: 'success' })
      setNotificationId(undefined)

      // Fire confetti if the executed step has confetti enabled
      if (executedStepRef.current?.showConfetti) {
        setTimeout(() => reward(), 100)
      }

      // Trigger onAllComplete immediately when last step succeeds
      if (wasLastStepRef.current) {
        onAllComplete?.()
      }
    }
  }, [
    receipt.isSuccess,
    receipt.data?.transactionHash,
    overlayState,
    reward,
    handleUpdateNotification,
    onAllComplete,
    onStepSuccess,
    isStepReady,
    step?.label,
    resetTxState
  ])

  // Handle transaction error
  useEffect(() => {
    if (receipt.isError && receipt.error && overlayState === 'pending') {
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
        {/* Close button - only shown in success/error states */}
        {(overlayState === 'success' || overlayState === 'error') && (
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
              <h3 className="text-lg font-semibold text-text-primary mt-6 mb-2">Transaction pending</h3>
              <p className="text-sm text-text-secondary">Waiting for confirmation...</p>
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

          {/* Success State */}
          {overlayState === 'success' && (
            <>
              <div className="relative">
                <span id={confettiId} className="absolute top-1/2 left-1/2" />
                <AnimatedCheckmark isVisible />
              </div>
              <h3 className="text-lg font-semibold text-text-primary mt-6 mb-2">
                {executedStepRef.current?.successTitle}
              </h3>
              <p className="text-sm text-text-secondary whitespace-pre-line mb-6">
                {executedStepRef.current?.successMessage}
              </p>
              <Button
                onClick={handleNextStep}
                variant={!isEffectiveLastStep && (!isStepReady || isAutoContinuing) ? 'busy' : 'filled'}
                isBusy={!isEffectiveLastStep && (!isStepReady || isAutoContinuing)}
                disabled={!isEffectiveLastStep && (!isStepReady || isAutoContinuing)}
                className="w-full max-w-xs"
                classNameOverride="yearn--button--nextgen w-full"
              >
                {executedStepRef.current?.notification?.type === 'crosschain zap'
                  ? 'Got it'
                  : isEffectiveLastStep
                    ? 'Nice'
                    : isAutoContinuing
                      ? 'Continuing...'
                      : step?.label || 'Continue'}
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
