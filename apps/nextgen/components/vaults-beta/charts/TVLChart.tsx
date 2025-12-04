import type { TTvlChartData } from '@nextgen/types/charts'
import { getTimeframeLimit } from '@nextgen/utils/charts'
import { useId, useMemo } from 'react'
import { Area, ComposedChart, Line, XAxis, YAxis } from 'recharts'
import type { ChartConfig } from './ChartPrimitives'
import { ChartContainer, ChartTooltip } from './ChartPrimitives'

type TVLChartProps = {
  chartData: TTvlChartData
  timeframe: string
  hideTooltip?: boolean
}

export function TVLChart({ chartData, timeframe, hideTooltip }: TVLChartProps) {
  const gradientId = useId().replace(/:/g, '')
  const filteredData = useMemo(() => {
    const limit = getTimeframeLimit(timeframe)
    if (!Number.isFinite(limit) || limit >= chartData.length) {
      return chartData
    }
    return chartData.slice(-limit)
  }, [chartData, timeframe])

  const chartConfig = useMemo<ChartConfig>(() => {
    return {
      value: {
        label: 'TVL (millions)',
        color: 'var(--chart-1)'
      }
    }
  }, [])

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
          <linearGradient id={`${gradientId}-tvl`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="5%" stopColor="#0657f9" stopOpacity={0.5} />
            <stop offset="95%" stopColor="#0657f9" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis dataKey={'date'} hide />
        <YAxis domain={[0, 'auto']} hide />
        {!hideTooltip && (
          <ChartTooltip
            formatter={(value: number) => [
              `$${value.toLocaleString(undefined, {
                maximumFractionDigits: 0
              })}`,
              'TVL'
            ]}
            contentStyle={{
              borderRadius: '12px',
              border: '1px solid rgba(0,0,0,0.08)'
            }}
          />
        )}
        <Area
          type={'monotone'}
          dataKey={'TVL'}
          stroke="none"
          fill={`url(#${gradientId}-tvl)`}
          fillOpacity={1}
          connectNulls
          isAnimationActive={false}
        />
        <Line
          type={'monotone'}
          dataKey={'TVL'}
          stroke="var(--color-value)"
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
        />
      </ComposedChart>
    </ChartContainer>
  )
}
