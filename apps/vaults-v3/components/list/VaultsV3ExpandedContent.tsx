import {
  AllocationChart,
  DARK_MODE_COLORS,
  LIGHT_MODE_COLORS,
  type TAllocationChartData,
  useDarkMode
} from '@lib/components/AllocationChart'
import { useYearn } from '@lib/contexts/useYearn'
import { useYearnTokenPrice } from '@lib/hooks/useYearnTokenPrice'
import { formatCounterValue, toNormalizedBN } from '@lib/utils'
import type { TYDaemonVault, TYDaemonVaultStrategy } from '@lib/utils/schemas/yDaemonVaultsSchemas'
import { VaultAboutSection } from '@nextgen/components/vaults-beta/VaultAboutSection'
import {
  type TVaultChartTab,
  type TVaultChartTimeframe,
  VaultChartsSection
} from '@nextgen/components/vaults-beta/VaultChartsSection'
import type { ReactElement } from 'react'
import { useMemo, useState } from 'react'
import { type TVaultsV3ExpandedView, VaultsV3ExpandedSelector } from './VaultsV3ExpandedSelector'

export default function VaultsV3ExpandedContent({
  currentVault,
  onNavigate
}: {
  currentVault: TYDaemonVault
  onNavigate: () => void
}): ReactElement {
  const [expandedView, setExpandedView] = useState<TVaultsV3ExpandedView>('performance')
  const [expandedTimeframe, setExpandedTimeframe] = useState<TVaultChartTimeframe>('all')

  return (
    <div className={'px-6 pb-6 pt-3'}>
      <div className={' bg-surface'}>
        <VaultsV3ExpandedSelector
          className={'p-3'}
          activeView={expandedView}
          onViewChange={setExpandedView}
          timeframe={expandedTimeframe}
          onTimeframeChange={setExpandedTimeframe}
          rightElement={
            <button
              type={'button'}
              onClick={(event): void => {
                event.stopPropagation()
                onNavigate()
              }}
              className={
                'rounded-lg  bg-surface-secondary px-4 py-2 text-xs font-semibold text-text-primary transition-colors hover:bg-surface-secondary/80'
              }
            >
              {'Go to Vault'}
            </button>
          }
        />

        {expandedView === 'apy' || expandedView === 'performance' ? (
          <div className={'px-3 pb-4'}>
            <VaultChartsSection
              chainId={currentVault.chainID}
              vaultAddress={currentVault.address}
              shouldRenderSelectors={false}
              chartTab={(expandedView === 'apy' ? 'historical-apy' : 'historical-pps') satisfies TVaultChartTab}
              timeframe={expandedTimeframe}
              chartHeightPx={200}
              chartHeightMdPx={200}
            />
          </div>
        ) : null}

        {expandedView === 'info' ? (
          <div className={'grid md:grid-cols-2 divide-y divide-border md:divide-y-0 md:divide-x'}>
            <div className={'p-4 md:p-6'}>
              <VaultStrategyAllocationPreview currentVault={currentVault} />
            </div>
            <div className={'p-4 md:p-6'}>
              <VaultAboutSection currentVault={currentVault} className={'p-0'} />
            </div>
          </div>
        ) : null}
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
    <div className={'flex flex-col gap-6'}>
      <div className={'flex flex-col gap-6 lg:flex-row lg:items-center'}>
        <AllocationChart allocationChartData={allocationChartData} />
        <div className={'flex flex-col gap-3'}>
          {activeStrategyData.map((item, index) => (
            <div key={item.id} className={'flex flex-row items-center gap-3'}>
              <div
                className={'h-3 w-3 rounded-sm'}
                style={{
                  backgroundColor: legendColors[index % legendColors.length]
                }}
              />
              <div className={'flex flex-col'}>
                <span className={'text-sm text-text-primary'}>{item.name}</span>
                <span className={'text-xs text-text-secondary'}>{item.amount}</span>
              </div>
            </div>
          ))}
          {unallocatedData ? (
            <div className={'flex flex-row items-center gap-3'}>
              <div className={'h-3 w-3 rounded-sm bg-surface-tertiary'} />
              <div className={'flex flex-col'}>
                <span className={'text-sm text-text-secondary'}>{'Unallocated'}</span>
                <span className={'text-xs text-text-secondary'}>{unallocatedData.amount}</span>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
