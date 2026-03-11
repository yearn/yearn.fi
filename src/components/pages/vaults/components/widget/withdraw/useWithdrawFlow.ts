import { useDirectUnstake } from '@pages/vaults/hooks/actions/useDirectUnstake'
import { useDirectWithdraw } from '@pages/vaults/hooks/actions/useDirectWithdraw'
import { useEnsoWithdraw } from '@pages/vaults/hooks/actions/useEnsoWithdraw'
import { useYvUsdLockedZapWithdraw } from '@pages/vaults/hooks/actions/useYvUsdLockedZapWithdraw'
import type { UseWidgetWithdrawFlowReturn } from '@pages/vaults/types'
import { YVUSD_LOCKED_ADDRESS, YVUSD_UNLOCKED_ADDRESS } from '@pages/vaults/utils/yvUsd'
import { toAddress } from '@shared/utils'
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
  maxShares: bigint
  isMaxWithdraw: boolean
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
  useErc4626: boolean
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
  maxShares,
  isMaxWithdraw,
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
  isDebouncing,
  useErc4626
}: UseWithdrawFlowProps): WithdrawFlowResult => {
  // Determine routing type
  const routeType = useWithdrawRoute({
    vaultAddress,
    withdrawToken,
    assetAddress,
    withdrawalSource,
    chainId,
    outputChainId,
    isUnstake
  })

  const isYvUsdLockedZapFlow = useMemo(
    () =>
      routeType === 'DIRECT_WITHDRAW' &&
      withdrawalSource === 'vault' &&
      chainId === outputChainId &&
      toAddress(vaultAddress) === YVUSD_LOCKED_ADDRESS &&
      toAddress(assetAddress) !== YVUSD_UNLOCKED_ADDRESS &&
      toAddress(withdrawToken) === toAddress(assetAddress),
    [routeType, withdrawalSource, chainId, outputChainId, vaultAddress, assetAddress, withdrawToken]
  )

  // Direct withdraw flow (vault → asset)
  const directWithdraw = useDirectWithdraw({
    vaultAddress,
    assetAddress,
    amount,
    maxShares,
    redeemAll: isMaxWithdraw,
    pricePerShare,
    account,
    chainId,
    decimals: assetDecimals,
    vaultDecimals,
    enabled: routeType === 'DIRECT_WITHDRAW' && amount > 0n && !isYvUsdLockedZapFlow,
    useErc4626
  })

  const yvUsdLockedZapWithdraw = useYvUsdLockedZapWithdraw({
    amount,
    requiredShares,
    account,
    chainId,
    enabled: isYvUsdLockedZapFlow && amount > 0n
  })

  // Direct unstake flow (staking → vault)
  const directUnstake = useDirectUnstake({
    stakingAddress,
    amount: requiredShares,
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
    if (routeType === 'DIRECT_WITHDRAW') {
      return isYvUsdLockedZapFlow ? yvUsdLockedZapWithdraw : directWithdraw
    }
    if (routeType === 'DIRECT_UNSTAKE') return directUnstake
    return ensoFlow
  }, [routeType, isYvUsdLockedZapFlow, yvUsdLockedZapWithdraw, directWithdraw, directUnstake, ensoFlow])

  return {
    routeType,
    activeFlow
  }
}
