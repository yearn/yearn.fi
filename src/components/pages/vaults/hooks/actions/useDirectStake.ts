'use client'

import type { UseWidgetDepositFlowReturn } from '@pages/vaults/types'
import { getApproveAbi } from '@shared/utils/approve'
import type { Address } from 'viem'
import { type UseSimulateContractReturnType, useReadContract, useSimulateContract } from 'wagmi'
import { useTokenAllowance } from '../useTokenAllowance'
import { getDirectStakeCall, getStakePreviewCall, normalizeStakingSource } from './stakingAdapter'

interface UseDirectStakeParams {
  stakingAddress?: Address
  vaultAddress: Address
  amount: bigint
  account?: Address
  chainId: number
  decimals: number
  stakingSource?: string // 'VeYFI' | 'yBOLD' | undefined (default)
  enabled: boolean
}

export function useDirectStake(params: UseDirectStakeParams): UseWidgetDepositFlowReturn {
  // Check current allowance (vault tokens → staking contract)
  const { allowance = 0n } = useTokenAllowance({
    account: params.account,
    token: params.vaultAddress,
    spender: params.stakingAddress,
    watch: true,
    chainId: params.chainId
  })

  const stakingSource = normalizeStakingSource(params.stakingSource)
  const previewCall = getStakePreviewCall(params.stakingSource, params.amount)

  const { data: previewExpectedAmountData } = useReadContract({
    address: params.stakingAddress,
    abi: (previewCall?.abi || []) as any,
    functionName: (previewCall?.functionName || 'previewDeposit') as any,
    args: previewCall?.args as any,
    chainId: params.chainId,
    query: {
      enabled: params.enabled && params.amount > 0n && !!params.stakingAddress && !!previewCall
    }
  })

  const previewExpectedAmount = (previewExpectedAmountData as bigint | undefined) ?? 0n
  const expectedOut = stakingSource === 'default' ? params.amount : previewExpectedAmount

  const isValidInput = params.amount > 0n && !!params.stakingAddress
  const isAllowanceSufficient = allowance >= params.amount
  const prepareApproveEnabled = !isAllowanceSufficient && isValidInput && !!params.account
  const prepareDepositEnabled = isAllowanceSufficient && isValidInput && !!params.account

  // Prepare approve transaction
  const prepareApprove: UseSimulateContractReturnType = useSimulateContract({
    abi: getApproveAbi(params.vaultAddress),
    functionName: 'approve',
    address: params.vaultAddress,
    args: params.amount > 0n && params.stakingAddress ? [params.stakingAddress, params.amount] : undefined,
    chainId: params.chainId,
    query: { enabled: prepareApproveEnabled }
  })

  const stakeCall = getDirectStakeCall({
    stakingSource: params.stakingSource,
    amount: params.amount,
    account: params.account
  })

  const prepareDeposit: UseSimulateContractReturnType = useSimulateContract({
    abi: stakeCall.abi as any,
    functionName: stakeCall.functionName as any,
    address: params.stakingAddress,
    args: stakeCall.args as any,
    account: params.account,
    chainId: params.chainId,
    query: { enabled: prepareDepositEnabled }
  })

  return {
    actions: {
      prepareApprove,
      prepareDeposit // Renamed from prepareStake for unified interface
    },
    periphery: {
      prepareApproveEnabled,
      prepareDepositEnabled, // Renamed from prepareStakeEnabled for unified interface
      isAllowanceSufficient,
      allowance,
      expectedOut, // Renamed from expectedStakeAmount for unified interface
      isLoadingRoute: false,
      isCrossChain: false,
      error: undefined
    }
  }
}
