import type { TKongVaultListItem } from '@shared/utils/schemas/kongVaultListSchema'
import type { ComponentType, SVGProps } from 'react'

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

export type TPartnerBadgeConfig = {
  background?: string
  labelTextColor?: string
  borderColor?: string
  dotColor?: string
  yearnTypemarkColor?: string
  yearnTypemarkOffsetXPx?: number
  yearnTypemarkOffsetYPx?: number
  partnerTypemarkComponent?: ComponentType<SVGProps<SVGSVGElement>>
  partnerTypemarkPath?: string
  partnerTypemarkAlt?: string
  partnerTypemarkHeightPx?: number
  partnerTypemarkMaxWidthPx?: number
  partnerTypemarkOffsetXPx?: number
  partnerTypemarkOffsetYPx?: number
}

export type TPartnerConfig = {
  slug: TPartnerSlug
  displayName: string
  manifest: TPartnerManifest
  themeOverrides?: TPartnerThemeOverrides
  badge?: TPartnerBadgeConfig
  vaultListFilter: (item: TKongVaultListItem) => boolean
}
