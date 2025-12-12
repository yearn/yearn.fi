import type { TAllocationChartData } from '@lib/components/AllocationChart'
import { AllocationChart, DARK_MODE_COLORS, LIGHT_MODE_COLORS, useDarkMode } from '@lib/components/AllocationChart'
import { useYearn } from '@lib/contexts/useYearn'
import { useYearnTokenPrice } from '@lib/hooks/useYearnTokenPrice'
import type { TSortDirection } from '@lib/types'
import { cl, formatCounterValue, formatPercent, toNormalizedBN } from '@lib/utils'
import type { TYDaemonVault, TYDaemonVaultStrategy } from '@lib/utils/schemas/yDaemonVaultsSchemas'
import type { TPossibleSortBy } from '@vaults-v2/hooks/useSortVaults'
import { useSortVaults } from '@vaults-v2/hooks/useSortVaults'
import { useQueryArguments } from '@vaults-v2/hooks/useVaultsQueryArgs'
import { ALL_VAULTSV3_KINDS_KEYS } from '@vaults-v3/constants'
import type { ReactElement } from 'react'
import { useMemo } from 'react'
import { NextgenVaultsListHead } from './NextgenVaultsListHead'
import { NextgenVaultsListStrategy } from './NextgenVaultsListStrategy'

export function VaultStrategiesSection({ currentVault }: { currentVault: TYDaemonVault }): ReactElement {
  const { vaults } = useYearn()
  const isDark = useDarkMode()
  const { sortDirection, sortBy, onChangeSortDirection, onChangeSortBy } = useQueryArguments({
    defaultSortBy: 'allocationPercentage',
    defaultTypes: ALL_VAULTSV3_KINDS_KEYS,
    defaultPathname: '/vaults-beta/[chainID]/[address]'
  })
  const tokenPrice = useYearnTokenPrice({
    address: currentVault.token.address,
    chainID: currentVault.chainID
  })

  const vaultList = useMemo((): TYDaemonVault[] => {
    const _vaultList = []
    for (const strategy of currentVault?.strategies || []) {
      _vaultList.push({
        ...vaults[strategy.address],
        details: strategy.details,
        status: strategy.status
      })
    }
    return _vaultList.filter((vault) => !!vault.address)
  }, [vaults, currentVault])

  const strategyList = useMemo((): TYDaemonVaultStrategy[] => {
    const _stratList = []
    for (const strategy of currentVault?.strategies || []) {
      if (!vaults[strategy.address]) {
        _stratList.push(strategy)
      }
    }
    return _stratList
  }, [vaults, currentVault])

  const mergedList = useMemo(
    () =>
      [...vaultList, ...strategyList] as (TYDaemonVault & {
        details: TYDaemonVaultStrategy['details']
        status: TYDaemonVaultStrategy['status']
      })[],
    [vaultList, strategyList]
  )

  const unallocatedPercentage =
    100 * 100 - mergedList.reduce((acc, strategy) => acc + (strategy.details?.debtRatio || 0), 0)
  const unallocatedValue =
    Number(currentVault.tvl.totalAssets) -
    mergedList.reduce((acc, strategy) => acc + Number(strategy.details?.totalDebt || 0), 0)

  const filteredVaultList = useMemo(() => {
    const strategies = mergedList.filter((vault) => vault.status !== 'not_active')
    return strategies
  }, [mergedList])

  const sortedVaultsToDisplay = useSortVaults(filteredVaultList, sortBy, sortDirection) as (TYDaemonVault & {
    details: TYDaemonVaultStrategy['details']
    status: TYDaemonVaultStrategy['status']
    netAPR: TYDaemonVaultStrategy['netAPR']
  })[]

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
        amount: formatCounterValue(
          toNormalizedBN(strategy.details?.totalDebt || 0, currentVault.token.decimals).display,
          tokenPrice
        )
      }))
  }, [filteredVaultList, currentVault.token.decimals, tokenPrice])

  const allocationChartData = useMemo(() => {
    const unallocatedData =
      unallocatedValue > 0
        ? {
            id: 'unallocated',
            name: 'Unallocated',
            value: unallocatedPercentage / 100,
            amount: formatCounterValue(
              toNormalizedBN(unallocatedValue, currentVault.token?.decimals).display,
              tokenPrice
            )
          }
        : null

    return [...activeStrategyData, unallocatedData].filter(Boolean) as TAllocationChartData[]
  }, [activeStrategyData, currentVault.token?.decimals, tokenPrice, unallocatedPercentage, unallocatedValue])

  const isVaultListEmpty = mergedList.length === 0
  const isFilteredVaultListEmpty = filteredVaultList.length === 0

  return (
    <>
      <div className={cl(isFilteredVaultListEmpty ? 'hidden' : 'flex px-4 pb-2 md:px-8')}>
        <div
          className={
            'grid w-full grid-cols-1 place-content-start gap-y-6 md:gap-x-6 lg:max-w-[846px] lg:grid-cols-9 lg:gap-y-4'
          }
        >
          <div className={'col-span-9 flex w-full flex-col'}></div>
          <div className={'col-span-9 flex flex-col gap-6'}>
            {allocationChartData.length > 0 ? (
              <div className={'flex flex-col gap-4'}>
                <div className={'flex flex-row items-center gap-8'}>
                  <AllocationChart allocationChartData={allocationChartData} />
                  <div className={'flex flex-col gap-2'}>
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

      <div className={'pb-2'}>
        {isVaultListEmpty ? (
          <div className={'border border-border bg-surface-secondary p-4 text-center text-text-primary'}>
            {'No strategies found for this vault.'}
          </div>
        ) : (
          <div className={'space-y-px'}>
            <NextgenVaultsListHead
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
                <NextgenVaultsListStrategy
                  key={strategy.address}
                  isUnallocated={false}
                  details={strategy.details}
                  chainId={currentVault.chainID}
                  allocation={formatCounterValue(
                    toNormalizedBN(strategy.details?.totalDebt || 0, currentVault.token.decimals).display,
                    tokenPrice
                  )}
                  name={strategy.name}
                  tokenAddress={currentVault.token.address}
                  address={strategy.address}
                  isVault={!!vaults[strategy.address]}
                  variant="v3"
                  apr={strategy.netAPR}
                  fees={currentVault.apr.fees}
                />
              ))}
            {unallocatedPercentage > 0 && unallocatedValue > 0 ? (
              <div className={'w-full rounded-lg text-text-primary opacity-50'}>
                <div className={'grid grid-cols-1 md:grid-cols-24 items-center w-full gap-4 py-3 px-4 md:px-8'}>
                  <div className={'col-span-9 flex flex-row items-center gap-4'}>
                    <div className={'rounded-full size-6'}>
                      <div className={'flex items-center justify-center size-6 text-text-secondary'}>{'●'}</div>
                    </div>
                    <strong title={'Unallocated'} className={'block truncate font-bold'}>
                      {'Unallocated'}
                    </strong>
                  </div>
                  <div
                    className={'md:col-span-14 grid grid-cols-1 sm:grid-cols-3 md:grid-cols-15 md:gap-4 mt-4 md:mt-0'}
                  >
                    <div
                      className={'flex flex-row justify-between sm:flex-col md:col-span-5 md:text-right'}
                      datatype={'number'}
                    >
                      <p className={'inline text-start text-xs text-text-primary/60 md:hidden'}>{'Allocation %'}</p>
                      <p>{formatPercent(unallocatedPercentage / 100, 0)}</p>
                    </div>
                    <div
                      className={'flex flex-row justify-between sm:flex-col md:col-span-5 md:text-right'}
                      datatype={'number'}
                    >
                      <p className={'inline text-start text-xs text-text-primary/60 md:hidden'}>{'Amount'}</p>
                      <p>{toNormalizedBN(unallocatedValue, currentVault.token.decimals).display}</p>
                    </div>
                    <div
                      className={'flex flex-row justify-between sm:flex-col md:col-span-5 md:text-right'}
                      datatype={'number'}
                    >
                      <p className={'inline text-start text-xs text-text-primary/60 md:hidden'}>{'APY'}</p>
                      <p>{'—'}</p>
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
                <NextgenVaultsListStrategy
                  key={strategy.address}
                  isUnallocated={true}
                  details={strategy.details}
                  chainId={currentVault.chainID}
                  allocation={formatCounterValue(
                    toNormalizedBN(strategy.details?.totalDebt || 0, currentVault.token.decimals).display,
                    tokenPrice
                  )}
                  name={strategy.name}
                  tokenAddress={currentVault.token.address}
                  address={strategy.address}
                  isVault={!!vaults[strategy.address]}
                  variant="v3"
                  apr={strategy.netAPR}
                  fees={currentVault.apr.fees}
                />
              ))}
          </div>
        )}
      </div>
    </>
  )
}
