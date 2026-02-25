import { useYvUsdCharts } from '@pages/vaults/hooks/useYvUsdCharts'
import { cl, SELECTOR_BAR_STYLES } from '@shared/utils'
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
  const [uncontrolledTimeframe, setUncontrolledTimeframe] = useState<TYvUsdChartTimeframe>('1y')

  const activeTab = chartTab ?? uncontrolledTab
  const activeTimeframe = timeframe ?? uncontrolledTimeframe
  const setActiveTab = onChartTabChange ?? setUncontrolledTab
  const setActiveTimeframe = onTimeframeChange ?? setUncontrolledTimeframe

  return (
    <div className={'space-y-3 md:space-y-4 pt-4 rounded-lg'}>
      {shouldRenderSelectors ? (
        <div className={'flex flex-col gap-2 md:gap-3 px-3 md:px-4 md:flex-row md:items-start md:justify-between'}>
          <div className={'flex flex-col'}>
            <div className={cl('flex items-center gap-0.5 md:gap-1 w-full md:w-auto', SELECTOR_BAR_STYLES.container)}>
              {VAULT_CHART_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type={'button'}
                  onClick={() => setActiveTab(tab.id)}
                  className={cl(
                    'flex-1 md:flex-initial rounded-sm px-2 md:px-3 py-2 md:py-1 text-xs font-semibold transition-all',
                    'min-h-[36px] md:min-h-0 active:scale-[0.98]',
                    SELECTOR_BAR_STYLES.buttonBase,
                    activeTab === tab.id ? SELECTOR_BAR_STYLES.buttonActive : SELECTOR_BAR_STYLES.buttonInactive
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
          <div className={'hidden md:flex flex-wrap gap-2 md:gap-3'}>
            <div className={cl('flex items-center gap-0.5 md:gap-1 w-full md:w-auto', SELECTOR_BAR_STYLES.container)}>
              {VAULT_CHART_TIMEFRAME_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type={'button'}
                  className={cl(
                    'flex-1 md:flex-initial rounded-sm px-2 md:px-3 py-2 md:py-1 text-xs font-semibold uppercase tracking-wide transition-all',
                    'min-h-[36px] md:min-h-0 active:scale-[0.98]',
                    SELECTOR_BAR_STYLES.buttonBase,
                    option.value === activeTimeframe
                      ? SELECTOR_BAR_STYLES.buttonActive
                      : SELECTOR_BAR_STYLES.buttonInactive
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
        <FixedHeightChartContainer heightPx={chartHeightPx} heightMdPx={chartHeightMdPx} className={'mx-4'}>
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
