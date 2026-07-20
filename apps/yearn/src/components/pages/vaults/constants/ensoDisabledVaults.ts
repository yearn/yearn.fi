import { toAddress } from '@shared/utils'
import type { Address } from 'viem'

// Add vault addresses here to disable Enso routing on a per-vault basis.
// Example:
// 1: ['0x27B5739e22ad9033bcBf192059122d163b60349D'] //yCRV
const ENSO_DISABLED_VAULTS_BY_CHAIN: Partial<Record<number, readonly Address[]>> = {}

export const isVaultEnsoDisabled = (chainId?: number, vaultAddress?: Address): boolean => {
  if (!chainId || !vaultAddress) {
    return false
  }

  const disabledVaults = ENSO_DISABLED_VAULTS_BY_CHAIN[chainId]
  if (!disabledVaults || disabledVaults.length === 0) {
    return false
  }

  const normalizedVaultAddress = toAddress(vaultAddress)
  return disabledVaults.some((address) => toAddress(address) === normalizedVaultAddress)
}
