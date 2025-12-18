import { useChartStyle } from '@lib/contexts/useChartStyle'
import type { TPpsChartData } from '@nextgen/types/charts'
import { getTimeframeLimit } from '@nextgen/utils/charts'
import { useId, useMemo } from 'react'
import { Area, CartesianGrid, ComposedChart, Line, LineChart, XAxis, YAxis } from 'recharts'
import type { ChartConfig } from './ChartPrimitives'
import { ChartContainer, ChartTooltip } from './ChartPrimitives'

type PercentSeriesKey = 'derivedApr'

type PPSChartProps = {
  chartData: TPpsChartData
  timeframe: string
  hideTooltip?: boolean
  dataKey?: 'PPS' | PercentSeriesKey
}

const PERCENT_SERIES_META: Record<PercentSeriesKey, { label: string; color: string }> = {
  derivedApr: {
    label: 'Derived APR %',
    color: 'var(--chart-4)'
  }
}

export function PPSChart({ chartData, timeframe, hideTooltip, dataKey = 'PPS' }: PPSChartProps) {
  const gradientId = useId().replace(/:/g, '')
  const { chartStyle } = useChartStyle()
  const isPowerglove = chartStyle === 'powerglove'
  const isBlended = chartStyle === 'blended'
  const filteredData = useMemo(() => {
    const limit = getTimeframeLimit(timeframe)
    if (!Number.isFinite(limit) || limit >= chartData.length) {
      return chartData
    }
    return chartData.slice(-limit)
  }, [chartData, timeframe])

  const isPercentSeries = dataKey !== 'PPS'
  const seriesColor = isPercentSeries ? `var(--color-${dataKey})` : 'var(--color-pps)'
  const chartConfig = useMemo<ChartConfig>(() => {
    const config: ChartConfig = {}
    if (isPercentSeries) {
      const meta = PERCENT_SERIES_META[dataKey as PercentSeriesKey]
      config[dataKey] = {
        label: meta.label,
        color: meta.color
      }
    } else {
      config.pps = {
        label: 'Price Per Share',
        color: 'var(--chart-1)'
      }
    }
    return config
  }, [dataKey, isPercentSeries])

  if (isPowerglove) {
    return (
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
            domain={isPercentSeries ? [0, 'auto'] : ['auto', 'auto']}
            tickFormatter={(value) => (isPercentSeries ? `${value}%` : Number(value).toFixed(3))}
            tick={{ fill: 'var(--chart-axis)' }}
            axisLine={{ stroke: 'var(--chart-axis)' }}
            tickLine={{ stroke: 'var(--chart-axis)' }}
          />
          {!hideTooltip && (
            <ChartTooltip
              formatter={(value: number) =>
                isPercentSeries
                  ? [`${(value ?? 0).toFixed(2)}%`, PERCENT_SERIES_META[dataKey as PercentSeriesKey].label]
                  : [(value ?? 0).toFixed(3), 'PPS']
              }
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
            dataKey={dataKey}
            stroke={seriesColor}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ChartContainer>
    )
  }

  if (isBlended) {
    return (
      <ChartContainer config={chartConfig} style={{ height: 'inherit' }}>
        <ComposedChart
          data={filteredData}
          margin={{
            top: 20,
            right: 30,
            left: 10,
            bottom: 20
          }}
        >
          <CartesianGrid vertical={false} />
          <defs>
            <linearGradient id={`${gradientId}-pps`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="5%" stopColor={seriesColor} stopOpacity={0.5} />
              <stop offset="95%" stopColor={seriesColor} stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey={'date'}
            tick={{ fill: 'var(--chart-axis)' }}
            axisLine={{ stroke: 'var(--chart-axis)' }}
            tickLine={{ stroke: 'var(--chart-axis)' }}
          />
          <YAxis
            domain={isPercentSeries ? [0, 'auto'] : ['auto', 'auto']}
            tickFormatter={(value) => (isPercentSeries ? `${value}%` : Number(value).toFixed(3))}
            tick={{ fill: 'var(--chart-axis)' }}
            axisLine={{ stroke: 'var(--chart-axis)' }}
            tickLine={{ stroke: 'var(--chart-axis)' }}
          />
          {!hideTooltip && (
            <ChartTooltip
              formatter={(value: number) =>
                isPercentSeries
                  ? [`${(value ?? 0).toFixed(2)}%`, PERCENT_SERIES_META[dataKey as PercentSeriesKey].label]
                  : [(value ?? 0).toFixed(3), 'PPS']
              }
              contentStyle={{
                backgroundColor: 'var(--chart-tooltip-bg)',
                borderRadius: 'var(--chart-tooltip-radius)',
                border: '1px solid var(--chart-tooltip-border)',
                boxShadow: 'var(--chart-tooltip-shadow)'
              }}
            />
          )}
          <Area
            type={'monotone'}
            dataKey={dataKey}
            stroke="none"
            fill={`url(#${gradientId}-pps)`}
            fillOpacity={1}
            connectNulls
            tooltipType={'none'}
            isAnimationActive={false}
          />
          <Line
            type={'monotone'}
            dataKey={dataKey}
            stroke={seriesColor}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ChartContainer>
    )
  }

  return (
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
          <linearGradient id={`${gradientId}-pps`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="5%" stopColor={seriesColor} stopOpacity={0.5} />
            <stop offset="95%" stopColor={seriesColor} stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis dataKey={'date'} hide />
        <YAxis domain={isPercentSeries ? [0, 'auto'] : ['auto', 'auto']} hide />
        {!hideTooltip && (
          <ChartTooltip
            formatter={(value: number) =>
              isPercentSeries
                ? [`${(value ?? 0).toFixed(2)}%`, PERCENT_SERIES_META[dataKey as PercentSeriesKey].label]
                : [(value ?? 0).toFixed(3), 'PPS']
            }
            contentStyle={{
              backgroundColor: 'var(--chart-tooltip-bg)',
              borderRadius: 'var(--chart-tooltip-radius)',
              border: '1px solid var(--chart-tooltip-border)',
              boxShadow: 'var(--chart-tooltip-shadow)'
            }}
          />
        )}
        <Area
          type={'monotone'}
          dataKey={dataKey}
          stroke="none"
          fill={`url(#${gradientId}-pps)`}
          fillOpacity={1}
          connectNulls
          tooltipType={'none'}
          isAnimationActive={false}
        />
        <Line
          type={'monotone'}
          dataKey={dataKey}
          stroke={seriesColor}
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
        />
      </ComposedChart>
    </ChartContainer>
  )
}
