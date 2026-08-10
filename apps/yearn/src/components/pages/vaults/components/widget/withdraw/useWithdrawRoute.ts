import { useEnsoEnabled } from '@pages/vaults/hooks/useEnsoEnabled'
import { isYBoldZapperWithdrawRoute } from '@pages/vaults/utils/yBold'
import { toAddress } from '@shared/utils'
import { useMemo } from 'react'
import type { Address } from 'viem'
import type { WithdrawalSource, WithdrawRouteType } from './types'

interface UseWithdrawRouteProps {
  vaultAddress: Address
  sourceToken: Address
  withdrawToken: Address
  assetAddress: Address
  stakingAddress?: Address
  withdrawalSource: WithdrawalSource
  chainId: number
  outputChainId: number
  isUnstake: boolean
}

interface ResolveWithdrawRouteTypeProps extends Omit<UseWithdrawRouteProps, 'chainId'> {
  ensoEnabled: boolean
  chainId: number
}

export const resolveWithdrawRouteType = ({
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
}: ResolveWithdrawRouteTypeProps): WithdrawRouteType => {
  // Case 1: Unstake (staking → vault tokens) - always allowed, doesn't need Enso
  if (isUnstake) {
    return 'DIRECT_UNSTAKE'
  }

  // Case 2: ysyBOLD → BOLD through the native yBOLD zapper
  if (
    isYBoldZapperWithdrawRoute({
      sourceToken,
      withdrawToken,
      assetAddress,
      vaultAddress,
      stakingAddress,
      withdrawalSource,
      chainId,
      outputChainId
    })
  ) {
    return 'YBOLD_ZAPPER_WITHDRAW'
  }

  const isUnstakeAndWithdrawFallback =
    withdrawalSource === 'staking' && toAddress(withdrawToken) === toAddress(assetAddress) && chainId === outputChainId

  // Case 3: Staked shares → asset fallback (unstake then withdraw)
  if (isUnstakeAndWithdrawFallback) {
    return 'DIRECT_UNSTAKE_WITHDRAW'
  }

  // When Enso disabled, always use direct withdraw
  if (!ensoEnabled) {
    return 'DIRECT_WITHDRAW'
  }

  // Case 4: Direct withdraw (vault → asset, same token, from vault source)
  if (
    toAddress(withdrawToken) === toAddress(assetAddress) &&
    withdrawalSource === 'vault' &&
    chainId === outputChainId
  ) {
    return 'DIRECT_WITHDRAW'
  }

  // Case 5: Everything else uses Enso
  return 'ENSO'
}

/**
 * Determines the routing type for a withdraw transaction.
 * - DIRECT_WITHDRAW: vault → asset (simple redeem)
 * - DIRECT_UNSTAKE: staking → vault (unstake)
 * - DIRECT_UNSTAKE_WITHDRAW: staking → vault → asset (two-step fallback)
 * - ENSO: all other cases (zaps, cross-chain, etc.)
 */
export const useWithdrawRoute = ({
  vaultAddress,
  sourceToken,
  withdrawToken,
  assetAddress,
  stakingAddress,
  withdrawalSource,
  chainId,
  outputChainId,
  isUnstake
}: UseWithdrawRouteProps): WithdrawRouteType => {
  const ensoEnabled = useEnsoEnabled({ chainId, vaultAddress })

  return useMemo(() => {
    return resolveWithdrawRouteType({
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
  }, [
    ensoEnabled,
    isUnstake,
    vaultAddress,
    sourceToken,
    withdrawToken,
    chainId,
    outputChainId,
    assetAddress,
    stakingAddress,
    withdrawalSource
  ])
}
