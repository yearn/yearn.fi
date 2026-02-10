import { isVelodromeVaultListItem } from '@shared/partners/isVelodromeVaultListItem'
import type { TPartnerConfig } from '@shared/partners/types'

export const VELODROME_PARTNER_CONFIG: TPartnerConfig = {
  slug: 'velodrome',
  displayName: 'Velodrome',
  manifest: {
    name: 'Yearn x Velodrome Vaults',
    description: 'Wear the yield yellow jersey with Velodrome.',
    uri: 'https://yearn.fi/velodrome',
    canonical: 'https://yearn.fi/velodrome',
    og: 'https://yearn.fi/apps/vaults-og.png',
    theme_color: '#151F2E',
    background_color: '#151F2E',
    title_color: '#ffffff'
  },
  themeOverrides: {
    cssVariables: {
      '--color-primary': '#EE2524',
      '--color-primary-hover': '#C81E1D'
    }
  },
  vaultListFilter: (item) => isVelodromeVaultListItem(item)
}
