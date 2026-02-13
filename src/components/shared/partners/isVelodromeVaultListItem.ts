import { matchesVaultCategory } from '@shared/partners/partnerFilterUtils'

export function isVelodromeVaultListItem(item: { category?: string | null }): boolean {
  return matchesVaultCategory(item, 'Velodrome')
}
