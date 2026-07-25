import { afterEach, describe, expect, it, vi } from 'vitest'

describe('vault widget cutover', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('keeps the package disabled by default', async () => {
    vi.stubEnv('NEXT_PUBLIC_VAULT_WIDGET_ENABLED', '')
    const { isVaultWidgetCutoverEnabled } = await import('@/config/vaultWidget')

    expect(isVaultWidgetCutoverEnabled()).toBe(false)
  })

  it('only enables the complete surface with an explicit true value', async () => {
    vi.stubEnv('NEXT_PUBLIC_VAULT_WIDGET_ENABLED', 'true')
    const { isVaultWidgetCutoverEnabled } = await import('@/config/vaultWidget')

    expect(isVaultWidgetCutoverEnabled()).toBe(true)
  })

  it('allows the legacy comparison override during development', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    const { isLegacyVaultWidgetPreview } = await import('@/config/vaultWidget')

    expect(isLegacyVaultWidgetPreview(new URLSearchParams('vaultWidget=legacy'))).toBe(true)
  })

  it('keeps the legacy override disabled in an ordinary production build', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('NEXT_PUBLIC_VAULT_WIDGET_PARITY_ENABLED', '')
    const { isLegacyVaultWidgetPreview } = await import('@/config/vaultWidget')

    expect(isLegacyVaultWidgetPreview(new URLSearchParams('vaultWidget=legacy'))).toBe(false)
  })

  it('allows the legacy override in an explicitly flagged production parity build', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('NEXT_PUBLIC_VAULT_WIDGET_PARITY_ENABLED', 'true')
    const { isLegacyVaultWidgetPreview } = await import('@/config/vaultWidget')

    expect(isLegacyVaultWidgetPreview(new URLSearchParams('vaultWidget=legacy'))).toBe(true)
    expect(isLegacyVaultWidgetPreview(new URLSearchParams())).toBe(false)
  })
})
