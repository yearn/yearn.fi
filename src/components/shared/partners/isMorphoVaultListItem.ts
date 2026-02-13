import { getInclusionFlag } from '@shared/partners/partnerFilterUtils'

export function isMorphoVaultListItem(item: { inclusion?: Record<string, boolean> }): boolean {
  return getInclusionFlag(item.inclusion, 'isMorpho') === true
}
