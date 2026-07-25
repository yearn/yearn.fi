import { env } from '@/env'

/**
 * This flag will switch the complete widget surface once the parity suite
 * covers every legacy route. It must not be used for route-by-route adoption.
 */
export function isVaultWidgetCutoverEnabled(): boolean {
  return env.NEXT_PUBLIC_VAULT_WIDGET_ENABLED === 'true'
}

export function isLegacyVaultWidgetPreview(searchParams: Pick<URLSearchParams, 'get'>): boolean {
  if (searchParams.get('vaultWidget') !== 'legacy') return false
  return env.DEV || env.NEXT_PUBLIC_VAULT_WIDGET_PARITY_ENABLED === 'true'
}
