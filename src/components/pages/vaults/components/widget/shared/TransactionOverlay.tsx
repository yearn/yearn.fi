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

type TransactionOverlayProps = {
  isOpen: boolean
  onClose: () => void
  step?: TransactionStep
  isLastStep?: boolean
  onAllComplete?: () => void
  topOffset?: string
  contentAlign?: 'center' | 'start'
}

export const TransactionOverlay: FC<TransactionOverlayProps> = ({
  isOpen,
  onClose,
  step,
  isLastStep = true,
  onAllComplete,
  contentAlign = 'center'
}) => {
  const [overlayState, setOverlayState] = useState<OverlayState>('success')
  const [errorMessage, setErrorMessage] = useState<string>('')

  const writeContract = useWriteContract()
  const { signTypedDataAsync } = useSignTypedData()
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

  // Track the step that was just executed (for showing success messages)
  const executedStepRef = useRef<TransactionStep | null>(null)

  const receipt = useWaitForTransactionReceipt({ hash: writeContract.data || ensoTxHash, confirmations })
  const txHash = (writeContract.data || ensoTxHash) as `0x${string}` | undefined
  const explorerChainId =
    ((executedStepRef.current?.prepare.data?.request as any)?.chainId as number | undefined) ?? currentChainId
  const blockExplorer = explorerChainId ? getNetwork(explorerChainId).defaultBlockExplorer : ''
  const explorerTxUrl = txHash && blockExplorer ? `${blockExplorer}/tx/${txHash}` : ''

  // Track if the executed step was the last step (captured at execution time)
  const wasLastStepRef = useRef(false)

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

  // Reset state when overlay closes
  // biome-ignore lint/correctness/useExhaustiveDependencies: Only trigger on isOpen change to prevent infinite loops
  useEffect(() => {
    if (!isOpen) {
      setOverlayState('idle')
      setErrorMessage('')
      setEnsoTxHash(undefined)
      hasStartedRef.current = false
      executedStepRef.current = null
      wasLastStepRef.current = false
      setNotificationId(undefined)
      writeContract.reset()
    }
  }, [isOpen])

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
  const executeStep = useCallback(async () => {
    // For permit steps, we don't need prepare.isSuccess - we need permitData
    if (step?.isPermit && step?.permitData) {
      // Handle permit signing flow
      executedStepRef.current = step
      wasLastStepRef.current = isLastStep

      setOverlayState('confirming')
      setErrorMessage('')

      try {
        // Get permit data - either direct or via async getter
        let permitDataDirect: PermitDataDirect | undefined
        if ('getPermitData' in step.permitData) {
          permitDataDirect = await step.permitData.getPermitData()
        } else {
          permitDataDirect = step.permitData
        }

        if (!permitDataDirect) {
          throw new Error('Failed to get permit data')
        }

        const signature = await signTypedDataAsync({
          domain: permitDataDirect.domain,
          types: permitDataDirect.types,
          primaryType: permitDataDirect.primaryType,
          message: permitDataDirect.message
        })

        // Pass signature back to the flow
        step.onPermitSigned?.(signature)
        setOverlayState('success')

        if (step.showConfetti) {
          setTimeout(() => reward(), 100)
        }
      } catch (error: any) {
        const isUserRejection =
          error?.message?.toLowerCase().includes('rejected') ||
          error?.message?.toLowerCase().includes('denied') ||
          error?.code === 4001

        if (isUserRejection) {
          onClose()
        } else {
          console.error('Permit signing failed:', error)
          setOverlayState('error')
          setErrorMessage('Failed to sign permit. Please try again.')
        }
      }
      return
    }

    if (!step?.prepare.isSuccess || !step?.prepare.data?.request) {
      setOverlayState('error')
      setErrorMessage('Transaction not ready. Please try again.')
      return
    }

    // Capture step info for success messages
    executedStepRef.current = step
    wasLastStepRef.current = isLastStep

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

    const isEnsoOrder = !!(step.prepare.data.request as any)?.__isEnsoOrder
    const isCrossChain = step.notification?.type === 'crosschain zap'

    try {
      if (isEnsoOrder) {
        const customWriteAsync = (step.prepare.data.request as any).writeContractAsync
        const result = await customWriteAsync()
        if (result.hash) {
          // For cross-chain: use 'submitted' status and show success immediately
          if (isCrossChain) {
            await handleCreateNotification(result.hash, step.notification, 'submitted')
            setOverlayState('success')
            if (step.showConfetti) {
              setTimeout(() => reward(), 100)
            }
            setNotificationId(undefined)
            // Trigger onAllComplete immediately for cross-chain success
            if (wasLastStepRef.current) {
              onAllComplete?.()
            }
          } else {
            // Same-chain Enso: wait for receipt
            setEnsoTxHash(result.hash)
            setOverlayState('pending')
            await handleCreateNotification(result.hash, step.notification)
          }
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
        await handleCreateNotification(hash, step.notification)
      }
    } catch (error: any) {
      const isUserRejection =
        error?.message?.toLowerCase().includes('rejected') ||
        error?.message?.toLowerCase().includes('denied') ||
        error?.code === 4001

      if (isUserRejection) {
        onClose()
      } else {
        console.error('Transaction failed:', error)
        setOverlayState('error')
        // Show more specific error if available
        const errorMsg = error?.shortMessage || error?.message || 'Transaction failed. Please try again.'
        setErrorMessage(errorMsg.length > 100 ? 'Transaction failed. Please try again.' : errorMsg)
      }
    }
  }, [
    step,
    currentChainId,
    switchChainAsync,
    client,
    writeContract,
    signTypedDataAsync,
    onClose,
    handleCreateNotification,
    isLastStep,
    reward,
    onAllComplete
  ])

  const handleNextStep = useCallback(() => {
    if (wasLastStepRef.current) {
      onClose()
    } else {
      // Reset for next step - parent will provide the new step
      writeContract.reset()
      setEnsoTxHash(undefined)
      executeStep()
    }
  }, [onClose, writeContract, executeStep])

  const handleRetry = useCallback(() => {
    writeContract.reset()
    setEnsoTxHash(undefined)
    executeStep()
  }, [writeContract, executeStep])

  const handleClose = useCallback(() => {
    onClose()
  }, [onClose])

  // Start step when overlay opens
  // biome-ignore lint/correctness/useExhaustiveDependencies: Only depend on isOpen and overlayState to prevent infinite loops
  useEffect(() => {
    if (isOpen && overlayState === 'idle' && step && !hasStartedRef.current) {
      hasStartedRef.current = true
      executeStep()
    }
  }, [isOpen, overlayState])

  // Handle transaction success
  // biome-ignore lint/correctness/useExhaustiveDependencies: writeContract excluded to prevent loops
  useEffect(() => {
    // For multi-step flows, wait until next step is ready before showing success
    // Check that step has changed (different label) and is ready
    const isNextStepReady = step?.label !== executedStepRef.current?.label && isStepReady
    const canShowSuccess = wasLastStepRef.current || isNextStepReady
    if (receipt.isSuccess && receipt.data?.transactionHash && overlayState === 'pending' && canShowSuccess) {
      setOverlayState('success')
      writeContract.reset()
      setEnsoTxHash(undefined)

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
    isStepReady,
    step?.label
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
                variant={!wasLastStepRef.current && !isStepReady ? 'busy' : 'filled'}
                isBusy={!wasLastStepRef.current && !isStepReady}
                disabled={!wasLastStepRef.current && !isStepReady}
                className="w-full max-w-xs"
                classNameOverride="yearn--button--nextgen w-full"
              >
                {executedStepRef.current?.notification?.type === 'crosschain zap'
                  ? 'Got it'
                  : wasLastStepRef.current
                    ? 'Nice'
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
