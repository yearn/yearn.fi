import { useDirectUnstake } from '@nextgen/hooks/actions/useDirectUnstake'
import { useDirectWithdraw } from '@nextgen/hooks/actions/useDirectWithdraw'
import { useEnsoWithdraw } from '@nextgen/hooks/actions/useEnsoWithdraw'
import type { UseWidgetWithdrawFlowReturn } from '@nextgen/types'
import { useMemo } from 'react'
import type { Address } from 'viem'
import type { WithdrawalSource, WithdrawRouteType } from './types'
import { useWithdrawRoute } from './useWithdrawRoute'

interface UseWithdrawFlowProps {
  // Token addresses
  withdrawToken: Address
  assetAddress: Address
  vaultAddress: Address
  sourceToken: Address
  stakingAddress?: Address
  // Amounts
  amount: bigint
  currentAmount: bigint
  requiredShares: bigint
  // Account & chain
  account?: Address
  chainId: number
  destinationChainId: number
  outputChainId: number
  // Decimals
  assetDecimals: number
  vaultDecimals: number
  outputDecimals: number
  // Price per share
  pricePerShare: bigint
  // Settings
  slippage: number
  withdrawalSource: WithdrawalSource
  isUnstake: boolean
  isDebouncing: boolean
}

export interface WithdrawFlowResult {
  routeType: WithdrawRouteType
  activeFlow: UseWidgetWithdrawFlowReturn
}

export const useWithdrawFlow = ({
  withdrawToken,
  assetAddress,
  vaultAddress,
  sourceToken,
  stakingAddress,
  amount,
  currentAmount,
  requiredShares,
  account,
  chainId,
  destinationChainId,
  outputChainId,
  assetDecimals,
  vaultDecimals,
  outputDecimals,
  pricePerShare,
  slippage,
  withdrawalSource,
  isUnstake,
  isDebouncing
}: UseWithdrawFlowProps): WithdrawFlowResult => {
  // Determine routing type
  const routeType = useWithdrawRoute({
    withdrawToken,
    assetAddress,
    vaultAddress,
    withdrawalSource,
    chainId,
    outputChainId,
    isUnstake
  })

  // Direct withdraw flow (vault → asset)
  const directWithdraw = useDirectWithdraw({
    vaultAddress,
    assetAddress,
    amount,
    pricePerShare,
    account,
    chainId,
    decimals: assetDecimals,
    vaultDecimals,
    enabled: routeType === 'DIRECT_WITHDRAW' && amount > 0n
  })

  // Direct unstake flow (staking → vault)
  const directUnstake = useDirectUnstake({
    stakingAddress,
    amount: currentAmount,
    account,
    chainId,
    enabled: routeType === 'DIRECT_UNSTAKE' && currentAmount > 0n
  })

  // Enso flow (zaps, cross-chain, etc.)
  const ensoFlow = useEnsoWithdraw({
    vaultAddress: sourceToken,
    withdrawToken,
    amount: requiredShares,
    currentAmount,
    account,
    receiver: account,
    chainId,
    destinationChainId,
    decimalsOut: outputDecimals,
    enabled: routeType === 'ENSO' && !!withdrawToken && !isDebouncing && requiredShares > 0n && currentAmount > 0n,
    slippage: slippage * 100
  })

  // Select active flow based on routing type
  const activeFlow = useMemo((): UseWidgetWithdrawFlowReturn => {
    if (routeType === 'DIRECT_WITHDRAW') return directWithdraw
    if (routeType === 'DIRECT_UNSTAKE') return directUnstake
    return ensoFlow
  }, [routeType, directWithdraw, directUnstake, ensoFlow])

  return {
    routeType,
    activeFlow
  }
}
