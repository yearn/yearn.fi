import type { TPpsChartData } from '@nextgen/types/charts'
import { getTimeframeLimit } from '@nextgen/utils/charts'
import { useId, useMemo } from 'react'
import { Area, ComposedChart, Line, XAxis, YAxis } from 'recharts'
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
  const filteredData = useMemo(() => {
    const limit = getTimeframeLimit(timeframe)
    if (!Number.isFinite(limit) || limit >= chartData.length) {
      return chartData
    }
    return chartData.slice(-limit)
  }, [chartData, timeframe])

  const isPercentSeries = dataKey !== 'PPS'
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
            <stop offset="5%" stopColor="#0657f9" stopOpacity={0.5} />
            <stop offset="95%" stopColor="#0657f9" stopOpacity={0} />
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
              borderRadius: '12px',
              border: '1px solid rgba(0,0,0,0.08)'
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
          isAnimationActive={false}
        />
        <Line
          type={'monotone'}
          dataKey={dataKey}
          stroke={isPercentSeries ? `var(--color-${dataKey})` : 'var(--color-pps)'}
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
        />
      </ComposedChart>
    </ChartContainer>
  )
}
