import { KATANA_CHAIN_ID } from '@pages/vaults/constants/addresses'
import { useEnsoEnabled } from '@pages/vaults/hooks/useEnsoEnabled'
import { useMemo } from 'react'
import { type Address, isAddressEqual } from 'viem'
import type { DepositRouteType } from './types'

interface UseDepositRouteProps {
  chainId: number
  sourceChainId?: number
  depositToken: Address
  assetAddress: Address
  directDepositTokenAddress?: Address
  destinationToken: Address
  vaultAddress: Address
  stakingAddress?: Address
}

interface ResolveDepositRouteTypeProps extends UseDepositRouteProps {
  ensoEnabled: boolean
}

export function resolveDepositRouteType({
  chainId,
  sourceChainId,
  depositToken,
  assetAddress,
  directDepositTokenAddress,
  destinationToken,
  vaultAddress,
  stakingAddress,
  ensoEnabled
}: ResolveDepositRouteTypeProps): DepositRouteType {
  if (
    sourceChainId !== undefined &&
    sourceChainId !== chainId &&
    (chainId === KATANA_CHAIN_ID || sourceChainId === KATANA_CHAIN_ID)
  ) {
    return 'NO_ROUTE'
  }

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
  sourceChainId,
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
        chainId,
        sourceChainId,
        depositToken,
        assetAddress,
        directDepositTokenAddress,
        destinationToken,
        vaultAddress,
        stakingAddress,
        ensoEnabled
      }),
    [
      ensoEnabled,
      chainId,
      sourceChainId,
      depositToken,
      assetAddress,
      directDepositTokenAddress,
      destinationToken,
      vaultAddress,
      stakingAddress
    ]
  )
}
