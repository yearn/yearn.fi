import { awaitTransactionRefresh } from '@yearn/vault-widget/internal/utils/transactionLifecycle'
import { type Address, type Hash, isHash, type TransactionReceipt } from 'viem'
import type {
  TDeferredStep,
  TPreparedStep,
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
  /** Authorize each next step from the confirmed outcome before it starts. */
  beforeStep?: (step: VaultWidgetExecutionStep, outcome: VaultWidgetPlanOutcome) => Promise<void>
  prepareStep?: (step: TDeferredStep, outcome: VaultWidgetPlanOutcome) => Promise<TPreparedStep>
  afterStep?: (step: TPreparedStep, outcome: VaultWidgetPlanOutcome) => Promise<void>
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
  return { ...outcome, submissions: [...outcome.submissions, submission] }
}

function updateSubmission(
  outcome: VaultWidgetPlanOutcome,
  submissionIndex: number,
  update: Partial<VaultWidgetPlanSubmission>
): VaultWidgetPlanOutcome {
  return {
    ...outcome,
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
  await runOperation(params, { ...initialContext, outcome: confirmedOutcome }, async () => {
    await params.afterStep?.(step, confirmedOutcome)
  })
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
  await runOperation(params, { ...initialContext, outcome: confirmedOutcome }, async () => {
    await params.afterStep?.(step, confirmedOutcome)
  })
  return executePlanStep(params, stepIndex + 1, confirmedOutcome)
}

async function executePlanStep(
  params: ExecuteTransactionPlanParams,
  stepIndex: number,
  outcome: VaultWidgetPlanOutcome
): Promise<VaultWidgetPlanOutcome> {
  const plannedStep = params.plan.steps[stepIndex]
  const stepCount = params.plan.steps.length
  if (!plannedStep) {
    params.onState?.({ status: 'success', outcome, stepIndex, stepCount })
    return outcome
  }

  await runOperation(params, { outcome, step: plannedStep, stepIndex, stepCount }, async () => {
    await params.beforeStep?.(plannedStep, outcome)
  })
  const step =
    plannedStep.kind === 'prepare'
      ? await runOperation(params, { outcome, step: plannedStep, stepIndex, stepCount }, async () => {
          if (!params.prepareStep) throw new Error('Step preparation is not configured')
          const prepared = await params.prepareStep(plannedStep, outcome)
          if (prepared.id !== plannedStep.id || prepared.chainId !== plannedStep.chainId)
            throw new Error('Prepared action changed the reviewed step or network')
          return prepared
        })
      : plannedStep

  if (step.kind === 'refresh') {
    params.onState?.({ status: 'refreshing', outcome, step, stepIndex, stepCount })
    await runOperation(params, { outcome, step, stepIndex, stepCount }, () => awaitTransactionRefresh(params.refresh))
    return executePlanStep(params, stepIndex + 1, outcome)
  }

  params.onState?.({ status: 'confirming', outcome, step, stepIndex, stepCount })
  if (step.kind === 'switch-chain') {
    await runOperation(params, { outcome, step, stepIndex, stepCount }, () =>
      params.adapter.switchChain({ chainId: step.chainId })
    )
    return executePlanStep(params, stepIndex + 1, outcome)
  }
  if (step.kind === 'permit') {
    const signature = await runOperation(params, { outcome, step, stepIndex, stepCount }, async () => {
      if (!params.adapter.signPermit) throw new Error('Permit signing is not configured')
      return params.adapter.signPermit({ account: params.account, chainId: step.chainId, data: step.data })
    })
    const signed = { ...outcome, signatures: { ...outcome.signatures, [step.id]: signature } }
    await runOperation(params, { outcome: signed, step, stepIndex, stepCount }, async () => {
      await params.afterStep?.(step, signed)
    })
    return executePlanStep(params, stepIndex + 1, signed)
  }
  if (step.kind === 'safe-proposal') {
    return executeSafeProposalStep(params, step, stepIndex, outcome)
  }
  return executeRequestStep(params, step, stepIndex, outcome)
}

export function executeTransactionPlan(params: ExecuteTransactionPlanParams): Promise<VaultWidgetPlanOutcome> {
  return executePlanStep(params, 0, { submissions: [] })
}
