import { TypeMarkAerodrome } from '@shared/icons/TypeMarkAerodrome'
import { isAerodromeVaultListItem } from '@shared/partners/isAerodromeVaultListItem'
import type { TPartnerConfig } from '@shared/partners/types'

export const AERODROME_PARTNER_CONFIG: TPartnerConfig = {
  slug: 'aerodrome',
  displayName: 'Aerodrome',
  manifest: {
    name: 'Yearn x Aerodrome Vaults',
    description: 'Liftoff for great yields, with Aerodrome on Yearn.',
    uri: 'https://yearn.fi/aerodrome',
    canonical: 'https://yearn.fi/aerodrome',
    og: 'https://yearn.fi/apps/vaults-og.png',
    theme_color: '#151B33',
    background_color: '#151B33',
    title_color: '#ffffff'
  },
  themeOverrides: {
    cssVariables: {
      '--color-primary': '#0052FF',
      '--color-primary-hover': '#054DED'
    }
  },
  badge: {
    background: 'linear-gradient(90deg, #0B1538 0%, #9b0101 100%)',
    labelTextColor: '#E6F0FF',
    borderColor: '#transparent',
    dotColor: '#73A1FF',
    yearnTypemarkColor: '#FFFFFF',
    partnerTypemarkMaxWidthPx: 180,
    partnerTypemarkComponent: TypeMarkAerodrome
  },
  vaultListFilter: (item) => isAerodromeVaultListItem(item)
}
