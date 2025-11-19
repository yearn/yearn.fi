import type { TTvlChartData } from '@nextgen/types/charts'
import { getTimeframeLimit } from '@nextgen/utils/charts'
import { useMemo } from 'react'
import { Bar, ComposedChart, XAxis, YAxis } from 'recharts'
import type { ChartConfig } from './ChartPrimitives'
import { ChartContainer, ChartTooltip } from './ChartPrimitives'

type TVLChartProps = {
  chartData: TTvlChartData
  timeframe: string
  hideTooltip?: boolean
}

export function TVLChart({ chartData, timeframe, hideTooltip }: TVLChartProps) {
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
        color: 'var(--chart-1)'
      }
    }
  }, [])

  return (
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
        <XAxis dataKey={'date'} hide />
        <YAxis domain={[0, 'auto']} hide />
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
