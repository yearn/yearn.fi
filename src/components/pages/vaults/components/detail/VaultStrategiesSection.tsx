import { ALL_VAULTSV3_KINDS_KEYS } from '@pages/vaults/constants'
import type { TPossibleSortBy } from '@pages/vaults/hooks/useSortVaults'
import { useSortVaults } from '@pages/vaults/hooks/useSortVaults'
import { useQueryArguments } from '@pages/vaults/hooks/useVaultsQueryArgs'
import type { TAllocationChartData } from '@shared/components/AllocationChart'
import { DARK_MODE_COLORS, LIGHT_MODE_COLORS, useDarkMode } from '@shared/components/AllocationChart'
import { useYearn } from '@shared/contexts/useYearn'
import { useYearnTokenPrice } from '@shared/hooks/useYearnTokenPrice'
import type { TSortDirection } from '@shared/types'
import { cl, formatPercent, formatTvlDisplay, toBigInt, toNormalizedBN } from '@shared/utils'
import type { TYDaemonVault, TYDaemonVaultStrategy } from '@shared/utils/schemas/yDaemonVaultsSchemas'
import type { ReactElement } from 'react'
import { lazy, Suspense, useCallback, useMemo } from 'react'
import { VaultsListHead } from './VaultsListHead'
import { VaultsListStrategy } from './VaultsListStrategy'

const AllocationChart = lazy(() =>
  import('@shared/components/AllocationChart').then((m) => ({ default: m.AllocationChart }))
)

export function VaultStrategiesSection({ currentVault }: { currentVault: TYDaemonVault }): ReactElement {
  const { vaults } = useYearn()
  const isDark = useDarkMode()
  const vaultVariant = currentVault.version?.startsWith('3') || currentVault.version?.startsWith('~3') ? 'v3' : 'v2'
  const { sortDirection, sortBy, onChangeSortDirection, onChangeSortBy } = useQueryArguments({
    defaultSortBy: 'allocationPercentage',
    defaultTypes: ALL_VAULTSV3_KINDS_KEYS,
    defaultPathname: '/vaults/[chainID]/[address]'
  })
  const tokenPrice = useYearnTokenPrice({
    address: currentVault.token.address,
    chainID: currentVault.chainID
  })

  const mergedList = useMemo(() => {
    const strategies = currentVault?.strategies || []
    const rows = strategies.map((strategy) => {
      const vault = vaults[strategy.address]
      if (vault) {
        return {
          ...vault,
          name: strategy.name || vault.name,
          apr: {
            ...vault.apr,
            netAPR: strategy.netAPR ?? vault.apr?.netAPR ?? 0
          },
          details: strategy.details,
          status: strategy.status,
          netAPR: strategy.netAPR
        }
      }
      return {
        ...strategy,
        apr: {
          netAPR: strategy.netAPR ?? 0
        }
      }
    })
    return rows as (TYDaemonVault & {
      details: TYDaemonVaultStrategy['details']
      status: TYDaemonVaultStrategy['status']
      netAPR: TYDaemonVaultStrategy['netAPR']
    })[]
  }, [vaults, currentVault])

  const allocatedRatio = mergedList.reduce((acc, strategy) => acc + (strategy.details?.debtRatio || 0), 0)
  const unallocatedPercentage = Math.max(0, 10000 - allocatedRatio)
  const totalAssets = currentVault.tvl.totalAssets ?? 0n
  const allocatedDebt = mergedList.reduce((acc, strategy) => acc + toBigInt(strategy.details?.totalDebt || 0), 0n)
  const unallocatedValue = totalAssets > allocatedDebt ? totalAssets - allocatedDebt : 0n

  const filteredVaultList = useMemo(() => {
    const strategies = mergedList.filter((vault) => vault.status !== 'not_active')
    return strategies
  }, [mergedList])

  const sortedVaultsToDisplay = useSortVaults(filteredVaultList, sortBy, sortDirection) as (TYDaemonVault & {
    details: TYDaemonVaultStrategy['details']
    status: TYDaemonVaultStrategy['status']
    netAPR: TYDaemonVaultStrategy['netAPR']
  })[]

  const formatAllocationAmount = useCallback(
    (totalDebt: string | undefined): string => {
      const normalized = toNormalizedBN(totalDebt || 0, currentVault.token.decimals).normalized
      const usdValue = Number(normalized) * tokenPrice
      return formatTvlDisplay(usdValue)
    },
    [currentVault.token.decimals, tokenPrice]
  )

  const activeStrategyData = useMemo(() => {
    return filteredVaultList
      .filter((strategy) => {
        const hasAllocation =
          strategy.details?.totalDebt && strategy.details.totalDebt !== '0' && strategy.details?.debtRatio
        return hasAllocation
      })
      .map((strategy) => ({
        id: strategy.address,
        name: strategy.name,
        value: (strategy.details?.debtRatio || 0) / 100,
        amount: formatAllocationAmount(strategy.details?.totalDebt)
      }))
  }, [filteredVaultList, formatAllocationAmount])

  const allocationChartData = useMemo(() => {
    const unallocatedUsdValue =
      Number(toNormalizedBN(unallocatedValue, currentVault.token?.decimals).normalized) * tokenPrice
    const unallocatedData =
      unallocatedValue > 0n
        ? {
            id: 'unallocated',
            name: 'Unallocated',
            value: unallocatedPercentage / 100,
            amount: formatTvlDisplay(unallocatedUsdValue)
          }
        : null

    return [...activeStrategyData, unallocatedData].filter(Boolean) as TAllocationChartData[]
  }, [activeStrategyData, currentVault.token?.decimals, tokenPrice, unallocatedPercentage, unallocatedValue])

  const isVaultListEmpty = mergedList.length === 0
  const isFilteredVaultListEmpty = filteredVaultList.length === 0

  return (
    <>
      <div className={cl(isFilteredVaultListEmpty ? 'hidden' : 'flex p-4 pb-2 md:p-6 md:pt-0 md:pb-2')}>
        <div
          className={
            'grid w-full grid-cols-1 place-content-start gap-y-6 md:gap-x-6 lg:max-w-[846px] lg:grid-cols-9 lg:gap-y-4'
          }
        >
          <div className={'col-span-9 flex w-full flex-col'}></div>
          <div className={'col-span-9 flex flex-col gap-6'}>
            {allocationChartData.length > 0 ? (
              <div className={'flex flex-col gap-4'}>
                <div className={'flex flex-row items-center justify-center gap-8 md:justify-start'}>
                  <Suspense
                    fallback={<div className={'size-48 md:size-32 animate-pulse rounded-full bg-surface-secondary'} />}
                  >
                    <div className={'md:hidden'}>
                      <AllocationChart
                        allocationChartData={allocationChartData}
                        width={192}
                        height={192}
                        innerRadius={64}
                        outerRadius={96}
                      />
                    </div>
                    <div className={'hidden md:block'}>
                      <AllocationChart allocationChartData={allocationChartData} />
                    </div>
                  </Suspense>
                  <div className={'hidden md:flex flex-col gap-2'}>
                    {activeStrategyData.map((item, index) => {
                      const colors = isDark ? DARK_MODE_COLORS : LIGHT_MODE_COLORS
                      const color = colors[index % colors.length]
                      return (
                        <div key={item.id} className={'flex flex-row items-center gap-2'}>
                          <div className={'h-3 w-3 rounded-sm'} style={{ backgroundColor: color }} />
                          <span className={'text-sm text-text-primary'}>{item.name}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className={'pb-6'}>
        {isVaultListEmpty ? (
          <div className={'border border-border bg-surface-secondary p-4 text-center text-text-primary'}>
            {'No strategies found for this vault.'}
          </div>
        ) : (
          <div className={'space-y-px'}>
            <VaultsListHead
              sortBy={sortBy}
              sortDirection={sortDirection}
              onSort={(newSortBy: string, newSortDirection: TSortDirection): void => {
                onChangeSortBy(newSortBy as TPossibleSortBy)
                onChangeSortDirection(newSortDirection as TSortDirection)
              }}
              items={[
                {
                  label: 'Strategy',
                  value: 'name',
                  sortable: false
                },
                {
                  label: 'Allocation %',
                  value: 'allocationPercentage',
                  sortable: true
                },
                {
                  label: 'Amount',
                  value: 'totalDebt',
                  sortable: true
                },
                {
                  label: 'APY',
                  value: 'netAPR',
                  sortable: true
                }
              ]}
            />
            {sortedVaultsToDisplay
              .filter(
                (strategy) =>
                  !(
                    strategy.status === 'unallocated' ||
                    strategy.details?.totalDebt === '0' ||
                    !strategy.details?.debtRatio
                  )
              )
              .map((strategy) => (
                <VaultsListStrategy
                  key={strategy.address}
                  isUnallocated={false}
                  details={strategy.details}
                  chainId={currentVault.chainID}
                  allocation={formatAllocationAmount(strategy.details?.totalDebt)}
                  name={strategy.name}
                  tokenAddress={currentVault.token.address}
                  address={strategy.address}
                  isVault={!!vaults[strategy.address]}
                  variant={vaultVariant}
                  apr={strategy.netAPR}
                  fees={currentVault.apr.fees}
                  vaultAddress={currentVault.address}
                />
              ))}
            {unallocatedPercentage > 0 && unallocatedValue > 0n ? (
              <div className={'w-full rounded-lg text-text-primary opacity-50'}>
                <div className={'grid grid-cols-1 md:grid-cols-24 items-center w-full gap-4 py-3 px-4 md:px-8'}>
                  <div className={'col-span-9 flex flex-row items-center gap-2'}>
                    <div className={'flex items-center justify-center size-6'}>
                      <div className={'size-2 rounded-full bg-text-secondary'} />
                    </div>
                    <strong title={'Unallocated'} className={'block truncate font-bold'}>
                      {'Unallocated'}
                    </strong>
                  </div>
                  <div className={'md:col-span-14 grid grid-cols-3 gap-2 md:grid-cols-15 md:gap-4 mt-4 md:mt-0'}>
                    <div className={'flex flex-col md:col-span-5 md:items-end'} datatype={'number'}>
                      <p className={'text-xs text-text-primary/60 mb-1 md:hidden'}>{'Allocation %'}</p>
                      <p className={'font-semibold'}>{formatPercent(unallocatedPercentage / 100, 0)}</p>
                    </div>
                    <div className={'flex flex-col md:col-span-5 md:items-end'} datatype={'number'}>
                      <p className={'text-xs text-text-primary/60 mb-1 md:hidden'}>{'Amount'}</p>
                      <p className={'font-semibold'}>
                        {formatTvlDisplay(
                          Number(toNormalizedBN(unallocatedValue, currentVault.token.decimals).normalized) * tokenPrice
                        )}
                      </p>
                    </div>
                    <div className={'flex flex-col md:col-span-5 md:items-end'} datatype={'number'}>
                      <p className={'text-xs text-text-primary/60 mb-1 md:hidden'}>{'APY'}</p>
                      <p className={'font-semibold'}>{'—'}</p>
                    </div>
                  </div>
                  <div className={'col-span-1'}></div>
                </div>
              </div>
            ) : null}
            {sortedVaultsToDisplay
              .filter(
                (strategy) =>
                  strategy.status === 'unallocated' ||
                  strategy.details?.totalDebt === '0' ||
                  !strategy.details?.debtRatio
              )
              .map((strategy) => (
                <VaultsListStrategy
                  key={strategy.address}
                  isUnallocated={true}
                  details={strategy.details}
                  chainId={currentVault.chainID}
                  allocation={formatAllocationAmount(strategy.details?.totalDebt)}
                  name={strategy.name}
                  tokenAddress={currentVault.token.address}
                  address={strategy.address}
                  isVault={!!vaults[strategy.address]}
                  variant={vaultVariant}
                  apr={strategy.netAPR}
                  fees={currentVault.apr.fees}
                  vaultAddress={currentVault.address}
                />
              ))}
          </div>
        )}
      </div>
    </>
  )
}
