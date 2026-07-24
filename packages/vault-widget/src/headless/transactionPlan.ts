import { encodeFunctionData, erc20Abi } from 'viem'
import type {
  VaultWidgetExecutionStep,
  VaultWidgetQuote,
  VaultWidgetTransactionPlan,
  VaultWidgetWalletType
} from '../types'

type BuildTransactionPlanParams = {
  allowance: bigint
  connectedChainId?: number
  mode: VaultWidgetTransactionPlan['mode']
  quote: VaultWidgetQuote
  walletType?: VaultWidgetWalletType
}

function buildApprovalSteps(quote: VaultWidgetQuote, allowance: bigint): VaultWidgetExecutionStep[] {
  const approval = quote.approval
  if (!approval || allowance >= approval.amount) return []

  const resetStep: VaultWidgetExecutionStep[] =
    approval.resetBeforeApproval && allowance > 0n
      ? [
          {
            id: 'reset-approval',
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
          }
        ]
      : []

  return [
    ...resetStep,
    {
      id: 'approve',
      kind: 'approve',
      label: `Approve ${approval.token.symbol}`,
      chainId: approval.token.chainId,
      request: {
        chainId: approval.token.chainId,
        to: approval.token.address,
        data: encodeFunctionData({
          abi: erc20Abi,
          functionName: 'approve',
          args: [approval.spender, approval.amount]
        })
      }
    }
  ]
}

function getExecutionLabel(mode: VaultWidgetTransactionPlan['mode']): string {
  if (mode === 'deposit') return 'Deposit'
  if (mode === 'withdraw') return 'Withdraw'
  if (mode === 'migrate') return 'Migrate'
  return 'Claim rewards'
}

function buildExecutionSteps(
  quote: VaultWidgetQuote,
  mode: VaultWidgetTransactionPlan['mode']
): VaultWidgetExecutionStep[] {
  const calls = quote.transactions ?? [
    {
      id: mode,
      label: getExecutionLabel(mode),
      transaction: quote.transaction
    }
  ]

  return calls.map((call) => ({
    id: call.id,
    kind: 'execute',
    label: call.label,
    chainId: call.transaction.chainId,
    request: call.transaction
  }))
}

function addChainSwitchSteps(
  steps: readonly VaultWidgetExecutionStep[],
  connectedChainId?: number
): VaultWidgetExecutionStep[] {
  return steps.reduce<{ chainId?: number; steps: VaultWidgetExecutionStep[] }>(
    (state, step) => {
      if (step.chainId === undefined || step.chainId === state.chainId) {
        return {
          chainId: step.chainId ?? state.chainId,
          steps: [...state.steps, step]
        }
      }

      return {
        chainId: step.chainId,
        steps: [
          ...state.steps,
          {
            id: `switch-chain-${step.chainId}`,
            kind: 'switch-chain',
            label: `Switch to chain ${step.chainId}`,
            chainId: step.chainId
          },
          step
        ]
      }
    },
    { chainId: connectedChainId, steps: [] }
  ).steps
}

function buildSafeProposalSteps(steps: readonly VaultWidgetExecutionStep[]): VaultWidgetExecutionStep[] {
  const executableSteps = steps.filter(
    (
      step
    ): step is VaultWidgetExecutionStep & {
      chainId: number
      request: NonNullable<VaultWidgetExecutionStep['request']>
    } => step.request !== undefined && step.chainId !== undefined
  )

  function groupByChain(remaining: typeof executableSteps, index = 0): VaultWidgetExecutionStep[] {
    const first = remaining[0]
    if (!first) return []
    const boundary = remaining.slice(1).findIndex(({ chainId }) => chainId !== first.chainId)
    const groupLength = boundary === -1 ? remaining.length : boundary + 1
    const group = remaining.slice(0, groupLength)
    const requests = group.map(({ request }) => request)

    return [
      {
        id: `safe-proposal-${first.chainId}-${index}`,
        kind: 'safe-proposal',
        label: requests.length === 1 ? 'Propose transaction' : `Propose ${requests.length} transactions`,
        chainId: first.chainId,
        requests
      },
      ...groupByChain(remaining.slice(groupLength), index + 1)
    ]
  }

  return groupByChain(executableSteps)
}

export function buildTransactionPlan({
  allowance,
  connectedChainId,
  mode,
  quote,
  walletType = 'eoa'
}: BuildTransactionPlanParams): VaultWidgetTransactionPlan {
  const approvalSteps = buildApprovalSteps(quote, allowance)
  const executionSteps = buildExecutionSteps(quote, mode)
  const transactionSteps =
    walletType === 'safe'
      ? buildSafeProposalSteps([...approvalSteps, ...executionSteps])
      : addChainSwitchSteps([...approvalSteps, ...executionSteps], connectedChainId)
  const crossChainSteps: VaultWidgetExecutionStep[] = quote.bridge
    ? [
        {
          id: 'wait-cross-chain',
          kind: 'wait-cross-chain',
          label: `Complete bridge to chain ${quote.bridge.destinationChainId}`,
          bridge: quote.bridge
        }
      ]
    : []

  return {
    id: `${mode}:${quote.adapterId}:${quote.transaction.chainId}:${quote.amountIn.toString()}`,
    mode,
    quote,
    walletType,
    steps: [
      ...transactionSteps,
      ...crossChainSteps,
      {
        id: 'refresh',
        kind: 'refresh',
        label: 'Refresh balances'
      }
    ]
  }
}
