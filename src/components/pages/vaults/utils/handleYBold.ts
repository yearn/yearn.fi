// Temp file, remove logic at a later date

import { mergeYBoldVault, YBOLD_STAKING_ADDRESS, YBOLD_VAULT_ADDRESS } from '@pages/vaults/domain/normalizeVault'
import { toAddress } from '@shared/utils'
import type { TKongVaultListItem } from '@shared/utils/schemas/kongVaultListSchema'
import { kongVaultListItemSchema } from '@shared/utils/schemas/kongVaultListSchema'
import { isAddressEqual } from 'viem'

export const fetchYBoldVault = async (
  kongBaseUri: string,
  vault?: TKongVaultListItem
): Promise<TKongVaultListItem | undefined> => {
  if (!vault || !isAddressEqual(vault.address, YBOLD_VAULT_ADDRESS)) {
    return undefined
  }

  try {
    const res = await fetch(`${kongBaseUri}/list/vaults/${toAddress(YBOLD_STAKING_ADDRESS)}`)
    const json = await res.json()
    const parsed: TKongVaultListItem = kongVaultListItemSchema.parse(json)
    return mergeYBoldVault(vault, parsed)
  } catch (error) {
    console.error('Error handling yBold vault:', error)
    return undefined
  }
}
