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
  chartTab?: TVaultChartTab
  onChartTabChange?: (tab: TVaultChartTab) => void
  timeframe?: TVaultChartTimeframe
  onTimeframeChange?: (timeframe: TVaultChartTimeframe) => void
  shouldRenderSelectors?: boolean
  chartHeightPx?: number
  chartHeightMdPx?: number
}

type TimeframeOption = {
  label: string
  value: string
}

export const VAULT_CHART_TIMEFRAME_OPTIONS = [
  { label: '30D', value: '30d' },
  { label: '90D', value: '90d' },
  { label: '1Y', value: '1y' },
  { label: 'All', value: 'all' }
] as const satisfies ReadonlyArray<TimeframeOption>

export type TVaultChartTimeframe = (typeof VAULT_CHART_TIMEFRAME_OPTIONS)[number]['value']

export type TVaultChartTab = 'historical-pps' | 'historical-apy' | 'historical-tvl'

export const VAULT_CHART_TABS: Array<{ id: TVaultChartTab; label: string }> = [
  { id: 'historical-apy', label: '30-Day APY' },
  { id: 'historical-pps', label: 'Performance' },
  { id: 'historical-tvl', label: 'TVL' }
]

export function VaultChartsSection({
  chainId,
  vaultAddress,
  chartTab,
  onChartTabChange,
  timeframe,
  onTimeframeChange,
  shouldRenderSelectors = true,
  chartHeightPx,
  chartHeightMdPx
}: VaultChartsSectionProps): ReactElement {
  const { data, error, isLoading } = useVaultChartTimeseries({
    chainId,
    address: vaultAddress
  })

  const transformed = useMemo(() => transformVaultChartData(data), [data])

  const chartsLoading = isLoading || !transformed.aprApyData || !transformed.ppsData || !transformed.tvlData
  const hasError = Boolean(error)

  const [uncontrolledTab, setUncontrolledTab] = useState<TVaultChartTab>('historical-apy')
  const [uncontrolledTimeframe, setUncontrolledTimeframe] = useState<TVaultChartTimeframe>('all')

  const activeTab = chartTab ?? uncontrolledTab
  const activeTimeframe = timeframe ?? uncontrolledTimeframe
  const setActiveTab = onChartTabChange ?? setUncontrolledTab
  const setActiveTimeframe = onTimeframeChange ?? setUncontrolledTimeframe

  return (
    <div className={'space-y-4 pt-3 rounded-lg'}>
      {shouldRenderSelectors ? (
        <div className={'flex flex-col gap-3 px-4 md:flex-row md:items-center md:justify-between'}>
          <div className={'flex flex-wrap gap-3'}>
            <div className={'flex items-center gap-1 rounded-lg bg-surface-secondary p-1 shadow-inner'}>
              {VAULT_CHART_TABS.map((tab) => (
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
              {VAULT_CHART_TIMEFRAME_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type={'button'}
                  className={cl(
                    'rounded-sm px-3 py-1 text-xs font-semibold uppercase tracking-wide transition-all',
                    option.value === activeTimeframe
                      ? 'bg-surface text-text-primary'
                      : 'bg-transparent text-text-secondary hover:text-text-secondary'
                  )}
                  onClick={() => setActiveTimeframe(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}

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
        <FixedHeightChartContainer heightPx={chartHeightPx} heightMdPx={chartHeightMdPx}>
          <ChartErrorBoundary>
            {activeTab === 'historical-pps' && transformed.ppsData ? (
              <PPSChart chartData={transformed.ppsData} timeframe={activeTimeframe} />
            ) : null}
            {activeTab === 'historical-apy' && transformed.aprApyData ? (
              <APYChart chartData={transformed.aprApyData} timeframe={activeTimeframe} />
            ) : null}
            {activeTab === 'historical-tvl' && transformed.tvlData ? (
              <TVLChart chartData={transformed.tvlData} timeframe={activeTimeframe} />
            ) : null}
          </ChartErrorBoundary>
        </FixedHeightChartContainer>
      )}
    </div>
  )
}
