import { getPortfolioGrowthLineDomain } from '@pages/portfolio/components/PortfolioGrowthContributionsChart'
import type { TPortfolioGrowthContributionChartPoint } from '@pages/portfolio/utils/portfolioGrowthContributions'
import { describe, expect, it } from 'vitest'

describe('getPortfolioGrowthLineDomain', () => {
  it('scales independent mixed-sign lines instead of their stack', () => {
    const data: TPortfolioGrowthContributionChartPoint[] = [
      { date: '2026-01-01', portfolioGrowth: 10, vault_0: 100, vault_1: 50, vault_2: -140 }
    ]

    expect(getPortfolioGrowthLineDomain(data, [{ key: 'vault_0' }, { key: 'vault_1' }, { key: 'vault_2' }])).toEqual([
      -147, 105
    ])
  })
})
