import { KATANA_CHAIN_ID } from '@pages/vaults/constants/addresses'
import { useVaultChartTimeseries } from '@pages/vaults/hooks/useVaultChartTimeseries'
import { useVaultUserHistory } from '@pages/vaults/hooks/useVaultUserHistory'
import { transformVaultChartData } from '@pages/vaults/utils/charts'
import { cl, SELECTOR_BAR_STYLES } from '@shared/utils'
import type { ReactElement } from 'react'
import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { ChartErrorBoundary } from './charts/ChartErrorBoundary'
import ChartSkeleton from './charts/ChartSkeleton'
import ChartsLoader from './charts/ChartsLoader'
import { FixedHeightChartContainer } from './charts/FixedHeightChartContainer'

const APYChart = lazy(() => import('./charts/APYChart').then((m) => ({ default: m.APYChart })))
const PPSChart = lazy(() => import('./charts/PPSChart').then((m) => ({ default: m.PPSChart })))
const TVLChart = lazy(() => import('./charts/TVLChart').then((m) => ({ default: m.TVLChart })))
const VaultTvlGrowthChart = lazy(() =>
  import('./charts/VaultTvlGrowthChart').then((m) => ({ default: m.VaultTvlGrowthChart }))
)

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
  enableUserCharts?: boolean
  userUnitLabel?: string
  overlayUserPositionOnTvlTab?: boolean
}

export const VAULT_CHART_TIMEFRAME_OPTIONS = [
  { label: '30D', value: '30d' },
  { label: '90D', value: '90d' },
  { label: '1Y', value: '1y' },
  { label: 'All', value: 'all' }
] as const

export type TVaultChartTimeframe = (typeof VAULT_CHART_TIMEFRAME_OPTIONS)[number]['value']

type TBaseVaultChartTab = 'historical-pps' | 'historical-apy' | 'historical-tvl'
type TUserVaultChartTab = 'user-position'
export type TVaultChartTab = TBaseVaultChartTab | TUserVaultChartTab

export const VAULT_CHART_TABS: Array<{ id: TBaseVaultChartTab; label: string }> = [
  { id: 'historical-apy', label: '30-Day APY' },
  { id: 'historical-pps', label: 'Performance' },
  { id: 'historical-tvl', label: 'TVL' }
]

const USER_VAULT_CHART_TABS: Array<{ id: TUserVaultChartTab; label: string }> = [
  { id: 'user-position', label: 'Your Position' }
]

function isUserChartTab(tab: TVaultChartTab): tab is TUserVaultChartTab {
  return tab === 'user-position'
}

export function VaultChartsSection({
  chainId,
  vaultAddress,
  chartTab,
  onChartTabChange,
  timeframe,
  onTimeframeChange,
  shouldRenderSelectors = true,
  chartHeightPx,
  chartHeightMdPx,
  enableUserCharts = false,
  userUnitLabel = 'assets',
  overlayUserPositionOnTvlTab = false
}: VaultChartsSectionProps): ReactElement {
  const { data, error, isLoading } = useVaultChartTimeseries({
    chainId,
    address: vaultAddress
  })

  const transformed = useMemo(() => transformVaultChartData(data), [data])

  const [uncontrolledTab, setUncontrolledTab] = useState<TVaultChartTab>('historical-apy')
  const [uncontrolledTimeframe, setUncontrolledTimeframe] = useState<TVaultChartTimeframe>('1y')

  const activeTab = chartTab ?? uncontrolledTab
  const activeTimeframe = timeframe ?? uncontrolledTimeframe
  const setActiveTab = onChartTabChange ?? setUncontrolledTab
  const setActiveTimeframe = onTimeframeChange ?? setUncontrolledTimeframe
  const availableTabs = useMemo(
    () => [...VAULT_CHART_TABS, ...(enableUserCharts ? USER_VAULT_CHART_TABS : [])],
    [enableUserCharts]
  )
  const fallbackTab = availableTabs[0]?.id ?? 'historical-apy'
  const resolvedActiveTab = availableTabs.some((tab) => tab.id === activeTab) ? activeTab : fallbackTab
  const activeTabIsUserChart = isUserChartTab(resolvedActiveTab)
  const shouldOverlayUserPositionOnTvlTab = overlayUserPositionOnTvlTab && resolvedActiveTab === 'historical-tvl'
  const showApyDisclaimer =
    shouldRenderSelectors && resolvedActiveTab === 'historical-apy' && chainId === KATANA_CHAIN_ID
  const {
    balanceData: userBalanceData,
    growthData: userGrowthData,
    isLoading: isUserHistoryLoading,
    isEmpty: isUserHistoryEmpty,
    error: userHistoryError
  } = useVaultUserHistory({
    chainId,
    vaultAddress,
    timeframe: activeTimeframe,
    enabled: (enableUserCharts && activeTabIsUserChart) || shouldOverlayUserPositionOnTvlTab
  })

  useEffect(() => {
    if (resolvedActiveTab === activeTab) {
      return
    }

    setActiveTab(resolvedActiveTab)
  }, [activeTab, resolvedActiveTab, setActiveTab])

  const vaultChartsLoading = isLoading || !transformed.aprApyData || !transformed.ppsData || !transformed.tvlData
  const chartsLoading = shouldOverlayUserPositionOnTvlTab
    ? isUserHistoryLoading
    : activeTabIsUserChart
      ? isUserHistoryLoading
      : vaultChartsLoading
  const hasError = Boolean(
    shouldOverlayUserPositionOnTvlTab ? userHistoryError : activeTabIsUserChart ? userHistoryError : error
  )
  const showUserEmptyState =
    (activeTabIsUserChart || shouldOverlayUserPositionOnTvlTab) && !chartsLoading && !hasError && isUserHistoryEmpty

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
            {showApyDisclaimer ? (
              <p className={'pointer-events-none relative mt-1 text-xxs text-text-secondary'}>
                {'*This chart does not include KAT and other incentives.'}
              </p>
            ) : null}
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
        <FixedHeightChartContainer heightPx={chartHeightPx} heightMdPx={chartHeightMdPx} className={'mx-4'}>
          <ChartErrorBoundary>
            <Suspense fallback={<ChartSkeleton />}>
              {resolvedActiveTab === 'user-position' && (userBalanceData || userGrowthData) ? (
                <VaultTvlGrowthChart
                  balanceData={userBalanceData}
                  growthData={userGrowthData}
                  timeframe={activeTimeframe}
                  unitLabel={userUnitLabel}
                />
              ) : null}
              {resolvedActiveTab === 'historical-pps' && transformed.ppsData ? (
                <PPSChart chartData={transformed.ppsData} timeframe={activeTimeframe} />
              ) : null}
              {resolvedActiveTab === 'historical-apy' && transformed.aprApyData ? (
                <APYChart chartData={transformed.aprApyData} timeframe={activeTimeframe} />
              ) : null}
              {resolvedActiveTab === 'historical-tvl' ? (
                shouldOverlayUserPositionOnTvlTab ? (
                  userBalanceData || userGrowthData ? (
                    <VaultTvlGrowthChart
                      balanceData={userBalanceData}
                      growthData={userGrowthData}
                      timeframe={activeTimeframe}
                      unitLabel={userUnitLabel}
                    />
                  ) : null
                ) : transformed.tvlData ? (
                  <TVLChart chartData={transformed.tvlData} timeframe={activeTimeframe} />
                ) : null
              ) : null}
            </Suspense>
          </ChartErrorBoundary>
        </FixedHeightChartContainer>
      )}
    </div>
  )
}
