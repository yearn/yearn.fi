import { AERODROME_PARTNER_CONFIG } from '@shared/partners/configs/aerodrome'
import { CURVE_PARTNER_CONFIG } from '@shared/partners/configs/curve'
import { KATANA_PARTNER_CONFIG } from '@shared/partners/configs/katana'
import { MORPHO_PARTNER_CONFIG } from '@shared/partners/configs/morpho'
import { POOLTOGETHER_PARTNER_CONFIG } from '@shared/partners/configs/pooltogether'
import { VELODROME_PARTNER_CONFIG } from '@shared/partners/configs/velodrome'
import type { TPartnerConfig, TPartnerSlug } from '@shared/partners/types'

export const PARTNER_SLUGS: TPartnerSlug[] = ['curve', 'morpho', 'katana', 'aerodrome', 'velodrome', 'pooltogether']

const PARTNER_CONFIGS: Record<TPartnerSlug, TPartnerConfig> = {
  aerodrome: AERODROME_PARTNER_CONFIG,
  curve: CURVE_PARTNER_CONFIG,
  katana: KATANA_PARTNER_CONFIG,
  morpho: MORPHO_PARTNER_CONFIG,
  pooltogether: POOLTOGETHER_PARTNER_CONFIG,
  velodrome: VELODROME_PARTNER_CONFIG
}

export function isPartnerSlug(value: string): value is TPartnerSlug {
  return value in PARTNER_CONFIGS
}

export function getPartnerConfig(slug: TPartnerSlug | null | undefined): TPartnerConfig | undefined {
  if (!slug) {
    return undefined
  }
  return PARTNER_CONFIGS[slug]
}

export function getAllPartnerConfigs(): TPartnerConfig[] {
  return PARTNER_SLUGS.map((slug) => PARTNER_CONFIGS[slug])
}
