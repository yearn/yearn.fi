import Link from '@components/Link'
import { Button } from '@lib/components/Button'
import { useWallet } from '@lib/contexts/useWallet'
import { useWeb3 } from '@lib/contexts/useWeb3'
import { useYearn } from '@lib/contexts/useYearn'
import { IconSpinner } from '@lib/icons/IconSpinner'
import type { TSortDirection } from '@lib/types'
import { isZero, toAddress } from '@lib/utils'
import type { TYDaemonVault } from '@lib/utils/schemas/yDaemonVaultsSchemas'
import { calculateVaultEstimatedAPY } from '@lib/utils/vaultApy'
import { VaultsListHead } from '@vaults/components/list/VaultsListHead'
import { VaultsListRow } from '@vaults/components/list/VaultsListRow'
import { SuggestedVaultCard } from '@vaults/components/SuggestedVaultCard'
import { type TPossibleSortBy, useSortVaults } from '@vaults/shared/index'
import { isAllocatorVaultOverride } from '@vaults/shared/utils/vaultListFacets'
import type { ReactElement } from 'react'
import { useMemo, useState } from 'react'

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
})

const percentFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
})

function HoldingsEmptyState({ isActive, onConnect }: { isActive: boolean; onConnect: () => void }): ReactElement {
  return (
    <div className={'flex flex-col items-center justify-center gap-4 px-6 py-16 text-center'}>
      <p className={'text-lg font-semibold text-text-primary'}>
        {isActive ? 'No vault positions yet' : 'Connect a wallet to get started'}
      </p>
      <p className={'max-w-md text-sm text-text-secondary'}>
        {isActive ? 'Deposit into a Yearn vault to see it here.' : 'Link a wallet to load your Yearn balances.'}
      </p>
      {isActive ? (
        <Link to="/vaults" className={'yearn--button'} data-variant={'filled'}>
          {'Browse vaults'}
        </Link>
      ) : (
        <Button onClick={onConnect} variant={'filled'}>
          {'Connect wallet'}
        </Button>
      )}
    </div>
  )
}

function PortfolioPage(): ReactElement {
  const {
    cumulatedValueInV2Vaults,
    cumulatedValueInV3Vaults,
    isLoading: isWalletLoading,
    getBalance,
    balances
  } = useWallet()
  const { isActive, openLoginModal, isUserConnecting, isIdentityLoading } = useWeb3()
  const { getPrice, katanaAprs, vaults, vaultsMigrations, vaultsRetired, isLoadingVaultList } = useYearn()
  const [sortBy, setSortBy] = useState<TPossibleSortBy>('deposited')
  const [sortDirection, setSortDirection] = useState<TSortDirection>('desc')

  const vaultLookup = useMemo(() => {
    const map = new Map<string, TYDaemonVault>()
    const allVaults = {
      ...vaults,
      ...vaultsMigrations,
      ...vaultsRetired
    }

    Object.values(allVaults).forEach((vault) => {
      const vaultKey = `${vault.chainID}_${toAddress(vault.address)}`
      map.set(vaultKey, vault)

      if (vault.staking?.available && vault.staking.address) {
        const stakingKey = `${vault.chainID}_${toAddress(vault.staking.address)}`
        map.set(stakingKey, vault)
      }
    })

    return map
  }, [vaults, vaultsMigrations, vaultsRetired])

  const holdingsVaults = useMemo(() => {
    const result: TYDaemonVault[] = []
    const seen = new Set<string>()

    Object.entries(balances || {}).forEach(([chainIDKey, perChain]) => {
      const parsedChainID = Number(chainIDKey)
      const chainID = Number.isFinite(parsedChainID) ? parsedChainID : undefined
      Object.values(perChain || {}).forEach((token) => {
        if (!token?.balance || token.balance.raw <= 0n) {
          return
        }
        const tokenChainID = chainID ?? token.chainID
        const tokenKey = `${tokenChainID}_${toAddress(token.address)}`
        const vault = vaultLookup.get(tokenKey)
        if (!vault) {
          return
        }
        const vaultKey = `${vault.chainID}_${toAddress(vault.address)}`
        if (seen.has(vaultKey)) {
          return
        }
        seen.add(vaultKey)
        result.push(vault)
      })
    })

    return result
  }, [balances, vaultLookup])

  const migratableSet = useMemo(
    () => new Set(Object.keys(vaultsMigrations).map((address) => toAddress(address))),
    [vaultsMigrations]
  )
  const retiredSet = useMemo(
    () => new Set(Object.keys(vaultsRetired).map((address) => toAddress(address))),
    [vaultsRetired]
  )

  const vaultFlags = useMemo(() => {
    const flags: Record<
      string,
      { hasHoldings: boolean; isMigratable: boolean; isRetired: boolean; isHidden: boolean }
    > = {}

    holdingsVaults.forEach((vault) => {
      const key = `${vault.chainID}_${toAddress(vault.address)}`
      flags[key] = {
        hasHoldings: true,
        isMigratable: migratableSet.has(toAddress(vault.address)),
        isRetired: retiredSet.has(toAddress(vault.address)),
        isHidden: Boolean(vault.info?.isHidden)
      }
    })

    return flags
  }, [holdingsVaults, migratableSet, retiredSet])

  const isSearchingBalances =
    (isActive || isUserConnecting) && (isWalletLoading || isUserConnecting || isIdentityLoading)
  const isLoading = isLoadingVaultList
  const isHoldingsLoading = (isLoading && isActive) || isSearchingBalances

  const v3Vaults = useMemo(
    () =>
      Object.values(vaults).filter(
        (vault) => vault.version?.startsWith('3') || vault.version?.startsWith('~3') || isAllocatorVaultOverride(vault)
      ),
    [vaults]
  )

  const sortedHoldings = useSortVaults(holdingsVaults, sortBy, sortDirection)
  const sortedCandidates = useSortVaults(v3Vaults, 'featuringScore', 'desc')

  const holdingsKeySet = useMemo(
    () => new Set(sortedHoldings.map((vault) => `${vault.chainID}_${toAddress(vault.address)}`)),
    [sortedHoldings]
  )

  const suggestedVaults = useMemo(
    () =>
      sortedCandidates
        .filter((vault) => !holdingsKeySet.has(`${vault.chainID}_${toAddress(vault.address)}`))
        .slice(0, 4),
    [sortedCandidates, holdingsKeySet]
  )

  const hasHoldings = sortedHoldings.length > 0
  const totalPortfolioValue = (cumulatedValueInV2Vaults || 0) + (cumulatedValueInV3Vaults || 0)

  const getVaultEstimatedAPY = useMemo(
    () =>
      (vault: (typeof holdingsVaults)[number]): number | null => {
        const apy = calculateVaultEstimatedAPY(vault, katanaAprs)
        return apy === 0 && !vault.apr?.netAPR ? null : apy
      },
    [katanaAprs]
  )

  const getVaultHistoricalAPY = useMemo(
    () =>
      (vault: (typeof holdingsVaults)[number]): number | null => {
        const monthlyAPY = vault.apr?.points?.monthAgo
        const weeklyAPY = vault.apr?.points?.weekAgo
        const chosenAPY = !isZero(monthlyAPY || 0) ? monthlyAPY : weeklyAPY
        return typeof chosenAPY === 'number' ? chosenAPY : null
      },
    []
  )

  const getVaultValue = useMemo(
    () =>
      (vault: (typeof holdingsVaults)[number]): number => {
        const shareBalance = getBalance({
          address: vault.address,
          chainID: vault.chainID
        })
        const price = getPrice({
          address: vault.address,
          chainID: vault.chainID
        })
        const baseValue = shareBalance.normalized * price.normalized

        let stakingValue = 0
        if (vault.staking?.available && vault.staking.address) {
          const stakingBalance = getBalance({
            address: vault.staking.address,
            chainID: vault.chainID
          })
          stakingValue = stakingBalance.normalized * price.normalized
        }

        return baseValue + stakingValue
      },
    [getBalance, getPrice]
  )

  const blendedMetrics = useMemo(() => {
    let totalValue = 0
    let weightedCurrent = 0
    let weightedHistorical = 0
    let hasCurrent = false
    let hasHistorical = false

    holdingsVaults.forEach((vault) => {
      const value = getVaultValue(vault)
      if (!Number.isFinite(value) || value <= 0) {
        return
      }

      const estimatedAPY = getVaultEstimatedAPY(vault)
      if (typeof estimatedAPY === 'number' && Number.isFinite(estimatedAPY)) {
        weightedCurrent += value * estimatedAPY
        hasCurrent = true
      }

      const historicalAPY = getVaultHistoricalAPY(vault)
      if (typeof historicalAPY === 'number' && Number.isFinite(historicalAPY)) {
        weightedHistorical += value * historicalAPY
        hasHistorical = true
      }

      totalValue += value
    })

    const blendedCurrentAPY = totalValue > 0 && hasCurrent ? weightedCurrent / totalValue : null
    const blendedHistoricalAPY = totalValue > 0 && hasHistorical ? weightedHistorical / totalValue : null
    const blendedCurrentAPYPercent = blendedCurrentAPY !== null ? blendedCurrentAPY * 100 : null
    const blendedHistoricalAPYPercent = blendedHistoricalAPY !== null ? blendedHistoricalAPY * 100 : null
    const estimatedAnnualReturn = blendedCurrentAPY !== null ? totalPortfolioValue * blendedCurrentAPY : null

    return {
      blendedCurrentAPY: blendedCurrentAPYPercent,
      blendedHistoricalAPY: blendedHistoricalAPYPercent,
      estimatedAnnualReturn
    }
  }, [getVaultEstimatedAPY, getVaultHistoricalAPY, getVaultValue, holdingsVaults, totalPortfolioValue])

  return (
    <div className={'min-h-[calc(100vh-var(--header-height))] w-full bg-app pb-8'}>
      <div className={'mx-auto flex w-full max-w-[1232px] flex-col gap-5 px-4 pb-16'}>
        <section className={'flex flex-col gap-4'}>
          <div className={'flex items-center gap-2 mt-2 text-sm text-text-secondary'}>
            <Link to={'/'} className={'transition-colors hover:text-text-primary'}>
              {'Home'}
            </Link>
            <span>{'>'}</span>
            <span className={'font-medium text-text-primary'}>{'Account Overview'}</span>
          </div>
          <div>
            <h1 className={'text-4xl font-black text-text-primary'}>{'Account Overview'}</h1>
          </div>
          {isActive ? (
            <div>
              <p className={'mt-2 text-base text-text-secondary'}>
                {'Monitor your balances, returns, and discover new vaults.'}
              </p>
              <div className={'grid grid-cols-1 gap-4 md:grid-cols-4'}>
                <div className={'rounded-3xl border border-border bg-surface p-6'}>
                  <p className={'text-sm font-semibold uppercase tracking-wide text-text-secondary'}>
                    {'Total balance'}
                  </p>
                  <p className={'mt-3 text-3xl font-black text-text-primary'}>
                    {isSearchingBalances ? (
                      <span
                        className={
                          'inline-flex h-9 w-40 items-center justify-center rounded-xl bg-surface-secondary animate-pulse'
                        }
                      >
                        <IconSpinner className={'h-4 w-4 text-text-secondary'} />
                      </span>
                    ) : (
                      currencyFormatter.format(totalPortfolioValue)
                    )}
                  </p>
                </div>

                <div className={'rounded-3xl border border-border bg-surface p-6'}>
                  <p className={'text-sm font-semibold uppercase tracking-wide text-text-secondary'}>
                    {'Blended Current APY'}
                  </p>
                  <p className={'mt-3 text-3xl font-black text-text-primary'}>
                    {isHoldingsLoading ? (
                      <span className={'inline-flex h-9 w-20 items-center justify-center animate-spin'}>
                        <IconSpinner className={'h-5 w-5 text-text-secondary'} />
                      </span>
                    ) : blendedMetrics.blendedCurrentAPY !== null ? (
                      `${percentFormatter.format(blendedMetrics.blendedCurrentAPY)}%`
                    ) : (
                      '—'
                    )}
                  </p>
                  <p className={'mt-2 text-sm text-text-secondary'}>
                    {'Weighted by your total deposits across all Yearn vaults.'}
                  </p>
                </div>

                <div className={'rounded-3xl border border-border bg-surface p-6'}>
                  <p className={'text-sm font-semibold uppercase tracking-wide text-text-secondary'}>
                    {'Blended 30-day APY'}
                  </p>
                  <p className={'mt-3 text-3xl font-black text-text-primary'}>
                    {isHoldingsLoading ? (
                      <span className={'inline-flex h-9 w-20 items-center justify-center animate-spin'}>
                        <IconSpinner className={'h-5 w-5 text-text-secondary'} />
                      </span>
                    ) : blendedMetrics.blendedHistoricalAPY !== null ? (
                      `${percentFormatter.format(blendedMetrics.blendedHistoricalAPY)}%`
                    ) : (
                      '—'
                    )}
                  </p>
                  <p className={'mt-2 text-sm text-text-secondary'}>
                    {'Blended 30-day performance using your current positions.'}
                  </p>
                </div>

                <div className={'rounded-3xl border border-border bg-surface p-6'}>
                  <p className={'text-sm font-semibold uppercase tracking-wide text-text-secondary'}>
                    {'Estimated Annual Return'}
                  </p>
                  <p className={'mt-3 text-3xl font-black text-text-primary'}>
                    {isHoldingsLoading ? (
                      <span
                        className={
                          'inline-flex h-9 w-40 items-center justify-center rounded-xl bg-surface-secondary animate-pulse'
                        }
                      >
                        <IconSpinner className={'h-4 w-4 text-text-secondary'} />
                      </span>
                    ) : blendedMetrics.estimatedAnnualReturn !== null ? (
                      currencyFormatter.format(blendedMetrics.estimatedAnnualReturn)
                    ) : (
                      '—'
                    )}
                  </p>
                  <p className={'mt-2 text-sm text-text-secondary'}>
                    {'Projects potential returns based on your blended current APY.'}
                  </p>
                </div>
              </div>
            </div>
          ) : null}
        </section>

        <section className={'flex flex-col gap-4'}>
          <div className={'flex flex-wrap items-center justify-between gap-4'}>
            <div>
              <h2 className={'text-2xl font-semibold text-text-primary'}>{'Your vaults'}</h2>
              <p className={'text-sm text-text-secondary'}>{'Track every Yearn position you currently hold.'}</p>
            </div>
            {hasHoldings ? (
              <Link to="/vaults" className={'yearn--button text-sm'} data-variant={'light'}>
                {'Browse more vaults'}
              </Link>
            ) : null}
          </div>
          <div className={'overflow-hidden rounded-3xl border border-border'}>
            <div className={'flex flex-col'}>
              <VaultsListHead
                sortBy={sortBy}
                sortDirection={sortDirection}
                onSort={(newSortBy, newDirection): void => {
                  setSortBy(newSortBy as TPossibleSortBy)
                  setSortDirection(newDirection)
                }}
                wrapperClassName={'rounded-t-3xl bg-surface-secondary'}
                containerClassName={'rounded-t-3xl bg-surface-secondary'}
                items={[
                  {
                    type: 'sort',
                    label: 'Vault / Featuring Score',
                    value: 'featuringScore',
                    sortable: true,
                    className: 'col-span-12'
                  },
                  {
                    type: 'sort',
                    label: 'Est. APY',
                    value: 'estAPY',
                    sortable: true,
                    className: 'col-span-4'
                  },
                  {
                    type: 'sort',
                    label: 'TVL',
                    value: 'tvl',
                    sortable: true,
                    className: 'col-span-4'
                  },
                  {
                    type: 'sort',
                    label: 'Your Holdings',
                    value: 'deposited',
                    sortable: true,
                    className: 'col-span-4 justify-end'
                  }
                ]}
              />
              {isHoldingsLoading ? (
                <div
                  className={'flex flex-col items-center justify-center gap-3 px-6 py-16 text-sm text-text-secondary'}
                >
                  <IconSpinner className={'h-6 w-6 text-text-secondary'} />
                  <span>{'Searching for Yearn balances...'}</span>
                </div>
              ) : hasHoldings ? (
                <div className={'flex flex-col gap-px'}>
                  {sortedHoldings.map((vault) => {
                    const key = `${vault.chainID}_${toAddress(vault.address)}`
                    const isV3 = vault.version?.startsWith('3') || vault.version?.startsWith('~3')
                    const hrefOverride = isV3 ? undefined : `/vaults/${vault.chainID}/${toAddress(vault.address)}`
                    return (
                      <VaultsListRow
                        key={key}
                        currentVault={vault}
                        flags={vaultFlags[key]}
                        hrefOverride={hrefOverride}
                        showBoostDetails={false}
                      />
                    )
                  })}
                </div>
              ) : (
                <HoldingsEmptyState isActive={isActive} onConnect={openLoginModal} />
              )}
            </div>
          </div>
        </section>

        {suggestedVaults.length > 0 ? (
          <section className={'flex flex-col gap-4'}>
            <div>
              <h2 className={'text-2xl font-semibold text-text-primary'}>{'You might like'}</h2>
              <p className={'text-sm text-text-secondary'}>
                {'Vaults picked for you based on performance and popularity.'}
              </p>
            </div>
            <div className={'grid gap-4 md:grid-cols-2 xl:grid-cols-4'}>
              {suggestedVaults.map((vault) => {
                const key = `${vault.chainID}_${toAddress(vault.address)}`
                return <SuggestedVaultCard key={key} vault={vault} />
              })}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  )
}

export default PortfolioPage
