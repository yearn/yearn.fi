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
    expect(getTranchedProductsByKind('junior').map((product) => product.name)).toEqual([
      'yvUSD Levered Yield',
      'yvETH Levered Yield',
      'yvBTC Levered Yield'
    ])
  })

  it('sets the yvBTC fixed target rate to 1.5%', () => {
    expect(getTranchedProductById('yvbtc-fixed')?.apyLabel).toBe('1.50%')
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
