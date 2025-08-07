import type { TAllocationChartData } from '@lib/components/AllocationChart'
import { AllocationChart } from '@lib/components/AllocationChart'
import { VaultsListStrategy } from '@lib/components/VaultsListStrategy'
import { useYearn } from '@lib/contexts/useYearn'
import { useYearnTokenPrice } from '@lib/hooks/useYearnTokenPrice'
import type { TSortDirection } from '@lib/types'
import { cl, formatCounterValue, formatPercent, toNormalizedBN } from '@lib/utils'
import type { TYDaemonVault, TYDaemonVaultStrategy } from '@lib/utils/schemas/yDaemonVaultsSchemas'
import type { TPossibleSortBy } from '@vaults-v2/hooks/useSortVaults'
import { useSortVaults } from '@vaults-v2/hooks/useSortVaults'
import { useQueryArguments } from '@vaults-v2/hooks/useVaultsQueryArgs'
import { VaultsV3ListHead } from '@vaults-v3/components/list/VaultsV3ListHead'
import { ALL_VAULTSV3_KINDS_KEYS } from '@vaults-v3/constants'
import type { ReactElement } from 'react'
import { useMemo } from 'react'

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
          'bg-[linear-gradient(80deg,_#2C3DA6,_#D21162)]'
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
            className={
              'items-right flex flex-row justify-between sm:flex-col md:col-span-4 md:mr-[-20px] md:text-right'
            }
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

export function VaultDetailsStrategies({ currentVault }: { currentVault: TYDaemonVault }): ReactElement {
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

  /* 🔵 - Yearn Finance **************************************************************************
   **	Source of truth for the unallocated percentage and value.
   **********************************************************************************************/
  const unallocatedPercentage =
    100 * 100 - mergedList.reduce((acc, strategy) => acc + (strategy.details?.debtRatio || 0), 0)

  /* 🔵 - Yearn Finance **************************************************************************
   **	True when the unallocated percentage is greater than 0. Might be a non-zero value due to
   **	price precision.
   **********************************************************************************************/
  const unallocatedValue =
    Number(currentVault.tvl.totalAssets) -
    mergedList.reduce((acc, strategy) => acc + Number(strategy.details?.totalDebt || 0), 0)

  const filteredVaultList = useMemo(() => {
    const strategies = mergedList.filter((vault) => vault.status !== 'not_active')
    return strategies
  }, [mergedList])

  /* 🔵 - Yearn Finance **************************************************************************
   **	Then, once we have reduced the list of vaults to display, we can sort them. The sorting
   **	is done via a custom method that will sort the vaults based on the sortBy and
   **	sortDirection values.
   **********************************************************************************************/
  const sortedVaultsToDisplay = useSortVaults(filteredVaultList, sortBy, sortDirection) as (TYDaemonVault & {
    details: TYDaemonVaultStrategy['details']
    status: TYDaemonVaultStrategy['status']
    netAPR: TYDaemonVaultStrategy['netAPR']
  })[]

  const allocationChartData = useMemo(() => {
    const strategyData = filteredVaultList.map((strategy) => ({
      id: strategy.address,
      name: strategy.name,
      value: (strategy.details?.debtRatio || 0) / 100,
      amount: formatCounterValue(
        toNormalizedBN(strategy.details?.totalDebt || 0, currentVault.token.decimals).display,
        tokenPrice
      )
    }))

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

    return [...strategyData, unallocatedData].filter(Boolean) as TAllocationChartData[]
  }, [currentVault.token?.decimals, filteredVaultList, tokenPrice, unallocatedPercentage, unallocatedValue])

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
          <div className={'col-span-9 flex w-full flex-col'}>
            <VaultsV3ListHead
              sortBy={sortBy}
              sortDirection={sortDirection}
              onSort={(newSortBy: string, newSortDirection: TSortDirection): void => {
                if (newSortDirection === '') {
                  onChangeSortBy('featuringScore')
                  onChangeSortDirection('')
                  return
                }
                onChangeSortBy(newSortBy as TPossibleSortBy)
                onChangeSortDirection(newSortDirection as TSortDirection)
              }}
              items={[
                { label: 'Vault', value: 'name', sortable: false, className: 'ml-20' },
                {
                  label: 'Allocation %',
                  value: 'allocationPercentage',
                  sortable: true,
                  className: 'col-span-4'
                },
                {
                  label: 'Allocation $',
                  value: 'allocation',
                  sortable: true,
                  className: 'col-span-4'
                },
                {
                  label: 'Est. APY',
                  value: 'estAPY',
                  sortable: true,
                  className: 'col-span-4 justify-end'
                }
              ]}
            />
            <div className={'grid gap-4'}>
              {sortedVaultsToDisplay.map((vault) => (
                <VaultsListStrategy
                  key={`${vault?.chainID || currentVault.chainID}_${vault.address}`}
                  isUnallocated={
                    vault.status === 'unallocated' || vault.details?.totalDebt === '0' || !vault.details?.debtRatio
                  }
                  details={vault.details}
                  chainId={vault.chainID || currentVault.chainID}
                  variant={'v3'}
                  isVault={!!vault.token}
                  address={vault.address}
                  name={vault.name}
                  tokenAddress={vault.token?.address || currentVault.token.address}
                  allocation={formatCounterValue(
                    toNormalizedBN(vault.details?.totalDebt || 0, vault.token?.decimals || currentVault.token?.decimals)
                      .display,
                    tokenPrice
                  )}
                  apr={vault.netAPR || vault.apr?.forwardAPR.netAPR || vault.apr?.netAPR}
                  fees={vault.apr?.fees}
                />
              ))}
              {unallocatedPercentage > 0 && (
                <UnallocatedStrategy
                  key={'unallocated'}
                  unallocatedPercentage={unallocatedPercentage}
                  unallocatedValue={formatCounterValue(
                    toNormalizedBN(unallocatedValue, currentVault.token?.decimals).display,
                    tokenPrice
                  )}
                />
              )}
            </div>
          </div>
          <div className={'col-span-9 flex lg:mt-4 lg:hidden'}>
            <div className={'flex size-full items-start justify-center'}>
              <AllocationChart
                allocationChartData={allocationChartData}
                colors={['#ff6ba5', '#ffb3d1', '#ff8fbb', '#ffd6e7', '#d21162', '#ff4d94']}
                textColor={'fill-white'}
              />
            </div>
          </div>
        </div>
        <div className={'mx-auto flex max-lg:hidden lg:mt-4'}>
          <div className={'flex size-full items-start justify-center'}>
            <AllocationChart
              allocationChartData={allocationChartData}
              colors={['#ff6ba5', '#ffb3d1', '#ff8fbb', '#ffd6e7', '#d21162', '#ff4d94']}
              textColor={'fill-white'}
            />
          </div>
        </div>
      </div>

      <div className={cl(isFilteredVaultListEmpty ? '' : 'hidden')}>
        <div className={'mx-auto flex h-96 w-full flex-col items-center justify-center px-10 py-2 md:w-3/4'}>
          <b className={'text-center text-lg'}>
            {isVaultListEmpty ? 'This vault IS the strategy' : 'No strategies found'}
          </b>
          <p className={'text-center text-neutral-600'}>
            {isVaultListEmpty
              ? "Surprise! This vault doesn't have any strategies. It is the strategy. #brainexplosion"
              : "Surprise! This vault doesn't have any strategies."}
          </p>
        </div>
      </div>
    </>
  )
}
