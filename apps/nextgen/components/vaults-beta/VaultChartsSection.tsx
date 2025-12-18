import { CHART_STYLE_OPTIONS, useChartStyle } from '@lib/contexts/useChartStyle'
import { cl } from '@lib/utils'
import { useVaultChartTimeseries } from '@nextgen/hooks/useVaultChartTimeseries'
import { transformVaultChartData } from '@nextgen/utils/charts'
import type { ReactElement } from 'react'
import { useMemo, useState } from 'react'
import { APYChart } from './charts/APYChart'
import { ChartErrorBoundary } from './charts/ChartErrorBoundary'
import ChartSkeleton from './charts/ChartSkeleton'
import ChartsLoader from './charts/ChartsLoader'
import { FixedHeightChartContainer } from './charts/FixedHeightChartContainer'
import { PPSChart } from './charts/PPSChart'
import { TVLChart } from './charts/TVLChart'

type VaultChartsSectionProps = {
  chainId: number
  vaultAddress: string
}

type TimeframeOption = {
  label: string
  value: string
}

const TIMEFRAME_OPTIONS: TimeframeOption[] = [
  { label: '30D', value: '30d' },
  { label: '90D', value: '90d' },
  { label: '1Y', value: '1y' },
  { label: 'All', value: 'all' }
]

type ChartTab = 'historical-pps' | 'historical-apy' | 'historical-tvl'

const CHART_TABS: Array<{ id: ChartTab; label: string }> = [
  { id: 'historical-tvl', label: 'TVL' },
  { id: 'historical-pps', label: 'Performance' },
  { id: 'historical-apy', label: 'APY' }
]

export function VaultChartsSection({ chainId, vaultAddress }: VaultChartsSectionProps): ReactElement {
  const { data, error, isLoading } = useVaultChartTimeseries({
    chainId,
    address: vaultAddress
  })

  const { chartStyle, setChartStyle } = useChartStyle()
  const transformed = useMemo(() => transformVaultChartData(data), [data])

  const chartsLoading = isLoading || !transformed.aprApyData || !transformed.ppsData || !transformed.tvlData
  const hasError = Boolean(error)

  const [activeTab, setActiveTab] = useState<ChartTab>('historical-tvl')
  const [timeframe, setTimeframe] = useState<TimeframeOption>(TIMEFRAME_OPTIONS[3])

  return (
    <div className={'space-y-4 pt-3 rounded-lg'}>
      <div className={'flex flex-col gap-3 px-4 md:flex-row md:items-center md:justify-between'}>
        <div className={'flex flex-wrap gap-3'}>
          <div className={'flex items-center gap-1 rounded-lg bg-surface-secondary p-1 shadow-inner'}>
            {CHART_TABS.map((tab) => (
              <button
                key={tab.id}
                type={'button'}
                onClick={() => setActiveTab(tab.id)}
                className={cl(
                  'rounded-sm px-3 py-1 text-xs font-semibold transition-all',
                  activeTab === tab.id
                    ? 'bg-surface text-text-primary'
                    : 'bg-transparent text-text-secondary hover:text-text-secondary'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
        <div className={'flex flex-wrap gap-3'}>
          <div className={'flex items-center gap-1 rounded-lg bg-surface-secondary p-1 shadow-inner'}>
            {TIMEFRAME_OPTIONS.map((option) => (
              <button
                key={option.value}
                type={'button'}
                className={cl(
                  'rounded-sm px-3 py-1 text-xs font-semibold uppercase tracking-wide transition-all',
                  option.value === timeframe.value
                    ? 'bg-surface text-text-primary'
                    : 'bg-transparent text-text-secondary hover:text-text-secondary'
                )}
                onClick={() => setTimeframe(option)}
              >
                {option.label}
              </button>
            ))}
          </div>
          <div className={'flex items-center gap-1 rounded-lg bg-surface-secondary p-1 shadow-inner'}>
            {CHART_STYLE_OPTIONS.map((option) => (
              <button
                key={option.id}
                type={'button'}
                className={cl(
                  'rounded-sm px-3 py-1 text-xs font-semibold transition-all',
                  option.id === chartStyle
                    ? 'bg-surface text-text-primary'
                    : 'bg-transparent text-text-secondary hover:text-text-secondary'
                )}
                onClick={() => setChartStyle(option.id)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {hasError ? (
        <div className={' bg-neutral-300 p-6 text-center text-sm text-red-700'}>
          {'Unable to load chart data right now.'}
        </div>
      ) : chartsLoading ? (
        <div className={'relative'}>
          <ChartSkeleton />
          <ChartsLoader loadingState={isLoading ? 'Loading charts' : 'Preparing charts'} />
        </div>
      ) : (
        <FixedHeightChartContainer>
          <ChartErrorBoundary>
            {activeTab === 'historical-pps' && transformed.ppsData ? (
              <PPSChart chartData={transformed.ppsData} timeframe={timeframe.value} />
            ) : null}
            {activeTab === 'historical-apy' && transformed.aprApyData ? (
              <APYChart chartData={transformed.aprApyData} timeframe={timeframe.value} />
            ) : null}
            {activeTab === 'historical-tvl' && transformed.tvlData ? (
              <TVLChart chartData={transformed.tvlData} timeframe={timeframe.value} />
            ) : null}
          </ChartErrorBoundary>
        </FixedHeightChartContainer>
      )}
    </div>
  )
}
