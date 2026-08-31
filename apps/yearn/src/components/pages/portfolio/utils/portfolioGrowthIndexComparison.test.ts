import {
  buildPortfolioGrowthIndexComparison,
  type TPortfolioGrowthIndexFamily
} from '@pages/portfolio/utils/portfolioGrowthIndexComparison'
import { describe, expect, it } from 'vitest'

function timestamp(date: string): number {
  return Math.floor(Date.parse(`${date}T00:00:00.000Z`) / 1000)
}

function makeFamily(args: {
  label: string
  values: Array<{ date: string; value: number | null; milliseconds?: boolean }>
}): TPortfolioGrowthIndexFamily {
  return {
    chainId: 1,
    vaultAddress: `0x${args.label.charCodeAt(0).toString(16).padStart(40, '0')}`,
    label: args.label,
    dataPoints: args.values.map((point) => ({
      timestamp: timestamp(point.date) * (point.milliseconds ? 1000 : 1),
      value: point.value
    }))
  }
}

describe('buildPortfolioGrowthIndexComparison', () => {
  it('keeps the portfolio index and ranks the four largest vault moves', () => {
    const dates = ['2026-01-01', '2026-01-02', '2026-01-03']
    const chart = buildPortfolioGrowthIndexComparison({
      totalPoints: [
        { date: dates[0]!, value: 100 },
        { date: dates[1]!, value: 105 },
        { date: dates[2]!, value: 110 }
      ],
      familySeries: [
        makeFamily({
          label: 'Gain',
          values: dates.map((date, index) => ({ date, value: [100, 105, 120][index]! }))
        }),
        makeFamily({
          label: 'Loss',
          values: dates.map((date, index) => ({ date, value: [200, 180, 160][index]! }))
        }),
        makeFamily({
          label: 'Tie first',
          values: dates.map((date, index) => ({ date, value: [100, 105, 110][index]! }))
        }),
        makeFamily({
          label: 'Tie second',
          values: dates.map((date, index) => ({ date, value: [50, 52.5, 55][index]! }))
        }),
        makeFamily({
          label: 'Small move',
          values: dates.map((date, index) => ({ date, value: [100, 100.5, 101][index]! }))
        })
      ]
    })

    expect(chart.series.map((series) => [series.label, series.terminalValue])).toEqual([
      ['Gain', 120],
      ['Loss', 80],
      ['Tie first', expect.closeTo(110)],
      ['Tie second', expect.closeTo(110)]
    ])
    expect(chart.data).toEqual([
      { date: dates[0], portfolioIndex: 100, vault_0: 100, vault_1: 100, vault_2: 100, vault_3: 100 },
      {
        date: dates[1],
        portfolioIndex: 105,
        vault_0: 105,
        vault_1: 90,
        vault_2: 105,
        vault_3: 105
      },
      {
        date: dates[2],
        portfolioIndex: 110,
        vault_0: 120,
        vault_1: 80,
        vault_2: expect.closeTo(110),
        vault_3: expect.closeTo(110)
      }
    ])
  })

  it('rebases to the selected dates and aligns by normalized date instead of array position', () => {
    const chart = buildPortfolioGrowthIndexComparison({
      totalPoints: [
        { date: '2026-02-02', value: 100 },
        { date: '2026-02-03', value: 110 },
        { date: '2026-02-04', value: 120 }
      ],
      familySeries: [
        makeFamily({
          label: 'Sparse',
          values: [
            { date: '2026-02-01', value: 50 },
            { date: '2026-02-02', value: 100, milliseconds: true },
            { date: '2026-02-04', value: 125, milliseconds: true }
          ]
        })
      ]
    })

    expect(chart.series[0]?.values).toEqual([100, null, 125])
    expect(chart.data.map((point) => point.vault_0)).toEqual([100, null, 125])
  })
})
