import type { DepositRouteType } from '@pages/vaults/components/widget/deposit/types'
import { getDirectStakeCall } from '@pages/vaults/hooks/actions/stakingAdapter'
import { YVUSD_LOCKED_ZAP_ADDRESS } from '@pages/vaults/utils/yvUsd'
import { vaultAbi } from '@shared/contracts/abi/vaultV2.abi'
import { yvUsdLockedZapAbi } from '@shared/contracts/abi/yvUsdLockedZap.abi'
import { getApproveAbi } from '@shared/utils/approve'
import type { Address, Hex } from 'viem'
import { encodeFunctionData, isAddressEqual } from 'viem'

export type TSafeBatchCall = {
  to: Address
  data: Hex
  value?: bigint
}

type TEnsoTransaction = {
  to: Address
  data: Hex
  value: string
}

type TBuildSafeDepositBatchParams = {
  routeType: DepositRouteType
  account?: Address
  depositToken: Address
  amount: bigint
  currentAllowance?: bigint
  chainId: number
  vaultAddress: Address
  stakingAddress?: Address
  stakingSource?: string
  approvalSpenderAddress?: Address
  routerAddress?: Address
  ensoTx?: TEnsoTransaction
}

function buildApproveCall({
  depositToken,
  approvalSpenderAddress,
  amount
}: {
  depositToken: Address
  approvalSpenderAddress: Address
  amount: bigint
}): TSafeBatchCall {
  return {
    to: depositToken,
    data: encodeFunctionData({
      abi: getApproveAbi(depositToken),
      functionName: 'approve',
      args: [approvalSpenderAddress, amount]
    }),
    value: 0n
  }
}

function buildApprovalCalls({
  depositToken,
  approvalSpenderAddress,
  amount,
  currentAllowance = 0n
}: {
  depositToken: Address
  approvalSpenderAddress: Address
  amount: bigint
  currentAllowance?: bigint
}): TSafeBatchCall[] {
  const approveAmountCall = buildApproveCall({
    depositToken,
    approvalSpenderAddress,
    amount
  })

  if (currentAllowance <= 0n) {
    return [approveAmountCall]
  }

  return [
    buildApproveCall({
      depositToken,
      approvalSpenderAddress,
      amount: 0n
    }),
    approveAmountCall
  ]
}

function buildDirectDepositCall(params: TBuildSafeDepositBatchParams & { account: Address }): TSafeBatchCall {
  if (params.routerAddress && isAddressEqual(params.routerAddress, YVUSD_LOCKED_ZAP_ADDRESS)) {
    return {
      to: YVUSD_LOCKED_ZAP_ADDRESS,
      data: encodeFunctionData({
        abi: yvUsdLockedZapAbi,
        functionName: 'zapIn',
        args: [params.amount, params.account]
      }),
      value: 0n
    }
  }

  return {
    to: params.vaultAddress,
    data: encodeFunctionData({
      abi: vaultAbi,
      functionName: 'deposit',
      args: [params.amount, params.account]
    }),
    value: 0n
  }
}

function buildDirectStakeCall(params: TBuildSafeDepositBatchParams & { account: Address }): TSafeBatchCall | undefined {
  if (!params.stakingAddress) {
    return undefined
  }

  const stakeCall = getDirectStakeCall({
    stakingSource: params.stakingSource,
    amount: params.amount,
    account: params.account
  })

  if (!stakeCall.args) {
    return undefined
  }

  return {
    to: params.stakingAddress,
    data: encodeFunctionData({
      abi: stakeCall.abi,
      functionName: stakeCall.functionName,
      args: stakeCall.args
    }),
    value: 0n
  }
}

function buildEnsoCall(ensoTx?: TEnsoTransaction): TSafeBatchCall | undefined {
  if (!ensoTx) {
    return undefined
  }

  return {
    to: ensoTx.to,
    data: ensoTx.data,
    value: BigInt(ensoTx.value || 0)
  }
}

export function buildSafeDepositBatch(
  params: TBuildSafeDepositBatchParams
): { calls: readonly TSafeBatchCall[]; chainId: number } | undefined {
  if (!params.account || !params.approvalSpenderAddress || params.amount <= 0n) {
    return undefined
  }

  const approvalCalls = buildApprovalCalls({
    depositToken: params.depositToken,
    approvalSpenderAddress: params.approvalSpenderAddress,
    amount: params.amount,
    currentAllowance: params.currentAllowance
  })
  const executionCall =
    params.routeType === 'DIRECT_DEPOSIT'
      ? buildDirectDepositCall({ ...params, account: params.account })
      : params.routeType === 'DIRECT_STAKE'
        ? buildDirectStakeCall({ ...params, account: params.account })
        : buildEnsoCall(params.ensoTx)

  if (!executionCall) {
    return undefined
  }

  return {
    calls: [...approvalCalls, executionCall],
    chainId: params.chainId
  }
}
