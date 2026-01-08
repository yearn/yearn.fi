import { useVaultChartTimeseries } from '@vaults/hooks/useVaultChartTimeseries'
import { transformVaultChartData } from '@vaults/utils/charts'
import type { ReactElement } from 'react'
import { useId, useMemo } from 'react'
import { Area, ComposedChart, ResponsiveContainer, YAxis } from 'recharts'

interface APYSparklineProps {
  chainId: number
  vaultAddress: string
}

export function APYSparkline({ chainId, vaultAddress }: APYSparklineProps): ReactElement {
  const gradientId = useId().replace(/:/g, '')
  const { data: timeseries, isLoading } = useVaultChartTimeseries({
    chainId,
    address: vaultAddress,
    limit: 30
  })

  const chartData = useMemo(() => {
    if (!timeseries) {
      return []
    }
    const transformed = transformVaultChartData(timeseries)
    return transformed.aprApyData?.slice(-30) ?? []
  }, [timeseries])

  if (isLoading) {
    return <div className={'h-[40px] w-full animate-pulse rounded bg-surface-secondary'} />
  }

  if (!chartData.length) {
    return <div className={'h-[40px] w-full flex items-center justify-center text-xs text-text-secondary'}>{'—'}</div>
  }

  return (
    <div className={'h-[40px] w-full'}>
      <ResponsiveContainer width={'100%'} height={40}>
        <ComposedChart data={chartData} margin={{ top: 2, right: 0, left: 0, bottom: 2 }}>
          <defs>
            <linearGradient id={`${gradientId}-sparkline`} x1={'0'} x2={'0'} y1={'0'} y2={'1'}>
              <stop offset={'5%'} stopColor={'#0657f9'} stopOpacity={0.4} />
              <stop offset={'95%'} stopColor={'#0657f9'} stopOpacity={0} />
            </linearGradient>
          </defs>
          <YAxis domain={[0, 'auto']} hide />
          <Area
            type={'monotone'}
            dataKey={'thirtyDayApy'}
            stroke={'#0657f9'}
            strokeWidth={1.5}
            fill={`url(#${gradientId}-sparkline)`}
            fillOpacity={1}
            connectNulls
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
