import { useEnsoEnabled } from '@pages/vaults/hooks/useEnsoEnabled'
import { useMemo } from 'react'
import { type Address, isAddressEqual } from 'viem'
import type { DepositRouteType } from './types'

interface UseDepositRouteProps {
  chainId: number
  depositToken: Address
  assetAddress: Address
  directDepositTokenAddress?: Address
  destinationToken: Address
  vaultAddress: Address
  stakingAddress?: Address
}

interface ResolveDepositRouteTypeProps extends Omit<UseDepositRouteProps, 'chainId'> {
  ensoEnabled: boolean
}

export function resolveDepositRouteType({
  depositToken,
  assetAddress,
  directDepositTokenAddress,
  destinationToken,
  vaultAddress,
  stakingAddress,
  ensoEnabled
}: ResolveDepositRouteTypeProps): DepositRouteType {
  // Case 1: Direct vault deposit (asset → vault)
  if (
    (isAddressEqual(depositToken, assetAddress) ||
      (!!directDepositTokenAddress && isAddressEqual(depositToken, directDepositTokenAddress))) &&
    isAddressEqual(destinationToken, vaultAddress)
  ) {
    return 'DIRECT_DEPOSIT'
  }

  // Case 2: Direct staking (vault → staking)
  if (
    stakingAddress &&
    isAddressEqual(depositToken, vaultAddress) &&
    isAddressEqual(destinationToken, stakingAddress)
  ) {
    return 'DIRECT_STAKE'
  }

  // Case 3: All other cases use Enso (if available)
  if (ensoEnabled) {
    return 'ENSO'
  }
  return 'NO_ROUTE'
}

/**
 * Determines the routing type for a deposit transaction.
 * - DIRECT_DEPOSIT: asset → vault (simple deposit)
 * - DIRECT_STAKE: vault → staking (stake vault tokens)
 * - ENSO: all other cases (zaps, cross-chain, etc.)
 */
export function useDepositRoute({
  chainId,
  depositToken,
  assetAddress,
  directDepositTokenAddress,
  destinationToken,
  vaultAddress,
  stakingAddress
}: UseDepositRouteProps): DepositRouteType {
  const ensoEnabled = useEnsoEnabled({ chainId, vaultAddress })

  return useMemo(
    () =>
      resolveDepositRouteType({
        depositToken,
        assetAddress,
        directDepositTokenAddress,
        destinationToken,
        vaultAddress,
        stakingAddress,
        ensoEnabled
      }),
    [ensoEnabled, depositToken, assetAddress, directDepositTokenAddress, destinationToken, vaultAddress, stakingAddress]
  )
}
