import { describe, expect, it } from 'vitest'

import {
  getTranchedProductById,
  getTranchedProductsByKind,
  getTranchedVaultRowsByKind,
  YVUSD_TRANCHE_DEPLOYMENT
} from './tranchedProducts'

describe('tranched product list copy', () => {
  it('uses the fixed product names', () => {
    expect(getTranchedProductsByKind('senior').map((product) => product.name)).toEqual(['yvUSD', 'yvWETH'])
  })

  it('uses the junior product names', () => {
    expect(getTranchedProductsByKind('junior').map((product) => product.name)).toEqual([
      'yvUSD Junior',
      'yvWETH Junior'
    ])
  })

  it('removes the BTC tranche products and their detail routes', () => {
    expect(getTranchedProductById('yvbtc-fixed')).toBeUndefined()
    expect(getTranchedProductById('yvbtc-levered')).toBeUndefined()
  })

  it('uses realistic TVLs and gives each Junior one quarter of its senior TVL', () => {
    const seniors = getTranchedVaultRowsByKind('senior')
    const juniors = getTranchedVaultRowsByKind('junior')
    expect(seniors.map(({ vault }) => vault.tvl.tvl)).toEqual([12_000_000, 13_200_000])
    seniors.forEach(({ product, vault }) => {
      const junior = juniors.find((row) => row.product.asset === product.asset)
      expect(junior?.vault.tvl.tvl).toBe(vault.tvl.tvl / 4)
      expect(junior?.vault.tvl.totalAssets).toBe(vault.tvl.totalAssets / 4n)
    })
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
