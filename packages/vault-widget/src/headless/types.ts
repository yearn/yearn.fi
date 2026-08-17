import type { Address, Hash, Hex, TransactionReceipt } from 'viem'

export type VaultWidgetTransactionMode = 'deposit' | 'withdraw'

export type VaultWidgetTransactionRequest = {
  chainId: number
  to: Address
  data: Hex
  value?: bigint
}

export type VaultWidgetApprovalToken = {
  address: Address
  chainId: number
  symbol: string
}

export type VaultWidgetApprovalRequirement = {
  token: VaultWidgetApprovalToken
  spender: Address
  amount: bigint
  resetBeforeApproval?: boolean
}

export type VaultWidgetExecutionCall = {
  id: string
  label: string
  request: VaultWidgetTransactionRequest
}

export type VaultWidgetTransactionIntent = {
  id: string
  mode: VaultWidgetTransactionMode
  approvals?: readonly VaultWidgetApprovalRequirement[]
  calls: readonly VaultWidgetExecutionCall[]
}

export type VaultWidgetWalletType = 'eoa' | 'safe'

export type VaultWidgetSwitchChainStep = {
  id: string
  kind: 'switch-chain'
  label: string
  chainId: number
}

export type VaultWidgetRequestStep = {
  id: string
  kind: 'reset-approval' | 'approve' | 'execute'
  label: string
  chainId: number
  request: VaultWidgetTransactionRequest
}

export type VaultWidgetSafeProposalStep = {
  id: string
  kind: 'safe-proposal'
  label: string
  chainId: number
  requests: readonly VaultWidgetTransactionRequest[]
}

export type VaultWidgetRefreshStep = {
  id: string
  kind: 'refresh'
  label: string
}

export type VaultWidgetExecutionStep =
  | VaultWidgetSwitchChainStep
  | VaultWidgetRequestStep
  | VaultWidgetSafeProposalStep
  | VaultWidgetRefreshStep

export type VaultWidgetTransactionPlan = {
  id: string
  intent: VaultWidgetTransactionIntent
  walletType: VaultWidgetWalletType
  steps: readonly VaultWidgetExecutionStep[]
}

export type VaultWidgetPlanSubmission = {
  stepId: string
  chainId: number
  proposalId?: Hex
  hash?: Hash
  receipt?: TransactionReceipt
}

export type VaultWidgetPlanOutcome = {
  submissions: readonly VaultWidgetPlanSubmission[]
}

export type VaultWidgetTransactionReplacement = {
  reason: 'cancelled' | 'replaced' | 'repriced'
  replacedHash: Hash
}

export type VaultWidgetTransactionReceiptResult = {
  receipt: TransactionReceipt
  replacement?: VaultWidgetTransactionReplacement
}

export type VaultWidgetExecutionAdapter = {
  switchChain: (params: { chainId: number }) => Promise<void>
  execute: (params: { account: Address; request: VaultWidgetTransactionRequest }) => Promise<Hash>
  waitForReceipt: (params: { chainId: number; hash: Hash }) => Promise<VaultWidgetTransactionReceiptResult>
  proposeSafeBatch?: (params: {
    account: Address
    chainId: number
    requests: readonly VaultWidgetTransactionRequest[]
  }) => Promise<Hex>
  waitForSafeExecution?: (params: { chainId: number; proposalId: Hex }) => Promise<Hash>
}

type VaultWidgetPlanExecutionProgress = {
  outcome: VaultWidgetPlanOutcome
  stepIndex: number
  stepCount: number
}

export type VaultWidgetPlanExecutionState =
  | (VaultWidgetPlanExecutionProgress & {
      status: 'confirming'
      step: VaultWidgetSwitchChainStep | VaultWidgetRequestStep | VaultWidgetSafeProposalStep
    })
  | (VaultWidgetPlanExecutionProgress & {
      status: 'pending'
      step: VaultWidgetRequestStep | VaultWidgetSafeProposalStep
    })
  | (VaultWidgetPlanExecutionProgress & {
      status: 'submitted'
      step: VaultWidgetSafeProposalStep
    })
  | (VaultWidgetPlanExecutionProgress & {
      status: 'refreshing'
      step: VaultWidgetRefreshStep
    })
  | (VaultWidgetPlanExecutionProgress & {
      status: 'success'
    })
  | (VaultWidgetPlanExecutionProgress & {
      status: 'error'
      error: Error
      step: VaultWidgetExecutionStep
    })
