import { isYvBtcAddress, YVBTC_CHAIN_ID } from '@pages/vaults/utils/yvBtc'
import type { TKongVaultSnapshot } from '@shared/utils/schemas/kongVaultSnapshotSchema'

export const NON_YEARN_ERC4626_WARNING_MESSAGE =
  'This is a non-Yearn ERC-4626 Vault. Please be careful when interacting with it.'

type TVaultOriginInput = Pick<TKongVaultSnapshot, 'chainId' | 'origin' | 'inclusion'> & { address: string }

export function isNonYearnErc4626Vault({ vault }: { vault?: TVaultOriginInput }): boolean {
  if (!vault) {
    return false
  }
  if (vault.inclusion?.isYearn === false) {
    return true
  }
  return vault.origin !== 'yearn' && !(vault.chainId === YVBTC_CHAIN_ID && isYvBtcAddress(vault.address))
}
