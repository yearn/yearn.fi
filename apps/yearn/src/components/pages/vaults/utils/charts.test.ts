import type { TChartTimeseriesResponse } from '@pages/vaults/types/charts'
import { describe, expect, it } from 'vitest'
import { formatChartMonthYearLabel, getChartMonthlyTicks, transformVaultChartData } from './charts'

function tvlPoint(time: number, value: number): TChartTimeseriesResponse['tvl'][number] {
  return {
    chainId: 1,
    address: '0xVault',
    label: 'tvl',
    component: null,
    period: '1 day',
    time,
    value
  }
}

function timeseries(tvl: TChartTimeseriesResponse['tvl']): TChartTimeseriesResponse {
  return {
    apyWeekly: [],
    apyMonthly: [],
    tvl,
    pps: []
  }
}

describe('transformVaultChartData', () => {
  it('drops buckets before the deployment day and keeps its daily bucket', () => {
    const day = 1_699_920_000
    const result = transformVaultChartData(
      timeseries([tvlPoint(day - 86_400, 50), tvlPoint(day, 100), tvlPoint(day + 86_400, 120)]),
      day + 3_600
    )
    expect(result.tvlData?.map((point) => point.TVL)).toEqual([100, 120])
  })

  it('starts each chart at its first available value instead of another series start', () => {
    const day = 1_699_920_000
    const result = transformVaultChartData({
      ...timeseries([tvlPoint(day + 2 * 86_400, 100)]),
      pps: [tvlPoint(day, 1), tvlPoint(day + 2 * 86_400, 1.1)]
    })
    expect(result.tvlData?.map((point) => point.TVL)).toEqual([100])
    expect(result.ppsData?.map((point) => point.PPS)).toEqual([1, null, 1.1])
  })

  it.each([undefined, null, 0, NaN])(
    'falls back to available data for invalid deployment time %s',
    (deploymentTime) => {
      const result = transformVaultChartData(timeseries([tvlPoint(1_699_920_000, 100)]), deploymentTime)
      expect(result.tvlData?.map((point) => point.TVL)).toEqual([100])
    }
  )

  it('accepts millisecond metadata and removes data from every series before deployment', () => {
    const day = 1_699_920_000
    const series = [tvlPoint(day - 86_400, 1), tvlPoint(day, 2)]
    const result = transformVaultChartData(
      { apyWeekly: series, apyMonthly: series, pps: series, tvl: series },
      day * 1000
    )
    expect(result.ppsData).toHaveLength(1)
    expect(result.tvlData).toHaveLength(1)
    expect(result.aprApyData).toHaveLength(1)
  })

  it('treats zero TVL inside an otherwise positive range as missing data', () => {
    const result = transformVaultChartData(
      timeseries([tvlPoint(1_700_000_000, 100), tvlPoint(1_700_086_400, 0), tvlPoint(1_700_172_800, 120)])
    )

    expect(result.tvlData?.map((point) => point.TVL)).toEqual([100, null, 120])
  })

  it('keeps leading and trailing zero TVL values as real zero periods', () => {
    const result = transformVaultChartData(
      timeseries([tvlPoint(1_700_000_000, 0), tvlPoint(1_700_086_400, 100), tvlPoint(1_700_172_800, 0)])
    )

    expect(result.tvlData?.map((point) => point.TVL)).toEqual([0, 100, 0])
  })
})

describe('portfolio history date labels', () => {
  it('formats ISO dates as month and year', () => {
    expect(formatChartMonthYearLabel('2026-05-13')).toBe('05/26')
  })

  it('selects one ISO date per month for chart ticks', () => {
    const data = [{ date: '2026-05-13' }, { date: '2026-05-14' }, { date: '2026-06-01' }, { date: '2026-06-30' }]

    expect(getChartMonthlyTicks(data)).toEqual(['2026-05-13', '2026-06-01'])
  })
})
