// Temp file, remove logic at a later date

import { toAddress } from '@lib/utils'
import type { TYDaemonVault } from '@lib/utils/schemas/yDaemonVaultsSchemas'
import { yDaemonVaultSchema } from '@lib/utils/schemas/yDaemonVaultsSchemas'
import { mergeYBoldVault, YBOLD_STAKING_ADDRESS, YBOLD_VAULT_ADDRESS } from '@vaults/domain/normalizeVault'
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
