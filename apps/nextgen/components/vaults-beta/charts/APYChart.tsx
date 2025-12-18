import { useChartStyle } from '@lib/contexts/useChartStyle'
import type { TAprApyChartData } from '@nextgen/types/charts'
import { getTimeframeLimit } from '@nextgen/utils/charts'
import { useId, useMemo } from 'react'
import { Area, CartesianGrid, ComposedChart, Line, LineChart, XAxis, YAxis } from 'recharts'
import type { ChartConfig } from './ChartPrimitives'
import { ChartContainer, ChartTooltip } from './ChartPrimitives'

type SeriesKey = 'derivedApy' | 'sevenDayApy' | 'thirtyDayApy'

const SERIES_META: Record<SeriesKey, { chartLabel: string; legendLabel: string; color: string }> = {
  derivedApy: {
    chartLabel: '1-day APY %',
    legendLabel: '1-day APY',
    color: 'var(--chart-4)'
  },
  sevenDayApy: {
    chartLabel: '7-day APY %',
    legendLabel: '7-day APY',
    color: 'var(--chart-3)'
  },
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
  const gradientId = useId().replace(/:/g, '')
  const { chartStyle } = useChartStyle()
  const isPowerglove = chartStyle === 'powerglove'
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

  if (isPowerglove) {
    return (
      <div className={'relative h-full'}>
        <ChartContainer config={chartConfig} style={{ height: 'inherit' }}>
          <LineChart
            data={filteredData}
            margin={{
              top: 20,
              right: 30,
              left: 10,
              bottom: 20
            }}
          >
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey={'date'}
              tick={{ fill: 'var(--chart-axis)' }}
              axisLine={{ stroke: 'var(--chart-axis)' }}
              tickLine={{ stroke: 'var(--chart-axis)' }}
            />
            <YAxis
              domain={[0, 'auto']}
              tickFormatter={(value) => `${value}%`}
              tick={{ fill: 'var(--chart-axis)' }}
              axisLine={{ stroke: 'var(--chart-axis)' }}
              tickLine={{ stroke: 'var(--chart-axis)' }}
              label={{
                value: 'Annualized %',
                angle: -90,
                position: 'insideLeft',
                offset: 10,
                style: {
                  textAnchor: 'middle',
                  fill: 'var(--chart-axis)'
                }
              }}
            />
            {!hideTooltip && (
              <ChartTooltip
                formatter={(value: number, name: string) => {
                  return [`${(value ?? 0).toFixed(2)}%`, formatSeriesLabel(name)]
                }}
                contentStyle={{
                  backgroundColor: 'var(--chart-tooltip-bg)',
                  borderRadius: 'var(--chart-tooltip-radius)',
                  border: '1px solid var(--chart-tooltip-border)',
                  boxShadow: 'var(--chart-tooltip-shadow)'
                }}
              />
            )}
            <Line
              type={'monotone'}
              dataKey={'sevenDayApy'}
              stroke={'var(--color-sevenDayApy)'}
              strokeWidth={1.5}
              dot={false}
              isAnimationActive={false}
            />
            <Line
              type={'monotone'}
              dataKey={'thirtyDayApy'}
              stroke={'var(--color-thirtyDayApy)'}
              strokeWidth={1.5}
              dot={false}
              isAnimationActive={false}
            />
            <Line
              type={'monotone'}
              dataKey={'derivedApy'}
              stroke={'var(--color-derivedApy)'}
              strokeWidth={1}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ChartContainer>
      </div>
    )
  }

  return (
    <div className={'relative h-full'}>
      <ChartContainer config={chartConfig} style={{ height: 'inherit' }}>
        <ComposedChart
          data={filteredData}
          margin={{
            top: 10,
            right: 0,
            left: 0,
            bottom: 0
          }}
        >
          <defs>
            <linearGradient id={`${gradientId}-apy`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="5%" stopColor="var(--color-thirtyDayApy)" stopOpacity={0.5} />
              <stop offset="95%" stopColor="var(--color-thirtyDayApy)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey={'date'} hide />
          <YAxis domain={[0, 'auto']} hide />
          <Area
            type={'monotone'}
            dataKey={'thirtyDayApy'}
            stroke="none"
            fill={`url(#${gradientId}-apy)`}
            fillOpacity={1}
            connectNulls
            isAnimationActive={false}
          />
          {!hideTooltip && (
            <ChartTooltip
              formatter={(value: number, name: string) => {
                return [`${(value ?? 0).toFixed(2)}%`, formatSeriesLabel(name)]
              }}
              contentStyle={{
                backgroundColor: 'var(--chart-tooltip-bg)',
                borderRadius: 'var(--chart-tooltip-radius)',
                border: '1px solid var(--chart-tooltip-border)',
                boxShadow: 'var(--chart-tooltip-shadow)'
              }}
            />
          )}
          <Line
            type={'monotone'}
            dataKey={'thirtyDayApy'}
            stroke={'var(--color-thirtyDayApy)'}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ChartContainer>
    </div>
  )
}
