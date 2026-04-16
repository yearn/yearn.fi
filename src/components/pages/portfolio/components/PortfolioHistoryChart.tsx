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
  getChartWeeklyTicks,
  getTimeframeLimit
} from '@pages/vaults/utils/charts'
import { IconSpinner } from '@shared/icons/IconSpinner'
import { cl, formatUSD } from '@shared/utils'
import type { ReactElement } from 'react'
import { useId, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { Area, CartesianGrid, ComposedChart, Line, XAxis, YAxis } from 'recharts'
import type { TPortfolioHistoryChartData, TPortfolioHistoryDenomination } from '../types/api'
import { PortfolioHistoryBreakdownModal } from './PortfolioHistoryBreakdownModal'

type TTimeframe = '30d' | '90d' | '1y'

type TPortfolioHistoryChartProps = {
  data: TPortfolioHistoryChartData | null
  denomination: TPortfolioHistoryDenomination
  onDenominationChange: (denomination: TPortfolioHistoryDenomination) => void
  isLoading: boolean
  isEmpty?: boolean
  error?: Error | null
  mergeWithHeader?: boolean
}

const EXAMPLE_PORTFOLIO_USD_DATA: TPortfolioHistoryChartData = [
  { date: '2025-05-01', value: 1800 },
  { date: '2025-06-01', value: 2600 },
  { date: '2025-07-01', value: 2450 },
  { date: '2025-08-01', value: 3900 },
  { date: '2025-09-01', value: 5100 },
  { date: '2025-10-01', value: 6800 },
  { date: '2025-11-01', value: 6400 },
  { date: '2025-12-01', value: 8900 },
  { date: '2026-01-01', value: 10450 },
  { date: '2026-02-01', value: 12100 },
  { date: '2026-03-01', value: 14800 },
  { date: '2026-04-01', value: 17250 }
]

type TPortfolioHistoryTooltipProps = {
  active?: boolean
  payload?: Array<{
    value?: unknown
    payload?: {
      date?: string
      value?: unknown
    }
  }>
  label?: string
}

type TActiveChartState = {
  activeLabel?: string | number
}

function formatHistoryValue(value: number, denomination: TPortfolioHistoryDenomination): string {
  if (denomination === 'eth') {
    return `${value.toFixed(value >= 100 ? 2 : value >= 1 ? 3 : 4)} ETH`
  }

  return formatUSD(value, 2, 2)
}

function PortfolioHistoryTooltip({
  active,
  payload,
  denomination
}: TPortfolioHistoryTooltipProps & { denomination: TPortfolioHistoryDenomination }): ReactElement | null {
  if (!active || !payload?.length) {
    return null
  }

  const point = payload[0]?.payload
  const date = point?.date
  const value = Number(payload[0]?.value ?? point?.value ?? 0)

  if (!date) {
    return null
  }

  return (
    <div
      className={
        'pointer-events-none flex min-w-[13rem] flex-col gap-2 rounded-xl border border-border bg-surface px-3 py-3 shadow-xl'
      }
    >
      <div className={'flex flex-col gap-0.5'}>
        <span className={'text-xs font-medium uppercase tracking-[0.12em] text-text-tertiary'}>
          {formatChartTooltipDate(date)}
        </span>
        <span className={'text-sm font-semibold text-text-primary'}>{formatHistoryValue(value, denomination)}</span>
      </div>
      <span className={'text-xs font-medium text-text-secondary'}>
        {value > 0 ? 'Click to see breakdown' : 'No breakdown available for this point'}
      </span>
    </div>
  )
}

export function PortfolioHistoryChart({
  data,
  denomination,
  onDenominationChange,
  isLoading,
  isEmpty = false,
  error,
  mergeWithHeader
}: TPortfolioHistoryChartProps): ReactElement {
  const [timeframe, setTimeframe] = useState<TTimeframe>('1y')
  const [hoveredBreakdownDate, setHoveredBreakdownDate] = useState<string | null>(null)
  const [selectedBreakdownDate, setSelectedBreakdownDate] = useState<string | null>(null)
  const [isBreakdownModalOpen, setIsBreakdownModalOpen] = useState(false)
  const gradientId = useId().replace(/:/g, '')

  const sectionClassName = mergeWithHeader
    ? 'flex flex-col gap-4 border-x border-border bg-surface p-6'
    : 'flex flex-col gap-4 rounded-lg border border-border bg-surface p-6'

  const filteredData = useMemo(() => {
    if (!data) {
      return []
    }
    const limit = getTimeframeLimit(timeframe)
    if (!Number.isFinite(limit) || limit >= data.length) {
      return data
    }
    return data.slice(-limit)
  }, [data, timeframe])

  const isShortTimeframe = timeframe === '30d'
  const ticks = useMemo(
    () => (isShortTimeframe ? getChartWeeklyTicks(filteredData) : getChartMonthlyTicks(filteredData)),
    [filteredData, isShortTimeframe]
  )
  const tickFormatter = isShortTimeframe ? formatChartWeekLabel : formatChartMonthYearLabel

  const formatValueTick = (value: number | string) => {
    const numericValue = Number(value)
    if (numericValue === 0) {
      return ''
    }

    if (denomination === 'eth') {
      if (numericValue >= 1_000) {
        return `${(numericValue / 1_000).toFixed(1)}k`
      }
      return numericValue >= 10 ? numericValue.toFixed(0) : numericValue.toFixed(2)
    }

    if (numericValue >= 1_000_000) {
      return `$${(numericValue / 1_000_000).toFixed(1)}M`
    }
    if (numericValue >= 1_000) {
      return `$${(numericValue / 1_000).toFixed(1)}k`
    }
    return `$${numericValue.toFixed(0)}`
  }

  const chartConfig = useMemo<ChartConfig>(() => {
    return {
      value: {
        label: denomination === 'eth' ? 'Total Value (ETH)' : 'Total Value (USD)',
        color: 'var(--chart-1)'
      }
    }
  }, [denomination])

  const exampleChartConfig = useMemo<ChartConfig>(() => {
    return {
      value: {
        label: denomination === 'eth' ? 'Example Value (ETH)' : 'Example Value (USD)',
        color: 'var(--color-neutral-400)'
      }
    }
  }, [denomination])

  const exampleData = useMemo<TPortfolioHistoryChartData>(
    () =>
      denomination === 'eth'
        ? EXAMPLE_PORTFOLIO_USD_DATA.map((point) => ({ ...point, value: point.value / 2500 }))
        : EXAMPLE_PORTFOLIO_USD_DATA,
    [denomination]
  )

  const openBreakdownModal = (date: string): void => {
    setSelectedBreakdownDate(date)
    setIsBreakdownModalOpen(true)
  }

  const closeBreakdownModal = (): void => {
    setIsBreakdownModalOpen(false)
  }

  const getBreakdownPoint = (date: string | null) => {
    if (!date) {
      return null
    }
    return filteredData.find((point) => point.date === date) ?? null
  }

  const handleChartMouseMove = (state: TActiveChartState | undefined): void => {
    const nextDate = typeof state?.activeLabel === 'string' ? state.activeLabel : null
    setHoveredBreakdownDate((currentDate) => (currentDate === nextDate ? currentDate : nextDate))
  }

  const handleChartMouseLeave = (): void => {
    setHoveredBreakdownDate(null)
  }

  const handleChartClick = (state?: TActiveChartState): void => {
    const clickedDate = typeof state?.activeLabel === 'string' ? state.activeLabel : hoveredBreakdownDate
    const selectedPoint = getBreakdownPoint(clickedDate)
    if (!selectedPoint || selectedPoint.value <= 0) {
      return
    }

    openBreakdownModal(selectedPoint.date)
  }

  const renderHeader = (showTimeframeControls = false): ReactElement => (
    <div className={'flex flex-col gap-3 md:flex-row md:items-center md:justify-between'}>
      <div className={'flex items-center justify-between gap-3'}>
        <h2 className={'text-xl font-semibold text-text-primary'}>{'Holdings History'}</h2>
        <div className={'flex rounded-lg border border-border bg-surface-secondary p-1'}>
          {(['usd', 'eth'] as const).map((nextDenomination) => (
            <button
              key={nextDenomination}
              type={'button'}
              onClick={() => onDenominationChange(nextDenomination)}
              className={cl(
                'min-h-[36px] rounded-md px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] transition-colors',
                denomination === nextDenomination
                  ? 'bg-surface text-text-primary'
                  : 'text-text-secondary hover:text-text-primary'
              )}
            >
              {nextDenomination}
            </button>
          ))}
        </div>
      </div>
      {showTimeframeControls ? (
        <div className={'flex gap-2 self-start md:self-auto'}>
          {(['30d', '90d', '1y'] as const).map((tf) => (
            <button
              key={tf}
              type={'button'}
              onClick={() => setTimeframe(tf)}
              className={cl(
                'min-h-[44px] rounded-lg border px-4 py-2 text-sm font-medium transition-colors',
                timeframe === tf
                  ? 'border-accent-500 bg-accent-500 text-white'
                  : 'border-border bg-surface text-text-secondary hover:border-accent-500 hover:text-accent-500'
              )}
            >
              {tf}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )

  if (isLoading) {
    return (
      <section className={sectionClassName}>
        {renderHeader()}
        <div className={'flex h-[300px] items-center justify-center'}>
          <IconSpinner className={'size-8 animate-spin text-text-secondary'} />
        </div>
      </section>
    )
  }

  if (error) {
    return (
      <section className={sectionClassName}>
        {renderHeader()}
        <div className={'flex h-[300px] items-center justify-center'}>
          <p className={'text-base text-text-secondary'}>Unable to load holdings history right now</p>
        </div>
      </section>
    )
  }

  if (isEmpty) {
    return (
      <section className={sectionClassName}>
        {renderHeader()}
        <div
          className={
            'relative h-[380px] overflow-hidden rounded-2xl border border-dashed border-border bg-surface-secondary sm:h-[320px]'
          }
        >
          <div className={'absolute inset-0 opacity-75'}>
            <ChartContainer config={exampleChartConfig} style={{ height: '100%', aspectRatio: 'unset' }}>
              <ComposedChart data={exampleData} margin={CHART_WITH_AXES_MARGIN}>
                <defs>
                  <linearGradient id={`${gradientId}-example`} x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-neutral-400)" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="var(--color-neutral-400)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} strokeDasharray={'4 6'} stroke={'var(--color-border)'} />
                <XAxis
                  dataKey={'date'}
                  ticks={getChartMonthlyTicks(exampleData)}
                  tickFormatter={formatChartMonthYearLabel}
                  tick={{ fill: 'var(--color-text-tertiary)' }}
                  axisLine={{ stroke: 'var(--color-border)' }}
                  tickLine={{ stroke: 'var(--color-border)' }}
                />
                <YAxis
                  domain={[0, 'auto']}
                  tickFormatter={formatValueTick}
                  mirror
                  width={CHART_Y_AXIS_WIDTH}
                  tickMargin={CHART_Y_AXIS_TICK_MARGIN}
                  tick={{ ...CHART_Y_AXIS_TICK_STYLE, fill: 'var(--color-text-tertiary)' }}
                  axisLine={{ stroke: 'var(--color-border)' }}
                  tickLine={{ stroke: 'var(--color-border)' }}
                />
                <Area
                  type={'monotone'}
                  dataKey={'value'}
                  stroke="none"
                  fill={`url(#${gradientId}-example)`}
                  fillOpacity={1}
                  isAnimationActive={false}
                />
                <Line
                  type={'monotone'}
                  dataKey={'value'}
                  stroke={'var(--color-neutral-400)'}
                  strokeWidth={2}
                  strokeDasharray={'6 6'}
                  dot={false}
                  isAnimationActive={false}
                />
              </ComposedChart>
            </ChartContainer>
          </div>
          <div className={'absolute inset-0 bg-linear-to-b from-surface/90 via-surface/55 to-surface/90'} />
          <div
            className={
              'absolute inset-y-0 left-0 w-[68%] bg-linear-to-r from-surface via-surface/78 to-transparent blur-2xl sm:w-[54%]'
            }
          />
          <div className={'relative z-10 flex h-full flex-col justify-between p-6 sm:p-7'}>
            <div className={'max-w-lg'}>
              <p className={'text-sm font-medium text-text-secondary'}>
                {'This is what your portfolio history can look like.'}
              </p>
              <h3 className={'mt-2 max-w-md text-2xl font-semibold tracking-tight text-text-primary sm:text-[2rem]'}>
                {'Your Yearn deposits, yield, and vault rotations will start drawing a story here.'}
              </h3>
              <p className={'mt-3 max-w-md text-sm leading-relaxed text-text-secondary sm:text-base'}>
                {
                  'Once you hold a Yearn vault, this chart will turn into a live timeline of your daily portfolio value.'
                }
              </p>
            </div>
            <div className={'flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between'}>
              <Link to={'/vaults'} className={'yearn--button--nextgen min-h-[44px] px-5'} data-variant={'filled'}>
                {'Explore Vaults'}
              </Link>
            </div>
          </div>
        </div>
      </section>
    )
  }

  if (!data || data.length === 0) {
    return (
      <section className={sectionClassName}>
        {renderHeader()}
        <div className={'flex h-[300px] items-center justify-center'}>
          <p className={'text-base text-text-secondary'}>No holdings history available</p>
        </div>
      </section>
    )
  }

  return (
    <section className={sectionClassName}>
      {renderHeader(true)}
      <div className={'h-[300px]'}>
        <ChartContainer
          config={chartConfig}
          style={{ height: '100%', aspectRatio: 'unset' }}
          className={getBreakdownPoint(hoveredBreakdownDate)?.value ? 'cursor-pointer' : undefined}
        >
          <ComposedChart
            data={filteredData}
            margin={CHART_WITH_AXES_MARGIN}
            onMouseMove={handleChartMouseMove}
            onMouseLeave={handleChartMouseLeave}
            onClick={handleChartClick}
          >
            <defs>
              <linearGradient id={`${gradientId}-holdings`} x1="0" x2="0" y1="0" y2="1">
                <stop offset="5%" stopColor="var(--color-value)" stopOpacity={0.5} />
                <stop offset="95%" stopColor="var(--color-value)" stopOpacity={0} />
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
              domain={[0, 'auto']}
              tickFormatter={formatValueTick}
              mirror
              width={CHART_Y_AXIS_WIDTH}
              tickMargin={CHART_Y_AXIS_TICK_MARGIN}
              tick={CHART_Y_AXIS_TICK_STYLE}
              axisLine={{ stroke: 'var(--chart-axis)' }}
              tickLine={{ stroke: 'var(--chart-axis)' }}
            />
            <ChartTooltip
              cursor={{ stroke: 'var(--chart-cursor-line)', strokeWidth: 1 }}
              content={(props) => <PortfolioHistoryTooltip {...props} denomination={denomination} />}
            />
            <Area
              type={'monotone'}
              dataKey={'value'}
              stroke="none"
              fill={`url(#${gradientId}-holdings)`}
              fillOpacity={1}
              connectNulls
              tooltipType={'none'}
              isAnimationActive={false}
            />
            <Line
              type={'monotone'}
              dataKey={'value'}
              stroke="var(--color-value)"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0, fill: 'var(--color-value)' }}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ChartContainer>
      </div>
      <PortfolioHistoryBreakdownModal
        date={selectedBreakdownDate}
        isOpen={isBreakdownModalOpen}
        onClose={closeBreakdownModal}
      />
    </section>
  )
}
