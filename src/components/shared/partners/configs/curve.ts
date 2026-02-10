import { isCurveVaultListItem } from '@shared/partners/isCurveVaultListItem'
import type { TPartnerConfig } from '@shared/partners/types'

export const CURVE_PARTNER_CONFIG: TPartnerConfig = {
  slug: 'curve',
  displayName: 'Curve',
  manifest: {
    name: 'Yearn x Curve Vaults',
    description: "If it's on Curve, you'll get the best max boosted yields with Yearn.",
    uri: 'https://yearn.fi/curve',
    canonical: 'https://yearn.fi/curve',
    og: 'https://yearn.fi/apps/vaults-og.png',
    theme_color: '#000000',
    background_color: '#000000',
    title_color: '#ffffff'
  },
  themeOverrides: {
    cssVariables: {
      '--color-primary': '#1763FD',
      '--color-primary-hover': '#034CDE'
    }
  },
  vaultListFilter: (item) => isCurveVaultListItem(item)
}
