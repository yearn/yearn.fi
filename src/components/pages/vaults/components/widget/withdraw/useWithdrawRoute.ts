import { KATANA_CHAIN_ID } from '@pages/vaults/constants/addresses'
import { useEnsoEnabled } from '@pages/vaults/hooks/useEnsoEnabled'
import { toAddress } from '@shared/utils'
import { useMemo } from 'react'
import type { Address } from 'viem'
import { isAddressEqual } from 'viem'
import { KATANA_NATIVE_BRIDGE_SOURCE_CHAIN_ID } from '../katanaBridge'
import type { WithdrawalSource, WithdrawRouteType } from './types'

interface UseWithdrawRouteProps {
  vaultAddress: Address
  withdrawToken: Address
  assetAddress: Address
  withdrawalSource: WithdrawalSource
  chainId: number
  outputChainId: number
  isUnstake: boolean
  allowKatanaNativeBridge?: boolean
  katanaBridgeDestinationTokenAddress?: Address
}

interface ResolveWithdrawRouteTypeProps extends Omit<UseWithdrawRouteProps, 'vaultAddress'> {
  ensoEnabled: boolean
}

export const resolveWithdrawRouteType = ({
  withdrawToken,
  assetAddress,
  withdrawalSource,
  chainId,
  outputChainId,
  isUnstake,
  ensoEnabled,
  allowKatanaNativeBridge,
  katanaBridgeDestinationTokenAddress
}: ResolveWithdrawRouteTypeProps): WithdrawRouteType => {
  // Case 1: Unstake (staking → vault tokens) - always allowed, doesn't need Enso
  if (isUnstake) {
    return 'DIRECT_UNSTAKE'
  }

  const isUnstakeAndWithdrawFallback =
    withdrawalSource === 'staking' && toAddress(withdrawToken) === toAddress(assetAddress) && chainId === outputChainId

  // Case 2: Staked shares → asset fallback (unstake then withdraw)
  if (isUnstakeAndWithdrawFallback) {
    return 'DIRECT_UNSTAKE_WITHDRAW'
  }

  const isKatanaNativeBridgeRoute =
    allowKatanaNativeBridge &&
    chainId === KATANA_CHAIN_ID &&
    outputChainId === KATANA_NATIVE_BRIDGE_SOURCE_CHAIN_ID &&
    !!katanaBridgeDestinationTokenAddress &&
    isAddressEqual(withdrawToken, katanaBridgeDestinationTokenAddress)

  if (isKatanaNativeBridgeRoute) {
    return 'KATANA_NATIVE_BRIDGE'
  }

  // When Enso disabled, always use direct withdraw
  if (!ensoEnabled) {
    return 'DIRECT_WITHDRAW'
  }

  // Case 3: Direct withdraw (vault → asset, same token, from vault source)
  if (
    toAddress(withdrawToken) === toAddress(assetAddress) &&
    withdrawalSource === 'vault' &&
    chainId === outputChainId
  ) {
    return 'DIRECT_WITHDRAW'
  }

  // Case 4: Everything else uses Enso
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
  withdrawToken,
  assetAddress,
  withdrawalSource,
  chainId,
  outputChainId,
  isUnstake,
  allowKatanaNativeBridge,
  katanaBridgeDestinationTokenAddress
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
      ensoEnabled,
      allowKatanaNativeBridge,
      katanaBridgeDestinationTokenAddress
    })
  }, [
    allowKatanaNativeBridge,
    assetAddress,
    chainId,
    ensoEnabled,
    isUnstake,
    katanaBridgeDestinationTokenAddress,
    outputChainId,
    withdrawalSource,
    withdrawToken
  ])
}
