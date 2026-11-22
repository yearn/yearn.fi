import type { TKongVault } from '@pages/vaults/domain/kongVaultSelectors'
import { isYvBtcAddress, YVBTC_CHAIN_ID } from '@pages/vaults/utils/yvBtc'
import type { TKongVaultSnapshot } from '@shared/utils/schemas/kongVaultSnapshotSchema'

export const NON_YEARN_ERC4626_WARNING_MESSAGE =
  'This is a non-Yearn ERC-4626 Vault. Please be careful when interacting with it.'

type TVaultOriginInput = Pick<TKongVaultSnapshot, 'chainId' | 'address' | 'origin' | 'inclusion'>

export function isNonYearnErc4626Vault({
  vault,
  snapshot
}: {
  vault?: TKongVault
  snapshot?: TKongVaultSnapshot
}): boolean {
  const item: TVaultOriginInput | undefined = vault ?? snapshot
  if (!item) {
    return false
  }
  if (item.inclusion?.isYearn === false) {
    return true
  }
  return item.origin !== 'yearn' && !(item.chainId === YVBTC_CHAIN_ID && isYvBtcAddress(item.address))
}
