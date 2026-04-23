import type { TPortfolioAllocationScatterPoint } from '@pages/portfolio/hooks/usePortfolioModel'
import { ChartContainer, ChartTooltip } from '@pages/vaults/components/detail/charts/ChartPrimitives'
import { CHART_Y_AXIS_TICK_MARGIN, CHART_Y_AXIS_TICK_STYLE } from '@pages/vaults/components/detail/charts/chartLayout'
import { SUPPORTED_NETWORKS } from '@shared/utils'
import { cl, formatAllocationPercent, formatPercent, formatTvlDisplay, formatUSD } from '@shared/utils'
import type { ReactElement } from 'react'
import { useMemo } from 'react'
import { CartesianGrid, ReferenceLine, Scatter, ScatterChart, XAxis, YAxis } from 'recharts'
import { PORTFOLIO_VAULT_CHART_COLORS } from './portfolioChartColors'

type TVaultAllocationScatterProps = {
  points: TPortfolioAllocationScatterPoint[]
  embedded?: boolean
  height?: number
  className?: string
}

type TChartPoint = TPortfolioAllocationScatterPoint & {
  allocationPct: number
  metricPct: number
  bubbleRadius: number
  color: string
}

type TTooltipProps = {
  active?: boolean
  payload?: Array<{
    payload?: TChartPoint
  }>
  equalWeightPct: number
  medianMetricPct: number
}

type TBubbleShapeProps = {
  active?: boolean
  cx?: number
  cy?: number
  payload?: TChartPoint
}

const DEFAULT_Y_DOMAIN: [number, number] = [-5, 5]
const MIN_BUBBLE_RADIUS = 6
const MAX_BUBBLE_RADIUS = 22
const QUADRANT_HINT =
  'Upper-left points may be underallocated winners. Lower-right points may be oversized underperformers.'
const SCATTER_CHART_MARGIN = {
  top: 20,
  right: 28,
  left: 10,
  bottom: 20
} as const
const SCATTER_Y_AXIS_WIDTH = 38

function formatSnapshotTimestamp(timestamp: number): string {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(timestamp)
}

function getMetricValue(point: TPortfolioAllocationScatterPoint): number | null {
  const value = point.netApyPct
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function getMedian(values: number[]): number {
  if (values.length === 0) {
    return 0
  }

  const sorted = [...values].sort((left, right) => left - right)
  const middle = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2
  }
  return sorted[middle] ?? 0
}

function getMetricDomain(values: number[]): [number, number] {
  if (values.length === 0) {
    return DEFAULT_Y_DOMAIN
  }

  const min = Math.min(0, ...values)
  const max = Math.max(0, ...values)
  const span = max - min
  const padding = span > 0 ? Math.max(2, span * 0.12) : Math.max(5, Math.abs(max || min) * 0.2 || 5)

  return [min - padding, max + padding]
}

function getBubbleRadius(value: number, minValue: number, maxValue: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return MIN_BUBBLE_RADIUS
  }

  if (maxValue <= minValue) {
    return (MIN_BUBBLE_RADIUS + MAX_BUBBLE_RADIUS) / 2
  }

  const normalized = (value - minValue) / (maxValue - minValue)
  const bounded = Math.min(Math.max(normalized, 0), 1)
  return MIN_BUBBLE_RADIUS + Math.sqrt(bounded) * (MAX_BUBBLE_RADIUS - MIN_BUBBLE_RADIUS)
}

function getChainLabel(chainId: number): string {
  return SUPPORTED_NETWORKS.find((chain) => chain.id === chainId)?.name || `Chain ${chainId}`
}

function getInterpretation({
  allocationPct,
  metricPct,
  equalWeightPct,
  medianMetricPct
}: {
  allocationPct: number
  metricPct: number
  equalWeightPct: number
  medianMetricPct: number
}): string {
  const isUnderallocated = allocationPct < equalWeightPct
  const isOutperforming = metricPct > medianMetricPct

  if (isUnderallocated && isOutperforming) {
    return 'Potential underallocated winner'
  }
  if (!isUnderallocated && !isOutperforming) {
    return 'Potential oversized underperformer'
  }
  if (!isUnderallocated && isOutperforming) {
    return 'Large allocation with strong performance'
  }
  return 'Smaller allocation with weaker performance'
}

function BubbleShape({ cx, cy, payload, active }: TBubbleShapeProps): ReactElement {
  const radius = Number(payload?.bubbleRadius) || MIN_BUBBLE_RADIUS
  const color = payload?.color || PORTFOLIO_VAULT_CHART_COLORS[0]

  return (
    <circle
      cx={cx ?? 0}
      cy={cy ?? 0}
      r={radius}
      fill={color}
      fillOpacity={active ? 0.88 : 0.72}
      stroke={color}
      strokeWidth={active ? 2.5 : 1.5}
    />
  )
}

function ScatterTooltipContent({
  active,
  payload,
  equalWeightPct,
  medianMetricPct
}: TTooltipProps): ReactElement | null {
  const point = payload?.[0]?.payload
  if (!active || !point) {
    return null
  }

  return (
    <div
      className="grid min-w-[15rem] gap-2 rounded-lg px-3 py-2 text-xs"
      style={{
        backgroundColor: 'var(--chart-tooltip-bg)',
        border: '1px solid var(--chart-tooltip-border)',
        boxShadow: 'var(--chart-tooltip-shadow)'
      }}
    >
      <div className="grid gap-0.5">
        <p className="font-semibold text-text-primary">{point.vaultName}</p>
        <p className="text-text-secondary">{getChainLabel(point.chainId)}</p>
      </div>

      <div className="grid gap-1 text-text-secondary">
        <div className="flex items-center justify-between gap-4">
          <span>{'Allocation'}</span>
          <span className="font-mono font-medium tabular-nums text-text-primary">
            {formatAllocationPercent(point.allocationPct)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span>{'Net APY'}</span>
          <span className="font-mono font-medium tabular-nums text-text-primary">
            {formatPercent(point.metricPct, 0, 2, 10_000)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span>{'Current position'}</span>
          <span className="font-mono font-medium tabular-nums text-text-primary">
            {formatUSD(point.currentPositionUsd, 2, 2)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span>{'Vault TVL'}</span>
          <span className="font-mono font-medium tabular-nums text-text-primary">{formatTvlDisplay(point.tvlUsd)}</span>
        </div>
      </div>

      <p className="text-text-secondary">
        {getInterpretation({
          allocationPct: point.allocationPct,
          metricPct: point.metricPct,
          equalWeightPct,
          medianMetricPct
        })}
      </p>
    </div>
  )
}

export function VaultAllocationScatter({
  points,
  embedded = false,
  height = 360,
  className
}: TVaultAllocationScatterProps): ReactElement {
  const positivePoints = useMemo(
    () => points.filter((point) => Number.isFinite(point.currentPositionUsd) && point.currentPositionUsd > 0),
    [points]
  )

  const chartPoints = useMemo<TChartPoint[]>(() => {
    const scopedPoints = positivePoints
      .map((point) => {
        const metricPct = getMetricValue(point)
        if (metricPct === null) {
          return null
        }
        return point
      })
      .filter((point): point is TPortfolioAllocationScatterPoint => point !== null)

    const totalPortfolioUsd = scopedPoints.reduce((sum, point) => sum + point.currentPositionUsd, 0)
    const tvlValues = scopedPoints
      .map((point) => point.tvlUsd)
      .filter((value): value is number => Number.isFinite(value) && value > 0)
    const minTvl = tvlValues.length > 0 ? Math.min(...tvlValues) : 0
    const maxTvl = tvlValues.length > 0 ? Math.max(...tvlValues) : 0

    return scopedPoints
      .toSorted((left, right) => right.currentPositionUsd - left.currentPositionUsd)
      .map((point, index) => {
        const allocationPct = totalPortfolioUsd > 0 ? (point.currentPositionUsd / totalPortfolioUsd) * 100 : 0
        const metricPct = getMetricValue(point) ?? 0

        return {
          ...point,
          allocationPct,
          metricPct,
          bubbleRadius: getBubbleRadius(point.tvlUsd, minTvl, maxTvl),
          color: PORTFOLIO_VAULT_CHART_COLORS[index % PORTFOLIO_VAULT_CHART_COLORS.length]
        }
      })
  }, [positivePoints])

  const hiddenCount = positivePoints.length - chartPoints.length
  const metricValues = chartPoints.map((point) => point.metricPct)
  const metricDomain = useMemo(() => getMetricDomain(metricValues), [metricValues])
  const equalWeightPct = chartPoints.length > 0 ? 100 / chartPoints.length : 0
  const medianMetricPct = useMemo(() => getMedian(metricValues), [metricValues])
  const asOfTimestamp = chartPoints[0]?.asOfTimestamp ?? Date.now()
  const metricLabel = 'Net APY'

  const rootClassName = embedded
    ? cl('flex h-full flex-col gap-3 pt-1', className)
    : cl('overflow-hidden rounded-xl border border-border bg-surface shadow-[0_1px_0_rgba(15,23,42,0.02)]', className)

  return (
    <section className={rootClassName}>
      <div className={embedded ? 'flex flex-col gap-3' : 'flex flex-col gap-4 px-5 py-4 md:px-6 md:py-5'}>
        {!embedded ? (
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="flex flex-col gap-1">
              <h3 className="text-lg font-semibold text-text-primary md:text-xl">{'Allocation vs Performance'}</h3>
              {chartPoints.length > 1 ? <p className="text-xs text-text-secondary">{QUADRANT_HINT}</p> : null}
              <p className="max-w-2xl text-sm text-text-secondary">
                {'Compare current portfolio weight against vault performance. Bubble size reflects vault TVL.'}
              </p>
              <p className="text-xs text-text-secondary">{`As of ${formatSnapshotTimestamp(asOfTimestamp)}`}</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {chartPoints.length > 1 ? <p className="text-xs text-text-secondary">{QUADRANT_HINT}</p> : null}
            <p className="text-sm text-text-secondary">
              {'Current allocation vs vault Net APY. Bubble size reflects vault TVL.'}
            </p>
            <p className="text-xs text-text-secondary">{`As of ${formatSnapshotTimestamp(asOfTimestamp)}`}</p>
          </div>
        )}

        {hiddenCount > 0 ? (
          <p className="text-xs text-text-secondary">
            {`${hiddenCount} vault${hiddenCount === 1 ? '' : 's'} hidden without ${metricLabel} data.`}
          </p>
        ) : null}

        {chartPoints.length === 0 ? (
          <div className="flex h-[360px] items-center justify-center rounded-lg border border-dashed border-border bg-surface-secondary/40 px-6 text-center text-sm text-text-secondary">
            {`No visible vaults have ${metricLabel} data.`}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="w-full" style={{ height: `${height}px` }}>
              <ChartContainer className="h-full w-full !aspect-auto" config={{ scatter: { label: metricLabel } }}>
                <ScatterChart margin={SCATTER_CHART_MARGIN}>
                  <CartesianGrid vertical={false} />
                  {chartPoints.length > 1 ? (
                    <>
                      <ReferenceLine
                        x={equalWeightPct}
                        stroke="var(--chart-grid)"
                        strokeDasharray="4 4"
                        ifOverflow="extendDomain"
                      />
                      <ReferenceLine
                        y={medianMetricPct}
                        stroke="var(--chart-grid)"
                        strokeDasharray="4 4"
                        ifOverflow="extendDomain"
                      />
                    </>
                  ) : null}
                  <XAxis
                    type="number"
                    dataKey="allocationPct"
                    domain={[0, 100]}
                    padding={{ left: 0, right: 14 }}
                    tickFormatter={(value: number | string) => formatAllocationPercent(Number(value))}
                    tickLine={false}
                    axisLine={false}
                    tickMargin={CHART_Y_AXIS_TICK_MARGIN}
                    tick={CHART_Y_AXIS_TICK_STYLE}
                    label={{
                      value: 'Allocation (%)',
                      position: 'insideBottom',
                      offset: -4,
                      fill: 'var(--chart-axis)'
                    }}
                  />
                  <YAxis
                    type="number"
                    dataKey="metricPct"
                    domain={metricDomain}
                    width={SCATTER_Y_AXIS_WIDTH}
                    tickFormatter={(value: number | string) => formatPercent(Number(value), 0, 1, 10_000)}
                    tickLine={false}
                    axisLine={false}
                    tickMargin={CHART_Y_AXIS_TICK_MARGIN}
                    tick={CHART_Y_AXIS_TICK_STYLE}
                    label={{
                      value: `${metricLabel} (%)`,
                      angle: -90,
                      position: 'insideLeft',
                      offset: 6,
                      fill: 'var(--chart-axis)'
                    }}
                  />
                  <ChartTooltip
                    cursor={false}
                    content={
                      <ScatterTooltipContent equalWeightPct={equalWeightPct} medianMetricPct={medianMetricPct} />
                    }
                  />
                  <Scatter data={chartPoints} shape={<BubbleShape />} activeShape={<BubbleShape />} />
                </ScatterChart>
              </ChartContainer>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
