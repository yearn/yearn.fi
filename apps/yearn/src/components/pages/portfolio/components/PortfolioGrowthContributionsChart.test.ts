import {
  buildPortfolioGrowthVaultColorMap,
  getPortfolioGrowthStackDomain
} from '@pages/portfolio/components/PortfolioGrowthContributionsChart'
import { describe, expect, it } from 'vitest'

describe('getPortfolioGrowthStackDomain', () => {
  it('includes intermediate mixed-sign band boundaries', () => {
    expect(getPortfolioGrowthStackDomain([-90, 0, 10, 100])).toEqual([-94.5, 105])
  })

  it('uses 100 as the visible floor for Index attribution', () => {
    expect(getPortfolioGrowthStackDomain([100, 135], 100)).toEqual([100, 136.75])
  })

  it('includes Index attribution losses below 100', () => {
    expect(getPortfolioGrowthStackDomain([90, 100], 100)).toEqual([89.5, 101])
  })
})

describe('buildPortfolioGrowthVaultColorMap', () => {
  it('keeps vault colors stable when contribution ranking changes', () => {
    const firstVault = { chainId: 1, vaultAddress: '0xa89e83e39c8a1cb173d7a0c0201cd3956b57db6d' }
    const secondVault = { chainId: 1, vaultAddress: '0xbf319ddc2edc1eb6fdf9910e39b37be221c8805f' }
    const rankedFirst = buildPortfolioGrowthVaultColorMap([firstVault, secondVault])
    const rankedSecond = buildPortfolioGrowthVaultColorMap([
      { ...secondVault, vaultAddress: secondVault.vaultAddress.toUpperCase() },
      firstVault
    ])

    expect(rankedFirst).toEqual(rankedSecond)
    expect(new Set(rankedFirst.values())).toHaveLength(2)
  })
})
