import type { UseSimulateContractReturnType } from 'wagmi'

export type T<Actions, Periphery> = {
  actions: Actions
  periphery: Periphery
}

export type UseDepositReturn = T<
  {
    prepareApprove: UseSimulateContractReturnType
    prepareDeposit: UseSimulateContractReturnType
  },
  {
    prepareApproveEnabled: boolean
    prepareDepositEnabled: boolean
  }
>

export type UseWithdrawReturn = T<
  {
    prepareWithdraw: UseSimulateContractReturnType
  },
  {
    prepareWithdrawEnabled: boolean
  }
>

export enum WidgetActionType {
  Deposit = 'deposit',
  Withdraw = 'withdraw',
  Stake = 'stake',
  Unstake = 'unstake'
}
