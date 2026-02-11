import { TypeMarkCurve } from '@shared/icons/TypeMarkCurve'
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
  badge: {
    background: 'linear-gradient(90deg, #1E222B 0%, #2B2F3A 100%)',
    labelTextColor: '#FFFFFF',
    borderColor: 'transparent',
    dotColor: '#A6AEC2',
    yearnTypemarkColor: '#FFFFFF',
    partnerTypemarkComponent: TypeMarkCurve,
    partnerTypemarkHeightPx: 24,
    partnerTypemarkMaxWidthPx: 92
  },
  vaultListFilter: (item) => isCurveVaultListItem(item)
}
