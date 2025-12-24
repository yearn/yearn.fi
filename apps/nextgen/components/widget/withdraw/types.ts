import type { UseSimulateContractReturnType } from 'wagmi'
import type { Address } from 'viem'

export type WithdrawRouteType = 'DIRECT_WITHDRAW' | 'DIRECT_UNSTAKE' | 'ENSO'

export type WithdrawalSource = 'vault' | 'staking' | null

export interface WithdrawFlowActions {
  prepareApprove: UseSimulateContractReturnType
  prepareWithdraw: UseSimulateContractReturnType
}

export interface WithdrawFlowPeriphery {
  prepareApproveEnabled: boolean
  prepareWithdrawEnabled: boolean
  isAllowanceSufficient: boolean
  expectedOut: bigint
  isLoadingRoute: boolean
  isCrossChain: boolean
  routerAddress?: string
  error?: unknown
}

export interface WithdrawFlow {
  actions: WithdrawFlowActions
  periphery: WithdrawFlowPeriphery
}

export interface WithdrawWidgetProps {
  vaultAddress: Address
  assetAddress: Address
  stakingAddress?: Address
  chainId: number
  vaultSymbol: string
  vaultType?: 'v2' | 'v3'
  handleWithdrawSuccess?: () => void
}

export interface WithdrawState {
  selectedToken?: Address
  selectedChainId?: number
  showWithdrawDetailsModal: boolean
  showTokenSelector: boolean
  withdrawalSource: WithdrawalSource
}
