import type { TVaultUserHistoryChartData } from '@pages/vaults/types/charts'
import {
  formatChartMonthYearLabel,
  formatChartTooltipDate,
  formatChartWeekLabel,
  getChartMonthlyTicks,
  getChartWeeklyTicks,
  getTimeframeLimit
} from '@pages/vaults/utils/charts'
import { useChartStyle } from '@shared/contexts/useChartStyle'
import { useId, useMemo } from 'react'
import { Area, CartesianGrid, ComposedChart, Line, XAxis, YAxis } from 'recharts'
import type { ChartConfig } from './ChartPrimitives'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from './ChartPrimitives'
import {
  CHART_TOOLTIP_WRAPPER_STYLE,
  CHART_WITH_AXES_MARGIN,
  CHART_Y_AXIS_TICK_MARGIN,
  CHART_Y_AXIS_TICK_STYLE,
  CHART_Y_AXIS_WIDTH
} from './chartLayout'

type TVaultTvlGrowthChartProps = {
  balanceData?: TVaultUserHistoryChartData | null
  growthData?: TVaultUserHistoryChartData | null
  timeframe: string
  unitLabel: string
}

type TMergedChartPoint = {
  date: string
  balance: number | null
  growth: number | null
}

type TTooltipPayloadItem = {
  dataKey?: string | number
  name?: string | number
}

function dedupeTooltipPayload<T extends TTooltipPayloadItem>(payload?: ReadonlyArray<T>): T[] {
  if (!payload?.length) {
    return []
  }

  const deduped = new Map<string, T>()
  for (const item of payload) {
    const key = String(item.dataKey ?? item.name ?? 'value')
    deduped.set(key, item)
  }

  return Array.from(deduped.values())
}

function formatUnitAxisValue(value: number): string {
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

function formatUnitTooltipValue(value: number, unitLabel: string, signed = false): string {
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

export function VaultTvlGrowthChart({ balanceData, growthData, timeframe, unitLabel }: TVaultTvlGrowthChartProps) {
  const gradientId = useId().replace(/:/g, '')
  const { chartStyle } = useChartStyle()
  const isPowerglove = chartStyle === 'powerglove'
  const isBlended = chartStyle === 'blended'
  const mergedData = useMemo<Array<TMergedChartPoint>>(() => {
    const sourceData = balanceData ?? growthData ?? []
    const growthByDate = new Map((growthData ?? []).map((point) => [point.date, point.value ?? null]))

    return sourceData.map((point) => ({
      date: point.date,
      balance: point.value ?? null,
      growth: growthByDate.get(point.date) ?? null
    }))
  }, [balanceData, growthData])
  const filteredData = useMemo(() => {
    const limit = getTimeframeLimit(timeframe)
    if (!Number.isFinite(limit) || limit >= mergedData.length) {
      return mergedData
    }
    return mergedData.slice(-limit)
  }, [mergedData, timeframe])
  const isShortTimeframe = timeframe === '30d' || timeframe === '90d'
  const ticks = useMemo(
    () => (isShortTimeframe ? getChartWeeklyTicks(filteredData) : getChartMonthlyTicks(filteredData)),
    [filteredData, isShortTimeframe]
  )
  const tickFormatter = isShortTimeframe ? formatChartWeekLabel : formatChartMonthYearLabel
  const hasGrowthSeries = filteredData.some((point) => Number.isFinite(point.growth ?? NaN))

  const chartConfig = useMemo<ChartConfig>(
    () => ({
      balance: {
        label: 'Your Balance',
        color: 'var(--chart-1)'
      },
      growth: {
        label: 'Your Growth',
        color: 'var(--chart-1)'
      }
    }),
    []
  )

  const chartTooltip = (
    <ChartTooltip
      content={({ active, payload, label }) => (
        <ChartTooltipContent
          active={active}
          payload={dedupeTooltipPayload(payload)}
          label={label}
          indicator={'line'}
          formatter={(value, name) => (
            <div className={'flex w-full items-center justify-between gap-3'} key={`${String(name)}-${String(value)}`}>
              <div className={'flex items-center gap-2'}>
                <svg className={'shrink-0'} width={'14'} height={'6'} viewBox={'0 0 14 6'} aria-hidden={true}>
                  <line
                    x1={'0'}
                    y1={'3'}
                    x2={'14'}
                    y2={'3'}
                    stroke={name === 'growth' ? 'var(--color-growth)' : 'var(--color-balance)'}
                    strokeWidth={'2'}
                    strokeDasharray={name === 'growth' ? '4 3' : undefined}
                    strokeLinecap={'round'}
                  />
                </svg>
                <span className={'text-text-secondary'}>{name === 'growth' ? 'Your Growth' : 'Your Balance'}</span>
              </div>
              <span className={'font-mono font-medium tabular-nums text-text-primary'}>
                {name === 'growth'
                  ? formatUnitTooltipValue(Number(value ?? 0), unitLabel, true)
                  : formatUnitTooltipValue(Number(value ?? 0), unitLabel)}
              </span>
            </div>
          )}
          labelFormatter={(tooltipLabel) => formatChartTooltipDate(String(tooltipLabel ?? ''))}
        />
      )}
      wrapperStyle={CHART_TOOLTIP_WRAPPER_STYLE}
    />
  )

  if (isPowerglove || isBlended) {
    return (
      <ChartContainer config={chartConfig} style={{ height: 'inherit' }}>
        <ComposedChart data={filteredData} margin={CHART_WITH_AXES_MARGIN}>
          <CartesianGrid vertical={false} />
          <defs>
            <linearGradient id={`${gradientId}-balance`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="5%" stopColor="var(--color-balance)" stopOpacity={0.5} />
              <stop offset="95%" stopColor="var(--color-balance)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey={'date'}
            ticks={ticks}
            tickFormatter={tickFormatter}
            tick={{ fill: 'var(--chart-axis)' }}
            axisLine={{ stroke: 'var(--chart-axis)' }}
            tickLine={{ stroke: 'var(--chart-axis)' }}
          />
          <YAxis
            yAxisId={'balance'}
            domain={['auto', 'auto']}
            tickFormatter={(value: number | string) => formatUnitAxisValue(Number(value))}
            mirror
            width={CHART_Y_AXIS_WIDTH}
            tickMargin={CHART_Y_AXIS_TICK_MARGIN}
            tick={CHART_Y_AXIS_TICK_STYLE}
            axisLine={{ stroke: 'var(--chart-axis)' }}
            tickLine={{ stroke: 'var(--chart-axis)' }}
          />
          {hasGrowthSeries ? (
            <YAxis
              yAxisId={'growth'}
              domain={['auto', 'auto']}
              tickFormatter={(value: number | string) => formatUnitAxisValue(Number(value))}
              width={CHART_Y_AXIS_WIDTH}
              tickMargin={CHART_Y_AXIS_TICK_MARGIN}
              tick={{
                ...CHART_Y_AXIS_TICK_STYLE,
                textAnchor: 'end',
                dx: -6
              }}
              axisLine={{ stroke: 'var(--chart-axis)' }}
              tickLine={{ stroke: 'var(--chart-axis)' }}
            />
          ) : null}
          {chartTooltip}
          <Area
            yAxisId={'balance'}
            type={'monotone'}
            dataKey={'balance'}
            stroke="none"
            fill={`url(#${gradientId}-balance)`}
            fillOpacity={1}
            connectNulls
            tooltipType={'none'}
            isAnimationActive={false}
          />
          <Line
            yAxisId={'balance'}
            type={'monotone'}
            dataKey={'balance'}
            stroke="var(--color-balance)"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
            connectNulls
          />
          {hasGrowthSeries ? (
            <Line
              yAxisId={'growth'}
              type={'monotone'}
              dataKey={'growth'}
              stroke="var(--color-growth)"
              strokeWidth={2}
              strokeDasharray={'6 6'}
              dot={false}
              isAnimationActive={false}
              connectNulls
            />
          ) : null}
        </ComposedChart>
      </ChartContainer>
    )
  }

  return (
    <ChartContainer config={chartConfig} style={{ height: 'inherit' }}>
      <ComposedChart data={filteredData} margin={CHART_WITH_AXES_MARGIN}>
        <defs>
          <linearGradient id={`${gradientId}-balance`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="5%" stopColor="var(--color-balance)" stopOpacity={0.4} />
            <stop offset="95%" stopColor="var(--color-balance)" stopOpacity={0} />
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
        {hasGrowthSeries ? (
          <YAxis
            yAxisId={'growth'}
            domain={['auto', 'auto']}
            tickFormatter={(value: number | string) => formatUnitAxisValue(Number(value))}
            width={CHART_Y_AXIS_WIDTH}
            tickMargin={CHART_Y_AXIS_TICK_MARGIN}
            tick={{
              ...CHART_Y_AXIS_TICK_STYLE,
              textAnchor: 'end',
              dx: -6
            }}
            axisLine={{ stroke: 'var(--chart-axis)' }}
            tickLine={{ stroke: 'var(--chart-axis)' }}
          />
        ) : null}
        <YAxis
          yAxisId={'balance'}
          orientation={'right'}
          mirror
          domain={['auto', 'auto']}
          tickFormatter={(value: number | string) => formatUnitAxisValue(Number(value))}
          width={CHART_Y_AXIS_WIDTH}
          tickMargin={CHART_Y_AXIS_TICK_MARGIN}
          tick={CHART_Y_AXIS_TICK_STYLE}
          axisLine={{ stroke: 'var(--chart-axis)' }}
          tickLine={{ stroke: 'var(--chart-axis)' }}
        />
        {chartTooltip}
        <Area
          yAxisId={'balance'}
          type={'monotone'}
          dataKey={'balance'}
          stroke="none"
          fill={`url(#${gradientId}-balance)`}
          fillOpacity={1}
          connectNulls
          tooltipType={'none'}
          isAnimationActive={false}
        />
        <Line
          yAxisId={'balance'}
          type={'monotone'}
          dataKey={'balance'}
          stroke="var(--color-balance)"
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
          connectNulls
        />
        {hasGrowthSeries ? (
          <Line
            yAxisId={'growth'}
            type={'monotone'}
            dataKey={'growth'}
            stroke="var(--color-growth)"
            strokeWidth={2}
            strokeDasharray={'6 6'}
            dot={false}
            isAnimationActive={false}
            connectNulls
          />
        ) : null}
      </ComposedChart>
    </ChartContainer>
  )
}
