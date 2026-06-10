import { useVaultUserHistory } from '@pages/vaults/hooks/useVaultUserHistory'
import { type TYvUsdSeriesPoint, useYvUsdCharts } from '@pages/vaults/hooks/useYvUsdCharts'
import { YVUSD_CHAIN_ID, YVUSD_LOCKED_ADDRESS, YVUSD_UNLOCKED_ADDRESS } from '@pages/vaults/utils/yvUsd'
import { cl, SELECTOR_BAR_STYLES } from '@shared/utils'
import type { ReactElement } from 'react'
import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { ChartErrorBoundary } from './charts/ChartErrorBoundary'
import ChartSkeleton from './charts/ChartSkeleton'
import ChartsLoader from './charts/ChartsLoader'
import { FixedHeightChartContainer } from './charts/FixedHeightChartContainer'
import { YvUsdApyChart, YvUsdChartLegend, YvUsdPerformanceChart, YvUsdTvlChart } from './charts/YvUsdDualLineChart'
import { VAULT_CHART_TABS, type VAULT_CHART_TIMEFRAME_OPTIONS, VaultChartTimeframeDropdown } from './VaultChartsSection'

const VaultTvlGrowthChart = lazy(() =>
  import('./charts/VaultTvlGrowthChart').then((m) => ({ default: m.VaultTvlGrowthChart }))
)

type TYvUsdUserChartTab = 'user-position'
export type TYvUsdChartTab = (typeof VAULT_CHART_TABS)[number]['id'] | TYvUsdUserChartTab
export type TYvUsdChartTimeframe = (typeof VAULT_CHART_TIMEFRAME_OPTIONS)[number]['value']

type YvUsdChartsSectionProps = {
  chartTab?: TYvUsdChartTab
  onChartTabChange?: (tab: TYvUsdChartTab) => void
  timeframe?: TYvUsdChartTimeframe
  onTimeframeChange?: (timeframe: TYvUsdChartTimeframe) => void
  shouldRenderSelectors?: boolean
  chartHeightPx?: number
  chartHeightMdPx?: number
  enableUserPositionChart?: boolean
}

function getActiveChartData({
  activeTab,
  apyData,
  performanceData,
  tvlData
}: {
  activeTab: TYvUsdChartTab
  apyData?: TYvUsdSeriesPoint[]
  performanceData?: TYvUsdSeriesPoint[]
  tvlData?: TYvUsdSeriesPoint[]
}): TYvUsdSeriesPoint[] | undefined {
  switch (activeTab) {
    case 'historical-pps':
      return performanceData
    case 'historical-tvl':
      return tvlData
    default:
      return apyData
  }
}

function renderActiveChart({
  activeTab,
  activeTimeframe,
  apyData,
  performanceData,
  tvlData
}: {
  activeTab: TYvUsdChartTab
  activeTimeframe: TYvUsdChartTimeframe
  apyData?: TYvUsdSeriesPoint[]
  performanceData?: TYvUsdSeriesPoint[]
  tvlData?: TYvUsdSeriesPoint[]
}): ReactElement | null {
  switch (activeTab) {
    case 'historical-pps':
      return performanceData ? <YvUsdPerformanceChart chartData={performanceData} timeframe={activeTimeframe} /> : null
    case 'historical-tvl':
      return tvlData ? <YvUsdTvlChart chartData={tvlData} timeframe={activeTimeframe} /> : null
    default:
      return apyData ? <YvUsdApyChart chartData={apyData} timeframe={activeTimeframe} /> : null
  }
}

export function YvUsdChartsSection({
  chartTab,
  onChartTabChange,
  timeframe,
  onTimeframeChange,
  shouldRenderSelectors = true,
  chartHeightPx,
  chartHeightMdPx,
  enableUserPositionChart = false
}: YvUsdChartsSectionProps): ReactElement {
  const { apyData, performanceData, tvlData, isLoading, error } = useYvUsdCharts()

  const [uncontrolledTab, setUncontrolledTab] = useState<TYvUsdChartTab>('historical-apy')
  const [uncontrolledTimeframe, setUncontrolledTimeframe] = useState<TYvUsdChartTimeframe>('1y')

  const activeTab = chartTab ?? uncontrolledTab
  const activeTimeframe = timeframe ?? uncontrolledTimeframe
  const setActiveTab = onChartTabChange ?? setUncontrolledTab
  const setActiveTimeframe = onTimeframeChange ?? setUncontrolledTimeframe
  const availableTabs = useMemo(
    () =>
      enableUserPositionChart
        ? [...VAULT_CHART_TABS, { id: 'user-position' as const, label: 'Your Position' }]
        : VAULT_CHART_TABS,
    [enableUserPositionChart]
  )
  const fallbackTab = availableTabs[0]?.id ?? 'historical-apy'
  const resolvedActiveTab = availableTabs.some((tab) => tab.id === activeTab) ? activeTab : fallbackTab
  const activeChartData = getActiveChartData({ activeTab: resolvedActiveTab, apyData, performanceData, tvlData })
  const activeTabIsUserChart = resolvedActiveTab === 'user-position'
  const {
    balanceData: userBalanceData,
    growthData: userGrowthData,
    isLoading: isUserHistoryLoading,
    isEmpty: isUserHistoryEmpty,
    error: userHistoryError
  } = useVaultUserHistory({
    vaults: [
      { chainId: YVUSD_CHAIN_ID, vaultAddress: YVUSD_UNLOCKED_ADDRESS },
      { chainId: YVUSD_CHAIN_ID, vaultAddress: YVUSD_LOCKED_ADDRESS }
    ],
    timeframe: activeTimeframe,
    enabled: enableUserPositionChart && activeTabIsUserChart,
    valueMode: 'usd'
  })
  const yvUsdChartsLoading = isLoading || !apyData || !performanceData || !tvlData
  const chartsLoading = activeTabIsUserChart ? isUserHistoryLoading : yvUsdChartsLoading
  const hasError = Boolean(activeTabIsUserChart ? userHistoryError : error)
  const showUserEmptyState = activeTabIsUserChart && !chartsLoading && !hasError && isUserHistoryEmpty

  useEffect(() => {
    if (resolvedActiveTab === activeTab) {
      return
    }

    setActiveTab(resolvedActiveTab)
  }, [activeTab, resolvedActiveTab, setActiveTab])

  return (
    <div className={'space-y-3 md:space-y-4 pt-4 rounded-lg'}>
      {shouldRenderSelectors ? (
        <div className={'flex flex-col gap-2 md:gap-3 px-3 md:px-4 md:flex-row md:items-start md:justify-between'}>
          <div className={'flex flex-col'}>
            <div className={cl('flex items-center gap-0.5 md:gap-1 w-full md:w-auto', SELECTOR_BAR_STYLES.container)}>
              {availableTabs.map((tab) => (
                <button
                  key={tab.id}
                  type={'button'}
                  onClick={() => setActiveTab(tab.id)}
                  className={cl(
                    'flex-1 md:flex-initial rounded-sm px-2 md:px-3 py-2 md:py-1 text-xs font-semibold transition-all',
                    'min-h-[36px] md:min-h-0 active:scale-[0.98]',
                    SELECTOR_BAR_STYLES.buttonBase,
                    resolvedActiveTab === tab.id ? SELECTOR_BAR_STYLES.buttonActive : SELECTOR_BAR_STYLES.buttonInactive
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
          <div className={'hidden w-full items-center justify-end md:flex md:w-auto'}>
            <VaultChartTimeframeDropdown timeframe={activeTimeframe} onTimeframeChange={setActiveTimeframe} />
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
          <ChartsLoader
            loadingState={
              activeTabIsUserChart ? 'Loading your history' : isLoading ? 'Loading charts' : 'Preparing charts'
            }
          />
        </div>
      ) : showUserEmptyState ? (
        <div className={'bg-neutral-300 p-6 text-center text-sm text-text-secondary'}>
          {'No wallet history is available for this vault yet.'}
        </div>
      ) : (
        <div className="space-y-0">
          <div className={'px-4'}>
            <FixedHeightChartContainer heightPx={chartHeightPx} heightMdPx={chartHeightMdPx}>
              <ChartErrorBoundary>
                {activeTabIsUserChart ? (
                  userBalanceData || userGrowthData ? (
                    <Suspense fallback={<ChartSkeleton />}>
                      <VaultTvlGrowthChart
                        balanceData={userBalanceData}
                        growthData={userGrowthData}
                        timeframe={activeTimeframe}
                        unitLabel={'USDC'}
                      />
                    </Suspense>
                  ) : null
                ) : (
                  renderActiveChart({
                    activeTab: resolvedActiveTab,
                    activeTimeframe,
                    apyData,
                    performanceData,
                    tvlData
                  })
                )}
              </ChartErrorBoundary>
            </FixedHeightChartContainer>
          </div>
          {!activeTabIsUserChart && activeChartData ? (
            <YvUsdChartLegend chartData={activeChartData} timeframe={activeTimeframe} />
          ) : null}
        </div>
      )}
    </div>
  )
}
