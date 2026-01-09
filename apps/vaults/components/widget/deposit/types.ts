import type { UseSimulateContractReturnType } from 'wagmi'

export type DepositRouteType = 'DIRECT_DEPOSIT' | 'DIRECT_STAKE' | 'ENSO'

export interface DepositFlowActions {
  prepareApprove: UseSimulateContractReturnType
  prepareDeposit: UseSimulateContractReturnType
}

export interface DepositFlowPeriphery {
  prepareApproveEnabled: boolean
  prepareDepositEnabled: boolean
  isAllowanceSufficient: boolean
  expectedOut: bigint
  isLoadingRoute: boolean
  isCrossChain: boolean
  routerAddress?: string
  error?: unknown
}

export interface DepositFlow {
  actions: DepositFlowActions
  periphery: DepositFlowPeriphery
}

export interface DepositWidgetProps {
  vaultAddress: `0x${string}`
  assetAddress: `0x${string}`
  stakingAddress?: `0x${string}`
  chainId: number
  vaultAPR: number
  vaultSymbol: string
  stakingSource?: string
  handleDepositSuccess?: () => void
}

export interface DepositState {
  selectedToken?: `0x${string}`
  selectedChainId?: number
  showVaultSharesModal: boolean
  showAnnualReturnModal: boolean
  showTokenSelector: boolean
}
