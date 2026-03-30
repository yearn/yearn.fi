import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { MobileKeyMetrics, YvUsdApyStatBox } from './QuickStatsGrid'

vi.mock('@shared/contexts/useWeb3', () => ({
  useWeb3: () => ({
    address: undefined,
    isActive: false
  })
}))

vi.mock('@pages/vaults/components/table/VaultForwardAPY', () => ({
  VaultForwardAPY: () => <div data-testid={'default-apy'}>{'Default APY'}</div>
}))

vi.mock('@pages/vaults/components/table/APYDetailsModal', () => ({
  APYDetailsModal: ({ isOpen, title, children }: { isOpen: boolean; title: string; children: ReactNode }) =>
    isOpen ? (
      <div data-testid={'apy-modal'}>
        <h1>{title}</h1>
        {children}
      </div>
    ) : null
}))

const TEST_VAULT = {
  version: '3.0.0',
  chainID: 1,
  address: '0x0000000000000000000000000000000000000001',
  name: 'Test Vault',
  token: {
    address: '0x0000000000000000000000000000000000000002',
    symbol: 'TKN',
    decimals: 6
  },
  tvl: {
    tvl: 1234
  }
}

describe('MobileKeyMetrics', () => {
  it('renders a custom APY box override when provided', () => {
    const html = renderToStaticMarkup(
      <MobileKeyMetrics
        currentVault={TEST_VAULT as never}
        tokenPrice={1}
        apyBox={<div data-testid={'custom-apy'}>{'Custom APY'}</div>}
      />
    )

    expect(html).toContain('Custom APY')
    expect(html).not.toContain('Default APY')
  })
})

describe('YvUsdApyStatBox', () => {
  it('renders the locked variant by default with the unlocked toggle affordance', () => {
    const html = renderToStaticMarkup(<YvUsdApyStatBox lockedApy={0.09} unlockedApy={0.05} />)

    expect(html).toContain('Locked')
    expect(html).toContain('9.00%')
    expect(html).toContain('Switch to unlocked APY display')
    expect(html).not.toContain('data-testid="apy-modal"')
  })

  it('formats large APY values with the shared significant-digit rules', () => {
    const html = renderToStaticMarkup(<YvUsdApyStatBox lockedApy={1.1777} unlockedApy={0.05} />)

    expect(html).toContain('118%')
    expect(html).not.toContain('117.77%')
  })

  it('renders the controlled variant when provided', () => {
    const html = renderToStaticMarkup(
      <YvUsdApyStatBox lockedApy={0.09} unlockedApy={0.05} activeVariant={'unlocked'} />
    )

    expect(html).toContain('Unlocked')
    expect(html).toContain('5.00%')
    expect(html).toContain('Switch to locked APY display')
  })

  it('shows the Infinifi points icon whenever yvUSD has points', () => {
    const lockedHtml = renderToStaticMarkup(
      <YvUsdApyStatBox
        lockedApy={0.09}
        unlockedApy={0.05}
        activeVariant={'locked'}
        lockedHasInfinifiPoints
        unlockedHasInfinifiPoints={false}
      />
    )
    const unlockedHtml = renderToStaticMarkup(
      <YvUsdApyStatBox
        lockedApy={0.09}
        unlockedApy={0.05}
        activeVariant={'unlocked'}
        lockedHasInfinifiPoints
        unlockedHasInfinifiPoints={false}
      />
    )

    expect(lockedHtml).toContain('aria-label="Infinifi points"')
    expect(unlockedHtml).toContain('aria-label="Infinifi points"')
  })
})
