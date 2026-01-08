import type { TCreateNotificationParams } from '@lib/types/notifications'
import { formatTAmount, toAddress } from '@lib/utils'
import type { Token } from '@nextgen/hooks/useTokens'
import { useMemo } from 'react'
import type { Address } from 'viem'
import type { DepositRouteType } from './types'

interface UseDepositNotificationsProps {
  // Tokens
  inputToken?: Token
  vault?: Token
  stakingToken?: Token
  // Addresses
  depositToken: Address
  assetAddress: Address
  destinationToken: Address
  stakingAddress?: Address
  // Account & chain
  account?: Address
  sourceChainId: number
  chainId: number
  // Amount
  depositAmount: bigint
  // Route info
  routeType: DepositRouteType
  routerAddress?: string
  isCrossChain: boolean
}

interface DepositNotificationsResult {
  approveNotificationParams?: TCreateNotificationParams
  depositNotificationParams?: TCreateNotificationParams
}

export const useDepositNotifications = ({
  inputToken,
  vault,
  stakingToken,
  depositToken,
  assetAddress,
  destinationToken,
  stakingAddress,
  account,
  sourceChainId,
  chainId,
  depositAmount,
  routeType,
  routerAddress,
  isCrossChain
}: UseDepositNotificationsProps): DepositNotificationsResult => {
  const isZap = toAddress(depositToken) !== toAddress(assetAddress)
  const isDepositAndStake = stakingAddress && toAddress(destinationToken) === toAddress(stakingAddress) && !isZap

  const approveNotificationParams = useMemo((): TCreateNotificationParams | undefined => {
    if (!inputToken || !vault || !account) return undefined

    let spenderAddress: Address
    let spenderName: string

    if (routeType === 'ENSO') {
      spenderAddress = (routerAddress as Address) || destinationToken
      spenderName = routerAddress ? 'Enso Router' : vault.symbol || ''
    } else if (routeType === 'DIRECT_STAKE') {
      spenderAddress = stakingAddress || destinationToken
      spenderName = stakingToken?.symbol || 'Staking Contract'
    } else if (routeType === 'DIRECT_DEPOSIT') {
      spenderAddress = destinationToken
      spenderName = vault.symbol || 'Vault'
    } else {
      return undefined
    }

    return {
      type: 'approve',
      amount: formatTAmount({
        value: depositAmount,
        decimals: inputToken.decimals ?? 18,
        options: { maximumFractionDigits: 8 }
      }),
      fromAddress: toAddress(depositToken),
      fromSymbol: inputToken.symbol || '',
      fromChainId: sourceChainId,
      toAddress: toAddress(spenderAddress),
      toSymbol: spenderName
    }
  }, [
    inputToken,
    vault,
    stakingToken,
    account,
    routeType,
    routerAddress,
    depositToken,
    depositAmount,
    sourceChainId,
    destinationToken,
    stakingAddress
  ])

  const depositNotificationParams = useMemo((): TCreateNotificationParams | undefined => {
    if (!inputToken || !vault || !account || depositAmount === 0n) return undefined

    let notificationType: 'deposit' | 'deposit and stake' | 'zap' | 'crosschain zap' | 'stake' = 'deposit'
    if (routeType === 'ENSO') {
      if (isCrossChain) {
        notificationType = 'crosschain zap'
      } else if (isZap) {
        notificationType = 'zap'
      } else if (isDepositAndStake) {
        notificationType = 'deposit and stake'
      }
    } else if (routeType === 'DIRECT_STAKE') {
      notificationType = 'stake'
    } else {
      notificationType = 'deposit'
    }

    // Use staking token symbol if destination is staking contract
    const destinationTokenSymbol =
      isDepositAndStake && stakingToken ? stakingToken.symbol || vault.symbol || '' : vault.symbol || ''

    return {
      type: notificationType,
      amount: formatTAmount({
        value: depositAmount,
        decimals: inputToken.decimals ?? 18,
        options: { maximumFractionDigits: 8 }
      }),
      fromAddress: toAddress(depositToken),
      fromSymbol: inputToken.symbol || '',
      fromChainId: sourceChainId,
      toAddress: toAddress(destinationToken),
      toSymbol: destinationTokenSymbol,
      toChainId: isCrossChain ? chainId : undefined
    }
  }, [
    inputToken,
    vault,
    account,
    depositAmount,
    routeType,
    isCrossChain,
    isZap,
    isDepositAndStake,
    depositToken,
    sourceChainId,
    destinationToken,
    chainId,
    stakingToken
  ])

  return {
    approveNotificationParams,
    depositNotificationParams
  }
}
