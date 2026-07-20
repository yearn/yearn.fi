import { APYChart } from '@pages/vaults/components/detail/charts/APYChart'
import { ChartErrorBoundary } from '@pages/vaults/components/detail/charts/ChartErrorBoundary'
import ChartSkeleton from '@pages/vaults/components/detail/charts/ChartSkeleton'
import { FixedHeightChartContainer } from '@pages/vaults/components/detail/charts/FixedHeightChartContainer'
import { PPSChart } from '@pages/vaults/components/detail/charts/PPSChart'
import { TVLChart } from '@pages/vaults/components/detail/charts/TVLChart'
import {
  type TVaultChartTab,
  type TVaultChartTimeframe,
  VAULT_CHART_TABS,
  VaultChartTimeframeDropdown
} from '@pages/vaults/components/detail/VaultChartsSection'
import type { TTranchedProduct } from '@pages/vaults/constants/tranchedProducts'
import {
  getVaultAddress,
  getVaultChainID,
  getVaultName,
  getVaultSymbol,
  type TKongVaultInput
} from '@pages/vaults/domain/kongVaultSelectors'
import { useVaultChartTimeseries } from '@pages/vaults/hooks/useVaultChartTimeseries'
import { useYvBtcVaults } from '@pages/vaults/hooks/useYvBtcVaults'
import type { TAprApyChartData, TPpsChartData } from '@pages/vaults/types/charts'
import { transformVaultChartData } from '@pages/vaults/utils/charts'
import { useYearn } from '@shared/contexts/useYearn'
import { cl, SELECTOR_BAR_STYLES } from '@shared/utils'
import type { ReactElement } from 'react'
import { Suspense, useMemo, useState } from 'react'

function parseApyLabel(value: string): number {
  const parsed = Number(value.replace('%', '').trim())
  return Number.isFinite(parsed) ? parsed : 0
}

function resolveBaseChartVault({
  product,
  vaults,
  yvBtcVault
}: {
  product: TTranchedProduct
  vaults: TKongVaultInput[]
  yvBtcVault?: TKongVaultInput
}): TKongVaultInput | undefined {
  if (product.asset === 'BTC') {
    return yvBtcVault ?? vaults.find((vault) => getVaultSymbol(vault).toLowerCase() === 'yvbtc')
  }

  const targetSymbols = product.asset === 'USD' ? ['yvusdc-1', 'usdc-1'] : ['yvweth', 'weth-1']
  return vaults.find((vault) => {
    const symbol = getVaultSymbol(vault).toLowerCase()
    const name = getVaultName(vault).toLowerCase()
    return targetSymbols.some((target) => symbol === target || name.includes(target))
  })
}

function buildSteadyApyData(baseData: TAprApyChartData | null, targetApy: number): TAprApyChartData | null {
  if (!baseData) {
    return null
  }
  return baseData.map((point) => ({
    ...point,
    sevenDayApy: targetApy,
    thirtyDayApy: targetApy,
    derivedApr: targetApy,
    derivedApy: targetApy
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
  const { allVaults, vaults } = useYearn()
  const { unlockedVault: yvBtcVault } = useYvBtcVaults()
  const [uncontrolledTab, setUncontrolledTab] = useState<TVaultChartTab>('historical-apy')
  const [uncontrolledTimeframe, setUncontrolledTimeframe] = useState<TVaultChartTimeframe>('1y')
  const activeTab = chartTab ?? uncontrolledTab
  const activeTimeframe = timeframe ?? uncontrolledTimeframe
  const setActiveTab = onChartTabChange ?? setUncontrolledTab
  const setActiveTimeframe = onTimeframeChange ?? setUncontrolledTimeframe
  const catalogVaults = useMemo(() => Object.values({ ...allVaults, ...vaults }), [allVaults, vaults])
  const baseVault = useMemo(
    () => resolveBaseChartVault({ product, vaults: catalogVaults, yvBtcVault }),
    [catalogVaults, product, yvBtcVault]
  )
  const { data, error, isLoading } = useVaultChartTimeseries({
    chainId: baseVault ? getVaultChainID(baseVault) : undefined,
    address: baseVault ? getVaultAddress(baseVault) : undefined
  })
  const transformed = useMemo(() => transformVaultChartData(data), [data])
  const apyData = useMemo(
    () =>
      product.kind === 'senior'
        ? buildSteadyApyData(transformed.aprApyData, parseApyLabel(product.apyLabel))
        : buildLeveredApyData(transformed.aprApyData),
    [product.apyLabel, product.kind, transformed.aprApyData]
  )
  const ppsData = useMemo(() => buildPpsData(product, transformed.ppsData), [product, transformed.ppsData])
  const tvlData = transformed.tvlData
  const isChartLoading = isLoading || !baseVault || !apyData || !ppsData || !tvlData

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

      {error ? (
        <div className={'bg-neutral-300 p-6 text-center text-sm text-red-700'}>
          {'Unable to load chart data right now.'}
        </div>
      ) : isChartLoading ? (
        <ChartSkeleton />
      ) : (
        <FixedHeightChartContainer heightPx={chartHeightPx} heightMdPx={chartHeightMdPx} className={'mx-4'}>
          <ChartErrorBoundary>
            <Suspense fallback={<ChartSkeleton />}>
              {activeTab === 'historical-apy' ? <APYChart chartData={apyData} timeframe={activeTimeframe} /> : null}
              {activeTab === 'historical-pps' ? <PPSChart chartData={ppsData} timeframe={activeTimeframe} /> : null}
              {activeTab === 'historical-tvl' ? <TVLChart chartData={tvlData} timeframe={activeTimeframe} /> : null}
            </Suspense>
          </ChartErrorBoundary>
        </FixedHeightChartContainer>
      )}
    </div>
  )
}
