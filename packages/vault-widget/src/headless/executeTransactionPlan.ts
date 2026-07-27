import type { Hash, Hex } from 'viem'
import type { Config } from 'wagmi'
import { switchChain } from 'wagmi/actions'
import type { VaultWidgetExecutionService } from '../services'
import type {
  EnsoBridgeStatusProvider,
  VaultWidgetEvent,
  VaultWidgetExecutionState,
  VaultWidgetTransactionPlan
} from '../types'

export type VaultWidgetPlanOutcome = {
  destinationHash?: Hash
  hash?: Hash
  proposalId?: Hex
}

export type VaultWidgetPlanProgress = VaultWidgetPlanOutcome & {
  isFinalTransaction: boolean
  step: VaultWidgetTransactionPlan['steps'][number]
  stepIndex: number
}

export type ExecuteVaultWidgetPlanParams = {
  account: `0x${string}`
  config: Config
  ensoBridge?: EnsoBridgeStatusProvider
  execution: VaultWidgetExecutionService
  onEvent?: (event: VaultWidgetEvent) => void
  onExecution: (state: VaultWidgetExecutionState) => void
  onProgress?: (progress: VaultWidgetPlanProgress) => Promise<void>
  onRefresh: () => Promise<void>
  onSubmitted?: (hash: Hash) => Promise<void>
  plan: VaultWidgetTransactionPlan
}

function isUserActionStep(step: VaultWidgetTransactionPlan['steps'][number]): boolean {
  return step.kind !== 'refresh' && step.kind !== 'wait-cross-chain'
}

function getUserActionProgress(
  plan: VaultWidgetTransactionPlan,
  planStepIndex: number
): Pick<Extract<VaultWidgetExecutionState, { step: unknown }>, 'stepCount' | 'stepIndex'> {
  const userActionCount = plan.steps.filter(isUserActionStep).length
  const completedUserActionCount = plan.steps.slice(0, planStepIndex).filter(isUserActionStep).length
  const currentStep = plan.steps[planStepIndex]
  const userActionIndex =
    currentStep && isUserActionStep(currentStep) ? completedUserActionCount : completedUserActionCount - 1
  return {
    stepCount: userActionCount,
    stepIndex: Math.max(0, userActionIndex)
  }
}

export async function executeVaultWidgetPlan(
  params: ExecuteVaultWidgetPlanParams,
  index = 0,
  outcome: VaultWidgetPlanOutcome = {}
): Promise<VaultWidgetPlanOutcome> {
  const step = params.plan.steps[index]
  if (!step) return outcome
  const userActionProgress = getUserActionProgress(params.plan, index)

  params.onExecution({
    status: 'confirming',
    step,
    ...userActionProgress
  })
  params.onEvent?.({ type: 'transaction_step', step })
  const isFinalTransaction = !params.plan.steps
    .slice(index + 1)
    .some((candidate) => candidate.kind === 'execute' || candidate.kind === 'safe-proposal')

  if (step.kind === 'switch-chain' && step.chainId) {
    await switchChain(params.config, { chainId: step.chainId })
    return executeVaultWidgetPlan(params, index + 1, outcome)
  }
  if (step.kind === 'refresh') {
    await params.onRefresh()
    return executeVaultWidgetPlan(params, index + 1, outcome)
  }
  if (step.kind === 'safe-proposal') {
    if (
      !step.chainId ||
      !step.requests?.length ||
      !params.execution.proposeSafeBatch ||
      !params.execution.waitForSafeExecution
    ) {
      throw new Error('Safe batch execution and tracking are not configured')
    }
    const proposalId = await params.execution.proposeSafeBatch({
      account: params.account,
      chainId: step.chainId,
      config: params.config,
      requests: step.requests,
      step
    })
    params.onExecution({
      status: 'pending',
      step,
      ...userActionProgress,
      proposalId
    })
    params.onEvent?.({ type: 'transaction_step', step, proposalId })
    await params.onProgress?.({ isFinalTransaction, proposalId, step, stepIndex: index })
    const hash = await params.execution.waitForSafeExecution(params.config, step.chainId, proposalId)
    if (!hash) throw new Error('Safe execution completed without a transaction receipt')
    return executeVaultWidgetPlan(params, index + 1, {
      hash,
      proposalId
    })
  }
  if (step.kind === 'wait-cross-chain') {
    if (!step.bridge || !outcome.hash || !params.ensoBridge) {
      throw new Error('Cross-chain completion tracking is not configured')
    }
    params.onExecution({
      status: 'submitted',
      step,
      ...userActionProgress,
      hash: outcome.hash,
      proposalId: outcome.proposalId
    })
    params.onEvent?.({
      type: 'transaction_submitted',
      plan: params.plan,
      hash: outcome.hash,
      proposalId: outcome.proposalId
    })
    await params.onSubmitted?.(outcome.hash)
    const bridgeStatus = await params.ensoBridge.waitForCompletion(
      {
        ...step.bridge,
        sourceTxHash: outcome.hash
      },
      (status) => params.onEvent?.({ type: 'bridge_status', status })
    )
    return executeVaultWidgetPlan(params, index + 1, {
      ...outcome,
      destinationHash: bridgeStatus.destinationTxHash
    })
  }
  if (!step.request) {
    return executeVaultWidgetPlan(params, index + 1, outcome)
  }

  const hash = await params.execution.execute({
    account: params.account,
    config: params.config,
    request: step.request,
    step
  })
  params.onExecution({
    status: 'pending',
    step,
    ...userActionProgress,
    hash
  })
  params.onEvent?.({ type: 'transaction_step', step, hash })
  await params.onProgress?.({ ...outcome, hash, isFinalTransaction, step, stepIndex: index })
  await params.execution.waitForReceipt(params.config, step.request.chainId, hash)
  return executeVaultWidgetPlan(params, index + 1, { ...outcome, hash })
}
