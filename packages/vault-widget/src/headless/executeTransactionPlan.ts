import { type Address, type Hash, isHash, type TransactionReceipt } from 'viem'
import type {
  VaultWidgetExecutionAdapter,
  VaultWidgetExecutionStep,
  VaultWidgetPlanExecutionState,
  VaultWidgetPlanOutcome,
  VaultWidgetPlanSubmission,
  VaultWidgetRequestStep,
  VaultWidgetSafeProposalStep,
  VaultWidgetTransactionPlan,
  VaultWidgetTransactionReceiptResult
} from './types'

export type ExecuteTransactionPlanParams = {
  account: Address
  adapter: VaultWidgetExecutionAdapter
  plan: VaultWidgetTransactionPlan
  refresh: () => Promise<void>
  onState?: (state: VaultWidgetPlanExecutionState) => void
}

type ExecutionFailureContext = {
  outcome: VaultWidgetPlanOutcome
  step: VaultWidgetExecutionStep
  stepIndex: number
  stepCount: number
}

export class VaultWidgetPlanExecutionError extends Error {
  readonly outcome: VaultWidgetPlanOutcome
  readonly step: VaultWidgetExecutionStep
  readonly stepIndex: number
  readonly stepCount: number

  constructor(cause: unknown, context: ExecutionFailureContext) {
    super(cause instanceof Error ? cause.message : 'Vault widget transaction plan execution failed', { cause })
    this.name = 'VaultWidgetPlanExecutionError'
    this.outcome = context.outcome
    this.step = context.step
    this.stepIndex = context.stepIndex
    this.stepCount = context.stepCount
  }
}

function appendSubmission(
  outcome: VaultWidgetPlanOutcome,
  submission: VaultWidgetPlanSubmission
): VaultWidgetPlanOutcome {
  return { submissions: [...outcome.submissions, submission] }
}

function updateSubmission(
  outcome: VaultWidgetPlanOutcome,
  submissionIndex: number,
  update: Partial<VaultWidgetPlanSubmission>
): VaultWidgetPlanOutcome {
  return {
    submissions: outcome.submissions.map((submission, index) =>
      index === submissionIndex ? { ...submission, ...update } : submission
    )
  }
}

function createExecutionError(
  params: ExecuteTransactionPlanParams,
  cause: unknown,
  context: ExecutionFailureContext
): VaultWidgetPlanExecutionError {
  const error = new VaultWidgetPlanExecutionError(cause, context)
  params.onState?.({
    status: 'error',
    error,
    ...context
  })
  return error
}

async function runOperation<T>(
  params: ExecuteTransactionPlanParams,
  context: ExecutionFailureContext,
  operation: () => Promise<T>
): Promise<T> {
  try {
    return await operation()
  } catch (cause) {
    throw createExecutionError(params, cause, context)
  }
}

function requireSuccessfulReceipt(
  params: ExecuteTransactionPlanParams,
  context: ExecutionFailureContext,
  receipt: TransactionReceipt
): void {
  if (receipt.status !== 'success') {
    throw createExecutionError(params, new Error('Transaction reverted'), context)
  }
}

function isTransactionHash(value: unknown): value is Hash {
  return typeof value === 'string' && isHash(value)
}

function resolveReceiptOutcome(
  params: ExecuteTransactionPlanParams,
  context: ExecutionFailureContext,
  submissionIndex: number,
  submittedHash: Hash,
  result: VaultWidgetTransactionReceiptResult,
  allowReplacement: boolean
): VaultWidgetPlanOutcome {
  const receiptHash = result?.receipt?.transactionHash
  if (!isTransactionHash(receiptHash)) {
    throw createExecutionError(params, new Error('Execution adapter returned an invalid transaction receipt'), context)
  }

  const replacement = result.replacement
  if (!replacement) {
    if (receiptHash.toLowerCase() !== submittedHash.toLowerCase()) {
      throw createExecutionError(
        params,
        new Error('Execution adapter returned a receipt for an unexpected transaction'),
        context
      )
    }
  } else if (
    !allowReplacement ||
    !isTransactionHash(replacement.replacedHash) ||
    replacement.replacedHash.toLowerCase() !== submittedHash.toLowerCase() ||
    receiptHash.toLowerCase() === submittedHash.toLowerCase() ||
    !['cancelled', 'replaced', 'repriced'].includes(replacement.reason)
  ) {
    throw createExecutionError(params, new Error('Execution adapter returned invalid replacement details'), context)
  }

  const confirmedOutcome = updateSubmission(context.outcome, submissionIndex, {
    hash: receiptHash,
    receipt: result.receipt,
    ...(replacement ? { replacement } : {})
  })
  const confirmedContext = { ...context, outcome: confirmedOutcome }
  if (replacement?.reason === 'cancelled') {
    throw createExecutionError(params, new Error('Transaction was cancelled in the wallet'), confirmedContext)
  }
  if (replacement?.reason === 'replaced') {
    throw createExecutionError(
      params,
      new Error('Transaction was replaced by a different wallet transaction'),
      confirmedContext
    )
  }

  requireSuccessfulReceipt(params, confirmedContext, result.receipt)
  return confirmedOutcome
}

async function executeRequestStep(
  params: ExecuteTransactionPlanParams,
  step: VaultWidgetRequestStep,
  stepIndex: number,
  outcome: VaultWidgetPlanOutcome
): Promise<VaultWidgetPlanOutcome> {
  const stepCount = params.plan.steps.length
  const initialContext = { outcome, step, stepIndex, stepCount }
  const hash = await runOperation(params, initialContext, () =>
    params.adapter.execute({ account: params.account, request: step.request })
  )
  const submissionIndex = outcome.submissions.length
  const pendingOutcome = appendSubmission(outcome, {
    stepId: step.id,
    chainId: step.chainId,
    hash
  })
  params.onState?.({
    status: 'pending',
    outcome: pendingOutcome,
    step,
    stepIndex,
    stepCount
  })
  const receiptResult = await runOperation(params, { ...initialContext, outcome: pendingOutcome }, () =>
    params.adapter.waitForReceipt({ chainId: step.chainId, hash })
  )
  const confirmedOutcome = resolveReceiptOutcome(
    params,
    { ...initialContext, outcome: pendingOutcome },
    submissionIndex,
    hash,
    receiptResult,
    true
  )
  return executePlanStep(params, stepIndex + 1, confirmedOutcome)
}

async function executeSafeProposalStep(
  params: ExecuteTransactionPlanParams,
  step: VaultWidgetSafeProposalStep,
  stepIndex: number,
  outcome: VaultWidgetPlanOutcome
): Promise<VaultWidgetPlanOutcome> {
  const stepCount = params.plan.steps.length
  const initialContext = { outcome, step, stepIndex, stepCount }
  const proposeSafeBatch = params.adapter.proposeSafeBatch
  const waitForSafeExecution = params.adapter.waitForSafeExecution
  if (!proposeSafeBatch || !waitForSafeExecution) {
    throw createExecutionError(
      params,
      new Error('Safe batch execution and tracking are not configured'),
      initialContext
    )
  }

  const proposalId = await runOperation(params, initialContext, () =>
    proposeSafeBatch({
      account: params.account,
      chainId: step.chainId,
      requests: step.requests
    })
  )
  const submissionIndex = outcome.submissions.length
  const submittedOutcome = appendSubmission(outcome, {
    stepId: step.id,
    chainId: step.chainId,
    proposalId
  })
  params.onState?.({
    status: 'submitted',
    outcome: submittedOutcome,
    step,
    stepIndex,
    stepCount
  })
  const hash = await runOperation(params, { ...initialContext, outcome: submittedOutcome }, () =>
    waitForSafeExecution({ chainId: step.chainId, proposalId })
  )
  const pendingOutcome = updateSubmission(submittedOutcome, submissionIndex, { hash })
  params.onState?.({
    status: 'pending',
    outcome: pendingOutcome,
    step,
    stepIndex,
    stepCount
  })
  const receiptResult = await runOperation(params, { ...initialContext, outcome: pendingOutcome }, () =>
    params.adapter.waitForReceipt({ chainId: step.chainId, hash })
  )
  const confirmedOutcome = resolveReceiptOutcome(
    params,
    { ...initialContext, outcome: pendingOutcome },
    submissionIndex,
    hash,
    receiptResult,
    false
  )
  return executePlanStep(params, stepIndex + 1, confirmedOutcome)
}

async function executePlanStep(
  params: ExecuteTransactionPlanParams,
  stepIndex: number,
  outcome: VaultWidgetPlanOutcome
): Promise<VaultWidgetPlanOutcome> {
  const step = params.plan.steps[stepIndex]
  const stepCount = params.plan.steps.length
  if (!step) {
    params.onState?.({ status: 'success', outcome, stepIndex, stepCount })
    return outcome
  }

  if (step.kind === 'refresh') {
    params.onState?.({ status: 'refreshing', outcome, step, stepIndex, stepCount })
    await runOperation(params, { outcome, step, stepIndex, stepCount }, params.refresh)
    return executePlanStep(params, stepIndex + 1, outcome)
  }

  params.onState?.({ status: 'confirming', outcome, step, stepIndex, stepCount })
  if (step.kind === 'switch-chain') {
    await runOperation(params, { outcome, step, stepIndex, stepCount }, () =>
      params.adapter.switchChain({ chainId: step.chainId })
    )
    return executePlanStep(params, stepIndex + 1, outcome)
  }
  if (step.kind === 'safe-proposal') {
    return executeSafeProposalStep(params, step, stepIndex, outcome)
  }
  return executeRequestStep(params, step, stepIndex, outcome)
}

export function executeTransactionPlan(params: ExecuteTransactionPlanParams): Promise<VaultWidgetPlanOutcome> {
  return executePlanStep(params, 0, { submissions: [] })
}
