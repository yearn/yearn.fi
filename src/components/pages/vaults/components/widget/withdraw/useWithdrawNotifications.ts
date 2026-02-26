import type { Token } from '@pages/vaults/hooks/useTokens'
import type { TCreateNotificationParams } from '@shared/types/notifications'
import { formatTAmount, toAddress } from '@shared/utils'
import { useMemo } from 'react'
import type { Address } from 'viem'
import type { WithdrawalSource, WithdrawRouteType } from './types'

interface UseWithdrawNotificationsProps {
  // Tokens
  vault?: Token
  outputToken?: Token
  stakingToken?: Token
  // Addresses
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
}

export const useWithdrawNotifications = ({
  vault,
  outputToken,
  stakingToken,
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
    if (!vault || !account || routeType !== 'ENSO' || !routerAddress) return undefined

    return {
      type: 'approve',
      amount: formatTAmount({ value: requiredShares, decimals: sourceTokenInfo.decimals }),
      fromAddress: toAddress(sourceToken),
      fromSymbol: sourceTokenInfo.symbol,
      fromChainId: chainId,
      toAddress: toAddress(routerAddress),
      toSymbol: 'Enso Router'
    }
  }, [vault, account, routeType, routerAddress, requiredShares, sourceTokenInfo, sourceToken, chainId])

  // Unstake notification: first step of the fallback flow
  const unstakeNotificationParams = useMemo((): TCreateNotificationParams | undefined => {
    if (!vault || !account || routeType !== 'DIRECT_UNSTAKE_WITHDRAW' || withdrawAmount === 0n) return undefined

    return {
      type: 'unstake',
      amount: formatTAmount({ value: requiredShares, decimals: sourceTokenInfo.decimals }),
      fromAddress: toAddress(sourceToken),
      fromSymbol: sourceTokenInfo.symbol,
      fromChainId: chainId,
      toAddress: toAddress(vault.address),
      toSymbol: vault.symbol || ''
    }
  }, [vault, account, routeType, withdrawAmount, requiredShares, sourceTokenInfo, sourceToken, chainId])

  // Withdraw notification: final withdrawal step
  const withdrawNotificationParams = useMemo((): TCreateNotificationParams | undefined => {
    if (!vault || !outputToken || !account || withdrawAmount === 0n) return undefined

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
    vault,
    outputToken,
    account,
    withdrawAmount,
    routeType,
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

  return {
    approveNotificationParams,
    unstakeNotificationParams,
    withdrawNotificationParams
  }
}
