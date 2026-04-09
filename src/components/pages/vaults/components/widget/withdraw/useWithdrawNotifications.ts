import type { Token } from '@pages/vaults/hooks/useTokens'
import type { TCreateNotificationParams } from '@shared/types/notifications'
import { formatTAmount, toAddress } from '@shared/utils'
import { KATANA_BRIDGE_TRACKING_URL } from '@shared/utils/katanaBridge'
import { useMemo } from 'react'
import type { Address } from 'viem'
import type { WithdrawalSource, WithdrawRouteType } from './types'

interface UseWithdrawNotificationsProps {
  // Tokens
  vault?: Token
  assetToken?: Token
  outputToken?: Token
  stakingToken?: Token
  // Addresses
  vaultAddress: Address
  sourceToken: Address
  assetAddress: Address
  withdrawToken: Address
  // Account & chain
  account?: Address
  chainId: number
  destinationChainId: number
  // Amount
  withdrawAmount: bigint
  requiredShares: bigint
  expectedOut?: bigint
  // Route info
  routeType: WithdrawRouteType
  routerAddress?: string
  isCrossChain: boolean
  // Source info
  withdrawalSource: WithdrawalSource
}

interface WithdrawNotificationsResult {
  approveNotificationParams?: TCreateNotificationParams
  unstakeNotificationParams?: TCreateNotificationParams
  withdrawNotificationParams?: TCreateNotificationParams
  bridgeNotificationParams?: TCreateNotificationParams
}

export const useWithdrawNotifications = ({
  vault,
  assetToken,
  outputToken,
  stakingToken,
  vaultAddress,
  sourceToken,
  assetAddress,
  withdrawToken,
  account,
  chainId,
  destinationChainId,
  withdrawAmount,
  requiredShares,
  expectedOut,
  routeType,
  routerAddress,
  isCrossChain,
  withdrawalSource
}: UseWithdrawNotificationsProps): WithdrawNotificationsResult => {
  const isZap = toAddress(withdrawToken) !== toAddress(assetAddress)
  const isUnstakeAndWithdraw =
    withdrawalSource === 'staking' && toAddress(withdrawToken) === toAddress(assetAddress) && !isZap
  const shareDecimals = vault?.decimals ?? stakingToken?.decimals ?? 18

  // Determine source token info based on withdrawal source
  const sourceTokenInfo = useMemo(() => {
    if (withdrawalSource === 'staking' && stakingToken) {
      return {
        symbol: stakingToken.symbol || '',
        decimals: shareDecimals
      }
    }
    return {
      symbol: vault?.symbol || '',
      decimals: shareDecimals
    }
  }, [withdrawalSource, stakingToken, vault, shareDecimals])

  // Approve notification: approving source token (vault/staking shares) to Enso router
  const approveNotificationParams = useMemo((): TCreateNotificationParams | undefined => {
    if (!vault || !account || !routerAddress) return undefined

    if (routeType === 'KATANA_NATIVE_BRIDGE' && assetToken) {
      return {
        type: 'approve',
        amount: formatTAmount({ value: withdrawAmount, decimals: assetToken.decimals ?? 18 }),
        fromAddress: toAddress(assetAddress),
        fromSymbol: assetToken.symbol || '',
        fromChainId: chainId,
        toAddress: toAddress(routerAddress),
        toSymbol: 'Katana Unified Bridge'
      }
    }

    if (routeType !== 'ENSO') return undefined

    return {
      type: 'approve',
      amount: formatTAmount({ value: requiredShares, decimals: sourceTokenInfo.decimals }),
      fromAddress: toAddress(sourceToken),
      fromSymbol: sourceTokenInfo.symbol,
      fromChainId: chainId,
      toAddress: toAddress(routerAddress),
      toSymbol: 'Enso Router'
    }
  }, [
    account,
    assetAddress,
    assetToken,
    chainId,
    requiredShares,
    routeType,
    routerAddress,
    sourceToken,
    sourceTokenInfo,
    vault,
    withdrawAmount
  ])

  // Unstake notification: first step of the fallback flow
  const unstakeNotificationParams = useMemo((): TCreateNotificationParams | undefined => {
    if (
      !vault ||
      !account ||
      !(
        routeType === 'DIRECT_UNSTAKE_WITHDRAW' ||
        (routeType === 'KATANA_NATIVE_BRIDGE' && withdrawalSource === 'staking')
      ) ||
      withdrawAmount === 0n
    ) {
      return undefined
    }

    return {
      type: 'unstake',
      amount: formatTAmount({ value: requiredShares, decimals: sourceTokenInfo.decimals }),
      fromAddress: toAddress(sourceToken),
      fromSymbol: sourceTokenInfo.symbol,
      fromChainId: chainId,
      toAddress: toAddress(vault.address),
      toSymbol: vault.symbol || ''
    }
  }, [
    vault,
    account,
    routeType,
    withdrawalSource,
    withdrawAmount,
    requiredShares,
    sourceTokenInfo,
    sourceToken,
    chainId
  ])

  // Withdraw notification: final withdrawal step
  const withdrawNotificationParams = useMemo((): TCreateNotificationParams | undefined => {
    if (!vault || !account || withdrawAmount === 0n) return undefined

    if (routeType === 'KATANA_NATIVE_BRIDGE' && assetToken) {
      return {
        type: 'withdraw',
        amount: formatTAmount({ value: requiredShares, decimals: shareDecimals }),
        fromAddress: toAddress(sourceToken),
        fromSymbol: sourceTokenInfo.symbol,
        fromChainId: chainId,
        toAddress: toAddress(assetAddress),
        toSymbol: assetToken.symbol || '',
        toAmount: formatTAmount({ value: withdrawAmount, decimals: assetToken.decimals ?? 18 })
      }
    }

    if (!outputToken) return undefined

    const withdrawFromTokenInfo =
      routeType === 'DIRECT_UNSTAKE_WITHDRAW'
        ? {
            symbol: vault.symbol || '',
            decimals: vault.decimals ?? 18
          }
        : sourceTokenInfo

    const withdrawFromAddress =
      routeType === 'DIRECT_UNSTAKE_WITHDRAW' ? toAddress(vault.address) : toAddress(sourceToken)

    let notificationType: 'withdraw' | 'withdraw zap' | 'crosschain withdraw zap' | 'unstake' | 'unstake and withdraw' =
      'withdraw'
    if (routeType === 'ENSO') {
      if (isCrossChain) {
        notificationType = 'crosschain withdraw zap'
      } else if (isZap) {
        notificationType = 'withdraw zap'
      } else if (isUnstakeAndWithdraw) {
        notificationType = 'unstake and withdraw'
      } else {
        notificationType = 'withdraw'
      }
    } else if (routeType === 'DIRECT_UNSTAKE') {
      notificationType = 'unstake'
    } else if (routeType === 'DIRECT_UNSTAKE_WITHDRAW') {
      notificationType = 'withdraw'
    }

    return {
      type: notificationType,
      amount: formatTAmount({ value: requiredShares, decimals: withdrawFromTokenInfo.decimals }),
      fromAddress: withdrawFromAddress,
      fromSymbol: withdrawFromTokenInfo.symbol,
      fromChainId: chainId,
      toAddress: toAddress(withdrawToken),
      toSymbol: outputToken.symbol || '',
      toAmount: expectedOut ? formatTAmount({ value: expectedOut, decimals: outputToken.decimals ?? 18 }) : undefined,
      toChainId: isCrossChain ? destinationChainId : undefined
    }
  }, [
    assetAddress,
    assetToken,
    vault,
    outputToken,
    account,
    withdrawAmount,
    routeType,
    shareDecimals,
    isCrossChain,
    isZap,
    isUnstakeAndWithdraw,
    requiredShares,
    sourceTokenInfo,
    sourceToken,
    chainId,
    withdrawToken,
    expectedOut,
    destinationChainId
  ])

  const bridgeNotificationParams = useMemo((): TCreateNotificationParams | undefined => {
    if (
      !vault ||
      !assetToken ||
      !outputToken ||
      !account ||
      routeType !== 'KATANA_NATIVE_BRIDGE' ||
      withdrawAmount === 0n
    ) {
      return undefined
    }

    return {
      type: 'bridge',
      amount: formatTAmount({ value: withdrawAmount, decimals: assetToken.decimals ?? 18 }),
      rawAmount: withdrawAmount.toString(),
      fromAddress: toAddress(assetAddress),
      fromSymbol: assetToken.symbol || '',
      fromChainId: chainId,
      toAddress: toAddress(withdrawToken),
      toSymbol: outputToken.symbol || '',
      toChainId: destinationChainId,
      vaultAddress: toAddress(vaultAddress),
      bridgeDirection: 'to-ethereum',
      trackingUrl: KATANA_BRIDGE_TRACKING_URL
    }
  }, [
    account,
    assetAddress,
    assetToken,
    chainId,
    destinationChainId,
    outputToken,
    routeType,
    vault,
    vaultAddress,
    withdrawAmount,
    withdrawToken
  ])

  return {
    approveNotificationParams,
    unstakeNotificationParams,
    withdrawNotificationParams,
    bridgeNotificationParams
  }
}
