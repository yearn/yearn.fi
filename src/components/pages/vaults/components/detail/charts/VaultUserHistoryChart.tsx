import type { TVaultUserHistoryChartData } from '@pages/vaults/types/charts'
import {
  formatChartMonthYearLabel,
  formatChartTooltipDate,
  formatChartWeekLabel,
  getChartMonthlyTicks,
  getChartWeeklyTicks,
  getTimeframeLimit
} from '@pages/vaults/utils/charts'
import { useId, useMemo } from 'react'
import { Area, CartesianGrid, ComposedChart, Line, XAxis, YAxis } from 'recharts'
import type { ChartConfig } from './ChartPrimitives'
import { ChartContainer, ChartTooltip } from './ChartPrimitives'
import {
  CHART_TOOLTIP_WRAPPER_STYLE,
  CHART_WITH_AXES_MARGIN,
  CHART_Y_AXIS_TICK_MARGIN,
  CHART_Y_AXIS_TICK_STYLE,
  CHART_Y_AXIS_WIDTH
} from './chartLayout'

type VaultUserHistoryChartProps = {
  chartData: TVaultUserHistoryChartData
  timeframe: string
  label: string
  unitLabel: string
  color: string
  signed?: boolean
}

function formatAxisValue(value: number): string {
  const absoluteValue = Math.abs(value)
  if (value === 0) {
    return ''
  }
  if (absoluteValue >= 1_000_000) {
    return `${value < 0 ? '-' : ''}${(absoluteValue / 1_000_000).toFixed(1)}M`
  }
  if (absoluteValue >= 1_000) {
    return `${value < 0 ? '-' : ''}${(absoluteValue / 1_000).toFixed(1)}k`
  }
  if (absoluteValue >= 10) {
    return value.toFixed(0)
  }
  if (absoluteValue >= 1) {
    return value.toFixed(2)
  }
  return value.toFixed(3)
}

function formatTooltipValue(value: number, unitLabel: string, signed: boolean): string {
  const absoluteValue = Math.abs(value)
  const formattedValue =
    absoluteValue >= 100
      ? absoluteValue.toFixed(2)
      : absoluteValue >= 1
        ? absoluteValue.toFixed(3)
        : absoluteValue.toFixed(4)

  if (!signed || value === 0) {
    return `${formattedValue} ${unitLabel}`
  }

  return `${value > 0 ? '+' : '-'}${formattedValue} ${unitLabel}`
}

export function VaultUserHistoryChart({
  chartData,
  timeframe,
  label,
  unitLabel,
  color,
  signed = false
}: VaultUserHistoryChartProps) {
  const gradientId = useId().replace(/:/g, '')
  const filteredData = useMemo(() => {
    const limit = getTimeframeLimit(timeframe)
    if (!Number.isFinite(limit) || limit >= chartData.length) {
      return chartData
    }
    return chartData.slice(-limit)
  }, [chartData, timeframe])
  const isShortTimeframe = timeframe === '30d' || timeframe === '90d'
  const ticks = useMemo(
    () => (isShortTimeframe ? getChartWeeklyTicks(filteredData) : getChartMonthlyTicks(filteredData)),
    [filteredData, isShortTimeframe]
  )
  const tickFormatter = isShortTimeframe ? formatChartWeekLabel : formatChartMonthYearLabel

  const chartConfig = useMemo<ChartConfig>(
    () => ({
      value: {
        label,
        color
      }
    }),
    [color, label]
  )

  return (
    <ChartContainer config={chartConfig} style={{ height: 'inherit' }}>
      <ComposedChart data={filteredData} margin={CHART_WITH_AXES_MARGIN}>
        <defs>
          <linearGradient id={`${gradientId}-user-history`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.5} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey={'date'}
          ticks={ticks}
          tickFormatter={tickFormatter}
          tick={{ fill: 'var(--chart-axis)' }}
          axisLine={{ stroke: 'var(--chart-axis)' }}
          tickLine={{ stroke: 'var(--chart-axis)' }}
        />
        <YAxis
          domain={['auto', 'auto']}
          tickFormatter={(value: number | string) => formatAxisValue(Number(value))}
          mirror
          width={CHART_Y_AXIS_WIDTH}
          tickMargin={CHART_Y_AXIS_TICK_MARGIN}
          tick={CHART_Y_AXIS_TICK_STYLE}
          axisLine={{ stroke: 'var(--chart-axis)' }}
          tickLine={{ stroke: 'var(--chart-axis)' }}
        />
        <ChartTooltip
          formatter={(value: number) => [formatTooltipValue(value ?? 0, unitLabel, signed), label]}
          labelFormatter={formatChartTooltipDate}
          wrapperStyle={CHART_TOOLTIP_WRAPPER_STYLE}
          contentStyle={{
            backgroundColor: 'var(--chart-tooltip-bg)',
            borderRadius: 'var(--chart-tooltip-radius)',
            border: '1px solid var(--chart-tooltip-border)',
            boxShadow: 'var(--chart-tooltip-shadow)'
          }}
        />
        <Area
          type={'monotone'}
          dataKey={'value'}
          stroke="none"
          fill={`url(#${gradientId}-user-history)`}
          fillOpacity={1}
          connectNulls
          tooltipType={'none'}
          isAnimationActive={false}
        />
        <Line
          type={'monotone'}
          dataKey={'value'}
          stroke={color}
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
          connectNulls
        />
      </ComposedChart>
    </ChartContainer>
  )
}
