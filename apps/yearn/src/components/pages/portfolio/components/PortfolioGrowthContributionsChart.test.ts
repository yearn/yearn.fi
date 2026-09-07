import { getPortfolioGrowthStackDomain } from '@pages/portfolio/components/PortfolioGrowthContributionsChart'
import { describe, expect, it } from 'vitest'

describe('getPortfolioGrowthStackDomain', () => {
  it('includes intermediate mixed-sign band boundaries', () => {
    expect(getPortfolioGrowthStackDomain([-90, 0, 10, 100])).toEqual([-94.5, 105])
  })

  it('uses 100 as the visible floor for Index attribution', () => {
    expect(getPortfolioGrowthStackDomain([0, 100, 135], 100)).toEqual([100, 136.75])
  })
})
