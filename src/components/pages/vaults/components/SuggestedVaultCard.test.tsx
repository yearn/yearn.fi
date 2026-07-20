import type { TKongVaultInput } from '@pages/vaults/domain/kongVaultSelectors'
import { useVaultApyData } from '@pages/vaults/hooks/useVaultApyData'
import { YVUSD_LOCKED_ADDRESS, YVUSD_UNLOCKED_ADDRESS } from '@pages/vaults/utils/yvUsd'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import { SuggestedVaultCard } from './SuggestedVaultCard'

vi.mock('@pages/vaults/hooks/useVaultApyData', () => ({
  useVaultApyData: vi.fn()
}))

vi.mock('@hooks/usePlausible', () => ({
  usePlausible: () => vi.fn()
}))

vi.mock('@pages/vaults/hooks/useYvUsdVaults', () => ({
  useYvUsdVaults: () => ({
    metrics: {
      locked: { apy: 0.09 },
      unlocked: { apy: 0.05 }
    }
  })
}))

const baseVault = {
  chainId: 1,
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
} as unknown as TKongVaultInput

function renderCard(vault: TKongVaultInput): string {
  const originalWindow = globalThis.window
  ;(globalThis as unknown as { window: unknown }).window = {
    location: { href: 'https://yearn.fi/', hostname: 'yearn.fi' }
  }

  try {
    return renderToStaticMarkup(<SuggestedVaultCard vault={vault} />)
  } finally {
    ;(globalThis as unknown as { window: unknown }).window = originalWindow
  }
}

describe('SuggestedVaultCard', () => {
  it('uses Historical APY and no HIST prefix when est APY is unavailable', () => {
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
      katanaThirtyDayApr: undefined,
      katanaEstApr: undefined
    })

    const html = renderCard(baseVault)
    expect(html).toContain('Historical APY')
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
      katanaThirtyDayApr: undefined,
      katanaEstApr: undefined
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
      katanaThirtyDayApr: undefined,
      katanaEstApr: undefined
    })

    const html = renderCard(baseVault)
    expect(html).toContain('class="truncate')
  })

  it('uses yvUSD locked presentation for the locked yvUSD suggestion', () => {
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
      katanaThirtyDayApr: undefined,
      katanaEstApr: undefined
    })

    const html = renderCard({
      ...baseVault,
      address: YVUSD_LOCKED_ADDRESS,
      name: 'yvUSD (Locked)',
      token: {
        address: YVUSD_UNLOCKED_ADDRESS,
        symbol: 'yvUSD'
      }
    } as unknown as TKongVaultInput)

    expect(html).toContain('yvUSD (14 day lock)')
    expect(html).toContain('Locked APY')
    expect(html).toContain('9.00%')
    expect(html).toContain('/vaults/1/')
    expect(html).toContain(YVUSD_LOCKED_ADDRESS)
    expect(html).toContain('yvusd-128.png')
  })

  it('uses yvUSD unlocked presentation for the unlocked yvUSD suggestion', () => {
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
      katanaThirtyDayApr: undefined,
      katanaEstApr: undefined
    })

    const html = renderCard({
      ...baseVault,
      address: YVUSD_UNLOCKED_ADDRESS,
      name: 'yvUSD',
      token: {
        address: YVUSD_UNLOCKED_ADDRESS,
        symbol: 'yvUSD'
      }
    } as unknown as TKongVaultInput)

    expect(html).toContain('yvUSD (Unlocked)')
    expect(html).toContain('Unlocked APY')
    expect(html).toContain('5.00%')
    expect(html).toContain('/vaults/1/')
    expect(html).toContain(YVUSD_UNLOCKED_ADDRESS)
  })
})
