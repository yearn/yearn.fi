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

export function buildTransactionPlan({
  allowance,
  connectedChainId,
  mode,
  quote
}: BuildTransactionPlanParams): VaultWidgetTransactionPlan {
  const approvalSteps = buildApprovalSteps(quote, allowance)
  const requiredChainIds = [...approvalSteps.map((step) => step.chainId), quote.transaction.chainId].filter(
    (chainId): chainId is number => chainId !== undefined
  )
  const firstChainId = requiredChainIds[0]
  const switchStep: VaultWidgetExecutionStep[] =
    firstChainId !== undefined && connectedChainId !== firstChainId
      ? [
          {
            id: `switch-chain-${firstChainId}`,
            kind: 'switch-chain',
            label: `Switch to chain ${firstChainId}`,
            chainId: firstChainId
          }
        ]
      : []

  return {
    id: `${mode}:${quote.adapterId}:${quote.transaction.chainId}:${quote.amountIn.toString()}`,
    mode,
    quote,
    steps: [
      ...switchStep,
      ...approvalSteps,
      {
        id: mode,
        kind: 'execute',
        label: mode === 'deposit' ? 'Deposit' : 'Withdraw',
        chainId: quote.transaction.chainId,
        request: quote.transaction
      },
      {
        id: 'refresh',
        kind: 'refresh',
        label: 'Refresh balances'
      }
    ]
  }
}
