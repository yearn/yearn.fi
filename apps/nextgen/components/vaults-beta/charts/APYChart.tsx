import type { TAprApyChartData } from '@nextgen/types/charts'
import { getTimeframeLimit } from '@nextgen/utils/charts'
import { useMemo, useState } from 'react'
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts'
import type { ChartConfig } from './ChartPrimitives'
import { ChartContainer, ChartTooltip } from './ChartPrimitives'

type SeriesKey = 'derivedApy' | 'sevenDayApy' | 'thirtyDayApy'

const SERIES_META: Record<SeriesKey, { chartLabel: string; legendLabel: string; color: string }> = {
  derivedApy: {
    chartLabel: '1-day APY %',
    legendLabel: '1-day APY',
    color: 'var(--chart-4)'
  },
  sevenDayApy: {
    chartLabel: '7-day APY %',
    legendLabel: '7-day APY',
    color: 'var(--chart-3)'
  },
  thirtyDayApy: {
    chartLabel: '30-day APY %',
    legendLabel: '30-day APY',
    color: 'var(--chart-2)'
  }
}

const SERIES_ORDER: SeriesKey[] = ['derivedApy', 'sevenDayApy', 'thirtyDayApy']

type APYChartProps = {
  chartData: TAprApyChartData
  timeframe: string
  hideAxes?: boolean
  hideTooltip?: boolean
  defaultVisibleSeries?: Partial<Record<SeriesKey, boolean>>
}

export function APYChart({ chartData, timeframe, hideAxes, hideTooltip, defaultVisibleSeries }: APYChartProps) {
  const [visibleSeries, setVisibleSeries] = useState<Record<SeriesKey, boolean>>({
    derivedApy: defaultVisibleSeries?.derivedApy ?? true,
    sevenDayApy: defaultVisibleSeries?.sevenDayApy ?? true,
    thirtyDayApy: defaultVisibleSeries?.thirtyDayApy ?? true
  })

  const filteredData = useMemo(() => {
    const limit = getTimeframeLimit(timeframe)
    if (!Number.isFinite(limit) || limit >= chartData.length) {
      return chartData
    }
    return chartData.slice(-limit)
  }, [chartData, timeframe])

  const chartConfig = useMemo<ChartConfig>(() => {
    return Object.entries(SERIES_META).reduce((acc, [key, meta]) => {
      acc[key] = {
        label: meta.chartLabel,
        color: hideAxes ? 'black' : meta.color
      }
      return acc
    }, {} as ChartConfig)
  }, [hideAxes])

  const formatSeriesLabel = (series: string) => SERIES_META[series as SeriesKey]?.legendLabel || series

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
            tick={
              hideAxes
                ? false
                : {
                    fill: 'var(--muted-foreground, #6b7280)'
                  }
            }
            axisLine={hideAxes ? false : { stroke: 'var(--muted-foreground, #6b7280)' }}
            tickLine={hideAxes ? false : { stroke: 'var(--muted-foreground, #6b7280)' }}
          />
          <YAxis
            domain={[0, 'auto']}
            tickFormatter={(value) => `${value}%`}
            label={
              hideAxes
                ? undefined
                : {
                    value: 'Annualized %',
                    angle: -90,
                    position: 'insideLeft',
                    offset: 10,
                    style: {
                      textAnchor: 'middle',
                      fill: hideAxes ? 'transparent' : 'var(--muted-foreground, #6b7280)'
                    }
                  }
            }
            tick={
              hideAxes
                ? false
                : {
                    fill: 'var(--muted-foreground, #6b7280)'
                  }
            }
            axisLine={hideAxes ? false : { stroke: 'var(--muted-foreground, #6b7280)' }}
            tickLine={hideAxes ? false : { stroke: 'var(--muted-foreground, #6b7280)' }}
          />
          {!hideTooltip && (
            <ChartTooltip
              formatter={(value: number, name: string) => {
                return [`${(value ?? 0).toFixed(2)}%`, formatSeriesLabel(name)]
              }}
              contentStyle={{ borderRadius: '12px', border: '1px solid rgba(0,0,0,0.08)' }}
            />
          )}
          {visibleSeries.sevenDayApy && (
            <Line
              type={'monotone'}
              dataKey={'sevenDayApy'}
              stroke={'var(--color-sevenDayApy)'}
              strokeWidth={hideAxes ? 1 : 1.5}
              dot={false}
              isAnimationActive={false}
            />
          )}
          {visibleSeries.thirtyDayApy && (
            <Line
              type={'monotone'}
              dataKey={'thirtyDayApy'}
              stroke={'var(--color-thirtyDayApy)'}
              strokeWidth={hideAxes ? 1 : 1.5}
              dot={false}
              isAnimationActive={false}
            />
          )}
          {visibleSeries.derivedApy && (
            <Line
              type={'monotone'}
              dataKey={'derivedApy'}
              stroke={'var(--color-derivedApy)'}
              strokeWidth={hideAxes ? 1 : 1}
              dot={false}
              isAnimationActive={false}
            />
          )}
        </LineChart>
      </ChartContainer>
      {!hideAxes && (
        <div className={'absolute inset-x-0 bottom-[-1rem] flex justify-center'}>
          <div
            className={
              'flex flex-wrap items-center gap-4 rounded-full border border-neutral-200 bg-white/90 px-4 py-2 text-[10px] uppercase tracking-wide'
            }
          >
            {SERIES_ORDER.map((seriesKey) => (
              <label key={seriesKey} className={'flex items-center gap-2 cursor-pointer select-none'}>
                <input
                  type={'checkbox'}
                  className={'h-3 w-3 rounded border border-neutral-400 text-neutral-800 focus:ring-0'}
                  checked={visibleSeries[seriesKey]}
                  onChange={(event) =>
                    setVisibleSeries((prev) => ({
                      ...prev,
                      [seriesKey]: event.target.checked
                    }))
                  }
                />
                <span className={'text-neutral-600'}>{SERIES_META[seriesKey].legendLabel}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
