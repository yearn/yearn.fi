import type { TPpsChartData } from '@nextgen/types/charts'
import { getTimeframeLimit } from '@nextgen/utils/charts'
import { useMemo } from 'react'
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts'
import type { ChartConfig } from './ChartPrimitives'
import { ChartContainer, ChartTooltip } from './ChartPrimitives'

type PercentSeriesKey = 'derivedApr'

type PPSChartProps = {
  chartData: TPpsChartData
  timeframe: string
  hideAxes?: boolean
  hideTooltip?: boolean
  dataKey?: 'PPS' | PercentSeriesKey
}

const PERCENT_SERIES_META: Record<PercentSeriesKey, { label: string; color: string }> = {
  derivedApr: {
    label: 'Derived APR %',
    color: 'var(--chart-4)'
  }
}

export function PPSChart({ chartData, timeframe, hideAxes, hideTooltip, dataKey = 'PPS' }: PPSChartProps) {
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
        color: hideAxes ? 'black' : meta.color
      }
    } else {
      config.pps = {
        label: 'Price Per Share',
        color: hideAxes ? 'black' : 'var(--chart-1)'
      }
    }
    return config
  }, [dataKey, hideAxes, isPercentSeries])

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
          tick={
            hideAxes
              ? false
              : {
                  fill: 'var(--muted-foreground, #6b7280)'
                }
          }
          axisLine={hideAxes ? false : { stroke: 'var(--muted-foreground, #6b7280)' }}
          tickLine={hideAxes ? false : { stroke: 'var(--muted-foreground, #6b7280)' }}
        />
        <YAxis
          domain={isPercentSeries ? [0, 'auto'] : ['auto', 'auto']}
          tickFormatter={(value) => (isPercentSeries ? `${value}%` : Number(value).toFixed(3))}
          label={
            hideAxes
              ? undefined
              : {
                  value: isPercentSeries ? PERCENT_SERIES_META[dataKey as PercentSeriesKey].label : 'Price Per Share',
                  angle: -90,
                  position: 'insideLeft',
                  offset: 10,
                  style: {
                    textAnchor: 'middle',
                    fill: hideAxes ? 'transparent' : 'var(--muted-foreground, #6b7280)'
                  }
                }
          }
          tick={
            hideAxes
              ? false
              : {
                  fill: 'var(--muted-foreground, #6b7280)'
                }
          }
          axisLine={hideAxes ? false : { stroke: 'var(--muted-foreground, #6b7280)' }}
          tickLine={hideAxes ? false : { stroke: 'var(--muted-foreground, #6b7280)' }}
        />
        {!hideTooltip && (
          <ChartTooltip
            formatter={(value: number) =>
              isPercentSeries
                ? [`${(value ?? 0).toFixed(2)}%`, PERCENT_SERIES_META[dataKey as PercentSeriesKey].label]
                : [(value ?? 0).toFixed(3), 'PPS']
            }
            contentStyle={{ borderRadius: '12px', border: '1px solid rgba(0,0,0,0.08)' }}
          />
        )}
        <Line
          type={'monotone'}
          dataKey={dataKey}
          stroke={isPercentSeries ? `var(--color-${dataKey})` : 'var(--color-pps)'}
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ChartContainer>
  )
}
