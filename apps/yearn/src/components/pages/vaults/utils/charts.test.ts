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
