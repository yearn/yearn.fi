import { YVUSD_LOCKED_ZAP_ADDRESS } from '@pages/vaults/utils/yvUsd'
import { yvUsdLockedZapAbi } from '@shared/contracts/abi/yvUsdLockedZap.abi'
import { getApproveAbi } from '@shared/utils/approve'
import type { Address, Hex } from 'viem'
import { encodeFunctionData, isAddressEqual } from 'viem'
import type { WithdrawRouteType } from './types'

type TSafeBatchCall = {
  to: Address
  data: Hex
  value?: bigint
}

type TEnsoTransaction = {
  to: Address
  data: Hex
  value: string
}

type TBuildSafeWithdrawBatchParams = {
  routeType: WithdrawRouteType
  account?: Address
  sourceToken: Address
  amount: bigint
  currentAllowance?: bigint
  chainId: number
  approvalSpenderAddress?: Address
  routerAddress?: Address
  ensoTx?: TEnsoTransaction
}

function buildApproveCall({
  sourceToken,
  approvalSpenderAddress,
  amount
}: {
  sourceToken: Address
  approvalSpenderAddress: Address
  amount: bigint
}): TSafeBatchCall {
  return {
    to: sourceToken,
    data: encodeFunctionData({
      abi: getApproveAbi(sourceToken),
      functionName: 'approve',
      args: [approvalSpenderAddress, amount]
    }),
    value: 0n
  }
}

function buildApprovalCalls({
  sourceToken,
  approvalSpenderAddress,
  amount,
  currentAllowance = 0n
}: {
  sourceToken: Address
  approvalSpenderAddress: Address
  amount: bigint
  currentAllowance?: bigint
}): TSafeBatchCall[] {
  const approveAmountCall = buildApproveCall({
    sourceToken,
    approvalSpenderAddress,
    amount
  })

  if (currentAllowance <= 0n) {
    return [approveAmountCall]
  }

  return [
    buildApproveCall({
      sourceToken,
      approvalSpenderAddress,
      amount: 0n
    }),
    approveAmountCall
  ]
}

function buildYvUsdLockedZapWithdrawCall(params: TBuildSafeWithdrawBatchParams & { account: Address }): TSafeBatchCall {
  return {
    to: YVUSD_LOCKED_ZAP_ADDRESS,
    data: encodeFunctionData({
      abi: yvUsdLockedZapAbi,
      functionName: 'zapOut',
      args: [params.amount, params.account]
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

export function buildSafeWithdrawBatch(
  params: TBuildSafeWithdrawBatchParams
): { calls: readonly TSafeBatchCall[]; chainId: number } | undefined {
  if (!params.account || !params.approvalSpenderAddress || params.amount <= 0n) {
    return undefined
  }

  const approvalCalls = buildApprovalCalls({
    sourceToken: params.sourceToken,
    approvalSpenderAddress: params.approvalSpenderAddress,
    amount: params.amount,
    currentAllowance: params.currentAllowance
  })
  const executionCall =
    params.routeType === 'ENSO'
      ? buildEnsoCall(params.ensoTx)
      : params.routeType === 'DIRECT_WITHDRAW' &&
          params.routerAddress &&
          isAddressEqual(params.routerAddress, YVUSD_LOCKED_ZAP_ADDRESS)
        ? buildYvUsdLockedZapWithdrawCall({ ...params, account: params.account })
        : undefined

  if (!executionCall) {
    return undefined
  }

  return {
    calls: [...approvalCalls, executionCall],
    chainId: params.chainId
  }
}
