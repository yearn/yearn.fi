import type { TKongVaultInput } from '@pages/vaults/domain/kongVaultSelectors'
import { Button } from '@shared/components/Button'
import type { ReactElement } from 'react'

type TVaultListEmpty = {
  currentSearch: string
  currentCategories: string[] | null
  currentChains: number[] | null
  onReset: () => void
  isLoading: boolean
  loadingLabel?: string
  defaultCategories?: string[]
  potentialResultsCount?: number
  // @deprecated: retained for compatibility with existing usages in worktrees being cleaned up
  sortedVaultsToDisplay?: TKongVaultInput[]
}
export function VaultsListEmpty({
  currentSearch,
  currentCategories,
  onReset,
  isLoading,
  loadingLabel,
  defaultCategories = [],
  potentialResultsCount = 0
}: TVaultListEmpty): ReactElement {
  if (isLoading) {
    const label = loadingLabel ?? 'Fetching Vaults…'
    return (
      <div
        className={
          'mt-2 flex h-96 w-full animate-pulse flex-col items-center justify-center gap-2 rounded-[12px] bg-white/5 px-10 py-2'
        }
      >
        <b className={'text-lg font-medium'}>{label}</b>
        <div className={'flex h-10 items-center justify-center'}>
          <span className={'loader'} />
        </div>
      </div>
    )
  }

  if (currentCategories?.length === 1 && currentCategories.includes('holdings')) {
    return (
      <div className={'mx-auto flex h-96 w-full flex-col items-center justify-center gap-2 px-10 py-2 md:w-3/4'}>
        <b className={'text-center text-lg font-normal'}>{'No vaults found'}</b>
        <p className={'text-center text-sm text-neutral-600'}>
          {"You don't appear to have any Yearn Vaults deposits."}
        </p>
      </div>
    )
  }

  const selectedCategoryCount = currentCategories?.length ?? 0
  const hasSearch = currentSearch !== ''
  const isFullCategorySelection = selectedCategoryCount >= defaultCategories.length

  if (hasSearch && isFullCategorySelection) {
    return (
      <div className={'mx-auto flex h-96 w-full flex-col items-center justify-center gap-2 px-10 py-2 md:w-3/4'}>
        <b className={'text-center text-lg font-normal'}>{'No vaults found'}</b>
        <p className={'text-center text-neutral-600'}>{`The vault "${currentSearch}" does not exist`}</p>
      </div>
    )
  }

  if (hasSearch && !isFullCategorySelection) {
    return (
      <div className={'mx-auto flex h-96 w-full flex-col items-center justify-center gap-2 px-10 py-2 md:w-3/4'}>
        <b className={'text-center text-lg font-normal'}>{'No vaults found'}</b>
        <p className={'text-center text-neutral-600'}>{`No results for "${currentSearch}" with current filters.`}</p>
        {potentialResultsCount > 0 ? (
          <>
            <p className={'text-center font-normal text-neutral-600'}>
              {`Found ${potentialResultsCount} vault${potentialResultsCount > 1 ? 's' : ''} when searching all categories.`}
            </p>
            <Button className={'mt-4 w-full md:w-48'} onClick={onReset}>
              {'Show all results'}
            </Button>
          </>
        ) : (
          <p className={'text-center font-normal text-neutral-600'}>{`The vault "${currentSearch}" does not exist.`}</p>
        )}
      </div>
    )
  }

  return (
    <div className={'mx-auto flex h-96 w-full flex-col items-center justify-center gap-4 px-10 py-2 md:w-3/4'}>
      <b className={'text-center text-lg font-normal'}>{'No vaults found'}</b>
      <p className={'text-center font-normal text-neutral-600'}>{'No vaults found that match your filters.'}</p>
      <Button className={'mt-4 w-full md:w-48'} onClick={onReset}>
        {'Search all vaults'}
      </Button>
    </div>
  )
}

export function VaultListEmptyExternalMigration(): ReactElement {
  return (
    <div className={'mx-auto flex h-96 w-full flex-col items-center justify-center px-10 py-2 md:w-3/4'}>
      <b className={'text-center text-lg'}>{'We looked under the cushions...'}</b>
      <p className={'text-center text-neutral-600'}>{"Looks like you don't have any tokens to migrate."}</p>
    </div>
  )
}
