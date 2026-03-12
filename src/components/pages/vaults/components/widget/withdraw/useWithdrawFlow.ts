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
  stakingSource?: string
  // Amounts
  amount: bigint
  currentAmount: bigint
  requiredShares: bigint
  maxShares: bigint
  redeemSharesOverride?: bigint
  isMaxWithdraw: boolean
  unstakeMaxRedeemShares: bigint
  allowDirectWithdrawStep?: boolean
  optimisticApprovedShares?: bigint | null
  // Account & chain
  account?: Address
  chainId: number
  destinationChainId: number
  outputChainId: number
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
  directWithdrawFlow: UseWidgetWithdrawFlowReturn
  directUnstakeFlow: UseWidgetWithdrawFlowReturn
}

export function useWithdrawFlow({
  withdrawToken,
  assetAddress,
  vaultAddress,
  sourceToken,
  stakingAddress,
  stakingSource,
  amount,
  currentAmount,
  requiredShares,
  maxShares,
  redeemSharesOverride,
  isMaxWithdraw,
  unstakeMaxRedeemShares,
  allowDirectWithdrawStep = true,
  optimisticApprovedShares,
  account,
  chainId,
  destinationChainId,
  outputChainId,
  vaultDecimals,
  outputDecimals,
  pricePerShare,
  slippage,
  withdrawalSource,
  isUnstake,
  isDebouncing,
  useErc4626
}: UseWithdrawFlowProps): WithdrawFlowResult {
  const routeType = useWithdrawRoute({
    vaultAddress,
    withdrawToken,
    assetAddress,
    withdrawalSource,
    chainId,
    outputChainId,
    isUnstake
  })
  const isDirectWithdrawRoute = routeType === 'DIRECT_WITHDRAW'
  const isDirectUnstakeRoute = routeType === 'DIRECT_UNSTAKE'
  const isDirectUnstakeWithdrawRoute = routeType === 'DIRECT_UNSTAKE_WITHDRAW'
  const isEnsoRoute = routeType === 'ENSO'

  const isYvUsdLockedZapFlow = useMemo(
    () =>
      isDirectWithdrawRoute &&
      withdrawalSource === 'vault' &&
      chainId === outputChainId &&
      toAddress(vaultAddress) === YVUSD_LOCKED_ADDRESS &&
      toAddress(assetAddress) !== YVUSD_UNLOCKED_ADDRESS &&
      toAddress(withdrawToken) === toAddress(assetAddress),
    [isDirectWithdrawRoute, withdrawalSource, chainId, outputChainId, vaultAddress, assetAddress, withdrawToken]
  )
  const directWithdrawEnabled =
    allowDirectWithdrawStep &&
    (isDirectWithdrawRoute || isDirectUnstakeWithdrawRoute) &&
    amount > 0n &&
    !isYvUsdLockedZapFlow
  const directUnstakeEnabled = (isDirectUnstakeRoute || isDirectUnstakeWithdrawRoute) && currentAmount > 0n
  const ensoEnabled = isEnsoRoute && !!withdrawToken && !isDebouncing && requiredShares > 0n && currentAmount > 0n

  const directWithdraw = useDirectWithdraw({
    vaultAddress,
    amount,
    maxShares,
    redeemSharesOverride,
    redeemAll: isMaxWithdraw,
    pricePerShare,
    account,
    chainId,
    vaultDecimals,
    enabled: directWithdrawEnabled,
    useErc4626
  })

  const yvUsdLockedZapWithdraw = useYvUsdLockedZapWithdraw({
    amount,
    requiredShares,
    optimisticApprovedShares,
    account,
    chainId,
    enabled: isYvUsdLockedZapFlow && amount > 0n
  })

  const directUnstake = useDirectUnstake({
    stakingAddress,
    stakingSource,
    amount: requiredShares,
    redeemAll: isMaxWithdraw,
    maxRedeemShares: unstakeMaxRedeemShares,
    account,
    chainId,
    enabled: directUnstakeEnabled
  })

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
    enabled: ensoEnabled,
    slippage: slippage * 100
  })

  const activeFlow = useMemo((): UseWidgetWithdrawFlowReturn => {
    if (isDirectWithdrawRoute) {
      return isYvUsdLockedZapFlow ? yvUsdLockedZapWithdraw : directWithdraw
    }
    if (isDirectUnstakeRoute) {
      return directUnstake
    }
    if (isDirectUnstakeWithdrawRoute) {
      return {
        actions: {
          prepareWithdraw: directUnstake.actions.prepareWithdraw
        },
        periphery: {
          prepareApproveEnabled: false,
          prepareWithdrawEnabled: directUnstake.periphery.prepareWithdrawEnabled,
          isAllowanceSufficient: true,
          allowance: directWithdraw.periphery.allowance,
          expectedOut: directWithdraw.periphery.expectedOut,
          isLoadingRoute:
            directUnstake.actions.prepareWithdraw.isLoading ||
            directUnstake.actions.prepareWithdraw.isFetching ||
            directWithdraw.actions.prepareWithdraw.isLoading ||
            directWithdraw.actions.prepareWithdraw.isFetching,
          isCrossChain: false,
          error: undefined
        }
      }
    }
    return ensoFlow
  }, [
    isDirectWithdrawRoute,
    isDirectUnstakeRoute,
    isDirectUnstakeWithdrawRoute,
    isYvUsdLockedZapFlow,
    yvUsdLockedZapWithdraw,
    directWithdraw,
    directUnstake,
    ensoFlow
  ])

  return {
    routeType,
    activeFlow,
    directWithdrawFlow: directWithdraw,
    directUnstakeFlow: directUnstake
  }
}
