export type OverlayState = 'idle' | 'confirming' | 'pending' | 'refreshing' | 'success' | 'error'
export type CompletionDeferral = 'none' | 'immediate' | 'after-close' | 'after-confetti'

function capitalizeWord(value: string): string {
  if (!value) return value
  return `${value[0]?.toUpperCase() || ''}${value.slice(1)}`
}

export function formatPendingTransactionFunctionName(params: {
  functionName?: unknown
  fallbackLabel?: string
}): string | undefined {
  const { functionName, fallbackLabel } = params

  if (typeof functionName === 'string' && functionName.length > 0) {
    return `${capitalizeWord(functionName)}()`
  }

  if (fallbackLabel) {
    return `${fallbackLabel}()`
  }

  return undefined
}

export function getPendingTransactionTitle(params: {
  isPreparingNextStep: boolean
  functionName?: unknown
  fallbackLabel?: string
}): string {
  const { isPreparingNextStep, functionName, fallbackLabel } = params

  if (isPreparingNextStep) {
    return 'Transaction confirmed'
  }

  const pendingFunctionName = formatPendingTransactionFunctionName({
    functionName,
    fallbackLabel
  })

  if (!pendingFunctionName) {
    return 'Transaction pending'
  }

  return `${pendingFunctionName} transaction pending`
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
