import type { TAprApyChartData } from '@nextgen/types/charts'
import { getTimeframeLimit } from '@nextgen/utils/charts'
import { useMemo } from 'react'
import { Line, LineChart, XAxis, YAxis } from 'recharts'
import type { ChartConfig } from './ChartPrimitives'
import { ChartContainer, ChartTooltip } from './ChartPrimitives'

// type SeriesKey = 'derivedApy' | 'sevenDayApy' | 'thirtyDayApy'

// const SERIES_META: Record<SeriesKey, { chartLabel: string; legendLabel: string; color: string }> = {
//   derivedApy: {
//     chartLabel: '1-day APY %',
//     legendLabel: '1-day APY',
//     color: 'var(--chart-4)'
//   },
//   sevenDayApy: {
//     chartLabel: '7-day APY %',
//     legendLabel: '7-day APY',
//     color: 'var(--chart-3)'
//   },
//   thirtyDayApy: {
//     chartLabel: '30-day APY %',
//     legendLabel: '30-day APY',
//     color: 'var(--chart-2)'
//   }
// }

type SeriesKey = 'thirtyDayApy'

const SERIES_META: Record<SeriesKey, { chartLabel: string; legendLabel: string; color: string }> = {
  thirtyDayApy: {
    chartLabel: '30-day APY %',
    legendLabel: '30-day APY',
    color: 'var(--chart-2)'
  }
}

type APYChartProps = {
  chartData: TAprApyChartData
  timeframe: string
  hideTooltip?: boolean
}

export function APYChart({ chartData, timeframe, hideTooltip }: APYChartProps) {
  const filteredData = useMemo(() => {
    const limit = getTimeframeLimit(timeframe)
    if (!Number.isFinite(limit) || limit >= chartData.length) {
      return chartData
    }
    return chartData.slice(-limit)
  }, [chartData, timeframe])

  const chartConfig = useMemo<ChartConfig>(() => {
    return Object.entries(SERIES_META).reduce((acc, [key, meta]) => {
      acc[key] = {
        label: meta.chartLabel,
        color: meta.color
      }
      return acc
    }, {} as ChartConfig)
  }, [])

  const formatSeriesLabel = (series: string) => SERIES_META[series as SeriesKey]?.legendLabel || series

  return (
    <div className={'relative h-full'}>
      <ChartContainer config={chartConfig} style={{ height: 'inherit' }}>
        <LineChart
          data={filteredData}
          margin={{
            top: 10,
            right: 0,
            left: 0,
            bottom: 0
          }}
        >
          <XAxis dataKey={'date'} hide />
          <YAxis domain={[0, 'auto']} hide />
          {!hideTooltip && (
            <ChartTooltip
              formatter={(value: number, name: string) => {
                return [`${(value ?? 0).toFixed(2)}%`, formatSeriesLabel(name)]
              }}
              contentStyle={{
                borderRadius: '12px',
                border: '1px solid rgba(0,0,0,0.08)'
              }}
            />
          )}
          {/* <Line
            type={'monotone'}
            dataKey={'sevenDayApy'}
            stroke={'var(--color-sevenDayApy)'}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          /> */}
          <Line
            type={'monotone'}
            dataKey={'thirtyDayApy'}
            stroke={'var(--color-thirtyDayApy)'}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
          {/* <Line
            type={'monotone'}
            dataKey={'derivedApy'}
            stroke={'var(--color-derivedApy)'}
            strokeWidth={1.25}
            dot={false}
            isAnimationActive={false}
          /> */}
        </LineChart>
      </ChartContainer>
    </div>
  )
}
