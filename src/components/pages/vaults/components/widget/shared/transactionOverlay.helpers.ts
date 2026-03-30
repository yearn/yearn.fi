export type OverlayState = 'idle' | 'confirming' | 'pending' | 'success' | 'error'
export type CompletionDeferral = 'none' | 'immediate' | 'after-close' | 'after-confetti'

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
