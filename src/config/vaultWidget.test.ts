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
})
