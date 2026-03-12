import type { TYvUsdSeriesPoint } from '@pages/vaults/hooks/useYvUsdCharts'
import {
  formatChartMonthYearLabel,
  formatChartTooltipDate,
  formatChartWeekLabel,
  getChartMonthlyTicks,
  getChartWeeklyTicks,
  getTimeframeLimit
} from '@pages/vaults/utils/charts'
import { useChartStyle } from '@shared/contexts/useChartStyle'
import { getChartStyleVariables } from '@shared/utils/chartStyles'
import type { CSSProperties, ReactElement } from 'react'
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
  allowNegativeValues?: boolean
  formatValue: (value: number) => string
  formatTick: (value: number | string) => string
}

type TYvUsdSeriesKey = 'unlocked' | 'locked'

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

function getFilteredYvUsdChartData(chartData: TYvUsdSeriesPoint[], timeframe: string): TYvUsdSeriesPoint[] {
  const limit = getTimeframeLimit(timeframe)
  if (!Number.isFinite(limit) || limit >= chartData.length) {
    return chartData
  }
  return chartData.slice(-limit)
}

function getVisibleSeriesKeys(chartData: TYvUsdSeriesPoint[], timeframe: string): TYvUsdSeriesKey[] {
  const filteredData = getFilteredYvUsdChartData(chartData, timeframe)
  return (Object.keys(SERIES_CONFIG) as TYvUsdSeriesKey[]).filter((seriesKey) =>
    filteredData.some((point) => typeof point[seriesKey] === 'number' && Number.isFinite(point[seriesKey]))
  )
}

function getSeriesLabel(name: string): string {
  return name === 'locked' ? 'Locked' : 'Unlocked'
}

export function YvUsdDualLineChart({
  chartData,
  timeframe,
  hideTooltip,
  allowNegativeValues = false,
  formatValue,
  formatTick
}: TYvUsdDualLineChartProps): ReactElement {
  const filteredData = useMemo(() => getFilteredYvUsdChartData(chartData, timeframe), [chartData, timeframe])
  const hasNegativeValues = useMemo(
    () =>
      filteredData.some((point) =>
        (Object.keys(SERIES_CONFIG) as TYvUsdSeriesKey[]).some((seriesKey) => {
          const value = point[seriesKey]
          return typeof value === 'number' && Number.isFinite(value) && value < 0
        })
      ),
    [filteredData]
  )
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
          domain={allowNegativeValues && hasNegativeValues ? ['auto', 'auto'] : [0, 'auto']}
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
              const numericValue = Number(value ?? 0)
              return [formatValue(numericValue), getSeriesLabel(name)]
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

export function YvUsdChartLegend({
  chartData,
  timeframe
}: Pick<TYvUsdDualLineChartProps, 'chartData' | 'timeframe'>): ReactElement | null {
  const { chartStyle } = useChartStyle()
  const chartStyleVars = getChartStyleVariables(chartStyle)
  const visibleSeries = useMemo(() => getVisibleSeriesKeys(chartData, timeframe), [chartData, timeframe])

  if (visibleSeries.length <= 1) {
    return null
  }

  return (
    <div className="relative h-0 -top-6 flex justify-center px-4" style={chartStyleVars as CSSProperties}>
      <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs font-medium text-text-secondary">
        {visibleSeries.map((seriesKey) => (
          <div key={seriesKey} className="flex items-center gap-2">
            <span
              className="block w-6 border-t-2"
              style={{
                borderColor: SERIES_CONFIG[seriesKey].color,
                borderTopStyle: seriesKey === 'locked' ? 'dashed' : 'solid'
              }}
            />
            <span>{SERIES_CONFIG[seriesKey].label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function formatPercentTick(value: number | string): string {
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue) || numericValue === 0) return ''
  return `${numericValue.toFixed(1)}%`
}

function formatPpsTick(value: number | string): string {
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue) || numericValue === 0) return ''
  return numericValue.toFixed(2)
}

function formatTvlTick(value: number | string): string {
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue) || numericValue === 0) return ''
  return `$${(numericValue / 1_000_000).toFixed(1)}M`
}

export function YvUsdApyChart({
  chartData,
  timeframe,
  hideTooltip
}: Omit<TYvUsdDualLineChartProps, 'formatValue' | 'formatTick'>): ReactElement {
  return (
    <YvUsdDualLineChart
      chartData={chartData}
      timeframe={timeframe}
      hideTooltip={hideTooltip}
      allowNegativeValues
      formatValue={(value) => `${value.toFixed(2)}%`}
      formatTick={formatPercentTick}
    />
  )
}

export function YvUsdPerformanceChart({
  chartData,
  timeframe,
  hideTooltip
}: Omit<TYvUsdDualLineChartProps, 'formatValue' | 'formatTick'>): ReactElement {
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
}: Omit<TYvUsdDualLineChartProps, 'formatValue' | 'formatTick'>): ReactElement {
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
