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
import { cl } from '@shared/utils'
import type { ReactElement } from 'react'
import { useId, useMemo, useState } from 'react'
import { Area, CartesianGrid, ComposedChart, Line, XAxis, YAxis } from 'recharts'
import type { TPortfolioHistoryChartData } from '../types/api'

type TTimeframe = '30d' | '90d' | '1y'

type TPortfolioHistoryChartProps = {
  data: TPortfolioHistoryChartData | null
  isLoading: boolean
  mergeWithHeader?: boolean
}

export function PortfolioHistoryChart({ data, isLoading, mergeWithHeader }: TPortfolioHistoryChartProps): ReactElement {
  const [timeframe, setTimeframe] = useState<TTimeframe>('1y')
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
      totalUsdValue: {
        label: 'Total Value',
        color: 'var(--chart-1)'
      }
    }
  }, [])

  if (isLoading) {
    return (
      <section className={sectionClassName}>
        <div className={'flex items-center justify-between'}>
          <h2 className={'text-xl font-semibold text-text-primary'}>Holdings History</h2>
        </div>
        <div className={'flex h-[300px] items-center justify-center'}>
          <IconSpinner className={'size-8 animate-spin text-text-secondary'} />
        </div>
      </section>
    )
  }

  if (!data || data.length === 0) {
    return (
      <section className={sectionClassName}>
        <div className={'flex items-center justify-between'}>
          <h2 className={'text-xl font-semibold text-text-primary'}>Holdings History</h2>
        </div>
        <div className={'flex h-[300px] items-center justify-center'}>
          <p className={'text-base text-text-secondary'}>No holdings history available</p>
        </div>
      </section>
    )
  }

  return (
    <section className={sectionClassName}>
      <div className={'flex items-center justify-between'}>
        <h2 className={'text-xl font-semibold text-text-primary'}>Holdings History</h2>
        <div className={'flex gap-2'}>
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
      </div>
      <div className={'h-[300px]'}>
        <ChartContainer config={chartConfig} style={{ height: '100%', aspectRatio: 'unset' }}>
          <ComposedChart data={filteredData} margin={CHART_WITH_AXES_MARGIN}>
            <defs>
              <linearGradient id={`${gradientId}-holdings`} x1="0" x2="0" y1="0" y2="1">
                <stop offset="5%" stopColor="var(--color-totalUsdValue)" stopOpacity={0.5} />
                <stop offset="95%" stopColor="var(--color-totalUsdValue)" stopOpacity={0} />
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
              formatter={(value: number) => [
                `$${value.toLocaleString(undefined, {
                  maximumFractionDigits: 2,
                  minimumFractionDigits: 2
                })}`,
                'Total Value'
              ]}
              labelFormatter={formatChartTooltipDate}
              contentStyle={{
                backgroundColor: 'var(--chart-tooltip-bg)',
                borderRadius: 'var(--chart-tooltip-radius)',
                border: '1px solid var(--chart-tooltip-border)',
                boxShadow: 'var(--chart-tooltip-shadow)'
              }}
            />
            <Area
              type={'monotone'}
              dataKey={'totalUsdValue'}
              stroke="none"
              fill={`url(#${gradientId}-holdings)`}
              fillOpacity={1}
              connectNulls
              tooltipType={'none'}
              isAnimationActive={false}
            />
            <Line
              type={'monotone'}
              dataKey={'totalUsdValue'}
              stroke="var(--color-totalUsdValue)"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ChartContainer>
      </div>
    </section>
  )
}
