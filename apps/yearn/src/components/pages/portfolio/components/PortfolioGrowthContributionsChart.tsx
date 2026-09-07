import type { TPortfolioHistoryChartTimeframe } from '@pages/portfolio/components/PortfolioHistoryChart'
import {
  buildPortfolioGrowthContributionChart,
  type TPortfolioGrowthContributionChartPoint,
  type TPortfolioGrowthContributionFamily,
  type TPortfolioGrowthContributionSeries
} from '@pages/portfolio/utils/portfolioGrowthContributions'
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
import { formatUSD } from '@shared/utils'
import type { ReactElement } from 'react'
import { useMemo } from 'react'
import { Area, CartesianGrid, ComposedChart, Line, ReferenceLine, XAxis, YAxis } from 'recharts'
import type { AxisDomain } from 'recharts/types/util/types'

type TPortfolioGrowthContributionsChartProps = {
  totalPoints: Array<{ date: string; value: number | null; isEstimated?: boolean }>
  familySeries: TPortfolioGrowthContributionFamily[]
  timeframe: TPortfolioHistoryChartTimeframe
  mode: 'usd' | 'eth' | 'index'
}

type TTooltipProps = {
  active?: boolean
  payload?: Array<{
    payload?: TPortfolioGrowthContributionChartPoint
  }>
}

type TPresentedContributionSeries = TPortfolioGrowthContributionSeries & {
  color: string
}

const MAX_VAULTS = 8
const CONTRIBUTION_COLORS = [
  '#46a2ff',
  '#7bb3a8',
  '#e1a23b',
  '#b67ae5',
  '#f472b6',
  '#f97316',
  '#14b8a6',
  '#94adf2'
] as const
const OTHER_COLOR = '#94a3b8'
const INDEX_BASE_COLOR = '#80b7f4'
const TOTAL_COLOR = '#2578ff'
const LINE_HEADROOM = 1.05
const CHART_MARGIN = {
  ...CHART_WITH_AXES_MARGIN,
  bottom: 4
}

function formatEthValue(value: number): string {
  const absoluteValue = Math.abs(value)
  const formattedValue =
    absoluteValue >= 100
      ? absoluteValue.toFixed(2)
      : absoluteValue >= 1
        ? absoluteValue.toFixed(3)
        : absoluteValue.toFixed(4)

  return `${formattedValue} ETH`
}

function formatIndexValue(value: number): string {
  return value.toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 2 })
}

function formatSignedGrowth(value: number, mode: 'usd' | 'eth' | 'index', isEstimated = false): string {
  const formatted =
    mode === 'eth'
      ? formatEthValue(value)
      : mode === 'index'
        ? formatIndexValue(Math.abs(value))
        : formatUSD(Math.abs(value), 2, 2)
  const estimateSuffix = isEstimated ? '*' : ''
  if (value > 0) {
    return `+${formatted}${estimateSuffix}`
  }
  if (value < 0) {
    return `−${formatted}${estimateSuffix}`
  }
  return `${formatted}${estimateSuffix}`
}

function formatGrowthTick(value: number | string, mode: 'usd' | 'eth' | 'index'): string {
  const numericValue = Number(value)
  const absoluteValue = Math.abs(numericValue)
  if (!Number.isFinite(numericValue)) {
    return ''
  }
  if (numericValue === 0) {
    return mode === 'usd' ? '$0' : '0'
  }
  if (mode === 'index') {
    return formatIndexValue(numericValue)
  }
  if (mode === 'eth') {
    if (absoluteValue >= 1_000) {
      return `${numericValue < 0 ? '−' : ''}${(absoluteValue / 1_000).toFixed(1)}k`
    }
    return absoluteValue >= 10
      ? numericValue.toFixed(1)
      : absoluteValue >= 1
        ? numericValue.toFixed(2)
        : numericValue.toFixed(3)
  }
  if (absoluteValue >= 1_000_000) {
    return `${numericValue < 0 ? '−' : ''}$${(absoluteValue / 1_000_000).toFixed(1)}M`
  }
  if (absoluteValue >= 1_000) {
    return `${numericValue < 0 ? '−' : ''}$${(absoluteValue / 1_000).toFixed(1)}k`
  }
  return `${numericValue < 0 ? '−' : ''}$${absoluteValue.toFixed(0)}`
}

export function getPortfolioGrowthStackDomain(values: number[], floor?: number): AxisDomain {
  if (floor !== undefined) {
    const maximum = Math.max(floor, ...values)
    return [floor, maximum > floor ? floor + (maximum - floor) * LINE_HEADROOM : floor + 1]
  }

  const bounds = values.reduce(
    (result, value) => ({ min: Math.min(result.min, value), max: Math.max(result.max, value) }),
    { min: 0, max: 0 }
  )

  if (bounds.min === 0 && bounds.max === 0) {
    return [0, 1]
  }

  return [bounds.min < 0 ? bounds.min * LINE_HEADROOM : 0, bounds.max > 0 ? bounds.max * LINE_HEADROOM : 0]
}

function PortfolioGrowthContributionsTooltip({
  active,
  payload,
  series,
  mode
}: TTooltipProps & {
  series: TPresentedContributionSeries[]
  mode: 'usd' | 'eth' | 'index'
}): ReactElement | null {
  if (!active || !payload?.length) {
    return null
  }

  const point = payload[0]?.payload
  if (!point?.date || typeof point.portfolioGrowth !== 'number' || !Number.isFinite(point.portfolioGrowth)) {
    return null
  }

  const baseRows = series
    .filter((item) => item.isBase)
    .flatMap((item) => {
      const value = point[item.key]
      return typeof value === 'number' && Number.isFinite(value) ? [{ ...item, value, isEstimated: false }] : []
    })
  const namedRows = series
    .filter((item) => !item.isOther && !item.isBase)
    .flatMap((item) => {
      const value = point[item.key]
      return typeof value === 'number' && Number.isFinite(value)
        ? [{ ...item, value, isEstimated: Boolean(point[`${item.key}Estimated`]) }]
        : []
    })
    .toSorted((left, right) => Math.abs(right.value) - Math.abs(left.value))
  const otherSeries = series.find((item) => item.isOther)
  const otherValue = otherSeries ? point[otherSeries.key] : null
  const rows =
    otherSeries && typeof otherValue === 'number' && Number.isFinite(otherValue)
      ? [
          ...baseRows,
          ...namedRows,
          {
            ...otherSeries,
            value: otherValue,
            isEstimated: Boolean(point[`${otherSeries.key}Estimated`])
          }
        ]
      : [...baseRows, ...namedRows]
  const hasEstimatedValue = Boolean(point.portfolioGrowthEstimated) || rows.some((row) => row.isEstimated)

  return (
    <div
      className={
        'pointer-events-none flex w-[min(17rem,calc(100vw-2rem))] flex-col rounded-xl border border-border bg-surface px-3 py-2 shadow-xl'
      }
    >
      <span className={'text-xs font-medium uppercase tracking-[0.12em] text-text-tertiary'}>
        {formatChartTooltipDate(point.date)}
      </span>
      <div className={'mt-1 flex items-center justify-between gap-5'}>
        <span className={'text-xs text-text-secondary'}>
          {mode === 'index' ? 'Portfolio index' : 'Portfolio growth'}
        </span>
        <strong className={'font-number text-sm font-semibold text-text-primary'}>
          {mode === 'index'
            ? formatIndexValue(point.portfolioGrowth)
            : formatSignedGrowth(point.portfolioGrowth, mode, Boolean(point.portfolioGrowthEstimated))}
        </strong>
      </div>
      <div className={'my-1.5 border-t border-border'} />
      <span className={'text-[11px] font-medium uppercase tracking-[0.12em] text-text-tertiary'}>
        {mode === 'index' ? 'Index attribution' : 'Vault contributions'}
      </span>
      <div className={'mt-1 flex flex-col gap-0.5'}>
        {rows.map((row) => (
          <div key={row.key} className={'flex items-center justify-between gap-4'}>
            <span className={'inline-flex min-w-0 items-center gap-2 text-xs text-text-secondary'}>
              <span className={'size-2 shrink-0 rounded-[2px]'} style={{ backgroundColor: row.color }} />
              <span className={'truncate'}>{row.label}</span>
            </span>
            <span className={'font-number shrink-0 text-xs font-medium text-text-primary'}>
              {formatSignedGrowth(row.value, mode, row.isEstimated)}
            </span>
          </div>
        ))}
      </div>
      {hasEstimatedValue ? (
        <p className={'mt-1.5 border-t border-border pt-1 text-[11px] text-text-tertiary'}>
          {'* Growth may be approximate.'}
        </p>
      ) : null}
    </div>
  )
}

export function PortfolioGrowthContributionsChart({
  totalPoints,
  familySeries,
  timeframe,
  mode
}: TPortfolioGrowthContributionsChartProps): ReactElement {
  const contributionChart = useMemo(
    () =>
      buildPortfolioGrowthContributionChart({
        totalPoints,
        familySeries,
        maxVaults: MAX_VAULTS,
        preserveNullValues: mode === 'eth',
        ...(mode === 'index'
          ? { baseContribution: { key: 'starting_index', label: 'Starting index', value: 100 } }
          : {})
      }),
    [familySeries, mode, totalPoints]
  )
  const series = useMemo<TPresentedContributionSeries[]>(
    () =>
      contributionChart.series.map((item, index) => ({
        ...item,
        color: item.isBase
          ? INDEX_BASE_COLOR
          : item.isOther
            ? OTHER_COLOR
            : (CONTRIBUTION_COLORS[index - Number(mode === 'index')] ?? CONTRIBUTION_COLORS[0])
      })),
    [contributionChart.series, mode]
  )
  const chartConfig = useMemo<ChartConfig>(
    () =>
      Object.fromEntries([
        ...series.map((item) => [item.key, { label: item.label, color: item.color }] as const),
        [
          'portfolioGrowth',
          {
            label: mode === 'index' ? 'Portfolio index' : `Portfolio growth (${mode.toUpperCase()})`,
            color: TOTAL_COLOR
          }
        ]
      ]),
    [mode, series]
  )
  const yAxisDomain = useMemo(
    () => getPortfolioGrowthStackDomain(contributionChart.bounds, mode === 'index' ? 100 : undefined),
    [contributionChart.bounds, mode]
  )
  const isShortRange = timeframe === '30d' || contributionChart.data.length <= 45
  const ticks = isShortRange
    ? getChartWeeklyTicks(contributionChart.data)
    : getChartMonthlyTicks(contributionChart.data)
  const tickFormatter = isShortRange ? formatChartWeekLabel : formatChartMonthYearLabel

  return (
    <ChartContainer config={chartConfig} style={{ height: '100%', aspectRatio: 'unset' }}>
      <ComposedChart data={contributionChart.data} margin={CHART_MARGIN}>
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
          tickFormatter={(value) => formatGrowthTick(value, mode)}
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
          content={(props) => <PortfolioGrowthContributionsTooltip {...props} series={series} mode={mode} />}
        />
        <ReferenceLine y={0} stroke={'var(--chart-axis)'} strokeOpacity={0.6} />
        {series.map((item) => (
          <Area
            key={item.key}
            type={'monotone'}
            dataKey={(point: TPortfolioGrowthContributionChartPoint | undefined) => point?.stackBands[item.key] ?? null}
            name={item.label}
            stroke={item.color}
            strokeWidth={0.75}
            fill={item.color}
            fillOpacity={item.isBase ? 0.38 : item.isOther ? 0.4 : 0.68}
            connectNulls={mode !== 'eth'}
            tooltipType={'none'}
            isAnimationActive={false}
          />
        ))}
        <Line
          type={'monotone'}
          dataKey={'portfolioGrowth'}
          stroke={TOTAL_COLOR}
          strokeWidth={3}
          dot={false}
          activeDot={{ r: 4, strokeWidth: 0, fill: TOTAL_COLOR }}
          connectNulls={mode !== 'eth'}
          isAnimationActive={false}
        />
      </ComposedChart>
    </ChartContainer>
  )
}
