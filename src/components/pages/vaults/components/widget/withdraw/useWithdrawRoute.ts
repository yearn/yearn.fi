import { useEnsoEnabled } from '@pages/vaults/hooks/useEnsoEnabled'
import { toAddress } from '@shared/utils'
import { useMemo } from 'react'
import type { Address } from 'viem'
import type { WithdrawalSource, WithdrawRouteType } from './types'

interface UseWithdrawRouteProps {
  vaultAddress: Address
  withdrawToken: Address
  assetAddress: Address
  withdrawalSource: WithdrawalSource
  chainId: number
  outputChainId: number
  isUnstake: boolean
}

interface ResolveWithdrawRouteTypeProps extends Omit<UseWithdrawRouteProps, 'vaultAddress' | 'chainId'> {
  ensoEnabled: boolean
  chainId: number
}

export const resolveWithdrawRouteType = ({
  withdrawToken,
  assetAddress,
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

  // When Enso disabled, always use direct withdraw
  if (!ensoEnabled) {
    return 'DIRECT_WITHDRAW'
  }

  // Case 2: Direct withdraw (vault → asset, same token, from vault source)
  if (
    toAddress(withdrawToken) === toAddress(assetAddress) &&
    withdrawalSource === 'vault' &&
    chainId === outputChainId
  ) {
    return 'DIRECT_WITHDRAW'
  }

  // Case 3: Everything else uses Enso
  return 'ENSO'
}

/**
 * Determines the routing type for a withdraw transaction.
 * - DIRECT_WITHDRAW: vault → asset (simple redeem)
 * - DIRECT_UNSTAKE: staking → vault (unstake)
 * - ENSO: all other cases (zaps, cross-chain, etc.)
 */
export const useWithdrawRoute = ({
  vaultAddress,
  withdrawToken,
  assetAddress,
  withdrawalSource,
  chainId,
  outputChainId,
  isUnstake
}: UseWithdrawRouteProps): WithdrawRouteType => {
  const ensoEnabled = useEnsoEnabled({ chainId, vaultAddress })

  return useMemo(() => {
    return resolveWithdrawRouteType({
      withdrawToken,
      assetAddress,
      withdrawalSource,
      chainId,
      outputChainId,
      isUnstake,
      ensoEnabled
    })
  }, [ensoEnabled, isUnstake, withdrawToken, chainId, outputChainId, assetAddress, withdrawalSource])
}
