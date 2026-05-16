import type { TChartTimeseriesResponse } from '@pages/vaults/types/charts'
import { describe, expect, it } from 'vitest'
import { transformVaultChartData } from './charts'

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
