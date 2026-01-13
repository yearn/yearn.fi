import { toAddress } from '@lib/utils'
import { useMemo } from 'react'
import type { Address } from 'viem'
import type { DepositRouteType } from './types'

interface UseDepositRouteProps {
  depositToken: Address
  assetAddress: Address
  destinationToken: Address
  vaultAddress: Address
  stakingAddress?: Address
}

/**
 * Determines the routing type for a deposit transaction.
 * - DIRECT_DEPOSIT: asset → vault (simple deposit)
 * - DIRECT_STAKE: vault → staking (stake vault tokens)
 * - ENSO: all other cases (zaps, cross-chain, etc.)
 */
export const useDepositRoute = ({
  depositToken,
  assetAddress,
  destinationToken,
  vaultAddress,
  stakingAddress
}: UseDepositRouteProps): DepositRouteType => {
  return useMemo(() => {
    // Case 1: Direct vault deposit (asset → vault)
    if (
      toAddress(depositToken) === toAddress(assetAddress) &&
      toAddress(destinationToken) === toAddress(vaultAddress)
    ) {
      return 'DIRECT_DEPOSIT'
    }

    // Case 2: Direct staking (vault → staking)
    if (
      toAddress(depositToken) === toAddress(vaultAddress) &&
      stakingAddress &&
      toAddress(destinationToken) === toAddress(stakingAddress)
    ) {
      return 'DIRECT_STAKE'
    }

    // Case 3: All other cases use Enso
    return 'ENSO'
  }, [depositToken, assetAddress, destinationToken, vaultAddress, stakingAddress])
}
