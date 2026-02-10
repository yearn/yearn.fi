import { getInclusionFlag } from '@shared/partners/partnerFilterUtils'

type TVaultListFilterInput = {
  chainId: number
  inclusion?: Record<string, boolean>
}

export const KATANA_CHAIN_ID = 747474

export function isKatanaVaultListItem(item: TVaultListFilterInput): boolean {
  const isKatana = getInclusionFlag(item.inclusion, 'isKatana')
  if (isKatana === true) {
    return true
  }

  if (isKatana === false) {
    return false
  }

  return item.chainId === KATANA_CHAIN_ID
}
