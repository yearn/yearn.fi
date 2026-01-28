import { useYvUsdCharts } from '@pages/vaults/hooks/useYvUsdCharts'
import { cl } from '@shared/utils'
import type { ReactElement } from 'react'
import { useState } from 'react'
import { ChartErrorBoundary } from './charts/ChartErrorBoundary'
import ChartSkeleton from './charts/ChartSkeleton'
import ChartsLoader from './charts/ChartsLoader'
import { FixedHeightChartContainer } from './charts/FixedHeightChartContainer'
import { YvUsdApyChart, YvUsdPerformanceChart, YvUsdTvlChart } from './charts/YvUsdDualLineChart'
import { VAULT_CHART_TABS, VAULT_CHART_TIMEFRAME_OPTIONS } from './VaultChartsSection'

export type TYvUsdChartTab = (typeof VAULT_CHART_TABS)[number]['id']
export type TYvUsdChartTimeframe = (typeof VAULT_CHART_TIMEFRAME_OPTIONS)[number]['value']

type YvUsdChartsSectionProps = {
  chartTab?: TYvUsdChartTab
  onChartTabChange?: (tab: TYvUsdChartTab) => void
  timeframe?: TYvUsdChartTimeframe
  onTimeframeChange?: (timeframe: TYvUsdChartTimeframe) => void
  shouldRenderSelectors?: boolean
  chartHeightPx?: number
  chartHeightMdPx?: number
}

export function YvUsdChartsSection({
  chartTab,
  onChartTabChange,
  timeframe,
  onTimeframeChange,
  shouldRenderSelectors = true,
  chartHeightPx,
  chartHeightMdPx
}: YvUsdChartsSectionProps): ReactElement {
  const { apyData, performanceData, tvlData, isLoading, error } = useYvUsdCharts()

  const chartsLoading = isLoading || !apyData || !performanceData || !tvlData
  const hasError = Boolean(error)

  const [uncontrolledTab, setUncontrolledTab] = useState<TYvUsdChartTab>('historical-apy')
  const [uncontrolledTimeframe, setUncontrolledTimeframe] = useState<TYvUsdChartTimeframe>('all')

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
            {activeTab === 'historical-pps' && performanceData ? (
              <YvUsdPerformanceChart chartData={performanceData} timeframe={activeTimeframe} />
            ) : null}
            {activeTab === 'historical-apy' && apyData ? (
              <YvUsdApyChart chartData={apyData} timeframe={activeTimeframe} />
            ) : null}
            {activeTab === 'historical-tvl' && tvlData ? (
              <YvUsdTvlChart chartData={tvlData} timeframe={activeTimeframe} />
            ) : null}
          </ChartErrorBoundary>
        </FixedHeightChartContainer>
      )}
    </div>
  )
}
