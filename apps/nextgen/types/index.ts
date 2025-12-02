import type { TAddress, TNormalizedBN } from '@lib/types'
import type { Hex } from 'viem'
import type { UseSimulateContractReturnType } from 'wagmi'

export type T<Actions, Periphery> = {
  actions: Actions
  periphery: Periphery
}

export type UseStakeReturn = T<
  {
    prepareApprove: UseSimulateContractReturnType
    prepareStake: UseSimulateContractReturnType
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
    prepareUnstake: UseSimulateContractReturnType
  },
  {
    prepareUnstakeEnabled: boolean
    balance: TNormalizedBN
  }
>

export type UseDepositReturn = T<
  {
    prepareApprove: UseSimulateContractReturnType
    prepareDeposit: UseSimulateContractReturnType
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
    prepareWithdraw: UseSimulateContractReturnType
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
    prepareApprove: UseSimulateContractReturnType
    prepareDeposit: UseSimulateContractReturnType
  },
  {
    prepareApproveEnabled: boolean
    prepareDepositEnabled: boolean
    isAllowanceSufficient: boolean
    expectedOut: bigint
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
    prepareWithdraw: UseSimulateContractReturnType
    prepareApprove?: UseSimulateContractReturnType // Optional: only needed for ENSO withdrawals
  },
  {
    prepareWithdrawEnabled: boolean
    prepareApproveEnabled?: boolean // Optional: only needed for ENSO withdrawals
    isAllowanceSufficient: boolean // always true for direct withdraw (no approval needed)
    expectedOut: bigint
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
  }
>

export enum WidgetActionType {
  Deposit = 'deposit',
  Withdraw = 'withdraw',
  Stake = 'stake',
  Unstake = 'unstake',
  DepositAndStake = 'deposit & stake',
  UnstakeAndWithdraw = 'unstake & withdraw',
  EnsoDeposit = 'enso deposit',
  EnsoWithdraw = 'enso withdraw',
  DepositGeneric = 'deposit generic',
  WithdrawGeneric = 'withdraw generic',
  DepositFinal = 'deposit final',
  WithdrawFinal = 'withdraw final'
}

export type {
  TNotificationActionParams,
  TNotificationTokenOption,
  TTxButtonNotificationParams
} from './notifications'
