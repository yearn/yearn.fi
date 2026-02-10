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
      '--color-primary': 'hsl(172 90% 42%)',
      '--color-primary-hover': 'hsl(172 90% 36%)'
    }
  },
  vaultListFilter: (item) => isKatanaVaultListItem(item)
}
