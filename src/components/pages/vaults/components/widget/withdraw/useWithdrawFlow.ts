import { useDirectUnstake } from '@pages/vaults/hooks/actions/useDirectUnstake'
import { useDirectWithdraw } from '@pages/vaults/hooks/actions/useDirectWithdraw'
import { useEnsoWithdraw } from '@pages/vaults/hooks/actions/useEnsoWithdraw'
import type { UseWidgetWithdrawFlowReturn } from '@pages/vaults/types'
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

export const useWithdrawFlow = ({
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
}: UseWithdrawFlowProps): WithdrawFlowResult => {
  // Determine routing type
  const routeType = useWithdrawRoute({
    withdrawToken,
    assetAddress,
    withdrawalSource,
    chainId,
    outputChainId,
    isUnstake
  })

  // Direct withdraw flow (vault → asset)
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
    enabled:
      allowDirectWithdrawStep &&
      (routeType === 'DIRECT_WITHDRAW' || routeType === 'DIRECT_UNSTAKE_WITHDRAW') &&
      amount > 0n,
    useErc4626
  })

  // Direct unstake flow (staking → vault)
  const directUnstake = useDirectUnstake({
    stakingAddress,
    stakingSource,
    amount: requiredShares,
    redeemAll: isMaxWithdraw,
    maxRedeemShares: unstakeMaxRedeemShares,
    account,
    chainId,
    enabled: (routeType === 'DIRECT_UNSTAKE' || routeType === 'DIRECT_UNSTAKE_WITHDRAW') && currentAmount > 0n
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
    if (routeType === 'DIRECT_UNSTAKE_WITHDRAW') {
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
  }, [routeType, directWithdraw, directUnstake, ensoFlow])

  return {
    routeType,
    activeFlow,
    directWithdrawFlow: directWithdraw,
    directUnstakeFlow: directUnstake
  }
}
