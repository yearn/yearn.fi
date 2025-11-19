import type { TTvlChartData } from '@nextgen/types/charts'
import { getTimeframeLimit } from '@nextgen/utils/charts'
import { useMemo } from 'react'
import { Bar, CartesianGrid, ComposedChart, XAxis, YAxis } from 'recharts'
import type { ChartConfig } from './ChartPrimitives'
import { ChartContainer, ChartTooltip } from './ChartPrimitives'

type TVLChartProps = {
  chartData: TTvlChartData
  timeframe: string
  hideAxes?: boolean
  hideTooltip?: boolean
}

export function TVLChart({ chartData, timeframe, hideAxes, hideTooltip }: TVLChartProps) {
  const filteredData = useMemo(() => {
    const limit = getTimeframeLimit(timeframe)
    if (!Number.isFinite(limit) || limit >= chartData.length) {
      return chartData
    }
    return chartData.slice(-limit)
  }, [chartData, timeframe])

  const chartConfig = useMemo<ChartConfig>(() => {
    return {
      value: {
        label: 'TVL (millions)',
        color: hideAxes ? 'black' : 'var(--chart-1)'
      }
    }
  }, [hideAxes])

  return (
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
          tickFormatter={(value) => `$${(value / 1_000_000).toFixed(1)}M`}
          label={
            hideAxes
              ? undefined
              : {
                  value: 'TVL ($ millions)',
                  angle: -90,
                  position: 'insideLeft',
                  offset: 10,
                  style: {
                    textAnchor: 'middle',
                    fill: 'var(--muted-foreground, #6b7280)'
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
            formatter={(value: number) => [`$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, 'TVL']}
            contentStyle={{ borderRadius: '12px', border: '1px solid rgba(0,0,0,0.08)' }}
          />
        )}
        <Bar
          dataKey={'TVL'}
          fill={'var(--color-value)'}
          stroke={'transparent'}
          radius={[4, 4, 0, 0]}
          isAnimationActive={false}
        />
      </ComposedChart>
    </ChartContainer>
  )
}
