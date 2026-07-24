import { encodeFunctionData, erc20Abi } from 'viem'
import type { VaultWidgetExecutionStep, VaultWidgetQuote, VaultWidgetTransactionPlan } from '../types'

type BuildTransactionPlanParams = {
  allowance: bigint
  connectedChainId?: number
  mode: 'deposit' | 'withdraw'
  quote: VaultWidgetQuote
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

function buildExecutionSteps(quote: VaultWidgetQuote, mode: 'deposit' | 'withdraw'): VaultWidgetExecutionStep[] {
  const calls = quote.transactions ?? [
    {
      id: mode,
      label: mode === 'deposit' ? 'Deposit' : 'Withdraw',
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

export function buildTransactionPlan({
  allowance,
  connectedChainId,
  mode,
  quote
}: BuildTransactionPlanParams): VaultWidgetTransactionPlan {
  const approvalSteps = buildApprovalSteps(quote, allowance)
  const executionSteps = buildExecutionSteps(quote, mode)

  return {
    id: `${mode}:${quote.adapterId}:${quote.transaction.chainId}:${quote.amountIn.toString()}`,
    mode,
    quote,
    steps: [
      ...addChainSwitchSteps([...approvalSteps, ...executionSteps], connectedChainId),
      {
        id: 'refresh',
        kind: 'refresh',
        label: 'Refresh balances'
      }
    ]
  }
}
