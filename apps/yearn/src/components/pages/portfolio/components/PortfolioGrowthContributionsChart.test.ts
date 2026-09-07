import { getPortfolioGrowthStackDomain } from '@pages/portfolio/components/PortfolioGrowthContributionsChart'
import { describe, expect, it } from 'vitest'

describe('getPortfolioGrowthStackDomain', () => {
  it('includes intermediate mixed-sign band boundaries', () => {
    expect(getPortfolioGrowthStackDomain([-90, 0, 10, 100])).toEqual([-94.5, 105])
  })
})
