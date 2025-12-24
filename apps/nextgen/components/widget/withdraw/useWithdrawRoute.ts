import { toAddress } from '@lib/utils'
import { useMemo } from 'react'
import type { Address } from 'viem'
import type { WithdrawRouteType, WithdrawalSource } from './types'

interface UseWithdrawRouteProps {
  withdrawToken: Address
  assetAddress: Address
  vaultAddress: Address
  withdrawalSource: WithdrawalSource
  chainId: number
  outputChainId: number
  isUnstake: boolean
}

/**
 * Determines the routing type for a withdraw transaction.
 * - DIRECT_WITHDRAW: vault → asset (simple redeem)
 * - DIRECT_UNSTAKE: staking → vault (unstake)
 * - ENSO: all other cases (zaps, cross-chain, etc.)
 */
export const useWithdrawRoute = ({
  withdrawToken,
  assetAddress,
  withdrawalSource,
  chainId,
  outputChainId,
  isUnstake
}: UseWithdrawRouteProps): WithdrawRouteType => {
  return useMemo(() => {
    // Case 1: Direct withdraw (vault → asset, same token, from vault source)
    if (
      toAddress(withdrawToken) === toAddress(assetAddress) &&
      withdrawalSource === 'vault' &&
      chainId === outputChainId
    ) {
      return 'DIRECT_WITHDRAW'
    }

    // Case 2: Unstake (staking → vault tokens)
    if (isUnstake) {
      return 'DIRECT_UNSTAKE'
    }

    // Case 3: Everything else uses Enso
    return 'ENSO'
  }, [withdrawToken, chainId, outputChainId, assetAddress, withdrawalSource, isUnstake])
}
