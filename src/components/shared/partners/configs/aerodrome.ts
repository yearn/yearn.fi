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
  vaultListFilter: (item) => isAerodromeVaultListItem(item)
}
