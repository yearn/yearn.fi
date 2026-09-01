import type { TPortfolioHistoryChartTimeframe } from '@pages/portfolio/components/PortfolioHistoryChart'
import {
  buildPortfolioGrowthIndexComparison,
  type TPortfolioGrowthIndexChartPoint,
  type TPortfolioGrowthIndexFamily,
  type TPortfolioGrowthIndexSeries
} from '@pages/portfolio/utils/portfolioGrowthIndexComparison'
import type { ChartConfig } from '@pages/vaults/components/detail/charts/ChartPrimitives'
import { ChartContainer, ChartTooltip } from '@pages/vaults/components/detail/charts/ChartPrimitives'
import {
  CHART_WITH_AXES_MARGIN,
  CHART_Y_AXIS_TICK_MARGIN,
  CHART_Y_AXIS_TICK_STYLE,
  CHART_Y_AXIS_WIDTH
} from '@pages/vaults/components/detail/charts/chartLayout'
import {
  formatChartMonthYearLabel,
  formatChartTooltipDate,
  formatChartWeekLabel,
  getChartMonthlyTicks,
  getChartWeeklyTicks
} from '@pages/vaults/utils/charts'
import type { ReactElement } from 'react'
import { useMemo } from 'react'
import { CartesianGrid, ComposedChart, Line, XAxis, YAxis } from 'recharts'
import type { AxisDomain } from 'recharts/types/util/types'

type TPortfolioGrowthIndexChartProps = {
  totalPoints: Array<{ date: string; value: number | null }>
  familySeries: TPortfolioGrowthIndexFamily[]
  timeframe: TPortfolioHistoryChartTimeframe
}

type TTooltipProps = {
  active?: boolean
  payload?: Array<{
    dataKey?: unknown
    color?: unknown
    value?: unknown
    payload?: TPortfolioGrowthIndexChartPoint
  }>
}

type TPresentedIndexSeries = TPortfolioGrowthIndexSeries & {
  color: string
}

const MAX_VAULTS = 8
const INDEX_COLORS = [
  '#2578ff',
  '#46a2ff',
  '#7bb3a8',
  '#e1a23b',
  '#b67ae5',
  '#f472b6',
  '#f97316',
  '#14b8a6',
  '#94adf2'
] as const
const INDEX_BASE = 100
const INDEX_HEADROOM = 1.05
const CHART_MARGIN = {
  ...CHART_WITH_AXES_MARGIN,
  bottom: 4
}

function formatIndexValue(value: number): string {
  return value >= 1000 ? value.toFixed(0) : value >= 100 ? value.toFixed(1) : value.toFixed(2)
}

function formatIndexTick(value: number | string, index?: number): string {
  if (index === 0) {
    return ''
  }

  const numericValue = Number(value)
  return Math.abs(numericValue) >= 1000 ? numericValue.toFixed(0) : numericValue.toFixed(1)
}

function getIndexDomain(data: TPortfolioGrowthIndexChartPoint[], series: TPresentedIndexSeries[]): AxisDomain {
  const values = data.flatMap((point) =>
    ['portfolioIndex', ...series.map((item) => item.key)].flatMap((key) => {
      const value = point[key]
      return typeof value === 'number' && Number.isFinite(value) ? [value] : []
    })
  )
  const minValue = Math.min(INDEX_BASE, ...values)
  const maxValue = Math.max(INDEX_BASE, ...values)
  const lowerDistance = INDEX_BASE - minValue
  const upperDistance = maxValue - INDEX_BASE

  return [
    lowerDistance > 0 ? INDEX_BASE - lowerDistance * INDEX_HEADROOM : INDEX_BASE - 1,
    upperDistance > 0 ? INDEX_BASE + upperDistance * INDEX_HEADROOM : INDEX_BASE + 1
  ]
}

function PortfolioGrowthIndexTooltip({
  active,
  payload,
  series
}: TTooltipProps & { series: TPresentedIndexSeries[] }): ReactElement | null {
  if (!active || !payload?.length) {
    return null
  }

  const point = payload[0]?.payload
  if (!point?.date) {
    return null
  }

  const rows = [
    ...(typeof point.portfolioIndex === 'number' && Number.isFinite(point.portfolioIndex)
      ? [
          {
            key: 'portfolioIndex',
            label: 'Portfolio',
            value: point.portfolioIndex,
            color: INDEX_COLORS[0]
          }
        ]
      : []),
    ...series.flatMap((item) => {
      const value = point[item.key]
      return typeof value === 'number' && Number.isFinite(value)
        ? [{ key: item.key, label: item.label, value, color: item.color }]
        : []
    })
  ]

  return (
    <div
      className={
        'pointer-events-none flex w-[min(17rem,calc(100vw-2rem))] flex-col rounded-xl border border-border bg-surface px-3 py-3 shadow-xl'
      }
    >
      <span className={'text-xs font-medium uppercase tracking-[0.12em] text-text-tertiary'}>
        {formatChartTooltipDate(point.date)}
      </span>
      <div className={'mt-2 flex flex-col gap-1.5'}>
        {rows.map((row) => (
          <div key={row.key} className={'flex items-center justify-between gap-4'}>
            <span className={'inline-flex min-w-0 items-center gap-2 text-xs text-text-secondary'}>
              <span className={'size-2 shrink-0 rounded-full'} style={{ backgroundColor: row.color }} />
              <span className={'truncate'}>{row.label}</span>
            </span>
            <span className={'font-number shrink-0 text-xs font-medium text-text-primary'}>
              {formatIndexValue(row.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function PortfolioGrowthIndexChart({
  totalPoints,
  familySeries,
  timeframe
}: TPortfolioGrowthIndexChartProps): ReactElement {
  const comparison = useMemo(
    () => buildPortfolioGrowthIndexComparison({ totalPoints, familySeries, maxVaults: MAX_VAULTS }),
    [familySeries, totalPoints]
  )
  const series = useMemo<TPresentedIndexSeries[]>(
    () =>
      comparison.series.map((item, index) => ({
        ...item,
        color: INDEX_COLORS[index + 1] ?? INDEX_COLORS[1]
      })),
    [comparison.series]
  )
  const chartConfig = useMemo<ChartConfig>(
    () =>
      Object.fromEntries([
        ['portfolioIndex', { label: 'Portfolio', color: INDEX_COLORS[0] }],
        ...series.map((item) => [item.key, { label: item.label, color: item.color }] as const)
      ]),
    [series]
  )
  const yAxisDomain = useMemo(() => getIndexDomain(comparison.data, series), [comparison.data, series])
  const isShortRange = timeframe === '30d' || comparison.data.length <= 45
  const ticks = isShortRange ? getChartWeeklyTicks(comparison.data) : getChartMonthlyTicks(comparison.data)
  const tickFormatter = isShortRange ? formatChartWeekLabel : formatChartMonthYearLabel

  return (
    <ChartContainer config={chartConfig} style={{ height: '100%', aspectRatio: 'unset' }}>
      <ComposedChart data={comparison.data} margin={CHART_MARGIN}>
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
          allowDataOverflow
          tickCount={5}
          tickFormatter={formatIndexTick}
          mirror
          width={CHART_Y_AXIS_WIDTH}
          tickMargin={CHART_Y_AXIS_TICK_MARGIN}
          tick={CHART_Y_AXIS_TICK_STYLE}
          axisLine={{ stroke: 'var(--chart-axis)' }}
          tickLine={{ stroke: 'var(--chart-axis)' }}
        />
        <ChartTooltip
          cursor={{ stroke: 'var(--chart-cursor-line)', strokeWidth: 1 }}
          wrapperStyle={{ zIndex: 20 }}
          content={(props) => <PortfolioGrowthIndexTooltip {...props} series={series} />}
        />
        <Line
          type={'monotone'}
          dataKey={'portfolioIndex'}
          name={'Portfolio'}
          stroke={INDEX_COLORS[0]}
          strokeWidth={2.5}
          dot={false}
          activeDot={{ r: 4, strokeWidth: 0, fill: INDEX_COLORS[0] }}
          connectNulls
          isAnimationActive={false}
        />
        {series.map((item) => (
          <Line
            key={item.key}
            type={'monotone'}
            dataKey={item.key}
            name={item.label}
            stroke={item.color}
            strokeWidth={1.75}
            strokeOpacity={0.9}
            dot={false}
            activeDot={{ r: 3.5, strokeWidth: 0, fill: item.color }}
            connectNulls
            isAnimationActive={false}
          />
        ))}
      </ComposedChart>
    </ChartContainer>
  )
}
