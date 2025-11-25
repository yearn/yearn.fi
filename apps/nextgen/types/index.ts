import type { TNormalizedBN } from '@lib/types'
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
export type UseWidgetFlowReturn = T<
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
