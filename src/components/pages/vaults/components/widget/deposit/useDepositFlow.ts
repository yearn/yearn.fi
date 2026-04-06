import { getRedeemPreviewCall } from '@pages/vaults/hooks/actions/stakingAdapter'
import { useDirectDeposit } from '@pages/vaults/hooks/actions/useDirectDeposit'
import { useDirectStake } from '@pages/vaults/hooks/actions/useDirectStake'
import { useEnsoDeposit } from '@pages/vaults/hooks/actions/useEnsoDeposit'
import { useYvUsdLockedZapDeposit } from '@pages/vaults/hooks/actions/useYvUsdLockedZapDeposit'
import { YVUSD_LOCKED_ADDRESS } from '@pages/vaults/utils/yvUsd'
import { toAddress } from '@shared/utils'
import { useMemo } from 'react'
import { type Address, isAddressEqual } from 'viem'
import { useReadContract } from 'wagmi'
import type { DepositRouteType } from './types'
import { useDepositRoute } from './useDepositRoute'
import { resolveValuationShareCount } from './valuation'

interface UseDepositFlowProps {
  // Token addresses
  depositToken: Address
  assetAddress: Address
  directDepositTokenAddress?: Address
  destinationToken: Address
  vaultAddress: Address
  stakingAddress?: Address
  // Amount
  amount: bigint
  currentAmount: bigint // For checking if input > 0
  // Account & chain
  account?: Address
  chainId: number
  sourceChainId: number
  destinationChainId?: number
  // Decimals
  inputDecimals: number
  vaultDecimals: number
  // Settings
  slippage: number
  stakingSource?: string
}

export interface DepositFlowResult {
  routeType: DepositRouteType
  activeFlow: {
    actions: {
      prepareApprove: ReturnType<typeof useDirectDeposit>['actions']['prepareApprove']
      prepareDeposit: ReturnType<typeof useDirectDeposit>['actions']['prepareDeposit']
    }
    periphery: {
      prepareApproveEnabled: boolean
      prepareDepositEnabled: boolean
      isAllowanceSufficient: boolean
      allowance: bigint
      expectedOut: bigint
      normalizedExpectedOut: bigint
      isLoadingRoute: boolean
      isLoadingExpectedOutNormalization: boolean
      isCrossChain: boolean
      routerAddress?: string
      error?: unknown
    }
  }
}

export const useDepositFlow = ({
  depositToken,
  assetAddress,
  directDepositTokenAddress,
  destinationToken,
  vaultAddress,
  stakingAddress,
  amount,
  currentAmount,
  account,
  chainId,
  sourceChainId,
  destinationChainId,
  inputDecimals,
  vaultDecimals,
  slippage,
  stakingSource
}: UseDepositFlowProps): DepositFlowResult => {
  // Determine routing type
  const routeType = useDepositRoute({
    chainId,
    sourceChainId,
    depositToken,
    assetAddress,
    directDepositTokenAddress,
    destinationToken,
    vaultAddress,
    stakingAddress
  })

  const isYvUsdLockedZapDeposit = useMemo(
    () =>
      routeType === 'DIRECT_DEPOSIT' &&
      !!directDepositTokenAddress &&
      toAddress(vaultAddress) === YVUSD_LOCKED_ADDRESS &&
      toAddress(depositToken) === toAddress(directDepositTokenAddress),
    [routeType, directDepositTokenAddress, vaultAddress, depositToken]
  )

  // Direct deposit flow (asset → vault)
  const directDeposit = useDirectDeposit({
    vaultAddress,
    assetAddress,
    amount,
    account,
    chainId,
    decimals: inputDecimals,
    enabled: routeType === 'DIRECT_DEPOSIT' && amount > 0n && !isYvUsdLockedZapDeposit
  })

  const yvUsdLockedZapDeposit = useYvUsdLockedZapDeposit({
    depositToken,
    amount,
    account,
    chainId,
    enabled: isYvUsdLockedZapDeposit && amount > 0n
  })

  // Direct stake flow (vault → staking)
  const directStake = useDirectStake({
    stakingAddress,
    vaultAddress,
    amount,
    account,
    chainId,
    decimals: vaultDecimals,
    stakingSource,
    enabled: routeType === 'DIRECT_STAKE' && amount > 0n
  })

  // Enso flow (zaps, cross-chain, etc.)
  const ensoFlow = useEnsoDeposit({
    vaultAddress: destinationToken,
    depositToken,
    amount,
    currentAmount,
    account,
    chainId: sourceChainId,
    destinationChainId,
    decimalsOut: vaultDecimals,
    enabled: routeType === 'ENSO' && !!depositToken && amount > 0n && currentAmount > 0n,
    slippage: slippage * 100
  })

  // Select active flow based on routing type
  const activeFlow = useMemo(() => {
    if (routeType === 'DIRECT_DEPOSIT') {
      return isYvUsdLockedZapDeposit ? yvUsdLockedZapDeposit : directDeposit
    }
    if (routeType === 'DIRECT_STAKE') return directStake
    return ensoFlow
  }, [routeType, isYvUsdLockedZapDeposit, yvUsdLockedZapDeposit, directDeposit, directStake, ensoFlow])

  const shouldNormalizeExpectedOut =
    !!stakingAddress && isAddressEqual(destinationToken, stakingAddress) && activeFlow.periphery.expectedOut > 0n

  const previewRedeemCall = useMemo(
    () =>
      shouldNormalizeExpectedOut ? getRedeemPreviewCall(stakingSource, activeFlow.periphery.expectedOut) : undefined,
    [shouldNormalizeExpectedOut, stakingSource, activeFlow.periphery.expectedOut]
  )

  const { data: normalizedExpectedOutData, isLoading: isLoadingExpectedOutNormalization } = useReadContract({
    address: stakingAddress,
    abi: (previewRedeemCall?.abi || []) as any,
    functionName: (previewRedeemCall?.functionName || 'previewRedeem') as any,
    args: previewRedeemCall?.args as any,
    chainId,
    query: {
      enabled: shouldNormalizeExpectedOut && !!stakingAddress && !!previewRedeemCall
    }
  })

  const normalizedExpectedOut = useMemo(
    () =>
      resolveValuationShareCount({
        expectedOut: activeFlow.periphery.expectedOut,
        destinationToken,
        vaultAddress,
        stakingAddress,
        previewedVaultShares: previewRedeemCall ? (normalizedExpectedOutData as bigint | undefined) : undefined
      }),
    [
      activeFlow.periphery.expectedOut,
      destinationToken,
      vaultAddress,
      stakingAddress,
      previewRedeemCall,
      normalizedExpectedOutData
    ]
  )

  return {
    routeType,
    activeFlow: {
      ...activeFlow,
      periphery: {
        ...activeFlow.periphery,
        normalizedExpectedOut,
        isLoadingExpectedOutNormalization: Boolean(
          shouldNormalizeExpectedOut && !!previewRedeemCall && isLoadingExpectedOutNormalization
        )
      }
    }
  }
}
