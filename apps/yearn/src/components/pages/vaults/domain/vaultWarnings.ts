import type { TKongVault } from '@pages/vaults/domain/kongVaultSelectors'
import { isYvBtcAddress, YVBTC_CHAIN_ID } from '@pages/vaults/utils/yvBtc'
import type { TKongVaultSnapshot } from '@shared/utils/schemas/kongVaultSnapshotSchema'

export const NON_YEARN_ERC4626_WARNING_MESSAGE =
  'This is a non-Yearn ERC-4626 Vault. Please be careful when interacting with it.'

export function isNonYearnErc4626Vault({
  vault,
  snapshot
}: {
  vault?: TKongVault
  snapshot?: TKongVaultSnapshot
}): boolean {
  if (vault) {
    if (isYvBtcAddress(vault.address) && vault.inclusion?.isYearn !== false) {
      return false
    }

    return vault.origin !== 'yearn' || vault.inclusion?.isYearn === false
  }

  if (snapshot) {
    if (
      snapshot.chainId === YVBTC_CHAIN_ID &&
      isYvBtcAddress(snapshot.address) &&
      snapshot.inclusion?.isYearn !== false
    ) {
      return false
    }

    return snapshot.origin !== 'yearn' || snapshot.inclusion?.isYearn === false
  }

  return false
}
