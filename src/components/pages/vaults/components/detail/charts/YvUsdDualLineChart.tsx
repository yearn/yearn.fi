import type { TYvUsdSeriesPoint } from '@pages/vaults/hooks/useYvUsdCharts'
import {
  formatChartMonthYearLabel,
  formatChartTooltipDate,
  formatChartWeekLabel,
  getChartMonthlyTicks,
  getChartWeeklyTicks,
  getTimeframeLimit
} from '@pages/vaults/utils/charts'
import { useMemo } from 'react'
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts'
import type { ChartConfig } from './ChartPrimitives'
import { ChartContainer, ChartTooltip } from './ChartPrimitives'
import {
  CHART_WITH_AXES_MARGIN,
  CHART_Y_AXIS_TICK_MARGIN,
  CHART_Y_AXIS_TICK_STYLE,
  CHART_Y_AXIS_WIDTH
} from './chartLayout'

type TYvUsdDualLineChartProps = {
  chartData: TYvUsdSeriesPoint[]
  timeframe: string
  hideTooltip?: boolean
  formatValue: (value: number) => string
  formatTick: (value: number | string) => string
}

const SERIES_CONFIG: ChartConfig = {
  unlocked: {
    label: 'Unlocked',
    color: 'var(--chart-1)'
  },
  locked: {
    label: 'Locked',
    color: 'var(--chart-2)'
  }
}

export function YvUsdDualLineChart({
  chartData,
  timeframe,
  hideTooltip,
  formatValue,
  formatTick
}: TYvUsdDualLineChartProps) {
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

  return (
    <ChartContainer config={SERIES_CONFIG} style={{ height: 'inherit' }}>
      <LineChart data={filteredData} margin={CHART_WITH_AXES_MARGIN}>
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
          domain={[0, 'auto']}
          tickFormatter={formatTick}
          mirror
          width={CHART_Y_AXIS_WIDTH}
          tickMargin={CHART_Y_AXIS_TICK_MARGIN}
          tick={CHART_Y_AXIS_TICK_STYLE}
          axisLine={{ stroke: 'var(--chart-axis)' }}
          tickLine={{ stroke: 'var(--chart-axis)' }}
        />
        {!hideTooltip && (
          <ChartTooltip
            formatter={(value: number, name: string) => {
              const label = name === 'locked' ? 'Locked' : 'Unlocked'
              const numericValue = Number(value ?? 0)
              return [formatValue(numericValue), label]
            }}
            labelFormatter={formatChartTooltipDate}
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
          dataKey={'unlocked'}
          stroke={'var(--color-unlocked)'}
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
        />
        <Line
          type={'monotone'}
          dataKey={'locked'}
          stroke={'var(--color-locked)'}
          strokeWidth={2}
          strokeDasharray="4 3"
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ChartContainer>
  )
}

const formatPercentTick = (value: number | string) => {
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue) || numericValue === 0) return ''
  return `${numericValue.toFixed(1)}%`
}

const formatPpsTick = (value: number | string) => {
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue) || numericValue === 0) return ''
  return numericValue.toFixed(2)
}

const formatTvlTick = (value: number | string) => {
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue) || numericValue === 0) return ''
  return `$${(numericValue / 1_000_000).toFixed(1)}M`
}

export function YvUsdApyChart({
  chartData,
  timeframe,
  hideTooltip
}: Omit<TYvUsdDualLineChartProps, 'formatValue' | 'formatTick'>) {
  return (
    <YvUsdDualLineChart
      chartData={chartData}
      timeframe={timeframe}
      hideTooltip={hideTooltip}
      formatValue={(value) => `${value.toFixed(2)}%`}
      formatTick={formatPercentTick}
    />
  )
}

export function YvUsdPerformanceChart({
  chartData,
  timeframe,
  hideTooltip
}: Omit<TYvUsdDualLineChartProps, 'formatValue' | 'formatTick'>) {
  return (
    <YvUsdDualLineChart
      chartData={chartData}
      timeframe={timeframe}
      hideTooltip={hideTooltip}
      formatValue={(value) => value.toFixed(4)}
      formatTick={formatPpsTick}
    />
  )
}

export function YvUsdTvlChart({
  chartData,
  timeframe,
  hideTooltip
}: Omit<TYvUsdDualLineChartProps, 'formatValue' | 'formatTick'>) {
  return (
    <YvUsdDualLineChart
      chartData={chartData}
      timeframe={timeframe}
      hideTooltip={hideTooltip}
      formatValue={(value) =>
        `$${value.toLocaleString(undefined, {
          maximumFractionDigits: 0
        })}`
      }
      formatTick={formatTvlTick}
    />
  )
}
