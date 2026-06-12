import type { TKongVaultListItem } from '@shared/utils/schemas/kongVaultListSchema'

export const isCatalogYearnVault = (item: TKongVaultListItem): boolean =>
  item.origin === 'yearn' && item.inclusion?.isYearn !== false
