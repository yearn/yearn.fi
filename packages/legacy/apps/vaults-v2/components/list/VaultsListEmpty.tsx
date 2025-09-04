import { Button } from '@lib/components/Button'
import { cl, isZero } from '@lib/utils'
import type { TYDaemonVaults } from '@lib/utils/schemas/yDaemonVaultsSchemas'
import type { ReactElement, ReactNode } from 'react'

type TVaultListEmpty = {
  sortedVaultsToDisplay: TYDaemonVaults
  currentSearch: string
  currentCategories: string[] | null
  currentChains: number[] | null
  onReset: () => void
  isLoading: boolean
  isV3?: boolean
  hiddenByFiltersCount?: number
}
export function VaultsListEmpty({
  sortedVaultsToDisplay,
  currentSearch,
  currentCategories,
  onReset,
  isLoading,
  hiddenByFiltersCount = 0,
  isV3 = false
}: TVaultListEmpty): ReactNode {
  if (isLoading && isZero(sortedVaultsToDisplay.length)) {
    return (
      <div
        className={
          'mt-2 flex h-96 w-full animate-pulse flex-col items-center justify-center gap-2 rounded-[12px] bg-white/5 px-10 py-2'
        }
      >
        <b className={'text-lg font-medium'}>{'Fetching Vaults…'}</b>
        <div className={'flex h-10 items-center justify-center'}>
          <span className={'loader'} />
        </div>
      </div>
    )
  }

  if (
    !isLoading &&
    isZero(sortedVaultsToDisplay.length) &&
    currentCategories?.length === 1 &&
    currentCategories?.includes('holdings')
  ) {
    return (
      <div className={'mx-auto flex h-96 w-full flex-col items-center justify-center gap-2 px-10 py-2 md:w-3/4'}>
        <b className={'text-center text-lg font-normal'}>{'No vaults found'}</b>
        <p className={'text-center text-sm text-neutral-600'}>
          {"You don't appear to have any Yearn Vaults deposits."}
        </p>
      </div>
    )
  }

  if (!isLoading && isZero(sortedVaultsToDisplay.length)) {
    const hasSearch = currentSearch !== ''
    const hasHiddenVaults = hiddenByFiltersCount > 0

    return (
      <div className={'mx-auto flex h-96 w-full flex-col items-center justify-center gap-2 px-10 py-2 md:w-3/4'}>
        <b className={'text-center text-lg font-normal'}>{'No vaults found'}</b>

        <p className={'text-center text-neutral-600'}>
          {hasSearch ? `The vault "${currentSearch}" is not found` : 'No vaults found that match your filters.'}
        </p>

        {hasHiddenVaults && (
          <p className={'mt-2 text-center text-sm text-neutral-500'}>
            {`${hiddenByFiltersCount} vault${hiddenByFiltersCount === 1 ? '' : 's'} hidden by filters`}
          </p>
        )}

        {(hasHiddenVaults || !hasSearch) && (
          <Button className={cl('mt-4 w-full md:w-48 ', isV3 ? '' : '!rounded-none')} onClick={onReset}>
            {'Show all'}
          </Button>
        )}
      </div>
    )
  }

  return <div />
}

export function VaultListEmptyExternalMigration(): ReactElement {
  return (
    <div className={'mx-auto flex h-96 w-full flex-col items-center justify-center px-10 py-2 md:w-3/4'}>
      <b className={'text-center text-lg'}>{'We looked under the cushions...'}</b>
      <p className={'text-center text-neutral-600'}>{"Looks like you don't have any tokens to migrate."}</p>
    </div>
  )
}
