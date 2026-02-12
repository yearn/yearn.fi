import { usePlausible } from '@hooks/usePlausible'
import { VaultAboutSection } from '@pages/vaults/components/detail/VaultAboutSection'
import {
  type TVaultChartTab,
  type TVaultChartTimeframe,
  VaultChartsSection
} from '@pages/vaults/components/detail/VaultChartsSection'
import { YvUsdChartsSection } from '@pages/vaults/components/detail/YvUsdChartsSection'
import { isYvUsdVault } from '@pages/vaults/utils/yvUsd'
import { useVaultSnapshot } from '@pages/vaults/hooks/useVaultSnapshot'
import { mergeVaultSnapshot } from '@pages/vaults/utils/normalizeVaultSnapshot'
import {
  AllocationChart,
  DARK_MODE_COLORS,
  LIGHT_MODE_COLORS,
  type TAllocationChartData,
  useDarkMode
} from '@shared/components/AllocationChart'
import { useYearn } from '@shared/contexts/useYearn'
import { useYearnTokenPrice } from '@shared/hooks/useYearnTokenPrice'
import { formatCounterValue, toAddress, toNormalizedBN } from '@shared/utils'
import { PLAUSIBLE_EVENTS } from '@shared/utils/plausible'
import type { TYDaemonVault, TYDaemonVaultStrategy } from '@shared/utils/schemas/yDaemonVaultsSchemas'
import type { ReactElement } from 'react'
import { useMemo } from 'react'
import { type TVaultsExpandedView, VaultsExpandedSelector } from './VaultsExpandedSelector'

const EXPANDED_VIEW_TO_CHART_TAB: Record<
  Extract<TVaultsExpandedView, 'apy' | 'performance' | 'tvl'>,
  TVaultChartTab
> = {
  apy: 'historical-apy',
  performance: 'historical-pps',
  tvl: 'historical-tvl'
}

type TVaultsListRowExpandedContentProps = {
  currentVault: TYDaemonVault
  expandedView: TVaultsExpandedView
  onExpandedViewChange: (nextView: TVaultsExpandedView) => void
  onNavigateToVault: () => void
  showKindTag?: boolean
  showHiddenTag?: boolean
  isHidden?: boolean
}

export default function VaultsListRowExpandedContent({
  currentVault,
  expandedView,
  onExpandedViewChange,
  onNavigateToVault,
  showKindTag = true,
  showHiddenTag = false,
  isHidden
}: TVaultsListRowExpandedContentProps): ReactElement {
  const trackEvent = usePlausible()
  const chartTimeframe: TVaultChartTimeframe = '1y'
  const { data: snapshotVault } = useVaultSnapshot({
    chainId: currentVault.chainID,
    address: currentVault.address
  })
  const mergedVault = useMemo(() => mergeVaultSnapshot(currentVault, snapshotVault), [currentVault, snapshotVault])

  const handleGoToVault = (event: React.MouseEvent): void => {
    event.stopPropagation()
    trackEvent(PLAUSIBLE_EVENTS.VAULT_CLICK_LIST_ROW_EXPANDED, {
      props: {
        vaultAddress: toAddress(currentVault.address),
        vaultSymbol: currentVault.symbol,
        chainID: currentVault.chainID.toString()
      }
    })
    onNavigateToVault()
  }

  return (
    <div className={'hidden md:block bg-surface'} data-tour="vaults-row-expanded">
      <div className={'px-6 pb-6 md'}>
        <div className={'grid gap-6 md:grid-cols-24'}>
          <div className={'col-span-12 border-r border-border'}>
            <VaultAboutSection
              currentVault={mergedVault ?? currentVault}
              className={'md:px-15'}
              showKindTag={showKindTag}
              showVaultAddress={true}
              showHiddenTag={showHiddenTag}
              isHidden={isHidden}
            />
          </div>
          <div className={'col-span-12 flex flex-col gap-4'} data-tour="vaults-row-expanded-strategy">
            <VaultsExpandedSelector
              activeView={expandedView}
              onViewChange={onExpandedViewChange}
              rightElement={
                <button
                  type={'button'}
                  onClick={handleGoToVault}
                  className={
                    'h-full rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400'
                  }
                >
                  {'Go to Vault'}
                </button>
              }
            />
            {expandedView in EXPANDED_VIEW_TO_CHART_TAB ? (
              isYvUsdVault(currentVault) ? (
                <YvUsdChartsSection
                  shouldRenderSelectors={false}
                  chartTab={EXPANDED_VIEW_TO_CHART_TAB[expandedView as keyof typeof EXPANDED_VIEW_TO_CHART_TAB]}
                  timeframe={chartTimeframe}
                  chartHeightPx={200}
                  chartHeightMdPx={200}
                />
              ) : (
                <VaultChartsSection
                  chainId={currentVault.chainID}
                  vaultAddress={currentVault.address}
                  shouldRenderSelectors={false}
                  chartTab={EXPANDED_VIEW_TO_CHART_TAB[expandedView as keyof typeof EXPANDED_VIEW_TO_CHART_TAB]}
                  timeframe={chartTimeframe}
                  chartHeightPx={200}
                  chartHeightMdPx={200}
                />
              )
            ) : (
              <VaultStrategyAllocationPreview currentVault={mergedVault ?? currentVault} />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function VaultStrategyAllocationPreview({ currentVault }: { currentVault: TYDaemonVault }): ReactElement {
  const { vaults } = useYearn()
  const tokenPrice = useYearnTokenPrice({
    address: currentVault.token.address,
    chainID: currentVault.chainID
  })
  const isDark = useDarkMode()

  const vaultList = useMemo(() => {
    const list: (TYDaemonVault & {
      details: TYDaemonVaultStrategy['details']
      status: TYDaemonVaultStrategy['status']
    })[] = []

    for (const strategy of currentVault?.strategies || []) {
      const linkedVault = vaults[strategy.address]
      if (linkedVault?.address) {
        list.push({
          ...linkedVault,
          details: strategy.details,
          status: strategy.status
        })
      }
    }

    return list
  }, [currentVault?.strategies, vaults])

  const strategyList = useMemo(() => {
    const list: TYDaemonVaultStrategy[] = []

    for (const strategy of currentVault?.strategies || []) {
      if (!vaults[strategy.address]) {
        list.push(strategy)
      }
    }

    return list
  }, [currentVault?.strategies, vaults])

  const mergedList = useMemo(
    () =>
      [...vaultList, ...strategyList] as (TYDaemonVault & {
        details: TYDaemonVaultStrategy['details']
        status: TYDaemonVaultStrategy['status']
      })[],
    [vaultList, strategyList]
  )

  const filteredVaultList = useMemo(
    () => mergedList.filter((strategy) => strategy.status !== 'not_active'),
    [mergedList]
  )

  const activeStrategyData = useMemo(
    () =>
      filteredVaultList
        .filter((strategy) => {
          const hasAllocation =
            strategy.details?.totalDebt && strategy.details.totalDebt !== '0' && strategy.details?.debtRatio
          return hasAllocation
        })
        .map(
          (strategy): TAllocationChartData => ({
            id: strategy.address,
            name: strategy.name,
            value: (strategy.details?.debtRatio || 0) / 100,
            amount: formatCounterValue(
              toNormalizedBN(strategy.details?.totalDebt || 0, currentVault.token.decimals).display,
              tokenPrice
            )
          })
        ),
    [filteredVaultList, currentVault.token.decimals, tokenPrice]
  )

  const unallocatedPercentage =
    100 * 100 - mergedList.reduce((acc, strategy) => acc + (strategy.details?.debtRatio || 0), 0)
  const unallocatedValue =
    Number(currentVault.tvl?.totalAssets || 0) -
    mergedList.reduce((acc, strategy) => acc + Number(strategy.details?.totalDebt || 0), 0)

  const unallocatedData = useMemo(() => {
    if (unallocatedValue > 0 && unallocatedPercentage > 0) {
      return {
        id: 'unallocated',
        name: 'Unallocated',
        value: unallocatedPercentage / 100,
        amount: formatCounterValue(toNormalizedBN(unallocatedValue, currentVault.token.decimals).display, tokenPrice)
      }
    }
    return null
  }, [currentVault.token.decimals, tokenPrice, unallocatedPercentage, unallocatedValue])

  const allocationChartData = useMemo(
    () => [...activeStrategyData, unallocatedData].filter(Boolean) as TAllocationChartData[],
    [activeStrategyData, unallocatedData]
  )

  const legendColors = useMemo(() => (isDark ? DARK_MODE_COLORS : LIGHT_MODE_COLORS), [isDark])

  if (allocationChartData.length === 0) {
    return <div className={'text-sm text-text-secondary'}>{'No strategy allocation data available.'}</div>
  }

  return (
    <div className={'flex flex-col h-full justify-center pl-4 gap-6'}>
      <div className={'flex flex-row-reverse items-center gap-6'}>
        <div className={'flex-2'}>
          <AllocationChart allocationChartData={allocationChartData} />
        </div>
        <div className={'flex min-w-0 flex-3 flex-col gap-3'}>
          {activeStrategyData.map((item, index) => (
            <div key={item.id} className={'flex min-w-0 flex-row items-center gap-3'}>
              <div
                className={'h-3 w-3 shrink-0 rounded-sm'}
                style={{
                  backgroundColor: legendColors[index % legendColors.length]
                }}
              />
              <div className={'flex min-w-0 flex-col'}>
                <span className={'text-sm text-text-primary break-words'}>{item.name}</span>
                <span className={'text-xs text-text-secondary'}>{item.amount}</span>
              </div>
            </div>
          ))}
          {unallocatedData ? (
            <div className={'flex min-w-0 flex-row items-center gap-3'}>
              <div className={'h-3 w-3 shrink-0 rounded-sm bg-surface-tertiary'} />
              <div className={'flex min-w-0 flex-col'}>
                <span className={'text-sm text-text-secondary break-words'}>{'Unallocated'}</span>
                <span className={'text-xs text-text-secondary'}>{unallocatedData.amount}</span>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
