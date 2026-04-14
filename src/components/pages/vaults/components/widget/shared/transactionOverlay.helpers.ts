export type OverlayState = 'idle' | 'confirming' | 'pending' | 'submitted' | 'refreshing' | 'success' | 'error'
export type CompletionDeferral = 'none' | 'immediate' | 'after-close' | 'after-confetti'

export function resolvePendingSafeOverlayState(params: {
  overlayState: OverlayState
  isWalletSafe: boolean
  hasReceiptTransactionHash: boolean
  callsStatus?: 'pending' | 'success' | 'failure'
}): OverlayState {
  const { overlayState, isWalletSafe, hasReceiptTransactionHash, callsStatus } = params

  if (overlayState !== 'pending') return overlayState
  if (!isWalletSafe) return overlayState
  if (hasReceiptTransactionHash) return overlayState
  if (callsStatus === 'failure') return 'error'
  if (callsStatus === 'pending') return 'submitted'

  return overlayState
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
