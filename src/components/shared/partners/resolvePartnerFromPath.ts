import { isPartnerSlug } from '@shared/partners/registry'
import { normalizePathname } from '@shared/utils/routes'
import type { TPartnerSlug } from './types'

export function resolvePartnerFromPath(pathname: string): TPartnerSlug | undefined {
  const normalized = normalizePathname(pathname).toLowerCase()
  const slug = normalized.replace(/^\//, '')
  if (!slug || !isPartnerSlug(slug)) {
    return undefined
  }
  return slug
}
