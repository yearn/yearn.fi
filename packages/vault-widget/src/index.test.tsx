import { YBoldVaultWidget } from '@yearn/vault-widget'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('wagmi', () => ({
  useAccount: () => ({ address: '0x1111111111111111111111111111111111111111' })
}))

vi.mock('@yearn/vault-widget/internal/hooks/useVaultUserData', () => ({
  useVaultUserData: () => ({})
}))

vi.mock('@yearn/vault-widget/runtime', () => ({
  useVaultWidgetRuntime: () => ({ wallet: {} }),
  VaultWidgetRuntimeProvider: ({ children }: { children: unknown }) => children
}))

vi.mock('@yearn/vault-widget/internal/components/widget', async () => {
  const { createElement } = await import('react')

  return {
    Widget: ({ withdrawalSource }: { withdrawalSource?: string }) =>
      createElement('span', { 'data-withdrawal-source': withdrawalSource ?? 'automatic' }),
    WidgetTabs: () => null
  }
})

describe('YBoldVaultWidget', () => {
  it('allows the widget to select between yBOLD and staked yBOLD balances', () => {
    const html = renderToStaticMarkup(<YBoldVaultWidget />)

    expect(html).toContain('data-withdrawal-source="automatic"')
  })
})
