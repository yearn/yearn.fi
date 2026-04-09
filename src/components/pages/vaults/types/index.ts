import type { AppUseSimulateContractReturnType } from '@shared/hooks/useAppWagmi'
import type { TAddress, TNormalizedBN } from '@shared/types'
import type { Hex } from 'viem'

export type T<Actions, Periphery> = {
  actions: Actions
  periphery: Periphery
}

export type UseStakeReturn = T<
  {
    prepareApprove: AppUseSimulateContractReturnType
    prepareStake: AppUseSimulateContractReturnType
  },
  {
    prepareApproveEnabled: boolean
    prepareStakeEnabled: boolean
    balance: TNormalizedBN
    expectedStakeAmount: TNormalizedBN
  }
>

export type UseUnstakeReturn = T<
  {
    prepareUnstake: AppUseSimulateContractReturnType
  },
  {
    prepareUnstakeEnabled: boolean
    balance: TNormalizedBN
  }
>

export type UseDepositReturn = T<
  {
    prepareApprove: AppUseSimulateContractReturnType
    prepareDeposit: AppUseSimulateContractReturnType
  },
  {
    prepareApproveEnabled: boolean
    prepareDepositEnabled: boolean
    expectedDepositAmount: bigint
    balanceOf: bigint
  }
>

export type UseWithdrawReturn = T<
  {
    prepareWithdraw: AppUseSimulateContractReturnType
  },
  {
    prepareWithdrawEnabled: boolean
    expectedWithdrawAmount: bigint
    maxRedeem: bigint
  }
>

// Unified interface for WidgetDepositFinal flows (direct deposit, direct stake, Enso)
export type UseWidgetDepositFlowReturn = T<
  {
    prepareApprove: AppUseSimulateContractReturnType
    prepareDeposit: AppUseSimulateContractReturnType
  },
  {
    prepareApproveEnabled: boolean
    prepareDepositEnabled: boolean
    isAllowanceSufficient: boolean
    allowance: bigint
    expectedOut: bigint
    minExpectedOut: bigint
    isLoadingRoute: boolean
    isCrossChain: boolean
    tx?: {
      to: TAddress
      data: Hex
      value: string
      from: TAddress
    }
    gas?: string
    routerAddress?: TAddress
    error?: string
  }
>

// Unified interface for WidgetWithdrawFinal flows (direct withdraw, direct unstake, Enso)
export type UseWidgetWithdrawFlowReturn = T<
  {
    prepareWithdraw: AppUseSimulateContractReturnType
    prepareApprove?: AppUseSimulateContractReturnType // Optional: only needed for ENSO withdrawals
  },
  {
    prepareWithdrawEnabled: boolean
    prepareApproveEnabled?: boolean // Optional: only needed for ENSO withdrawals
    isAllowanceSufficient: boolean // always true for direct withdraw (no approval needed)
    allowance: bigint
    expectedOut: bigint
    minExpectedOut: bigint
    isLoadingRoute: boolean
    isCrossChain: boolean
    routerAddress?: TAddress
    tx?: {
      to: TAddress
      data: Hex
      value: string
      from: TAddress
    }
    gas?: string
    error?: string
    resetQuote?: () => void
  }
>

export enum WidgetActionType {
  Deposit = 'deposit',
  Withdraw = 'withdraw',
  Migrate = 'migrate'
}

// Migrate flow types
export type MigrateRouteType = 'permit' | 'approve'

export type UseMigrateFlowReturn = T<
  {
    prepareApprove: AppUseSimulateContractReturnType
    prepareMigrate: AppUseSimulateContractReturnType
    prepareMulticall: AppUseSimulateContractReturnType // For permit flow: multicall(selfPermit + migrate)
  },
  {
    isAllowanceSufficient: boolean
    isCheckingPermit: boolean
    allowance: bigint
    balance: bigint
    prepareApproveEnabled: boolean
    prepareMigrateEnabled: boolean
    prepareMulticallEnabled: boolean
    routeType: MigrateRouteType
    supportsPermit: boolean
    permitDeadline: bigint
    routerAddress: TAddress
    error?: string
  }
>
