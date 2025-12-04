import type { TVaultChartTimeseries, TVaultTimeseriesPoint } from '@lib/utils/schemas/vaultChartsSchema'

export type TChartTimeseriesResponse = TVaultChartTimeseries
export type TTimeseriesPoint = TVaultTimeseriesPoint & {
  time: number
  value: number | null
}

export type TChartDataPoint = {
  date: string
  [key: string]: number | string | null
}

export type TAprApyChartData = Array<
  TChartDataPoint & {
    sevenDayApy: number | null
    thirtyDayApy: number | null
    derivedApr: number | null
    derivedApy: number | null
  }
>

export type TTvlChartData = Array<TChartDataPoint & { TVL: number | null }>
export type TPpsChartData = Array<TChartDataPoint & { PPS: number | null }>

export type TTransformedChartData = {
  aprApyData: TAprApyChartData | null
  tvlData: TTvlChartData | null
  ppsData: TPpsChartData | null
}
