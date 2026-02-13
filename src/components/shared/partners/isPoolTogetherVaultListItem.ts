import { getInclusionFlag } from '@shared/partners/partnerFilterUtils'

export function isPoolTogetherVaultListItem(item: { inclusion?: Record<string, boolean> }): boolean {
  return getInclusionFlag(item.inclusion, 'isPoolTogether') === true
}
