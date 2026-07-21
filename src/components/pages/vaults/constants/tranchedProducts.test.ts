import { describe, expect, it } from 'vitest'

import {
  getTranchedProductById,
  getTranchedProductsByKind,
  getTranchedVaultRowsByKind,
  YVUSD_TRANCHE_DEPLOYMENT
} from './tranchedProducts'

describe('tranched product list copy', () => {
  it('uses Fixed Yield names for senior products', () => {
    expect(getTranchedProductsByKind('senior').map((product) => product.name)).toEqual([
      'yvUSD Fixed Yield',
      'yvETH Fixed Yield',
      'yvBTC Fixed Yield'
    ])
  })

  it('uses Levered Yield names for junior products', () => {
    expect(getTranchedProductsByKind('junior').map((product) => product.name)).toEqual(['yvUSD Levered Yield'])
  })

  it('sets the yvBTC fixed target rate to 1.5%', () => {
    expect(getTranchedProductsByKind('senior').find((product) => product.id === 'yvbtc-fixed')?.apyLabel).toBe('1.50%')
  })

  it('marks undeployed fixed products as placeholders without fake TVL', () => {
    const placeholderRows = getTranchedVaultRowsByKind('senior').filter(
      ({ product }) => product.availability === 'placeholder'
    )

    expect(placeholderRows.map(({ product }) => product.id)).toEqual(['yveth-fixed', 'yvbtc-fixed'])
    expect(placeholderRows.every(({ vault }) => vault.tvl.tvl === 0 && vault.tvl.totalAssets === 0n)).toBe(true)
    expect(getTranchedProductById('yveth-fixed')).toBeUndefined()
    expect(getTranchedProductById('yvbtc-fixed')).toBeUndefined()
  })

  it('uses the deployed yvUSD tranche addresses and does not expose equity', () => {
    const rows = [...getTranchedVaultRowsByKind('senior'), ...getTranchedVaultRowsByKind('junior')]

    expect(rows.find(({ product }) => product.id === 'yvusd-fixed')?.vault.address).toBe(
      YVUSD_TRANCHE_DEPLOYMENT.tranches.fixed
    )
    expect(rows.find(({ product }) => product.id === 'yvusd-levered')?.vault.address).toBe(
      YVUSD_TRANCHE_DEPLOYMENT.tranches.levered
    )
    expect(rows.some(({ vault }) => vault.address === YVUSD_TRANCHE_DEPLOYMENT.tranches.equity)).toBe(false)
  })
})
