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
  formatUnixTimestamp,
  getChartMonthlyTicks,
  getChartWeeklyTicks,
  getTimeframeLimit
} from '@pages/vaults/utils/charts'
import { cl, formatUSD, SELECTOR_BAR_STYLES } from '@shared/utils'
import type { ReactElement } from 'react'
import { useMemo, useState } from 'react'
import { CartesianGrid, ComposedChart, Line, XAxis, YAxis } from 'recharts'

export type TPortfolioVaultGrowthChartMode = 'position' | 'index'
export type TPortfolioVaultGrowthChartTimeframe = '30d' | '90d' | '1y' | 'all'

export type TPortfolioVaultGrowthChartPoint = {
  timestamp: number
  vaultAddress: string
  vaultName: string
  symbol: string
  pricePerShare: number
  underlyingUsdPrice: number
  userShareBalance: number
}

export type TPortfolioVaultGrowthChartSeriesPoint = {
  timestamp: number
  positionValueUsd: number | null
  indexValue: number | null
}

export type TPortfolioVaultGrowthChartSeries = {
  vaultAddress: string
  vaultName: string
  symbol?: string | null
  points: TPortfolioVaultGrowthChartSeriesPoint[]
}

export type TPortfolioVaultGrowthChartProps = {
  points?: TPortfolioVaultGrowthChartPoint[]
  series?: TPortfolioVaultGrowthChartSeries[]
  mode?: TPortfolioVaultGrowthChartMode
  initialMode?: TPortfolioVaultGrowthChartMode
  onModeChange?: (mode: TPortfolioVaultGrowthChartMode) => void
  timeframe?: TPortfolioVaultGrowthChartTimeframe
  vaultOrder?: string[]
  maxVaults?: number
  indexBase?: number
  colors?: string[]
  title?: string
  height?: number
  showModeToggle?: boolean
  className?: string
  emptyMessage?: string
}

type TTransformedPoint = {
  timestamp: number
  date: string
  value: number | null
}

type TTransformedSeries = {
  key: string
  vaultAddress: string
  label: string
  color: string
  positionPoints: TTransformedPoint[]
  indexPoints: TTransformedPoint[]
}

type TChartPoint = {
  date: string
  timestamp: number
  [seriesKey: string]: string | number | null
}

type TTooltipProps = {
  active?: boolean
  payload?: Array<{
    dataKey?: unknown
    color?: unknown
    value?: unknown
    payload?: {
      date?: string
      [seriesKey: string]: unknown
    }
  }>
}

const DEFAULT_COLORS = ['#2578ff', '#46a2ff', '#94adf2', '#7bb3a8', '#e1a23b', '#b67ae5', '#f472b6', '#f97316']
const MIN_RELEVANCE_SCORE = 0.000001

const MODE_COPY: Record<TPortfolioVaultGrowthChartMode, string> = {
  position: 'Shows actual protocol gain from your deposited positions during the selected timeframe.',
  index: 'Shows vault performance normalized to 100, ignoring position size.'
}

function getVaultKey(address: string): string {
  return address.toLowerCase()
}

function normalizeTimestamp(timestamp: number): number {
  return timestamp > 1_000_000_000_000 ? Math.floor(timestamp / 1000) : Math.floor(timestamp)
}

function isFinitePositive(value: number): boolean {
  return Number.isFinite(value) && value > 0
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function getValidShareBalance(point: TPortfolioVaultGrowthChartPoint): number {
  return Number.isFinite(point.userShareBalance) && point.userShareBalance > 0 ? point.userShareBalance : 0
}

function hasRawExposure(points: TPortfolioVaultGrowthChartPoint[]): boolean {
  return points.some((point) => getValidShareBalance(point) > 0)
}

function hasPrecomputedExposure(points: TPortfolioVaultGrowthChartSeriesPoint[]): boolean {
  return points.some((point) => isFiniteNumber(point.positionValueUsd) || isFiniteNumber(point.indexValue))
}

function buildPositionPoints(points: TPortfolioVaultGrowthChartPoint[]): TTransformedPoint[] {
  return points.reduce<{
    points: TTransformedPoint[]
    cumulativeGrowthUsd: number
    previousPricePerShare: number | null
    previousShareBalance: number
    hasSeenExposure: boolean
  }>(
    (state, point) => {
      const timestamp = normalizeTimestamp(point.timestamp)
      const shareBalance = getValidShareBalance(point)
      const hasValidPrices = isFinitePositive(point.pricePerShare) && isFinitePositive(point.underlyingUsdPrice)

      if (!hasValidPrices) {
        state.points.push({ timestamp, date: formatUnixTimestamp(timestamp), value: null })
        return state
      }

      const cumulativeGrowthUsd =
        state.previousPricePerShare !== null
          ? state.cumulativeGrowthUsd +
            state.previousShareBalance * (point.pricePerShare - state.previousPricePerShare) * point.underlyingUsdPrice
          : state.cumulativeGrowthUsd
      const hasSeenExposure = state.hasSeenExposure || state.previousShareBalance > 0 || shareBalance > 0

      state.points.push({
        timestamp,
        date: formatUnixTimestamp(timestamp),
        value: hasSeenExposure ? cumulativeGrowthUsd : null
      })

      return {
        points: state.points,
        cumulativeGrowthUsd,
        previousPricePerShare: point.pricePerShare,
        previousShareBalance: shareBalance,
        hasSeenExposure
      }
    },
    {
      points: [],
      cumulativeGrowthUsd: 0,
      previousPricePerShare: null,
      previousShareBalance: 0,
      hasSeenExposure: false
    }
  ).points
}

function buildIndexPoints(points: TPortfolioVaultGrowthChartPoint[], indexBase: number): TTransformedPoint[] {
  const basePricePerShare = points.find(
    (point) => getValidShareBalance(point) > 0 && isFinitePositive(point.pricePerShare)
  )?.pricePerShare

  return points.map((point) => {
    const timestamp = normalizeTimestamp(point.timestamp)
    const hasOpenPosition = getValidShareBalance(point) > 0
    const value =
      hasOpenPosition && basePricePerShare && isFinitePositive(point.pricePerShare)
        ? (point.pricePerShare / basePricePerShare) * indexBase
        : null

    return { timestamp, date: formatUnixTimestamp(timestamp), value }
  })
}

function getFiniteValues(points: TTransformedPoint[]): number[] {
  return points.flatMap((point) => (isFiniteNumber(point.value) ? [point.value] : []))
}

function getPositionRelevance(points: TTransformedPoint[]): number {
  return Math.max(0, ...getFiniteValues(points).map((value) => Math.abs(value)))
}

function getIndexRelevance(points: TTransformedPoint[], indexBase: number): number {
  return Math.max(0, ...getFiniteValues(points).map((value) => Math.abs(value - indexBase)))
}

function selectRelevantSeries(args: {
  series: TTransformedSeries[]
  maxVaults?: number
  indexBase: number
}): TTransformedSeries[] {
  const scoredSeries = args.series.map((vaultSeries) => {
    const positionScore = getPositionRelevance(vaultSeries.positionPoints)
    const indexScore = getIndexRelevance(vaultSeries.indexPoints, args.indexBase)
    return {
      vaultSeries,
      positionScore,
      indexScore,
      combinedScore: positionScore + indexScore
    }
  })
  const hasRelevantSeries = scoredSeries.some(
    (series) => series.positionScore > MIN_RELEVANCE_SCORE || series.indexScore > MIN_RELEVANCE_SCORE
  )
  const candidates = hasRelevantSeries
    ? scoredSeries.filter(
        (series) => series.positionScore > MIN_RELEVANCE_SCORE || series.indexScore > MIN_RELEVANCE_SCORE
      )
    : scoredSeries

  if (typeof args.maxVaults !== 'number' || candidates.length <= args.maxVaults) {
    return candidates.map((series) => series.vaultSeries)
  }

  const maxVaults = args.maxVaults
  const selectedKeys = new Set<string>()
  const selectedSeries: TTransformedSeries[] = []
  const addSeries = (vaultSeries: TTransformedSeries): void => {
    if (selectedSeries.length >= maxVaults || selectedKeys.has(vaultSeries.vaultAddress.toLowerCase())) {
      return
    }
    selectedKeys.add(vaultSeries.vaultAddress.toLowerCase())
    selectedSeries.push(vaultSeries)
  }
  const positionTarget = Math.ceil(maxVaults / 2)

  candidates
    .toSorted((left, right) => right.positionScore - left.positionScore || right.combinedScore - left.combinedScore)
    .slice(0, positionTarget)
    .forEach((series) => {
      addSeries(series.vaultSeries)
    })

  candidates
    .toSorted((left, right) => right.indexScore - left.indexScore || right.combinedScore - left.combinedScore)
    .forEach((series) => {
      addSeries(series.vaultSeries)
    })

  candidates
    .toSorted((left, right) => right.combinedScore - left.combinedScore)
    .forEach((series) => {
      addSeries(series.vaultSeries)
    })

  return selectedSeries
}

function applySeriesPresentation(series: TTransformedSeries[], colors: string[]): TTransformedSeries[] {
  return series.map((vaultSeries, index) => ({
    ...vaultSeries,
    key: `vault_${index}`,
    color: colors[index % colors.length] ?? DEFAULT_COLORS[index % DEFAULT_COLORS.length]
  }))
}

function groupVaultPoints(points: TPortfolioVaultGrowthChartPoint[]): Map<string, TPortfolioVaultGrowthChartPoint[]> {
  return points.reduce<Map<string, TPortfolioVaultGrowthChartPoint[]>>((groups, point) => {
    const key = getVaultKey(point.vaultAddress)
    const existing = groups.get(key) ?? []
    existing.push({ ...point, timestamp: normalizeTimestamp(point.timestamp) })
    groups.set(key, existing)
    return groups
  }, new Map())
}

function buildSeries(args: {
  points: TPortfolioVaultGrowthChartPoint[]
  timeframe: TPortfolioVaultGrowthChartTimeframe
  vaultOrder?: string[]
  maxVaults?: number
  indexBase: number
  colors: string[]
}): TTransformedSeries[] {
  const grouped = groupVaultPoints(args.points)
  const groupedKeys = Array.from(grouped.keys())
  const orderedKeys = args.vaultOrder?.length
    ? args.vaultOrder.map(getVaultKey).filter((key) => grouped.has(key))
    : groupedKeys
  const limit = getTimeframeLimit(args.timeframe)

  const transformedSeries = orderedKeys.flatMap((vaultKey) => {
    const rawPoints = grouped.get(vaultKey)
    if (!rawPoints?.length) {
      return []
    }

    const sortedPoints = rawPoints.toSorted((left, right) => left.timestamp - right.timestamp)
    const points = !Number.isFinite(limit) || limit >= sortedPoints.length ? sortedPoints : sortedPoints.slice(-limit)
    const firstPoint = points[0]
    if (!firstPoint || !hasRawExposure(points)) {
      return []
    }

    return [
      {
        key: vaultKey,
        vaultAddress: firstPoint.vaultAddress,
        label: firstPoint.vaultName || firstPoint.symbol || firstPoint.vaultAddress,
        color: args.colors[0] ?? DEFAULT_COLORS[0],
        positionPoints: buildPositionPoints(points),
        indexPoints: buildIndexPoints(points, args.indexBase)
      }
    ]
  })

  return applySeriesPresentation(
    selectRelevantSeries({ series: transformedSeries, maxVaults: args.maxVaults, indexBase: args.indexBase }),
    args.colors
  )
}

function buildPrecomputedIndexPoints(
  points: TPortfolioVaultGrowthChartSeriesPoint[],
  indexBase: number
): TTransformedPoint[] {
  const baseValue = points.find((point) => isFiniteNumber(point.indexValue))?.indexValue

  return points.map((point) => {
    const timestamp = normalizeTimestamp(point.timestamp)
    const value = baseValue && isFiniteNumber(point.indexValue) ? (point.indexValue / baseValue) * indexBase : null

    return { timestamp, date: formatUnixTimestamp(timestamp), value }
  })
}

function buildPrecomputedPositionPoints(points: TPortfolioVaultGrowthChartSeriesPoint[]): TTransformedPoint[] {
  return points.reduce<{
    points: TTransformedPoint[]
    baseValue: number | null
    lastValue: number | null
  }>(
    (state, point) => {
      const timestamp = normalizeTimestamp(point.timestamp)
      const nextLastValue = isFiniteNumber(point.positionValueUsd) ? point.positionValueUsd : state.lastValue
      const nextBaseValue = state.baseValue ?? nextLastValue

      state.points.push({
        timestamp,
        date: formatUnixTimestamp(timestamp),
        value: nextBaseValue !== null && nextLastValue !== null ? nextLastValue - nextBaseValue : null
      })

      return {
        points: state.points,
        baseValue: nextBaseValue,
        lastValue: nextLastValue
      }
    },
    {
      points: [],
      baseValue: null,
      lastValue: null
    }
  ).points
}

function buildSeriesFromPrecomputed(args: {
  series: TPortfolioVaultGrowthChartSeries[]
  timeframe: TPortfolioVaultGrowthChartTimeframe
  vaultOrder?: string[]
  maxVaults?: number
  indexBase: number
  colors: string[]
}): TTransformedSeries[] {
  const seriesByVaultKey = new Map(
    args.series.map((vaultSeries) => [getVaultKey(vaultSeries.vaultAddress), vaultSeries])
  )
  const orderedKeys = args.vaultOrder?.length
    ? args.vaultOrder.map(getVaultKey).filter((key) => seriesByVaultKey.has(key))
    : Array.from(seriesByVaultKey.keys())
  const limit = getTimeframeLimit(args.timeframe)

  const transformedSeries = orderedKeys.flatMap((vaultKey) => {
    const vaultSeries = seriesByVaultKey.get(vaultKey)
    if (!vaultSeries?.points.length) {
      return []
    }

    const sortedPoints = vaultSeries.points
      .map((point) => ({ ...point, timestamp: normalizeTimestamp(point.timestamp) }))
      .toSorted((left, right) => left.timestamp - right.timestamp)
    const points = !Number.isFinite(limit) || limit >= sortedPoints.length ? sortedPoints : sortedPoints.slice(-limit)
    if (!hasPrecomputedExposure(points)) {
      return []
    }

    return [
      {
        key: vaultKey,
        vaultAddress: vaultSeries.vaultAddress,
        label: vaultSeries.vaultName || vaultSeries.symbol || vaultSeries.vaultAddress,
        color: args.colors[0] ?? DEFAULT_COLORS[0],
        positionPoints: buildPrecomputedPositionPoints(points),
        indexPoints: buildPrecomputedIndexPoints(points, args.indexBase)
      }
    ]
  })

  return applySeriesPresentation(
    selectRelevantSeries({ series: transformedSeries, maxVaults: args.maxVaults, indexBase: args.indexBase }),
    args.colors
  )
}

function buildChartData(series: TTransformedSeries[], mode: TPortfolioVaultGrowthChartMode): TChartPoint[] {
  const timestamps = Array.from(
    new Set(
      series.flatMap((vaultSeries) =>
        (mode === 'position' ? vaultSeries.positionPoints : vaultSeries.indexPoints).map((point) => point.timestamp)
      )
    )
  ).toSorted((left, right) => left - right)

  return timestamps.map((timestamp) => {
    const row: TChartPoint = { timestamp, date: formatUnixTimestamp(timestamp) }

    series.forEach((vaultSeries) => {
      const points = mode === 'position' ? vaultSeries.positionPoints : vaultSeries.indexPoints
      row[vaultSeries.key] = points.find((point) => point.timestamp === timestamp)?.value ?? null
    })

    return row
  })
}

function formatPositionValue(value: number): string {
  const absolute = formatUSD(Math.abs(value), 2, 2)
  if (value > 0) {
    return `+${absolute}`
  }
  if (value < 0) {
    return `-${absolute}`
  }
  return absolute
}

function formatIndexValue(value: number): string {
  return value >= 1000 ? value.toFixed(0) : value >= 100 ? value.toFixed(1) : value.toFixed(2)
}

function formatPositionTick(value: number | string): string {
  const numericValue = Number(value)
  const absoluteValue = Math.abs(numericValue)
  if (absoluteValue >= 1_000_000) {
    return `${numericValue < 0 ? '-' : ''}$${(absoluteValue / 1_000_000).toFixed(1)}M`
  }
  if (absoluteValue >= 1_000) {
    return `${numericValue < 0 ? '-' : ''}$${(absoluteValue / 1_000).toFixed(1)}k`
  }
  return `${numericValue < 0 ? '-' : ''}$${absoluteValue.toFixed(0)}`
}

function formatIndexTick(value: number | string): string {
  const numericValue = Number(value)
  return Math.abs(numericValue) >= 1000 ? numericValue.toFixed(0) : numericValue.toFixed(1)
}

function PortfolioVaultGrowthTooltip({
  active,
  payload,
  mode,
  seriesLabels
}: TTooltipProps & {
  mode: TPortfolioVaultGrowthChartMode
  seriesLabels: Record<string, string>
}): ReactElement | null {
  if (!active || !payload?.length) {
    return null
  }

  const date = payload[0]?.payload?.date
  if (!date) {
    return null
  }

  const rows = payload
    .flatMap((entry) => {
      const dataKey = typeof entry.dataKey === 'string' ? entry.dataKey : ''
      const value = typeof entry.value === 'number' ? entry.value : Number(entry.value ?? NaN)

      if (!Number.isFinite(value)) {
        return []
      }

      return [
        {
          key: dataKey,
          label: seriesLabels[dataKey] ?? dataKey,
          value,
          color: typeof entry.color === 'string' ? entry.color : 'var(--color-text-primary)'
        }
      ]
    })
    .toSorted((left, right) => right.value - left.value)

  return (
    <div
      className={
        'pointer-events-none flex min-w-[13rem] flex-col gap-2 rounded-xl border border-border bg-surface px-3 py-3 shadow-xl'
      }
    >
      <span className={'text-xs font-medium uppercase tracking-[0.12em] text-text-tertiary'}>
        {formatChartTooltipDate(date)}
      </span>
      <div className={'flex flex-col gap-1.5'}>
        {rows.map((row) => (
          <div key={row.key} className={'flex items-center justify-between gap-3'}>
            <span className={'inline-flex items-center gap-2 text-xs text-text-secondary'}>
              <span className={'size-2 rounded-full'} style={{ backgroundColor: row.color }} />
              <span>{row.label}</span>
            </span>
            <span className={'text-sm font-semibold text-text-primary'}>
              {mode === 'position' ? formatPositionValue(row.value) : formatIndexValue(row.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function PortfolioVaultGrowthChart({
  points = [],
  series: precomputedSeries,
  mode,
  initialMode = 'position',
  onModeChange,
  timeframe = 'all',
  vaultOrder,
  maxVaults,
  indexBase = 100,
  colors = DEFAULT_COLORS,
  title = 'Vault Growth',
  height = 300,
  showModeToggle = true,
  className,
  emptyMessage = 'No vault growth history available'
}: TPortfolioVaultGrowthChartProps): ReactElement {
  const [uncontrolledMode, setUncontrolledMode] = useState<TPortfolioVaultGrowthChartMode>(initialMode)
  const activeMode = mode ?? uncontrolledMode
  const series = useMemo(() => {
    if (precomputedSeries) {
      return buildSeriesFromPrecomputed({
        series: precomputedSeries,
        timeframe,
        vaultOrder,
        maxVaults,
        indexBase,
        colors
      })
    }

    return buildSeries({ points, timeframe, vaultOrder, maxVaults, indexBase, colors })
  }, [colors, indexBase, maxVaults, points, precomputedSeries, timeframe, vaultOrder])
  const chartData = useMemo(() => buildChartData(series, activeMode), [activeMode, series])
  const chartConfig = useMemo<ChartConfig>(() => {
    return Object.fromEntries(
      series.map((vaultSeries) => [vaultSeries.key, { label: vaultSeries.label, color: vaultSeries.color }])
    )
  }, [series])
  const seriesLabels = useMemo<Record<string, string>>(() => {
    return Object.fromEntries(series.map((vaultSeries) => [vaultSeries.key, vaultSeries.label]))
  }, [series])
  const hasRenderableValue = chartData.some((point) =>
    series.some((vaultSeries) => typeof point[vaultSeries.key] === 'number' && Number.isFinite(point[vaultSeries.key]))
  )
  const isShortRange = timeframe === '30d' || chartData.length <= 45
  const ticks = isShortRange ? getChartWeeklyTicks(chartData) : getChartMonthlyTicks(chartData)
  const tickFormatter = isShortRange ? formatChartWeekLabel : formatChartMonthYearLabel

  const handleModeChange = (nextMode: TPortfolioVaultGrowthChartMode): void => {
    if (!mode) {
      setUncontrolledMode(nextMode)
    }
    onModeChange?.(nextMode)
  }

  return (
    <section className={cl('flex flex-col gap-3', className)}>
      {title || showModeToggle ? (
        <div className={'flex flex-col gap-2'}>
          <div className={'flex flex-col gap-2 md:flex-row md:items-center md:justify-between'}>
            {title ? <h3 className={'text-base font-semibold text-text-primary'}>{title}</h3> : null}
            {showModeToggle ? (
              <div className={cl('flex w-full items-center gap-0.5 md:w-auto md:gap-1', SELECTOR_BAR_STYLES.container)}>
                {(['position', 'index'] as const).map((nextMode) => (
                  <button
                    key={nextMode}
                    type={'button'}
                    onClick={() => handleModeChange(nextMode)}
                    className={cl(
                      'min-h-[36px] flex-1 rounded-sm px-3 py-2 text-xs font-semibold transition-all md:min-h-0 md:flex-initial md:py-1',
                      'active:scale-[0.98]',
                      SELECTOR_BAR_STYLES.buttonBase,
                      activeMode === nextMode ? SELECTOR_BAR_STYLES.buttonActive : SELECTOR_BAR_STYLES.buttonInactive
                    )}
                  >
                    {nextMode === 'position' ? 'Position' : 'Index'}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          {showModeToggle ? <p className={'text-xs text-text-secondary'}>{MODE_COPY[activeMode]}</p> : null}
        </div>
      ) : null}

      {!hasRenderableValue ? (
        <div
          className={
            'flex min-h-[240px] items-center justify-center rounded-xl border border-border/70 bg-surface-secondary/40'
          }
        >
          <p className={'text-sm text-text-secondary'}>{emptyMessage}</p>
        </div>
      ) : (
        <div style={{ height }}>
          <ChartContainer config={chartConfig} style={{ height: '100%', aspectRatio: 'unset' }}>
            <ComposedChart data={chartData} margin={CHART_WITH_AXES_MARGIN}>
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
                tickFormatter={activeMode === 'position' ? formatPositionTick : formatIndexTick}
                mirror
                width={CHART_Y_AXIS_WIDTH}
                tickMargin={CHART_Y_AXIS_TICK_MARGIN}
                tick={CHART_Y_AXIS_TICK_STYLE}
                axisLine={{ stroke: 'var(--chart-axis)' }}
                tickLine={{ stroke: 'var(--chart-axis)' }}
              />
              <ChartTooltip
                cursor={{ stroke: 'var(--chart-cursor-line)', strokeWidth: 1 }}
                content={(props) => (
                  <PortfolioVaultGrowthTooltip {...props} mode={activeMode} seriesLabels={seriesLabels} />
                )}
              />
              {series.map((vaultSeries) => (
                <Line
                  key={vaultSeries.key}
                  type={'monotone'}
                  dataKey={vaultSeries.key}
                  name={vaultSeries.label}
                  stroke={vaultSeries.color}
                  strokeWidth={2}
                  strokeOpacity={0.9}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 0, fill: vaultSeries.color }}
                  connectNulls
                  isAnimationActive={false}
                />
              ))}
            </ComposedChart>
          </ChartContainer>
        </div>
      )}
    </section>
  )
}
