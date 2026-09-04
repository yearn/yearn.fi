import {
  getWithdrawPreviewCall,
  normalizeStakingSource
} from '@yearn/vault-widget/internal/hooks/actions/stakingAdapter'
import { useDirectUnstake } from '@yearn/vault-widget/internal/hooks/actions/useDirectUnstake'
import { useDirectWithdraw } from '@yearn/vault-widget/internal/hooks/actions/useDirectWithdraw'
import { useEnsoWithdraw } from '@yearn/vault-widget/internal/hooks/actions/useEnsoWithdraw'
import { useYBoldZapperWithdraw } from '@yearn/vault-widget/internal/hooks/actions/useYBoldZapperWithdraw'
import { useYvUsdLockedZapWithdraw } from '@yearn/vault-widget/internal/hooks/actions/useYvUsdLockedZapWithdraw'
import type { EnsoQuotePurpose } from '@yearn/vault-widget/internal/hooks/solvers/useSolverEnso'
import { useReadContract } from '@yearn/vault-widget/internal/hooks/useAppWagmi'
import { toAddress } from '@yearn/vault-widget/internal/utils'
import { toBasisPoints } from '@yearn/vault-widget/internal/utils/slippage'
import { YVUSD_LOCKED_ADDRESS, YVUSD_UNLOCKED_ADDRESS } from '@yearn/vault-widget/internal/utils/yvUsd'
import type { UseWidgetWithdrawFlowReturn } from '@yearn/vault-widget/types'
import { useMemo } from 'react'
import type { Address } from 'viem'
import { resolveEnsoWithdrawInputAmount } from './ensoWithdrawAmount'
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
  ensoQuotePurpose: EnsoQuotePurpose
  ensoEnabled: boolean
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
  ensoQuotePurpose,
  ensoEnabled,
  withdrawalSource,
  isUnstake,
  isDebouncing,
  useErc4626
}: UseWithdrawFlowProps): WithdrawFlowResult {
  const routeType = useWithdrawRoute({
    vaultAddress,
    sourceToken,
    withdrawToken,
    assetAddress,
    stakingAddress,
    withdrawalSource,
    chainId,
    outputChainId,
    isUnstake,
    ensoEnabled
  })
  const isDirectWithdrawRoute = routeType === 'DIRECT_WITHDRAW'
  const isDirectUnstakeRoute = routeType === 'DIRECT_UNSTAKE'
  const isDirectUnstakeWithdrawRoute = routeType === 'DIRECT_UNSTAKE_WITHDRAW'
  const isYBoldZapperWithdrawRoute = routeType === 'YBOLD_ZAPPER_WITHDRAW'
  const isEnsoRoute = routeType === 'ENSO'
  const isStakingWithdrawal = withdrawalSource === 'staking'
  const stakingSourceKind = normalizeStakingSource(stakingSource)
  const stakingWithdrawPreviewCall = getWithdrawPreviewCall(stakingSource, requiredShares)
  const shouldPreviewStakingShares =
    isEnsoRoute && isStakingWithdrawal && !isMaxWithdraw && !!stakingAddress && requiredShares > 0n
  const {
    data: previewWithdrawSharesData,
    isError: isStakingSharePreviewError,
    isLoading: isLoadingStakingSharePreview,
    isFetching: isFetchingStakingSharePreview
  } = useReadContract({
    address: stakingAddress,
    abi: stakingWithdrawPreviewCall.abi as any,
    functionName: stakingWithdrawPreviewCall.functionName as any,
    args: stakingWithdrawPreviewCall.args as any,
    chainId,
    query: { enabled: shouldPreviewStakingShares }
  })
  const previewWithdrawShares = typeof previewWithdrawSharesData === 'bigint' ? previewWithdrawSharesData : undefined
  const didStakingSharePreviewFail = shouldPreviewStakingShares && isStakingSharePreviewError
  const allowOneToOneStakingFallback = stakingSourceKind === 'default'
  const ensoInputAmount = resolveEnsoWithdrawInputAmount({
    requiredVaultShares: requiredShares,
    isStakingWithdrawal,
    isMaxWithdraw,
    stakingRedeemableShares: unstakeMaxRedeemShares,
    previewWithdrawShares,
    previewFailed: didStakingSharePreviewFail,
    allowOneToOneFallback: allowOneToOneStakingFallback
  })
  const isPreparingEnsoInputAmount =
    shouldPreviewStakingShares &&
    !didStakingSharePreviewFail &&
    (previewWithdrawShares === undefined || isLoadingStakingSharePreview || isFetchingStakingSharePreview)
  const ensoInputAmountError =
    didStakingSharePreviewFail && !allowOneToOneStakingFallback
      ? 'Unable to determine the staked share amount. Please try again.'
      : undefined

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
  const ensoFlowEnabled =
    isEnsoRoute &&
    !!withdrawToken &&
    !isDebouncing &&
    ensoInputAmount > 0n &&
    currentAmount > 0n &&
    !isPreparingEnsoInputAmount &&
    !ensoInputAmountError
  const yBoldZapperWithdrawEnabled =
    isYBoldZapperWithdrawRoute && !isDebouncing && requiredShares > 0n && currentAmount > 0n

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

  const yBoldZapperWithdraw = useYBoldZapperWithdraw({
    requiredVaultShares: requiredShares,
    redeemAll: isMaxWithdraw,
    maxRedeemShares: unstakeMaxRedeemShares,
    optimisticApprovedShares,
    maxLoss: BigInt(toBasisPoints(slippage)),
    account,
    chainId,
    enabled: yBoldZapperWithdrawEnabled
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
    amount: ensoInputAmount,
    account,
    receiver: account,
    chainId,
    destinationChainId,
    decimalsOut: outputDecimals,
    enabled: ensoFlowEnabled,
    slippage: toBasisPoints(slippage),
    quotePurpose: ensoQuotePurpose,
    isPreparingAmount: isPreparingEnsoInputAmount,
    amountError: ensoInputAmountError
  })

  const activeFlow = useMemo((): UseWidgetWithdrawFlowReturn => {
    if (isDirectWithdrawRoute) {
      return isYvUsdLockedZapFlow ? yvUsdLockedZapWithdraw : directWithdraw
    }
    if (isDirectUnstakeRoute) {
      return directUnstake
    }
    if (isYBoldZapperWithdrawRoute) {
      return yBoldZapperWithdraw
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
          minExpectedOut: directWithdraw.periphery.minExpectedOut,
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
    isYBoldZapperWithdrawRoute,
    isDirectUnstakeWithdrawRoute,
    isYvUsdLockedZapFlow,
    yvUsdLockedZapWithdraw,
    yBoldZapperWithdraw,
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
