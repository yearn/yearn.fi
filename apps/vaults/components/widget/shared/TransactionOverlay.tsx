import { Button } from '@lib/components/Button'
import { useNotificationsActions } from '@lib/contexts/useNotificationsActions'
import type { TCreateNotificationParams } from '@lib/types/notifications'
import { cl } from '@lib/utils'
import { type FC, useCallback, useEffect, useId, useRef, useState } from 'react'
import { useReward } from 'react-rewards'
import {
  type UseSimulateContractReturnType,
  useAccount,
  useChainId,
  usePublicClient,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWriteContract
} from 'wagmi'

type OverlayState = 'idle' | 'confirming' | 'pending' | 'success' | 'error'

export type TransactionStep = {
  prepare: UseSimulateContractReturnType
  label: string
  confirmMessage: string
  successTitle: string
  successMessage: string
  showConfetti?: boolean
  notification?: TCreateNotificationParams
}

type TransactionOverlayProps = {
  isOpen: boolean
  onClose: () => void
  steps: TransactionStep[]
  onAllComplete?: () => void
}

const AnimatedCheckmark: FC<{ isVisible: boolean }> = ({ isVisible }) => {
  const [animate, setAnimate] = useState(false)

  useEffect(() => {
    if (isVisible) {
      const timeout = setTimeout(() => setAnimate(true), 100)
      return () => clearTimeout(timeout)
    }
    setAnimate(false)
    return undefined
  }, [isVisible])

  return (
    <div
      className={`w-14 h-14 rounded-full border-2 border-green-500 flex items-center justify-center transition-all duration-300 ${
        animate ? 'scale-100 opacity-100' : 'scale-75 opacity-0'
      }`}
    >
      <svg className="w-7 h-7 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M5 13l4 4L19 7"
          style={{
            strokeDasharray: 30,
            strokeDashoffset: animate ? 0 : 30,
            transition: 'stroke-dashoffset 0.4s ease-out 0.15s'
          }}
        />
      </svg>
    </div>
  )
}

const Spinner: FC = () => (
  <div className="w-12 h-12 border-3 border-border border-t-primary rounded-full animate-spin" />
)

const ErrorIcon: FC = () => (
  <div className="w-14 h-14 rounded-full border-2 border-red-500 flex items-center justify-center">
    <svg className="w-7 h-7 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  </div>
)

export const TransactionOverlay: FC<TransactionOverlayProps> = ({ isOpen, onClose, steps, onAllComplete }) => {
  const [overlayState, setOverlayState] = useState<OverlayState>('idle')
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [errorMessage, setErrorMessage] = useState<string>('')

  const writeContract = useWriteContract()
  const currentChainId = useChainId()
  const { switchChainAsync } = useSwitchChain()
  const [ensoTxHash, setEnsoTxHash] = useState<`0x${string}` | undefined>()
  const client = usePublicClient()
  const { address: account } = useAccount()

  // Notification system integration
  const { createNotification, updateNotification } = useNotificationsActions()
  const [notificationId, setNotificationId] = useState<number | undefined>()

  // Fast chains like BASE need extra confirmations
  const confirmations = currentChainId === 8453 ? 2 : 1
  const receipt = useWaitForTransactionReceipt({ hash: writeContract.data || ensoTxHash, confirmations })

  // Capture step config at start so values don't change
  const capturedSteps = useRef<TransactionStep[]>([])

  // Use captured steps for navigation to prevent issues when steps prop changes mid-transaction
  const stepsToUse = capturedSteps.current.length > 0 ? capturedSteps.current : steps
  const isLastStep = currentStepIndex === stepsToUse.length - 1
  const nextStep = !isLastStep ? stepsToUse[currentStepIndex + 1] : null

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

  // Reset state when overlay closes
  // biome-ignore lint/correctness/useExhaustiveDependencies: Only trigger on isOpen change to prevent infinite loops
  useEffect(() => {
    if (!isOpen) {
      setOverlayState('idle')
      setCurrentStepIndex(0)
      setErrorMessage('')
      setEnsoTxHash(undefined)
      hasStartedRef.current = false
      setNotificationId(undefined)
      writeContract.reset()
    }
  }, [isOpen])

  // Create notification with txHash (called after signing succeeds)
  const handleCreateNotification = useCallback(
    async (txHash: `0x${string}`, notification?: TCreateNotificationParams): Promise<number | undefined> => {
      if (!notification || !account) return undefined

      try {
        const id = await createNotification(notification)
        setNotificationId(id)
        await updateNotification({ id, txHash, status: 'pending' })
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

  const executeCurrentStep = useCallback(
    async (stepIndex?: number, retryCount = 0) => {
      const index = stepIndex ?? currentStepIndex

      // For steps after the first, use live steps as prepare data needs to reflect current state
      // The parent may have removed earlier steps (e.g., approve removed after allowance granted)
      // So we match by label from captured steps to find the right live step
      const capturedStep = capturedSteps.current[index]
      let step = capturedStep

      // Try to find matching live step by label (more reliable after steps array changes)
      if (capturedStep) {
        const liveStep = steps.find((s) => s.label === capturedStep.label)
        if (liveStep?.prepare.isSuccess && liveStep?.prepare.data?.request) {
          step = liveStep
        }
      }

      // If step prepare isn't ready, check live steps as fallback
      if (!step?.prepare.isSuccess || !step?.prepare.data?.request) {
        const liveStep = steps.find((s) => s.label === capturedStep?.label) || steps[0]
        if (liveStep?.prepare.isSuccess && liveStep?.prepare.data?.request) {
          step = liveStep
        }
      }

      // If still not ready, retry a few times (allowance query may still be updating)
      if (!step?.prepare.isSuccess || !step?.prepare.data?.request) {
        if (retryCount < 10) {
          setTimeout(() => executeCurrentStep(stepIndex, retryCount + 1), 500)
          return
        }
        setOverlayState('error')
        setErrorMessage('Transaction not ready. Please try again.')
        return
      }

      setOverlayState('confirming')
      setErrorMessage('')

      const txChainId = step.prepare.data.request.chainId
      const wrongNetwork = txChainId && currentChainId !== txChainId

      // Handle chain switch if needed
      if (wrongNetwork && txChainId) {
        try {
          await switchChainAsync({ chainId: txChainId })
        } catch {
          // User rejected chain switch - silent close
          onClose()
          return
        }
      }

      // Check if it's an Enso order
      const isEnsoOrder = !!(step.prepare.data.request as any)?.__isEnsoOrder

      try {
        if (isEnsoOrder) {
          const customWriteAsync = (step.prepare.data.request as any).writeContractAsync
          const result = await customWriteAsync()
          if (result.hash) {
            setEnsoTxHash(result.hash)
            setOverlayState('pending')
            // Create notification after signing succeeds
            await handleCreateNotification(result.hash, step.notification)
          }
        } else {
          // Estimate gas with buffer
          let gasOverrides: { gas?: bigint } = {}
          if (client) {
            try {
              const gasEstimate = await client.estimateContractGas(step.prepare.data.request as any)
              if (gasEstimate) {
                gasOverrides = { gas: (gasEstimate * BigInt(110)) / BigInt(100) }
              }
            } catch {
              // Gas estimation failed, proceed without override
            }
          }

          const hash = await writeContract.writeContractAsync({
            ...step.prepare.data.request,
            ...gasOverrides
          })
          setOverlayState('pending')
          // Create notification after signing succeeds
          await handleCreateNotification(hash, step.notification)
        }
      } catch (error: any) {
        const isUserRejection =
          error?.message?.toLowerCase().includes('rejected') ||
          error?.message?.toLowerCase().includes('denied') ||
          error?.code === 4001

        if (isUserRejection) {
          // Silent close on rejection
          onClose()
        } else {
          setOverlayState('error')
          setErrorMessage('Transaction failed. Please try again.')
        }
      }
    },
    [
      currentStepIndex,
      steps,
      currentChainId,
      switchChainAsync,
      client,
      writeContract,
      onClose,
      handleCreateNotification
    ]
  )

  const handleNextStep = useCallback(() => {
    if (isLastStep) {
      onAllComplete?.()
      onClose()
    } else {
      const nextIndex = currentStepIndex + 1
      setCurrentStepIndex(nextIndex)
      writeContract.reset()
      setEnsoTxHash(undefined)
      // Execute next step with explicit index to avoid stale closure
      setTimeout(() => {
        executeCurrentStep(nextIndex)
      }, 100)
    }
  }, [isLastStep, onAllComplete, onClose, currentStepIndex, writeContract, executeCurrentStep])

  const handleRetry = useCallback(() => {
    writeContract.reset()
    setEnsoTxHash(undefined)
    executeCurrentStep()
  }, [writeContract, executeCurrentStep])

  const handleClose = useCallback(() => {
    onClose()
  }, [onClose])

  // Start first step when overlay opens
  // biome-ignore lint/correctness/useExhaustiveDependencies: Only depend on isOpen and overlayState to prevent infinite loops from steps/executeCurrentStep changing
  useEffect(() => {
    if (isOpen && overlayState === 'idle' && steps.length > 0 && !hasStartedRef.current) {
      hasStartedRef.current = true
      capturedSteps.current = steps.map((s) => ({ ...s }))
      executeCurrentStep()
    }
  }, [isOpen, overlayState])

  // Handle transaction success
  // biome-ignore lint/correctness/useExhaustiveDependencies: writeContract excluded to prevent loops
  useEffect(() => {
    if (receipt.isSuccess && receipt.data?.transactionHash && overlayState === 'pending') {
      setOverlayState('success')
      writeContract.reset()
      setEnsoTxHash(undefined)

      // Update notification to success
      handleUpdateNotification({ receipt: receipt.data, status: 'success' })
      setNotificationId(undefined)

      // Fire confetti if this step has it
      const step = capturedSteps.current[currentStepIndex]
      if (step?.showConfetti) {
        setTimeout(() => reward(), 100)
      }
    }
  }, [
    receipt.isSuccess,
    receipt.data?.transactionHash,
    overlayState,
    currentStepIndex,
    reward,
    handleUpdateNotification
  ])

  // Handle transaction error
  // biome-ignore lint/correctness/useExhaustiveDependencies: writeContract excluded to prevent loops
  useEffect(() => {
    if (receipt.isError && receipt.error && overlayState === 'pending') {
      setOverlayState('error')
      setErrorMessage('Transaction failed. Please try again.')
      writeContract.reset()
      setEnsoTxHash(undefined)

      // Update notification to error
      handleUpdateNotification({ status: 'error' })
      setNotificationId(undefined)
    }
  }, [receipt.isError, receipt.error, overlayState, handleUpdateNotification])

  const capturedStep = stepsToUse[currentStepIndex]

  return (
    <div
      className="absolute z-50"
      style={{
        top: '-48px', // Cover the tabs
        left: 0,
        right: 0,
        bottom: 0,
        pointerEvents: isOpen ? 'auto' : 'none'
      }}
    >
      {/* Semi-transparent backdrop with fade animation */}
      <div
        className={cl(
          'absolute inset-0 bg-black/5 rounded-xl transition-opacity duration-200',
          isOpen ? 'opacity-100' : 'opacity-0'
        )}
      />
      {/* Overlay content with slide and fade animation */}
      <div
        className={cl(
          'absolute inset-0 bg-surface rounded-xl transition-all duration-300 ease-out flex flex-col',
          isOpen ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'
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
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          {/* Confirming State */}
          {overlayState === 'confirming' && (
            <>
              <Spinner />
              <h3 className="text-lg font-semibold text-text-primary mt-6 mb-2">Confirm in your wallet</h3>
              <p className="text-sm text-text-secondary whitespace-pre-line">{capturedStep?.confirmMessage}</p>
            </>
          )}

          {/* Pending State */}
          {overlayState === 'pending' && (
            <>
              <Spinner />
              <h3 className="text-lg font-semibold text-text-primary mt-6 mb-2">Transaction pending</h3>
              <p className="text-sm text-text-secondary">Waiting for confirmation...</p>
            </>
          )}

          {/* Success State */}
          {overlayState === 'success' && (
            <>
              <div className="relative">
                <span id={confettiId} className="absolute top-1/2 left-1/2" />
                <AnimatedCheckmark isVisible />
              </div>
              <h3 className="text-lg font-semibold text-text-primary mt-6 mb-2">{capturedStep?.successTitle}</h3>
              <p className="text-sm text-text-secondary whitespace-pre-line mb-6">{capturedStep?.successMessage}</p>
              <Button
                onClick={handleNextStep}
                variant="filled"
                className="w-full max-w-xs"
                classNameOverride="yearn--button--nextgen w-full"
              >
                {isLastStep ? 'Nice' : nextStep?.label || 'Continue'}
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
