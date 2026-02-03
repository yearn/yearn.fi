import { useEnsoEnabled } from '@pages/vaults/hooks/useEnsoEnabled'
import { toAddress } from '@shared/utils'
import { useMemo } from 'react'
import type { Address } from 'viem'
import type { WithdrawalSource, WithdrawRouteType } from './types'

interface UseWithdrawRouteProps {
  withdrawToken: Address
  assetAddress: Address
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
  const ensoEnabled = useEnsoEnabled()

  return useMemo(() => {
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
  }, [ensoEnabled, isUnstake, withdrawToken, chainId, outputChainId, assetAddress, withdrawalSource])
}
