import { YBOLD_STAKING_ADDRESS, YBOLD_VAULT_ADDRESS } from '@pages/vaults/domain/normalizeVault'
import { isYvUsdAddress, YVUSD_CHAIN_ID, YVUSD_LOCKED_ADDRESS, YVUSD_UNLOCKED_ADDRESS } from '@pages/vaults/utils/yvUsd'
import { toAddress } from '@shared/utils'

export type TUserHistoryVault = {
  chainId: number
  vaultAddress: string
}

export function getVaultUserHistoryVaults({
  chainId,
  vaultAddress
}: {
  chainId: number
  vaultAddress: string
}): TUserHistoryVault[] {
  const normalizedVaultAddress = toAddress(vaultAddress)

  if (isYvUsdAddress(normalizedVaultAddress)) {
    return [
      { chainId: YVUSD_CHAIN_ID, vaultAddress: YVUSD_UNLOCKED_ADDRESS },
      { chainId: YVUSD_CHAIN_ID, vaultAddress: YVUSD_LOCKED_ADDRESS }
    ]
  }

  if (
    normalizedVaultAddress === toAddress(YBOLD_VAULT_ADDRESS) ||
    normalizedVaultAddress === toAddress(YBOLD_STAKING_ADDRESS)
  ) {
    return [
      { chainId, vaultAddress: YBOLD_VAULT_ADDRESS },
      { chainId, vaultAddress: YBOLD_STAKING_ADDRESS }
    ]
  }

  return [{ chainId, vaultAddress }]
}
