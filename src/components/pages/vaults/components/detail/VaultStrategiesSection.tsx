import { ALL_VAULTSV3_KINDS_KEYS } from '@pages/vaults/constants'
import {
  getVaultAPR,
  getVaultChainID,
  getVaultName,
  getVaultStrategies,
  getVaultToken,
  getVaultTVL,
  getVaultVersion,
  type TKongVaultInput,
  type TKongVaultStrategy
} from '@pages/vaults/domain/kongVaultSelectors'
import { useQueryArguments } from '@pages/vaults/hooks/useVaultsQueryArgs'
import type { TAllocationChartData } from '@shared/components/AllocationChart'
import { DARK_MODE_COLORS, LIGHT_MODE_COLORS, useDarkMode } from '@shared/components/AllocationChart'
import { useYearn } from '@shared/contexts/useYearn'
import { useYearnTokenPrice } from '@shared/hooks/useYearnTokenPrice'
import type { TSortDirection } from '@shared/types'
import { cl, formatPercent, formatTvlDisplay, toAddress, toBigInt, toNormalizedBN } from '@shared/utils'
import type { ReactElement } from 'react'
import { lazy, Suspense, useCallback, useMemo } from 'react'
import { VaultsListHead } from './VaultsListHead'
import { VaultsListStrategy } from './VaultsListStrategy'

const AllocationChart = lazy(() =>
  import('@shared/components/AllocationChart').then((m) => ({ default: m.AllocationChart }))
)

type TStrategyRow = TKongVaultStrategy & {
  name: string
  isVault: boolean
}

export function VaultStrategiesSection({ currentVault }: { currentVault: TKongVaultInput }): ReactElement {
  const { vaults } = useYearn()
  const isDark = useDarkMode()
  const vaultVersion = getVaultVersion(currentVault)
  const vaultVariant = vaultVersion?.startsWith('3') || vaultVersion?.startsWith('~3') ? 'v3' : 'v2'
  const chainId = getVaultChainID(currentVault)
  const token = getVaultToken(currentVault)
  const fees = getVaultAPR(currentVault).fees
  const strategies = getVaultStrategies(currentVault)
  const totalAssets = getVaultTVL(currentVault).totalAssets
  const { sortDirection, sortBy, onChangeSortDirection, onChangeSortBy } = useQueryArguments({
    defaultSortBy: 'allocationPercentage',
    defaultTypes: ALL_VAULTSV3_KINDS_KEYS,
    defaultPathname: '/vaults/[chainID]/[address]'
  })
  const tokenPrice = useYearnTokenPrice({
    address: token.address,
    chainID: chainId
  })

  const mergedList = useMemo(() => {
    return strategies.map((strategy): TStrategyRow => {
      const linkedVault = vaults[toAddress(strategy.address)]
      return {
        ...strategy,
        name: strategy.name || (linkedVault ? getVaultName(linkedVault) : `Strategy ${strategy.address}`),
        isVault: Boolean(linkedVault?.address)
      }
    })
  }, [strategies, vaults])

  const allocatedRatio = mergedList.reduce((acc, strategy) => acc + (strategy.details?.debtRatio || 0), 0)
  const unallocatedPercentage = Math.max(0, 10000 - allocatedRatio)
  const allocatedDebt = mergedList.reduce((acc, strategy) => acc + toBigInt(strategy.details?.totalDebt || 0), 0n)
  const unallocatedValue = totalAssets > allocatedDebt ? totalAssets - allocatedDebt : 0n

  const filteredVaultList = useMemo(() => {
    return mergedList
  }, [mergedList])

  const sortedVaultsToDisplay = useMemo(() => {
    const direction = sortDirection === 'asc' ? 1 : -1
    const normalizedSortBy = String(sortBy)
    return filteredVaultList.toSorted((a, b) => {
      if (normalizedSortBy === 'allocationPercentage') {
        return direction * ((a.details?.debtRatio || 0) - (b.details?.debtRatio || 0))
      }
      if (normalizedSortBy === 'totalDebt') {
        return direction * Number(toBigInt(a.details?.totalDebt || 0) - toBigInt(b.details?.totalDebt || 0))
      }
      if (normalizedSortBy === 'netAPR') {
        return direction * ((a.estimatedAPY ?? a.netAPR ?? 0) - (b.estimatedAPY ?? b.netAPR ?? 0))
      }
      return direction * a.name.localeCompare(b.name)
    })
  }, [filteredVaultList, sortBy, sortDirection])

  const resolveStrategyUsdValue = useCallback(
    (totalDebt: string | undefined): number => {
      const normalized = toNormalizedBN(totalDebt || 0, token.decimals).normalized
      return Number(normalized) * tokenPrice
    },
    [token.decimals, tokenPrice]
  )

  const formatAllocationAmount = useCallback(
    (totalDebt: string | undefined): string => formatTvlDisplay(resolveStrategyUsdValue(totalDebt)),
    [resolveStrategyUsdValue]
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
    const unallocatedUsdValue = Number(toNormalizedBN(unallocatedValue, token.decimals).normalized) * tokenPrice
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
  }, [activeStrategyData, token.decimals, tokenPrice, unallocatedPercentage, unallocatedValue])

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
          <div className={'col-span-9 flex flex-col gap-6'}>
            {allocationChartData.length > 0 ? (
              <div className={'flex flex-col gap-4'}>
                <div className={'flex items-center justify-center gap-8 md:justify-start'}>
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
                  <div className={'hidden flex-col gap-2 md:flex'}>
                    {activeStrategyData.map((item, index) => {
                      const colors = isDark ? DARK_MODE_COLORS : LIGHT_MODE_COLORS
                      const color = colors[index % colors.length]
                      return (
                        <div key={item.id} className={'flex items-center gap-2'}>
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
                onChangeSortBy(newSortBy as never)
                onChangeSortDirection(newSortDirection)
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
                  details={strategy.details}
                  status={strategy.status}
                  chainId={chainId}
                  allocation={formatAllocationAmount(strategy.details?.totalDebt)}
                  totalValueUsd={resolveStrategyUsdValue(strategy.details?.totalDebt)}
                  name={strategy.name}
                  tokenAddress={token.address}
                  address={strategy.address}
                  isVault={strategy.isVault}
                  variant={vaultVariant}
                  apr={strategy.estimatedAPY}
                  netApr={strategy.netAPR}
                  fees={fees}
                />
              ))}
            {unallocatedPercentage > 0 && unallocatedValue > 0n ? (
              <div className={'w-full rounded-lg text-text-primary opacity-50'}>
                <div className={'grid w-full grid-cols-1 items-center gap-4 px-4 py-3 md:grid-cols-24 md:px-8'}>
                  <div className={'flex w-full items-center gap-2 md:col-span-9 md:w-auto'}>
                    <div className={'flex size-6 items-center justify-center'}>
                      <div className={'size-2 rounded-full bg-text-secondary'} />
                    </div>
                    <strong title={'Unallocated'} className={'block truncate font-bold'}>
                      Unallocated
                    </strong>
                  </div>
                  <div className={'grid w-full grid-cols-3 gap-2 md:col-span-14 md:grid-cols-15 md:gap-4'}>
                    <div className={'flex flex-col items-center md:items-end md:col-span-5'} datatype={'number'}>
                      <p className={'mb-1 text-xs text-text-primary/60 md:hidden'}>Allocation %</p>
                      <p className={'font-semibold'}>{formatPercent(unallocatedPercentage / 100, 0)}</p>
                    </div>
                    <div className={'flex flex-col items-center md:items-end md:col-span-5'} datatype={'number'}>
                      <p className={'mb-1 text-xs text-text-primary/60 md:hidden'}>Amount</p>
                      <p className={'font-semibold'}>
                        {formatTvlDisplay(
                          Number(toNormalizedBN(unallocatedValue, token.decimals).normalized) * tokenPrice
                        )}
                      </p>
                    </div>
                    <div className={'flex flex-col items-center md:items-end md:col-span-5'} datatype={'number'}>
                      <p className={'mb-1 text-xs text-text-primary/60 md:hidden'}>APY</p>
                      <p className={'font-semibold'}>-</p>
                    </div>
                  </div>
                  <div className={'hidden md:block md:col-span-1'}></div>
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
                  details={strategy.details}
                  status={strategy.status}
                  chainId={chainId}
                  allocation={formatAllocationAmount(strategy.details?.totalDebt)}
                  totalValueUsd={resolveStrategyUsdValue(strategy.details?.totalDebt)}
                  name={strategy.name}
                  tokenAddress={token.address}
                  address={strategy.address}
                  isVault={strategy.isVault}
                  variant={vaultVariant}
                  apr={strategy.estimatedAPY}
                  netApr={strategy.netAPR}
                  fees={fees}
                />
              ))}
          </div>
        )}
      </div>
    </>
  )
}
