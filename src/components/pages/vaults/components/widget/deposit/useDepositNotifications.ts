import type { Token } from '@pages/vaults/hooks/useTokens'
import type { TCreateNotificationParams } from '@shared/types/notifications'
import { formatTAmount, toAddress } from '@shared/utils'
import { useMemo } from 'react'
import type { Address } from 'viem'
import { getDepositApprovalSpender } from './approvalSpender'
import type { DepositRouteType } from './types'

interface UseDepositNotificationsProps {
  // Tokens
  inputToken?: Token
  assetToken?: Token
  vault?: Token
  stakingToken?: Token
  // Addresses
  depositToken: Address
  assetAddress: Address
  destinationToken: Address
  vaultAddress: Address
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
  assetToken,
  vault,
  stakingToken,
  depositToken,
  assetAddress,
  destinationToken,
  vaultAddress,
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

    const { spenderAddress, spenderName } = getDepositApprovalSpender({
      routeType,
      destinationToken,
      stakingAddress,
      routerAddress,
      vaultSymbol: vault.symbol,
      stakingTokenSymbol: stakingToken?.symbol
    })

    if (!spenderAddress || !spenderName) {
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
    destinationToken,
    stakingAddress,
    depositToken,
    depositAmount,
    sourceChainId
  ])

  const depositNotificationParams = useMemo((): TCreateNotificationParams | undefined => {
    if (!inputToken || !vault || !account || depositAmount === 0n) return undefined
    if (routeType === 'KATANA_NATIVE_BRIDGE') {
      return {
        type: 'bridge',
        amount: formatTAmount({
          value: depositAmount,
          decimals: inputToken.decimals ?? 18,
          options: { maximumFractionDigits: 8 }
        }),
        rawAmount: depositAmount.toString(),
        fromAddress: toAddress(depositToken),
        fromSymbol: inputToken.symbol || '',
        fromChainId: sourceChainId,
        toAddress: toAddress(assetAddress),
        toSymbol: assetToken?.symbol || '',
        toChainId: chainId,
        destinationBalanceRaw: assetToken?.balance.raw.toString() || '0',
        vaultAddress: toAddress(vaultAddress),
        bridgeDirection: 'to-katana',
        trackingUrl: 'https://bridge.katana.network/transactions'
      }
    }

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
    assetToken,
    vault,
    account,
    depositAmount,
    routeType,
    isCrossChain,
    isZap,
    isDepositAndStake,
    depositToken,
    sourceChainId,
    assetAddress,
    destinationToken,
    vaultAddress,
    chainId,
    stakingToken
  ])

  return {
    approveNotificationParams,
    depositNotificationParams
  }
}
