import type { TYDaemonVault } from '@lib/utils/schemas/yDaemonVaultsSchemas'
import { useVaultApyData } from '@vaults-v3/hooks/useVaultApyData'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'

import { SuggestedVaultCard } from './SuggestedVaultCard'

vi.mock('@vaults-v3/hooks/useVaultApyData', () => ({
  useVaultApyData: vi.fn()
}))

const baseVault = {
  chainID: 1,
  address: '0x0000000000000000000000000000000000000001',
  name: 'A Very Long Vault Name That Should Truncate In The Card Header',
  category: 'Some Category',
  token: {
    address: '0x0000000000000000000000000000000000000002',
    symbol: 'TKN'
  },
  staking: {
    source: 'None'
  },
  tvl: {
    tvl: 1234567
  }
} as unknown as TYDaemonVault

function renderCard(vault: TYDaemonVault): string {
  const originalWindow = globalThis.window
  ;(globalThis as unknown as { window: unknown }).window = {
    location: { href: 'https://yearn.fi/', hostname: 'yearn.fi' }
  }

  try {
    return renderToStaticMarkup(
      <MemoryRouter>
        <SuggestedVaultCard vault={vault} />
      </MemoryRouter>
    )
  } finally {
    ;(globalThis as unknown as { window: unknown }).window = originalWindow
  }
}

describe('SuggestedVaultCard', () => {
  it('uses 30D APY and no HIST prefix when est APY is unavailable', () => {
    vi.mocked(useVaultApyData).mockReturnValue({
      mode: 'historical',
      baseForwardApr: 0,
      netApr: 0.1234,
      rewardsAprSum: 0,
      isBoosted: false,
      hasPendleArbRewards: false,
      hasKelp: false,
      hasKelpNEngenlayer: false,
      katanaExtras: undefined,
      katanaTotalApr: undefined
    })

    const html = renderCard(baseVault)
    expect(html).toContain('30D APY')
    expect(html).not.toContain('Hist.')
  })

  it('uses Est. APY when est APY is available', () => {
    vi.mocked(useVaultApyData).mockReturnValue({
      mode: 'spot',
      baseForwardApr: 0.1234,
      netApr: 0,
      rewardsAprSum: 0,
      isBoosted: false,
      hasPendleArbRewards: false,
      hasKelp: false,
      hasKelpNEngenlayer: false,
      katanaExtras: undefined,
      katanaTotalApr: undefined
    })

    const html = renderCard(baseVault)
    expect(html).toContain('Est. APY')
  })

  it('truncates the vault title to a single line', () => {
    vi.mocked(useVaultApyData).mockReturnValue({
      mode: 'spot',
      baseForwardApr: 0.1,
      netApr: 0,
      rewardsAprSum: 0,
      isBoosted: false,
      hasPendleArbRewards: false,
      hasKelp: false,
      hasKelpNEngenlayer: false,
      katanaExtras: undefined,
      katanaTotalApr: undefined
    })

    const html = renderCard(baseVault)
    expect(html).toContain('class="truncate')
  })
})
