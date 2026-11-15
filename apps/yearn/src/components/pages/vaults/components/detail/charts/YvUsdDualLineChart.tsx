import type { TChartDataPoint } from '@pages/vaults/types/charts'
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
import type { ComponentProps, CSSProperties, ReactElement } from 'react'
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

type TLineSeries = { key: string; label: string }
type TDualLineSeries = readonly [TLineSeries, TLineSeries]

type TDualLineChartProps = {
  chartData: TChartDataPoint[]
  series?: TDualLineSeries
  timeframe: string
  hideTooltip?: boolean
  allowNegativeValues?: boolean
  connectNulls?: boolean
  referenceFloor?: number
  formatValue: (value: number) => string
  formatTick: (value: number | string) => string
}

type TYAxisDomain = NonNullable<ComponentProps<typeof YAxis>['domain']>

const YVUSD_SERIES: TDualLineSeries = [
  { key: 'unlocked', label: 'Unlocked' },
  { key: 'locked', label: 'Locked' }
]
const SERIES_COLORS = ['var(--chart-1)', 'var(--chart-2)'] as const

function getFilteredChartData(chartData: TChartDataPoint[], timeframe: string): TChartDataPoint[] {
  const limit = getTimeframeLimit(timeframe)
  if (!Number.isFinite(limit) || limit >= chartData.length) {
    return chartData
  }
  return chartData.slice(-limit)
}

function DualLineChart({
  chartData,
  series = YVUSD_SERIES,
  timeframe,
  hideTooltip,
  allowNegativeValues = false,
  connectNulls = false,
  referenceFloor,
  formatValue,
  formatTick
}: TDualLineChartProps): ReactElement {
  const [primary, secondary] = series
  const chartConfig: ChartConfig = {
    [primary.key]: { label: primary.label, color: SERIES_COLORS[0] },
    [secondary.key]: { label: secondary.label, color: SERIES_COLORS[1] }
  }
  const filteredData = useMemo(() => getFilteredChartData(chartData, timeframe), [chartData, timeframe])
  const hasNegativeValues = useMemo(
    () =>
      filteredData.some((point) =>
        series.some(({ key }) => {
          const value = point[key]
          return typeof value === 'number' && Number.isFinite(value) && value < 0
        })
      ),
    [filteredData, series]
  )
  const isShortTimeframe = timeframe === '30d' || timeframe === '90d'
  const ticks = useMemo(
    () => (isShortTimeframe ? getChartWeeklyTicks(filteredData) : getChartMonthlyTicks(filteredData)),
    [filteredData, isShortTimeframe]
  )
  const tickFormatter = isShortTimeframe ? formatChartWeekLabel : formatChartMonthYearLabel
  const yAxisDomain = useMemo<TYAxisDomain>(() => {
    if (allowNegativeValues && hasNegativeValues) {
      return ['auto', 'auto'] as [string, string]
    }

    if (referenceFloor !== undefined) {
      return ([dataMin, dataMax]: [number, number]) => [Math.min(referenceFloor, dataMin), dataMax]
    }

    return [0, 'auto'] as [number, 'auto']
  }, [allowNegativeValues, hasNegativeValues, referenceFloor])

  return (
    <ChartContainer config={chartConfig} style={{ height: 'inherit' }}>
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
          domain={yAxisDomain}
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
              return [formatValue(numericValue), chartConfig[name]?.label ?? name]
            }}
            labelFormatter={formatChartTooltipDate}
            itemSorter={(item) => (item.dataKey === secondary.key ? 0 : 1)}
            labelStyle={{ marginBottom: 8 }}
            itemStyle={{ color: `var(--color-${primary.key})`, paddingTop: 0, paddingBottom: 2 }}
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
          dataKey={primary.key}
          stroke={`var(--color-${primary.key})`}
          strokeWidth={2}
          dot={filteredData.filter((point) => Number.isFinite(point[primary.key])).length === 1}
          isAnimationActive={false}
          connectNulls={connectNulls}
        />
        <Line
          type={'monotone'}
          dataKey={secondary.key}
          stroke={`var(--color-${secondary.key})`}
          strokeWidth={2}
          strokeDasharray="4 3"
          dot={filteredData.filter((point) => Number.isFinite(point[secondary.key])).length === 1}
          isAnimationActive={false}
          connectNulls={connectNulls}
        />
      </LineChart>
    </ChartContainer>
  )
}

export function DualLineChartLegend({
  chartData,
  series = YVUSD_SERIES,
  timeframe,
  showSingleSeries = false
}: Pick<TDualLineChartProps, 'chartData' | 'series' | 'timeframe'> & {
  showSingleSeries?: boolean
}): ReactElement | null {
  const { chartStyle } = useChartStyle()
  const chartStyleVars = getChartStyleVariables(chartStyle)
  const filteredData = useMemo(() => getFilteredChartData(chartData, timeframe), [chartData, timeframe])
  const visibleSeries = series
    .map(({ key, label }, index) => ({ key, label, color: SERIES_COLORS[index], dashed: index === 1 }))
    .filter(({ key }) => filteredData.some((point) => Number.isFinite(point[key])))

  if (visibleSeries.length < (showSingleSeries ? 1 : 2)) {
    return null
  }

  return (
    <div className="relative h-0 -top-6 flex justify-center px-4" style={chartStyleVars as CSSProperties}>
      <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs font-medium text-text-secondary">
        {visibleSeries.map(({ key, label, color, dashed }) => (
          <div key={key} className="flex items-center gap-2">
            <span
              className="block w-6 border-t-2"
              style={{
                borderColor: color,
                borderTopStyle: dashed ? 'dashed' : 'solid'
              }}
            />
            <span>{label}</span>
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

export function DualLineApyChart({
  chartData,
  series,
  timeframe,
  hideTooltip
}: Omit<TDualLineChartProps, 'formatValue' | 'formatTick'>): ReactElement {
  return (
    <DualLineChart
      chartData={chartData}
      series={series}
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
}: Omit<TDualLineChartProps, 'formatValue' | 'formatTick'>): ReactElement {
  return (
    <DualLineChart
      chartData={chartData}
      timeframe={timeframe}
      hideTooltip={hideTooltip}
      referenceFloor={1}
      formatValue={(value) => value.toFixed(4)}
      formatTick={formatPpsTick}
    />
  )
}

export function YvUsdTvlChart({
  chartData,
  timeframe,
  hideTooltip
}: Omit<TDualLineChartProps, 'formatValue' | 'formatTick'>): ReactElement {
  return (
    <DualLineChart
      chartData={chartData}
      timeframe={timeframe}
      hideTooltip={hideTooltip}
      connectNulls
      formatValue={(value) =>
        `$${value.toLocaleString(undefined, {
          maximumFractionDigits: 0
        })}`
      }
      formatTick={formatTvlTick}
    />
  )
}
