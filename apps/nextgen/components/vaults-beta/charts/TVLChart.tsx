import { useChartStyle } from '@lib/contexts/useChartStyle'
import type { TTvlChartData } from '@nextgen/types/charts'
import { getTimeframeLimit } from '@nextgen/utils/charts'
import { useId, useMemo } from 'react'
import { Area, Bar, CartesianGrid, ComposedChart, Line, XAxis, YAxis } from 'recharts'
import type { ChartConfig } from './ChartPrimitives'
import { ChartContainer, ChartTooltip } from './ChartPrimitives'

type TVLChartProps = {
  chartData: TTvlChartData
  timeframe: string
  hideTooltip?: boolean
}

export function TVLChart({ chartData, timeframe, hideTooltip }: TVLChartProps) {
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
    return {
      value: {
        label: 'TVL (millions)',
        color: 'var(--chart-1)'
      }
    }
  }, [])

  if (isPowerglove) {
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
          <XAxis
            dataKey={'date'}
            tick={{ fill: 'var(--chart-axis)' }}
            axisLine={{ stroke: 'var(--chart-axis)' }}
            tickLine={{ stroke: 'var(--chart-axis)' }}
          />
          <YAxis
            domain={[0, 'auto']}
            tickFormatter={(value) => `$${(value / 1_000_000).toFixed(1)}M`}
            tick={{ fill: 'var(--chart-axis)' }}
            axisLine={{ stroke: 'var(--chart-axis)' }}
            tickLine={{ stroke: 'var(--chart-axis)' }}
            label={{
              value: 'TVL ($ millions)',
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
              formatter={(value: number) => [
                `$${value.toLocaleString(undefined, {
                  maximumFractionDigits: 0
                })}`,
                'TVL'
              ]}
              contentStyle={{
                backgroundColor: 'var(--chart-tooltip-bg)',
                borderRadius: 'var(--chart-tooltip-radius)',
                border: '1px solid var(--chart-tooltip-border)',
                boxShadow: 'var(--chart-tooltip-shadow)'
              }}
            />
          )}
          <Bar
            dataKey={'TVL'}
            fill={'var(--color-value)'}
            stroke={'transparent'}
            radius={[4, 4, 0, 0]}
            isAnimationActive={false}
            barSize={6}
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
          <linearGradient id={`${gradientId}-tvl`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="5%" stopColor="var(--color-value)" stopOpacity={0.5} />
            <stop offset="95%" stopColor="var(--color-value)" stopOpacity={0} />
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
              backgroundColor: 'var(--chart-tooltip-bg)',
              borderRadius: 'var(--chart-tooltip-radius)',
              border: '1px solid var(--chart-tooltip-border)',
              boxShadow: 'var(--chart-tooltip-shadow)'
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
