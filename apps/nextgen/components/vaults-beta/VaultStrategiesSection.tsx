import type { TAllocationChartData } from '@lib/components/AllocationChart'
import { AllocationChart } from '@lib/components/AllocationChart'
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

function UnallocatedStrategy({
  unallocatedPercentage,
  unallocatedValue
}: {
  unallocatedPercentage: number
  unallocatedValue: string
}): ReactElement {
  return (
    <div
      className={cl('w-full group', 'relative transition-all duration-300 ease-in-out', 'text-white', 'rounded-3xl')}
    >
      <div
        className={cl(
          'absolute inset-0 rounded-2xl',
          'opacity-20 transition-opacity  pointer-events-none',
          'bg-[linear-gradient(80deg,#2C3DA6,#D21162)]'
        )}
      />

      <div
        className={cl(
          'grid grid-cols-1 md:grid-cols-12 text-neutral-900 items-center w-full py-3 md:px-8 px-4 justify-between'
        )}
      >
        <div className={cl('col-span-5 flex flex-row items-center gap-4 z-10')}>
          <div className={'flex items-center justify-center'}>
            <button className={cl('text-sm font-bold transition-all duration-300 ease-in-out')}>{'●'}</button>
          </div>

          <strong title={'Unallocated'} className={'block truncate font-bold '}>
            {'Unallocated'}
          </strong>
        </div>

        <div
          className={cl(
            'md:col-span-7 z-10',
            'grid grid-cols-1 sm:grid-cols-3 md:grid-cols-12 md:gap-4',
            'mt-4 md:mt-0'
          )}
        >
          <div
            className={'items-right flex flex-row justify-between sm:flex-col md:col-span-3 md:text-right'}
            datatype={'number'}
          >
            <p className={'inline text-start text-xs text-neutral-800/60 md:hidden'}>{'Percentage'}</p>
            <p>{formatPercent(unallocatedPercentage / 100, 0)}</p>
          </div>
          <div
            className={'items-right flex flex-row justify-between sm:flex-col md:col-span-4 md:-mr-5 md:text-right'}
            datatype={'number'}
          >
            <p className={'inline text-start text-xs text-neutral-800/60 md:hidden'}>{'Amount'}</p>
            <p>{unallocatedValue}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export function VaultStrategiesSection({ currentVault }: { currentVault: TYDaemonVault }): ReactElement {
  const { vaults } = useYearn()
  const { sortDirection, sortBy, onChangeSortDirection, onChangeSortBy } = useQueryArguments({
    defaultSortBy: 'allocationPercentage',
    defaultTypes: ALL_VAULTSV3_KINDS_KEYS,
    defaultPathname: '/v3/[chainID]/[address]'
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
      <div className={cl(isFilteredVaultListEmpty ? 'hidden' : 'flex p-4 md:p-8 lg:pr-0')}>
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
                      const colors = ['#ff6ba5', '#ffb3d1', '#ff8fbb', '#ffd6e7', '#d21162', '#ff4d94']
                      const color = colors[index % colors.length]
                      return (
                        <div key={item.id} className={'flex flex-row items-center gap-2'}>
                          <div className={'h-3 w-3 rounded-sm'} style={{ backgroundColor: color }} />
                          <span className={'text-sm text-neutral-900'}>{item.name}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            ) : null}
            {unallocatedPercentage > 0 && unallocatedValue > 0 ? (
              <UnallocatedStrategy
                unallocatedPercentage={unallocatedPercentage}
                unallocatedValue={toNormalizedBN(unallocatedValue, currentVault.token.decimals).display}
              />
            ) : null}
          </div>
        </div>
      </div>

      <div className={'pb-2'}>
        {isVaultListEmpty ? (
          <div className={'border border-neutral-200 bg-neutral-100 p-4 text-center text-neutral-900'}>
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
            {sortedVaultsToDisplay.map((strategy) => (
              <NextgenVaultsListStrategy
                key={strategy.address}
                isUnallocated={
                  strategy.status === 'unallocated' ||
                  strategy.details?.totalDebt === '0' ||
                  !strategy.details?.debtRatio
                }
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
