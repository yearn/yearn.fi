import { TypeMarkKatana } from '@shared/icons/TypeMarkKatana'
import { isKatanaVaultListItem } from '@shared/partners/isKatanaVaultListItem'
import type { TPartnerConfig } from '@shared/partners/types'

export const KATANA_PARTNER_CONFIG: TPartnerConfig = {
  slug: 'katana',
  displayName: 'Katana',
  manifest: {
    name: 'Yearn x Katana Vaults',
    description: 'Explore Yearn vaults curated for Katana users.',
    uri: 'https://yearn.fi/katana',
    canonical: 'https://yearn.fi/katana',
    og: 'https://yearn.fi/apps/vaults-og.png',
    theme_color: '#000000',
    background_color: '#000000',
    title_color: '#ffffff'
  },
  themeOverrides: {
    cssVariables: {
      '--color-primary': '#e00101',
      '--color-primary-hover': '#e00101'
    }
  },
  badge: {
    background: 'linear-gradient(90deg, #fbad18 0%, #003279 100%)',
    labelTextColor: '#FFFFFF',
    borderColor: 'border-border',
    dotColor: '#F4FF00',
    yearnTypemarkColor: '#FFFFFF',
    partnerTypemarkOffsetYPx: 1,
    partnerTypemarkMaxWidthPx: 120,
    partnerTypemarkComponent: TypeMarkKatana
  },
  vaultListFilter: (item) => isKatanaVaultListItem(item)
}
