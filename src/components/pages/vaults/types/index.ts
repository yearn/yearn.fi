import type { TAddress, TNormalizedBN } from '@shared/types'
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
    allowance: bigint
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
    allowance: bigint
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
    resetQuote?: () => void
  }
>

export enum WidgetActionType {
  Deposit = 'deposit',
  Withdraw = 'withdraw',
  Migrate = 'migrate'
}

// Migrate flow types
export type MigrateRouteType = 'PERMIT' | 'APPROVE'

export type MigratePermitData = {
  domain: {
    name: string
    version: string
    chainId: number
    verifyingContract: TAddress
  }
  types: {
    Permit: { name: string; type: string }[]
  }
  primaryType: 'Permit'
  message: {
    owner: TAddress
    spender: TAddress
    value: bigint
    nonce: bigint
    deadline: bigint
  }
}

export type UseMigrateFlowReturn = T<
  {
    prepareApprove: UseSimulateContractReturnType
    prepareMigrate: UseSimulateContractReturnType
  },
  {
    routeType: MigrateRouteType
    supportsPermit: boolean
    isAllowanceSufficient: boolean
    allowance: bigint
    balance: bigint
    prepareApproveEnabled: boolean
    prepareMigrateEnabled: boolean
    permitSignature: `0x${string}` | undefined
    setPermitSignature: (sig: `0x${string}` | undefined) => void
    permitData?: MigratePermitData
    deadline: bigint
    error?: string
  }
>
