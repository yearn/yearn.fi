import { isMorphoVaultListItem } from '@shared/partners/isMorphoVaultListItem'
import type { TPartnerConfig } from '@shared/partners/types'

export const MORPHO_PARTNER_CONFIG: TPartnerConfig = {
  slug: 'morpho',
  displayName: 'Morpho',
  manifest: {
    name: 'Yearn x Morpho Vaults',
    description: 'Time to feel the butterfly effect.',
    uri: 'https://yearn.fi/morpho',
    canonical: 'https://yearn.fi/morpho',
    og: 'https://yearn.fi/apps/vaults-og.png',
    theme_color: '#15181A',
    background_color: '#15181A',
    title_color: '#ffffff'
  },
  themeOverrides: {
    cssVariables: {
      '--color-primary': '#2973FF',
      '--color-primary-hover': '#2066E8'
    }
  },
  vaultListFilter: (item) => isMorphoVaultListItem(item)
}
