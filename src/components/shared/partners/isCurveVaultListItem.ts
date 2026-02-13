import { matchesVaultCategory } from '@shared/partners/partnerFilterUtils'

export function isCurveVaultListItem(item: { category?: string | null }): boolean {
  return matchesVaultCategory(item, 'Curve')
}
