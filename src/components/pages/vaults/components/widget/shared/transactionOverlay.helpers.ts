export type OverlayState = 'idle' | 'confirming' | 'pending' | 'submitted' | 'refreshing' | 'success' | 'error'
export type CompletionDeferral = 'none' | 'immediate' | 'after-close' | 'after-confetti'
export type SafeTransactionStatus = 'AWAITING_CONFIRMATIONS' | 'AWAITING_EXECUTION' | 'CANCELLED' | 'FAILED' | 'SUCCESS'

export function resolveOverlayConnectedChainId(params: {
  accountChainId: number | undefined
  currentChainId: number
  targetChainId: number | undefined
  isWalletSafe: boolean
}): number {
  if (params.accountChainId) {
    return params.accountChainId
  }

  if (params.isWalletSafe && params.targetChainId) {
    return params.targetChainId
  }

  return params.currentChainId
}

export function resolvePendingSafeOverlayState(params: {
  overlayState: OverlayState
  isWalletSafe: boolean
  hasExecutionReceipt: boolean
  safeTxStatus?: SafeTransactionStatus
  callsStatus?: 'pending' | 'success' | 'failure'
}): OverlayState {
  const { overlayState, isWalletSafe, hasExecutionReceipt, safeTxStatus, callsStatus } = params

  if (overlayState !== 'pending' && overlayState !== 'submitted') return overlayState
  if (!isWalletSafe) return overlayState
  if (hasExecutionReceipt) return overlayState

  if (safeTxStatus === 'FAILED' || safeTxStatus === 'CANCELLED') return 'error'
  if (safeTxStatus === 'AWAITING_CONFIRMATIONS' || safeTxStatus === 'AWAITING_EXECUTION') return 'submitted'

  if (callsStatus === 'failure') return 'error'
  if (callsStatus === 'pending') return 'submitted'

  return overlayState
}

export function resolveExecutionTrackingHash(params: {
  isWalletSafe: boolean
  submittedTxHash?: `0x${string}`
  safeExecutionTxHash?: `0x${string}`
  callsReceiptTxHash?: `0x${string}`
}): `0x${string}` | undefined {
  if (!params.isWalletSafe) {
    return params.submittedTxHash
  }

  return params.safeExecutionTxHash ?? params.callsReceiptTxHash
}

export function shouldAutoContinuePermitSuccess(params: {
  overlayState: OverlayState
  executedStepIsPermit?: boolean
  executedStepAutoContinues: boolean
  executedStepCompletesFlow: boolean
  currentStepLabel?: string
  executedStepLabel?: string
  isStepReady: boolean
  hasAdvancedFromStep?: string | null
  hasAutoContinuedFromStep?: string | null
}): boolean {
  const {
    overlayState,
    executedStepIsPermit,
    executedStepAutoContinues,
    executedStepCompletesFlow,
    currentStepLabel,
    executedStepLabel,
    isStepReady,
    hasAdvancedFromStep,
    hasAutoContinuedFromStep
  } = params

  if (overlayState !== 'success') return false
  if (!executedStepIsPermit) return false
  if (!executedStepAutoContinues) return false
  if (executedStepCompletesFlow) return false
  if (!currentStepLabel || currentStepLabel === executedStepLabel) return false
  if (!isStepReady) return false
  if (hasAdvancedFromStep === executedStepLabel) return false
  if (hasAutoContinuedFromStep === executedStepLabel) return false

  return true
}

export function shouldRefetchNextStepAfterReceipt(params: {
  isOpen: boolean
  overlayState: OverlayState
  hasReceiptTransactionHash: boolean
  wasLastStep: boolean
  currentStepLabel?: string
  executedStepLabel?: string
  isStepReady: boolean
}): boolean {
  if (!params.isOpen) return false
  if (params.overlayState !== 'pending' && params.overlayState !== 'submitted') return false
  if (!params.hasReceiptTransactionHash) return false
  if (params.wasLastStep) return false
  if (!params.currentStepLabel || params.currentStepLabel === params.executedStepLabel) return false
  if (params.isStepReady) return false

  return true
}

export function resolveCompletionDeferral(params: {
  completedAllSteps: boolean
  deferOnAllCompleteUntilClose: boolean
  deferOnAllCompleteUntilConfettiEnd: boolean
  stepShowsConfetti: boolean
}): CompletionDeferral {
  const { completedAllSteps, deferOnAllCompleteUntilClose, deferOnAllCompleteUntilConfettiEnd, stepShowsConfetti } =
    params

  if (!completedAllSteps) return 'none'
  if (deferOnAllCompleteUntilClose) return 'after-close'
  if (deferOnAllCompleteUntilConfettiEnd && stepShowsConfetti) return 'after-confetti'
  return 'immediate'
}

export function shouldRunDeferredCompletion(params: {
  completionDeferral: CompletionDeferral
  trigger: 'close' | 'confetti'
}): boolean {
  const { completionDeferral, trigger } = params

  if (completionDeferral === 'after-confetti') {
    return trigger === 'confetti' || trigger === 'close'
  }

  if (completionDeferral === 'after-close') {
    return trigger === 'close'
  }

  return false
}
