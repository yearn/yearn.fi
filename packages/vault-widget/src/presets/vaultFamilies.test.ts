import { describe, expect, it } from 'vitest'
import type { VaultWidgetToken } from '../types'
import { createYvBtcFamilyPreset, YVBTC_LOCKED_ADDRESS } from './yvBtc'
import { createYvUsdFamilyPreset, YVUSD_LOCKED_ADDRESS, YVUSD_UNLOCKED_ADDRESS } from './yvUsd'

const btcAsset: VaultWidgetToken = {
  address: '0x1111111111111111111111111111111111111111',
  chainId: 1,
  decimals: 8,
  symbol: 'WBTC'
}

describe('product family presets', () => {
  it('provides live locked and unlocked yvUSD configurations', () => {
    const family = createYvUsdFamilyPreset({
      estimatedAprByVariant: {
        locked: 0.12,
        unlocked: 0.05
      }
    })
    const locked = family.variants.find(({ id }) => id === 'locked')
    const unlocked = family.variants.find(({ id }) => id === 'unlocked')

    expect(family.defaultVariant).toBe('locked')
    expect(locked).toMatchObject({ available: true, config: { vaultAddress: YVUSD_LOCKED_ADDRESS } })
    expect(locked?.config?.adapters[0]?.id).toBe('yvUSD-locked')
    expect(locked?.config?.infoPositionSources?.map(({ id }) => id)).toEqual(['yvUSD-unlocked', 'yvUSD-locked'])
    expect(locked?.config?.info).toMatchObject({
      cooldownVaultAddress: YVUSD_LOCKED_ADDRESS,
      showAllPositionSources: true,
      showTotalShares: false
    })
    expect(locked?.config?.display?.estimatedApr).toBe(0.12)
    expect(unlocked).toMatchObject({ available: true, config: { vaultAddress: YVUSD_UNLOCKED_ADDRESS } })
    expect(unlocked?.config?.adapters[0]?.id).toBe('erc4626')
    expect(unlocked?.config?.infoPositionSources?.map(({ id }) => id)).toEqual(['yvUSD-unlocked', 'yvUSD-locked'])
    expect(unlocked?.config?.display?.estimatedApr).toBe(0.05)
  })

  it('keeps locked yvBTC explicitly unavailable until its contract launches', () => {
    const family = createYvBtcFamilyPreset({ asset: btcAsset })
    const locked = family.variants.find(({ id }) => id === 'locked')

    expect(YVBTC_LOCKED_ADDRESS).toBe('0x0000000000000000000000000000000000000000')
    expect(family.defaultVariant).toBe('unlocked')
    expect(locked).toEqual({
      id: 'locked',
      label: 'Locked',
      description: 'The locked yvBTC contract has not launched.',
      available: false,
      unavailableMessage: 'Locked yvBTC is not live yet.'
    })
  })
})
