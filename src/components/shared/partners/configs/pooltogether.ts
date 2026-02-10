import { isPoolTogetherVaultListItem } from '@shared/partners/isPoolTogetherVaultListItem'
import type { TPartnerConfig } from '@shared/partners/types'

export const POOLTOGETHER_PARTNER_CONFIG: TPartnerConfig = {
  slug: 'pooltogether',
  displayName: 'PoolTogether',
  manifest: {
    name: 'Yearn x PoolTogether Vaults',
    description: 'Feeling lucky Anon? Win mega yield payouts with prize vaults.',
    uri: 'https://yearn.fi/pooltogether',
    canonical: 'https://yearn.fi/pooltogether',
    og: 'https://yearn.fi/apps/vaults-og.png',
    theme_color: '#4C249F',
    background_color: '#4C249F',
    title_color: '#ffffff'
  },
  themeOverrides: {
    cssVariables: {
      '--color-primary': '#C521D4',
      '--color-primary-hover': '#DC25ED'
    }
  },
  vaultListFilter: (item) => isPoolTogetherVaultListItem(item)
}
