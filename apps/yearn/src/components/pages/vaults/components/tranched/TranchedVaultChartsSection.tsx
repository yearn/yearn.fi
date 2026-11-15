import { APYChart } from '@pages/vaults/components/detail/charts/APYChart'
import { ChartErrorBoundary } from '@pages/vaults/components/detail/charts/ChartErrorBoundary'
import ChartSkeleton from '@pages/vaults/components/detail/charts/ChartSkeleton'
import { FixedHeightChartContainer } from '@pages/vaults/components/detail/charts/FixedHeightChartContainer'
import { PPSChart } from '@pages/vaults/components/detail/charts/PPSChart'
import { TVLChart } from '@pages/vaults/components/detail/charts/TVLChart'
import { DualLineApyChart, DualLineChartLegend } from '@pages/vaults/components/detail/charts/YvUsdDualLineChart'
import {
  type TVaultChartTab,
  type TVaultChartTimeframe,
  VAULT_CHART_TABS,
  VaultChartTimeframeDropdown
} from '@pages/vaults/components/detail/VaultChartsSection'
import { type TTranchedProduct, YVUSD_TRANCHE_DEPLOYMENT } from '@pages/vaults/constants/tranchedProducts'
import { useVaultChartTimeseries } from '@pages/vaults/hooks/useVaultChartTimeseries'
import type { TAprApyChartData, TChartDataPoint, TPpsChartData } from '@pages/vaults/types/charts'
import { formatUnixTimestamp, getTimeframeLimit, transformVaultChartData } from '@pages/vaults/utils/charts'
import { cl, SELECTOR_BAR_STYLES } from '@shared/utils'
import type { ReactElement } from 'react'
import { Suspense, useMemo, useState } from 'react'

const REFERENCE_VAULTS = {
  USD: { name: 'USDC-1', address: '0xBe53A109B494E5c9f97b9Cd39Fe969BE68BF6204' },
  ETH: { name: 'WETH-1', address: '0xc56413869c6CDf96496f2b1eF801fEDBdFA7dDB0' }
}

const SECONDS_PER_DAY = 86_400

function hasChartValues<T extends TChartDataPoint>(
  data: T[] | null,
  key: keyof T,
  timeframe: TVaultChartTimeframe
): data is T[] {
  return data?.slice(-getTimeframeLimit(timeframe)).some((point) => Number.isFinite(point[key])) ?? false
}

function buildSeniorApyData(baseData: TAprApyChartData | null, target: number): TChartDataPoint[] {
  if (baseData) {
    return baseData.map(({ date, thirtyDayApy }) => ({ date, historical: thirtyDayApy, target }))
  }

  const today = Math.floor(Date.now() / 86_400_000) * SECONDS_PER_DAY
  const days = getTimeframeLimit('1y')
  return Array.from({ length: days }, (_, day) => ({
    date: formatUnixTimestamp(today - (days - 1 - day) * SECONDS_PER_DAY),
    historical: null,
    target
  }))
}

function buildLeveredApyData(baseData: TAprApyChartData | null): TAprApyChartData | null {
  if (!baseData) {
    return null
  }
  return baseData.map((point) => ({
    ...point,
    sevenDayApy: point.sevenDayApy === null ? null : point.sevenDayApy * 2,
    thirtyDayApy: point.thirtyDayApy === null ? null : point.thirtyDayApy * 2,
    derivedApr: point.derivedApr === null ? null : point.derivedApr * 2,
    derivedApy: point.derivedApy === null ? null : point.derivedApy * 2
  }))
}

function buildPpsData(product: TTranchedProduct, baseData: TPpsChartData | null): TPpsChartData | null {
  if (!baseData || product.kind === 'senior') {
    return baseData
  }
  return baseData.map((point) => ({
    ...point,
    PPS: point.PPS === null ? null : point.PPS * 2
  }))
}

export function TranchedVaultChartsSection({
  chartHeightMdPx = 230,
  chartHeightPx = 180,
  chartTab,
  onChartTabChange,
  onTimeframeChange,
  product,
  shouldRenderSelectors = true,
  timeframe
}: {
  product: TTranchedProduct
  chartTab?: TVaultChartTab
  onChartTabChange?: (tab: TVaultChartTab) => void
  timeframe?: TVaultChartTimeframe
  onTimeframeChange?: (timeframe: TVaultChartTimeframe) => void
  shouldRenderSelectors?: boolean
  chartHeightPx?: number
  chartHeightMdPx?: number
}): ReactElement {
  const [uncontrolledTab, setUncontrolledTab] = useState<TVaultChartTab>('historical-apy')
  const [uncontrolledTimeframe, setUncontrolledTimeframe] = useState<TVaultChartTimeframe>('1y')
  const activeTab = chartTab ?? uncontrolledTab
  const activeTimeframe = timeframe ?? uncontrolledTimeframe
  const setActiveTab = onChartTabChange ?? setUncontrolledTab
  const setActiveTimeframe = onTimeframeChange ?? setUncontrolledTimeframe
  const isSenior = product.kind === 'senior'
  const isApyTab = activeTab === 'historical-apy'
  const referenceVault = REFERENCE_VAULTS[product.asset]
  // The ETH products still point to preview addresses in the tranche catalog.
  const trancheAddress =
    product.asset === 'USD' ? YVUSD_TRANCHE_DEPLOYMENT.tranches[isSenior ? 'fixed' : 'levered'] : undefined
  const trancheQuery = useVaultChartTimeseries({
    chainId: YVUSD_TRANCHE_DEPLOYMENT.chainId,
    address: trancheAddress
  })
  const referenceQuery = useVaultChartTimeseries({ chainId: 1, address: referenceVault.address })
  const trancheData = trancheQuery.isPlaceholderData ? undefined : trancheQuery.data
  const referenceData = referenceQuery.isPlaceholderData ? undefined : referenceQuery.data
  const tranche = useMemo(() => transformVaultChartData(trancheData), [trancheData])
  const reference = useMemo(() => transformVaultChartData(referenceData), [referenceData])

  const hasActualApy = hasChartValues(tranche.aprApyData, 'thirtyDayApy', activeTimeframe)
  const hasReferenceApy = hasChartValues(reference.aprApyData, 'thirtyDayApy', activeTimeframe)
  const apyData = hasActualApy ? tranche.aprApyData : hasReferenceApy ? reference.aprApyData : null
  const targetApy = Number.parseFloat(product.apyLabel)
  const seniorApyData = useMemo(
    () => (isSenior ? buildSeniorApyData(apyData, targetApy) : null),
    [apyData, isSenior, targetApy]
  )
  const juniorApyData = useMemo(
    () => (!isSenior && !hasActualApy ? buildLeveredApyData(apyData) : apyData),
    [apyData, hasActualApy, isSenior]
  )
  const apySeries = [
    { key: 'historical', label: hasActualApy ? 'Actual APY' : 'Reference APY' },
    { key: 'target', label: 'Target APY' }
  ] as const

  const ppsData = hasChartValues(tranche.ppsData, 'PPS', activeTimeframe)
    ? tranche.ppsData
    : hasChartValues(reference.ppsData, 'PPS', activeTimeframe)
      ? buildPpsData(product, reference.ppsData)
      : null
  const tvlData = hasChartValues(tranche.tvlData, 'TVL', activeTimeframe)
    ? tranche.tvlData
    : hasChartValues(reference.tvlData, 'TVL', activeTimeframe)
      ? reference.tvlData
      : null
  const isLoading =
    trancheQuery.isLoading ||
    trancheQuery.isPlaceholderData ||
    referenceQuery.isLoading ||
    referenceQuery.isPlaceholderData
  const showApyNote = !hasActualApy && (isSenior ? !hasReferenceApy && !isLoading : hasReferenceApy)
  const error = trancheQuery.error ?? referenceQuery.error
  const hasActiveData = isApyTab
    ? Boolean(seniorApyData || juniorApyData)
    : activeTab === 'historical-pps'
      ? Boolean(ppsData)
      : Boolean(tvlData)

  return (
    <div className={'space-y-3 rounded-lg pt-4 md:space-y-4'}>
      {shouldRenderSelectors ? (
        <div className={'flex flex-col gap-2 px-3 md:flex-row md:items-start md:justify-between md:gap-3 md:px-4'}>
          <div className={cl('flex w-full items-center gap-0.5 md:w-auto md:gap-1', SELECTOR_BAR_STYLES.container)}>
            {VAULT_CHART_TABS.map((tab) => (
              <button
                key={tab.id}
                type={'button'}
                onClick={(): void => setActiveTab(tab.id)}
                aria-pressed={activeTab === tab.id}
                className={cl(
                  'min-h-[36px] flex-1 rounded-sm px-2 py-2 text-xs font-semibold transition-all active:scale-[0.98] md:min-h-0 md:flex-initial md:px-3 md:py-1',
                  SELECTOR_BAR_STYLES.buttonBase,
                  activeTab === tab.id ? SELECTOR_BAR_STYLES.buttonActive : SELECTOR_BAR_STYLES.buttonInactive
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className={'hidden w-full items-center justify-end md:flex md:w-auto'}>
            <VaultChartTimeframeDropdown timeframe={activeTimeframe} onTimeframeChange={setActiveTimeframe} />
          </div>
        </div>
      ) : null}

      {hasActiveData ? (
        <div>
          <div className={'px-4'}>
            <FixedHeightChartContainer heightPx={chartHeightPx} heightMdPx={chartHeightMdPx}>
              <ChartErrorBoundary>
                <Suspense fallback={<ChartSkeleton />}>
                  {isApyTab &&
                    (seniorApyData ? (
                      <DualLineApyChart chartData={seniorApyData} series={apySeries} timeframe={activeTimeframe} />
                    ) : juniorApyData ? (
                      <APYChart
                        chartData={juniorApyData}
                        timeframe={activeTimeframe}
                        seriesLabel={hasActualApy ? 'Actual APY' : 'Illustrative APY'}
                      />
                    ) : null)}
                  {activeTab === 'historical-pps' && ppsData ? (
                    <PPSChart chartData={ppsData} timeframe={activeTimeframe} />
                  ) : null}
                  {activeTab === 'historical-tvl' && tvlData ? (
                    <TVLChart chartData={tvlData} timeframe={activeTimeframe} />
                  ) : null}
                </Suspense>
              </ChartErrorBoundary>
            </FixedHeightChartContainer>
          </div>
          {isApyTab && seniorApyData ? (
            <DualLineChartLegend
              chartData={seniorApyData}
              series={apySeries}
              timeframe={activeTimeframe}
              showSingleSeries
            />
          ) : null}
          {isApyTab && showApyNote ? (
            <p className={'px-4 pb-1 text-center text-xs text-text-secondary'}>
              {isSenior
                ? 'Actual APY history is unavailable.'
                : `Illustrative APY uses twice the 30-day APY of ${referenceVault.name}.`}
            </p>
          ) : null}
        </div>
      ) : isLoading ? (
        <ChartSkeleton />
      ) : (
        <FixedHeightChartContainer heightPx={chartHeightPx} heightMdPx={chartHeightMdPx}>
          <div className={'grid h-full place-items-center px-4 text-center text-sm text-text-secondary'}>
            {error ? 'Unable to load chart data right now.' : 'No chart history is available for this vault yet.'}
          </div>
        </FixedHeightChartContainer>
      )}
    </div>
  )
}
