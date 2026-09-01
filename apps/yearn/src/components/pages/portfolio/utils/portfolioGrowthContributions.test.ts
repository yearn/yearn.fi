import {
  buildPortfolioGrowthContributionChart,
  type TPortfolioGrowthContributionFamily,
  toPortfolioGrowthContributionPoint
} from '@pages/portfolio/utils/portfolioGrowthContributions'
import { describe, expect, it } from 'vitest'

function timestamp(date: string): number {
  return Math.floor(Date.parse(`${date}T00:00:00.000Z`) / 1000)
}

function makeFamily(args: {
  label: string
  values: Array<{ date: string; value: number | null; milliseconds?: boolean; estimated?: boolean }>
  chainId?: number
  vaultAddress?: string
}): TPortfolioGrowthContributionFamily {
  return {
    chainId: args.chainId ?? 1,
    vaultAddress: args.vaultAddress ?? `0x${args.label.charCodeAt(0).toString(16).padStart(40, '0')}`,
    label: args.label,
    dataPoints: args.values.map((point) => ({
      timestamp: timestamp(point.date) * (point.milliseconds ? 1000 : 1),
      value: point.value,
      isEstimated: point.estimated
    }))
  }
}

function expectConservation(chart: ReturnType<typeof buildPortfolioGrowthContributionChart>, precision = 10): void {
  chart.data.forEach((point) => {
    if (point.portfolioGrowth !== null) {
      const contributionTotal = chart.series.reduce((total, series) => total + Number(point[series.key] ?? 0), 0)
      expect(contributionTotal).toBeCloseTo(point.portfolioGrowth, precision)
    }
  })
}

describe('buildPortfolioGrowthContributionChart', () => {
  it('selects the matching per-vault value for USD and ETH modes', () => {
    const point = {
      timestamp: timestamp('2026-01-01'),
      growthUsd: 25,
      growthUsdEstimated: true,
      growthWeightEth: 0.01
    }

    expect(toPortfolioGrowthContributionPoint(point, 'usd')).toEqual({
      timestamp: point.timestamp,
      value: 25,
      isEstimated: true
    })
    expect(toPortfolioGrowthContributionPoint(point, 'eth')).toEqual({
      timestamp: point.timestamp,
      value: 0.01
    })
  })

  it('keeps the top four vaults and puts the remaining contribution in Other', () => {
    const dates = ['2026-01-01', '2026-01-02', '2026-01-03']
    const chart = buildPortfolioGrowthContributionChart({
      totalPoints: [
        { date: dates[0]!, value: 0 },
        { date: dates[1]!, value: 31 },
        { date: dates[2]!, value: 56 }
      ],
      familySeries: [
        makeFamily({
          label: 'A',
          values: dates.map((date, index) => ({ date, value: [10, 30, 40][index]! }))
        }),
        makeFamily({
          label: 'B',
          values: dates.map((date, index) => ({ date, value: [100, 105, 115][index]! }))
        }),
        makeFamily({
          label: 'C',
          values: dates.map((date, index) => ({ date, value: [2, 6, 8][index]! }))
        }),
        makeFamily({
          label: 'D',
          values: dates.map((date, index) => ({ date, value: [8, 9, 11][index]! }))
        }),
        makeFamily({
          label: 'E',
          values: dates.map((date, index) => ({ date, value: [20, 21, 22][index]! }))
        })
      ]
    })

    expect(chart.series.map(({ key, label, terminalValue }) => ({ key, label, terminalValue }))).toEqual([
      { key: 'vault_0', label: 'A', terminalValue: 30 },
      { key: 'vault_1', label: 'B', terminalValue: 15 },
      { key: 'vault_2', label: 'C', terminalValue: 6 },
      { key: 'vault_3', label: 'D', terminalValue: 3 },
      { key: 'other', label: 'Other', terminalValue: 2 }
    ])
    expect(chart.data).toEqual([
      { date: dates[0], portfolioGrowth: 0, vault_0: 0, vault_1: 0, vault_2: 0, vault_3: 0, other: 0 },
      { date: dates[1], portfolioGrowth: 31, vault_0: 20, vault_1: 5, vault_2: 4, vault_3: 1, other: 1 },
      { date: dates[2], portfolioGrowth: 56, vault_0: 30, vault_1: 15, vault_2: 6, vault_3: 3, other: 2 }
    ])
    expectConservation(chart)
  })

  it('supports eight chart vaults while keeping the remainder in Other', () => {
    const dates = ['2026-01-01', '2026-01-02']
    const chart = buildPortfolioGrowthContributionChart({
      totalPoints: [
        { date: dates[0]!, value: 0 },
        { date: dates[1]!, value: 45 }
      ],
      familySeries: Array.from({ length: 9 }, (_, index) => {
        const terminalValue = 9 - index
        return makeFamily({
          label: `Vault ${terminalValue}`,
          values: [
            { date: dates[0]!, value: 0 },
            { date: dates[1]!, value: terminalValue }
          ]
        })
      }),
      maxVaults: 8
    })

    expect(chart.series.slice(0, -1).map((series) => series.label)).toEqual([
      'Vault 9',
      'Vault 8',
      'Vault 7',
      'Vault 6',
      'Vault 5',
      'Vault 4',
      'Vault 3',
      'Vault 2'
    ])
    expect(chart.data.at(-1)).toMatchObject({ vault_7: 2, other: 1 })
    expectConservation(chart)
  })

  it('rebases and ranks families within the dates supplied by the total series', () => {
    const chart = buildPortfolioGrowthContributionChart({
      totalPoints: [
        { date: '2026-01-01', value: 0 },
        { date: '2026-01-02', value: 12 },
        { date: '2026-01-03', value: 25 }
      ],
      familySeries: [
        makeFamily({
          label: 'Old winner',
          values: [
            { date: '2025-01-01', value: 0 },
            { date: '2026-01-01', value: 100 },
            { date: '2026-01-02', value: 102 },
            { date: '2026-01-03', value: 105 }
          ]
        }),
        makeFamily({
          label: 'Recent winner',
          values: [
            { date: '2026-01-01', value: 50 },
            { date: '2026-01-02', value: 60 },
            { date: '2026-01-03', value: 70 }
          ]
        })
      ]
    })

    expect(chart.data.map((point) => point.date)).toEqual(['2026-01-01', '2026-01-02', '2026-01-03'])
    expect(chart.series.slice(0, -1).map((series) => [series.label, series.terminalValue])).toEqual([
      ['Recent winner', 20],
      ['Old winner', 5]
    ])
    expect(chart.data.map((point) => [point.vault_0, point.vault_1, point.other])).toEqual([
      [0, 0, 0],
      [10, 2, 0],
      [20, 5, 0]
    ])
    expectConservation(chart)
  })

  it('carries sparse and null family values forward and normalizes millisecond timestamps', () => {
    const chart = buildPortfolioGrowthContributionChart({
      totalPoints: [
        { date: '2026-01-01', value: 0 },
        { date: '2026-01-02', value: 5 },
        { date: '2026-01-03', value: 7 },
        { date: '2026-01-04', value: 10 }
      ],
      familySeries: [
        makeFamily({
          label: 'Sparse',
          values: [
            { date: '2026-01-03', value: 107, milliseconds: true },
            { date: '2026-01-01', value: 100, milliseconds: true },
            { date: '2026-01-02', value: null }
          ]
        })
      ]
    })

    expect(chart.data.map((point) => point.vault_0)).toEqual([0, 0, 7, 7])
    expect(chart.data.map((point) => point.other)).toEqual([0, 5, 0, 3])
    expect(chart.series[0]?.terminalValue).toBe(7)
    expectConservation(chart)
  })

  it('preserves mixed positive and negative vault contributions', () => {
    const dates = ['2026-02-01', '2026-02-02', '2026-02-03']
    const chart = buildPortfolioGrowthContributionChart({
      totalPoints: [
        { date: dates[0]!, value: 0 },
        { date: dates[1]!, value: 10 },
        { date: dates[2]!, value: 10 }
      ],
      familySeries: [
        makeFamily({
          label: 'Gain',
          values: dates.map((date, index) => ({ date, value: [0, 50, 100][index]! }))
        }),
        makeFamily({
          label: 'Loss',
          values: dates.map((date, index) => ({ date, value: [0, -40, -90][index]! }))
        })
      ]
    })

    expect(chart.series.slice(0, -1).map((series) => [series.label, series.terminalValue])).toEqual([
      ['Gain', 100],
      ['Loss', -90]
    ])
    expect(chart.data.at(-1)).toMatchObject({ portfolioGrowth: 10, vault_0: 100, vault_1: -90, other: 0 })
    expectConservation(chart)
  })

  it('ranks and conserves fractional ETH-denominated contributions', () => {
    const dates = ['2026-02-01', '2026-02-02', '2026-02-03']
    const chart = buildPortfolioGrowthContributionChart({
      totalPoints: [
        { date: dates[0]!, value: 0 },
        { date: dates[1]!, value: 0.5 },
        { date: dates[2]!, value: 0.75 }
      ],
      familySeries: [
        makeFamily({
          label: 'Small ETH gain',
          values: dates.map((date, index) => ({ date, value: [1, 1.1, 1.2][index]! }))
        }),
        makeFamily({
          label: 'Large ETH gain',
          values: dates.map((date, index) => ({ date, value: [2, 2.4, 2.6][index]! }))
        })
      ]
    })

    expect(chart.series.slice(0, -1).map((series) => [series.label, series.terminalValue])).toEqual([
      ['Large ETH gain', expect.closeTo(0.6)],
      ['Small ETH gain', expect.closeTo(0.2)]
    ])
    expect(chart.data.at(-1)).toMatchObject({
      portfolioGrowth: 0.75,
      vault_0: expect.closeTo(0.6),
      vault_1: expect.closeTo(0.2),
      other: expect.closeTo(-0.05)
    })
    expectConservation(chart)
  })

  it('preserves unavailable ETH totals and family values as gaps', () => {
    const dates = ['2026-02-01', '2026-02-02', '2026-02-03', '2026-02-04']
    const chart = buildPortfolioGrowthContributionChart({
      totalPoints: [
        { date: dates[0]!, value: 0 },
        { date: dates[1]!, value: 1 },
        { date: dates[2]!, value: null },
        { date: dates[3]!, value: 2 }
      ],
      familySeries: [
        makeFamily({
          label: 'Unavailable ETH growth',
          values: dates.map((date, index) => ({ date, value: [0, 1, null, 2][index]! }))
        })
      ],
      preserveNullValues: true
    })

    expect(chart.data).toEqual([
      { date: dates[0], portfolioGrowth: 0, vault_0: 0, other: 0 },
      { date: dates[1], portfolioGrowth: 1, vault_0: 1, other: 0 },
      { date: dates[2], portfolioGrowth: null, vault_0: null, other: null },
      { date: dates[3], portfolioGrowth: 2, vault_0: 2, other: 0 }
    ])
  })

  it('leaves explicitly unavailable ETH families out of a still-valued aggregate', () => {
    const dates = ['2026-02-01', '2026-02-02', '2026-02-03']
    const chart = buildPortfolioGrowthContributionChart({
      totalPoints: [
        { date: dates[0]!, value: 0 },
        { date: dates[1]!, value: 1 },
        { date: dates[2]!, value: 1.5 }
      ],
      familySeries: [
        makeFamily({
          label: 'Unavailable ETH growth',
          values: dates.map((date, index) => ({ date, value: [0, 1, null][index]! }))
        })
      ],
      preserveNullValues: true
    })

    expect(chart.series.map((series) => series.label)).toEqual(['Other'])
    expect(chart.data.at(-1)).toEqual({
      date: dates[2],
      portfolioGrowth: 1.5,
      other: 1.5
    })
    expectConservation(chart)
  })

  it('propagates estimated pricing through rebased total, vault, and Other values', () => {
    const chart = buildPortfolioGrowthContributionChart({
      totalPoints: [
        { date: '2026-02-01', value: 0, isEstimated: true },
        { date: '2026-02-02', value: 5, isEstimated: true }
      ],
      familySeries: [
        makeFamily({
          label: 'Estimated vault',
          values: [
            { date: '2026-02-01', value: 10, estimated: true },
            { date: '2026-02-02', value: 15 }
          ]
        })
      ]
    })

    expect(chart.data[0]).toMatchObject({
      portfolioGrowthEstimated: true,
      vault_0Estimated: true,
      otherEstimated: true
    })
    expect(chart.data[1]).toMatchObject({
      portfolioGrowthEstimated: true,
      vault_0Estimated: true,
      otherEstimated: true
    })
  })

  it('uses stable input-order ties while keeping same-address vaults on different chains distinct', () => {
    const sharedAddress = '0x1111111111111111111111111111111111111111'
    const tiedFamilies = [
      makeFamily({
        label: 'Ethereum vault',
        chainId: 1,
        vaultAddress: sharedAddress,
        values: [
          { date: '2026-03-01', value: 10 },
          { date: '2026-03-02', value: 15 }
        ]
      }),
      makeFamily({
        label: 'Optimism vault',
        chainId: 10,
        vaultAddress: sharedAddress,
        values: [
          { date: '2026-03-01', value: 20 },
          { date: '2026-03-02', value: 25 }
        ]
      }),
      makeFamily({
        label: 'Loss vault',
        chainId: 137,
        values: [
          { date: '2026-03-01', value: 5 },
          { date: '2026-03-02', value: 0 }
        ]
      })
    ]
    const chart = buildPortfolioGrowthContributionChart({
      totalPoints: [
        { date: '2026-03-01', value: 0 },
        { date: '2026-03-02', value: 5 }
      ],
      familySeries: tiedFamilies
    })

    expect(
      chart.series.slice(0, -1).map(({ label, chainId, vaultAddress, terminalValue }) => ({
        label,
        chainId,
        vaultAddress,
        terminalValue
      }))
    ).toEqual([
      { label: 'Ethereum vault', chainId: 1, vaultAddress: sharedAddress, terminalValue: 5 },
      { label: 'Optimism vault', chainId: 10, vaultAddress: sharedAddress, terminalValue: 5 },
      { label: 'Loss vault', chainId: 137, vaultAddress: tiedFamilies[2]!.vaultAddress, terminalValue: -5 }
    ])
    expect(chart.series[0]?.key).not.toBe(chart.series[1]?.key)
    expectConservation(chart)
  })

  it('falls back to only Other when family series are empty, null, or flat', () => {
    const chart = buildPortfolioGrowthContributionChart({
      totalPoints: [
        { date: '2026-04-01', value: 0 },
        { date: '2026-04-02', value: 4 }
      ],
      familySeries: [
        makeFamily({ label: 'Empty', values: [] }),
        makeFamily({
          label: 'Null',
          values: [
            { date: '2026-04-01', value: null },
            { date: '2026-04-02', value: null }
          ]
        }),
        makeFamily({
          label: 'Flat',
          values: [
            { date: '2026-04-01', value: 5 },
            { date: '2026-04-02', value: 5 }
          ]
        })
      ]
    })

    expect(chart.series).toEqual([
      {
        key: 'other',
        label: 'Other',
        chainId: null,
        vaultAddress: null,
        isOther: true,
        terminalValue: 4
      }
    ])
    expect(chart.data).toEqual([
      { date: '2026-04-01', portfolioGrowth: 0, other: 0 },
      { date: '2026-04-02', portfolioGrowth: 4, other: 4 }
    ])
    expectConservation(chart)
  })
})
