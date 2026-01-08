import { useChartStyle } from '@lib/contexts/useChartStyle'
import type { TAprApyChartData } from '@nextgen/types/charts'
import {
  formatChartMonthYearLabel,
  formatChartTooltipDate,
  formatChartWeekLabel,
  getChartMonthlyTicks,
  getChartWeeklyTicks,
  getTimeframeLimit
} from '@nextgen/utils/charts'
import { useId, useMemo } from 'react'
import { Area, CartesianGrid, ComposedChart, Line, LineChart, XAxis, YAxis } from 'recharts'
import type { ChartConfig } from './ChartPrimitives'
import { ChartContainer, ChartTooltip } from './ChartPrimitives'

const formatPercentTick = (value: number | string) => (Number(value) === 0 ? '' : `${value}%`)

type ThirtyDayAPYChartProps = {
  chartData: TAprApyChartData
  timeframe: string
  hideTooltip?: boolean
}

export function ThirtyDayAPYChart({ chartData, timeframe, hideTooltip }: ThirtyDayAPYChartProps) {
  const gradientId = useId().replace(/:/g, '')
  const { chartStyle } = useChartStyle()
  const isPowerglove = chartStyle === 'powerglove'
  const isBlended = chartStyle === 'blended'
  const filteredData = useMemo(() => {
    const limit = getTimeframeLimit(timeframe)
    if (!Number.isFinite(limit) || limit >= chartData.length) {
      return chartData
    }
    return chartData.slice(-limit)
  }, [chartData, timeframe])
  const isShortTimeframe = timeframe === '30d' || timeframe === '90d'
  const ticks = useMemo(
    () => (isShortTimeframe ? getChartWeeklyTicks(filteredData, true) : getChartMonthlyTicks(filteredData, true)),
    [filteredData, isShortTimeframe]
  )
  const tickFormatter = isShortTimeframe ? formatChartWeekLabel : formatChartMonthYearLabel

  const chartConfig = useMemo<ChartConfig>(() => {
    return {
      thirtyDayApy: {
        label: '30-Day APY %',
        color: 'var(--chart-1)'
      }
    }
  }, [])

  if (isPowerglove) {
    return (
      <div className={'relative h-full'}>
        <ChartContainer config={chartConfig} style={{ height: 'inherit' }}>
          <LineChart
            data={filteredData}
            margin={{
              top: 20,
              right: 30,
              left: 10,
              bottom: 20
            }}
          >
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
              tickFormatter={formatPercentTick}
              tick={{ fill: 'var(--chart-axis)' }}
              axisLine={{ stroke: 'var(--chart-axis)' }}
              tickLine={{ stroke: 'var(--chart-axis)' }}
            />
            {!hideTooltip && (
              <ChartTooltip
                formatter={(value: number) => {
                  return [`${(value ?? 0).toFixed(2)}%`, '30-Day APY']
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
              dataKey={'thirtyDayApy'}
              stroke={'var(--color-thirtyDayApy)'}
              strokeWidth={1.5}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ChartContainer>
      </div>
    )
  }

  if (isBlended) {
    return (
      <div className={'relative h-full'}>
        <ChartContainer config={chartConfig} style={{ height: 'inherit' }}>
          <ComposedChart
            data={filteredData}
            margin={{
              top: 20,
              right: 30,
              left: 10,
              bottom: 20
            }}
          >
            <CartesianGrid vertical={false} />
            <defs>
              <linearGradient id={`${gradientId}-thirty-day-apy`} x1="0" x2="0" y1="0" y2="1">
                <stop offset="5%" stopColor="var(--color-thirtyDayApy)" stopOpacity={0.5} />
                <stop offset="95%" stopColor="var(--color-thirtyDayApy)" stopOpacity={0} />
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
              domain={[0, 'auto']}
              tickFormatter={formatPercentTick}
              tick={{ fill: 'var(--chart-axis)' }}
              axisLine={{ stroke: 'var(--chart-axis)' }}
              tickLine={{ stroke: 'var(--chart-axis)' }}
            />
            <Area
              type={'monotone'}
              dataKey={'thirtyDayApy'}
              stroke="none"
              fill={`url(#${gradientId}-thirty-day-apy)`}
              fillOpacity={1}
              connectNulls
              tooltipType={'none'}
              isAnimationActive={false}
            />
            {!hideTooltip && (
              <ChartTooltip
                formatter={(value: number) => {
                  return [`${(value ?? 0).toFixed(2)}%`, '30-Day APY']
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
              dataKey={'thirtyDayApy'}
              stroke={'var(--color-thirtyDayApy)'}
              strokeWidth={1.5}
              dot={false}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ChartContainer>
      </div>
    )
  }

  return (
    <div className={'relative h-full'}>
      <ChartContainer config={chartConfig} style={{ height: 'inherit' }}>
        <ComposedChart
          data={filteredData}
          margin={{
            top: 10,
            right: 0,
            left: 0,
            bottom: 0
          }}
        >
          <defs>
            <linearGradient id={`${gradientId}-thirty-day-apy`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="5%" stopColor="var(--color-thirtyDayApy)" stopOpacity={0.5} />
              <stop offset="95%" stopColor="var(--color-thirtyDayApy)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey={'date'} hide />
          <YAxis domain={[0, 'auto']} hide />
          <Area
            type={'monotone'}
            dataKey={'thirtyDayApy'}
            stroke="none"
            fill={`url(#${gradientId}-thirty-day-apy)`}
            fillOpacity={1}
            connectNulls
            tooltipType={'none'}
            isAnimationActive={false}
          />
          {!hideTooltip && (
            <ChartTooltip
              formatter={(value: number) => {
                return [`${(value ?? 0).toFixed(2)}%`, '30-Day APY']
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
            dataKey={'thirtyDayApy'}
            stroke={'var(--color-thirtyDayApy)'}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ChartContainer>
    </div>
  )
}
