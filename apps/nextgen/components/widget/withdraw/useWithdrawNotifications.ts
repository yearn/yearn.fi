import type { TCreateNotificationParams } from '@lib/types/notifications'
import { formatTAmount, toAddress } from '@lib/utils'
import type { Token } from '@nextgen/hooks/useTokens'
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

  // Determine source token info based on withdrawal source
  const sourceTokenInfo = useMemo(() => {
    if (withdrawalSource === 'staking' && stakingToken) {
      return {
        symbol: stakingToken.symbol || '',
        decimals: stakingToken.decimals ?? 18
      }
    }
    return {
      symbol: vault?.symbol || '',
      decimals: vault?.decimals ?? 18
    }
  }, [withdrawalSource, stakingToken, vault])

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

  // Withdraw notification: swapping shares for output token
  const withdrawNotificationParams = useMemo((): TCreateNotificationParams | undefined => {
    if (!vault || !outputToken || !account || withdrawAmount === 0n) return undefined

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
    }

    return {
      type: notificationType,
      amount: formatTAmount({ value: requiredShares, decimals: sourceTokenInfo.decimals }),
      fromAddress: toAddress(sourceToken),
      fromSymbol: sourceTokenInfo.symbol,
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
    withdrawNotificationParams
  }
}
