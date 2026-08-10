import type { Address, Hex } from 'viem'

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
