import type { TKongVaultListItem } from '@shared/utils/schemas/kongVaultListSchema'

export type TPartnerSlug = 'aerodrome' | 'curve' | 'katana' | 'morpho' | 'pooltogether' | 'velodrome'

export type TPartnerManifest = {
  name: string
  description: string
  uri: string
  canonical?: string
  og: string
  theme_color?: string
  background_color?: string
  title_color?: string
}

export type TPartnerThemeOverrides = {
  cssVariables?: Record<`--${string}`, string>
}

export type TPartnerConfig = {
  slug: TPartnerSlug
  displayName: string
  manifest: TPartnerManifest
  themeOverrides?: TPartnerThemeOverrides
  vaultListFilter: (item: TKongVaultListItem) => boolean
}
