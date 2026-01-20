// Temp file, remove logic at a later date

import { mergeYBoldVault, YBOLD_STAKING_ADDRESS, YBOLD_VAULT_ADDRESS } from '@pages/vaults/domain/normalizeVault'
import { toAddress } from '@shared/utils'
import type { TYDaemonVault } from '@shared/utils/schemas/yDaemonVaultsSchemas'
import { yDaemonVaultSchema } from '@shared/utils/schemas/yDaemonVaultsSchemas'
import { isAddressEqual } from 'viem'

const params = new URLSearchParams({
  strategiesDetails: 'withDetails',
  strategiesCondition: 'inQueue'
})

export const fetchYBoldVault = async (
  yDaemonBaseUri: string,
  vault?: TYDaemonVault
): Promise<TYDaemonVault | undefined> => {
  if (!vault || !isAddressEqual(vault.address, YBOLD_VAULT_ADDRESS)) {
    return undefined
  }

  try {
    const res = await fetch(`${yDaemonBaseUri}/vaults/${toAddress(YBOLD_STAKING_ADDRESS)}?${params}`)
    const json = await res.json()
    const parsed: TYDaemonVault = yDaemonVaultSchema.parse(json)
    return mergeYBoldVault(vault, parsed)
  } catch (error) {
    console.error('Error handling yBold vault:', error)
    return undefined
  }
}
