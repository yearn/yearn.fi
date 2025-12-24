import type { TCreateNotificationParams } from '@lib/types/notifications'
import { formatTAmount, toAddress } from '@lib/utils'
import type { Token } from '@nextgen/hooks/useTokens'
import { useMemo } from 'react'
import type { Address } from 'viem'
import type { WithdrawRouteType, WithdrawalSource } from './types'

interface UseWithdrawNotificationsProps {
  // Tokens
  vault?: Token
  outputToken?: Token
  stakingToken?: Token
  // Addresses
  sourceToken: Address
  withdrawToken: Address
  // Account & chain
  account?: Address
  chainId: number
  destinationChainId: number
  // Amount
  withdrawAmount: bigint
  requiredShares: bigint
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
  withdrawToken,
  account,
  chainId,
  destinationChainId,
  withdrawAmount,
  requiredShares,
  routeType,
  routerAddress,
  isCrossChain,
  withdrawalSource
}: UseWithdrawNotificationsProps): WithdrawNotificationsResult => {
  const approveNotificationParams = useMemo((): TCreateNotificationParams | undefined => {
    if (!vault || !outputToken || !account || routeType !== 'ENSO') return undefined

    const spenderAddress = routerAddress || withdrawToken
    const spenderName = routerAddress ? 'Enso Router' : outputToken.symbol || ''

    return {
      type: 'approve',
      amount: formatTAmount({ value: vault.balance.raw, decimals: vault.decimals ?? 18 }),
      fromAddress: toAddress(sourceToken),
      fromSymbol: vault.symbol || '',
      fromChainId: chainId,
      toAddress: toAddress(spenderAddress),
      toSymbol: spenderName
    }
  }, [vault, outputToken, account, routeType, routerAddress, sourceToken, chainId, withdrawToken])

  const withdrawNotificationParams = useMemo((): TCreateNotificationParams | undefined => {
    if (!vault || !outputToken || !account || withdrawAmount === 0n) return undefined

    let notificationType: 'withdraw' | 'zap' | 'crosschain zap' | 'unstake' = 'withdraw'
    if (routeType === 'ENSO') {
      notificationType = isCrossChain ? 'crosschain zap' : 'zap'
    } else if (routeType === 'DIRECT_UNSTAKE') {
      notificationType = 'unstake'
    }

    const sourceTokenSymbol =
      withdrawalSource === 'staking' && stakingToken ? stakingToken.symbol || vault.symbol || '' : vault.symbol || ''

    return {
      type: notificationType,
      amount: formatTAmount({ value: requiredShares, decimals: vault.decimals ?? 18 }),
      fromAddress: toAddress(sourceToken),
      fromSymbol: sourceTokenSymbol,
      fromChainId: chainId,
      toAddress: toAddress(withdrawToken),
      toSymbol: outputToken.symbol || '',
      toChainId: isCrossChain ? destinationChainId : undefined
    }
  }, [
    vault,
    outputToken,
    account,
    withdrawAmount,
    routeType,
    isCrossChain,
    requiredShares,
    sourceToken,
    chainId,
    withdrawToken,
    destinationChainId,
    stakingToken,
    withdrawalSource
  ])

  return {
    approveNotificationParams,
    withdrawNotificationParams
  }
}
