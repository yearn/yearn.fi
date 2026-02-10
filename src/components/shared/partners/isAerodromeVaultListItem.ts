import { matchesVaultCategory } from '@shared/partners/partnerFilterUtils'

export function isAerodromeVaultListItem(item: { category?: string | null }): boolean {
  return matchesVaultCategory(item, 'Aerodrome')
}
