import { encodeFunctionData, erc20Abi } from 'viem'
import type {
  VaultWidgetExecutionStep,
  VaultWidgetRequestStep,
  VaultWidgetTransactionIntent,
  VaultWidgetTransactionPlan,
  VaultWidgetWalletType
} from './types'

export type BuildTransactionPlanParams = {
  intent: VaultWidgetTransactionIntent
  allowances?: readonly bigint[]
  connectedChainId?: number
  walletType?: VaultWidgetWalletType
}

function buildApprovalSteps(
  intent: VaultWidgetTransactionIntent,
  allowances: readonly bigint[]
): VaultWidgetRequestStep[] {
  return (intent.approvals ?? []).flatMap((approval, index) => {
    const allowance = allowances[index] ?? 0n
    if (allowance >= approval.amount) return []

    const approveRequest = {
      chainId: approval.token.chainId,
      to: approval.token.address,
      data: encodeFunctionData({
        abi: erc20Abi,
        functionName: 'approve',
        args: [approval.spender, approval.amount]
      })
    }
    const approveStep: VaultWidgetRequestStep = {
      id: `approve-${index}`,
      kind: 'approve',
      label: `Approve ${approval.token.symbol}`,
      chainId: approval.token.chainId,
      request: approveRequest
    }

    if (!approval.resetBeforeApproval || allowance === 0n) {
      return [approveStep]
    }

    return [
      {
        id: `reset-approval-${index}`,
        kind: 'reset-approval',
        label: `Reset ${approval.token.symbol} approval`,
        chainId: approval.token.chainId,
        request: {
          chainId: approval.token.chainId,
          to: approval.token.address,
          data: encodeFunctionData({
            abi: erc20Abi,
            functionName: 'approve',
            args: [approval.spender, 0n]
          })
        }
      },
      approveStep
    ]
  })
}

function buildExecutionSteps(intent: VaultWidgetTransactionIntent): VaultWidgetRequestStep[] {
  return intent.calls.map(({ id, label, request }) => ({
    id,
    kind: 'execute',
    label,
    chainId: request.chainId,
    request
  }))
}

function addChainSwitchSteps(
  steps: readonly VaultWidgetRequestStep[],
  connectedChainId?: number
): VaultWidgetExecutionStep[] {
  return steps.reduce<{
    activeChainId?: number
    steps: VaultWidgetExecutionStep[]
    switchIndex: number
  }>(
    (state, step) => {
      if (step.chainId === state.activeChainId) {
        return {
          activeChainId: state.activeChainId,
          steps: state.steps.concat(step),
          switchIndex: state.switchIndex
        }
      }

      return {
        activeChainId: step.chainId,
        steps: state.steps.concat(
          {
            id: `switch-chain-${step.chainId}-${state.switchIndex}`,
            kind: 'switch-chain',
            label: `Switch to chain ${step.chainId}`,
            chainId: step.chainId
          },
          step
        ),
        switchIndex: state.switchIndex + 1
      }
    },
    {
      activeChainId: connectedChainId,
      steps: [],
      switchIndex: 0
    }
  ).steps
}

function buildSafeProposalSteps(steps: readonly VaultWidgetRequestStep[]): VaultWidgetExecutionStep[] {
  function groupByChain(remaining: readonly VaultWidgetRequestStep[], proposalIndex = 0): VaultWidgetExecutionStep[] {
    const first = remaining[0]
    if (!first) return []

    const nextChainBoundary = remaining.slice(1).findIndex(({ chainId }) => chainId !== first.chainId)
    const groupLength = nextChainBoundary === -1 ? remaining.length : nextChainBoundary + 1
    const group = remaining.slice(0, groupLength)
    const requests = group.map(({ request }) => request)

    return [
      {
        id: `safe-proposal-${first.chainId}-${proposalIndex}`,
        kind: 'safe-proposal',
        label: requests.length === 1 ? 'Propose transaction' : `Propose ${requests.length} transactions`,
        chainId: first.chainId,
        requests
      },
      ...groupByChain(remaining.slice(groupLength), proposalIndex + 1)
    ]
  }

  return groupByChain(steps)
}

export function buildTransactionPlan({
  intent,
  allowances = [],
  connectedChainId,
  walletType = 'eoa'
}: BuildTransactionPlanParams): VaultWidgetTransactionPlan {
  const transactionSteps = [...buildApprovalSteps(intent, allowances), ...buildExecutionSteps(intent)]
  const executionSteps =
    walletType === 'safe'
      ? buildSafeProposalSteps(transactionSteps)
      : addChainSwitchSteps(transactionSteps, connectedChainId)

  return {
    id: intent.id,
    intent,
    walletType,
    steps: [
      ...executionSteps,
      {
        id: 'refresh',
        kind: 'refresh',
        label: 'Refresh balances'
      }
    ]
  }
}
