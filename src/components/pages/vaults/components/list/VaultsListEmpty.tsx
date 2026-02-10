import { Button } from '@shared/components/Button'
import { EmptyState } from '@shared/components/EmptyState'
import type { TYDaemonVaults } from '@shared/utils/schemas/yDaemonVaultsSchemas'
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
  sortedVaultsToDisplay?: TYDaemonVaults
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
      <EmptyState
        title="No vaults found"
        description="You don't appear to have any Yearn Vaults deposits."
        size="lg"
        unstyled
        className="mx-auto h-96 w-full md:w-3/4"
      />
    )
  }

  const selectedCategoryCount = currentCategories?.length ?? 0
  const hasSearch = currentSearch !== ''
  const isFullCategorySelection = selectedCategoryCount >= defaultCategories.length

  if (hasSearch && isFullCategorySelection) {
    return (
      <EmptyState
        title="No vaults found"
        description={`The vault "${currentSearch}" does not exist`}
        size="lg"
        unstyled
        className="mx-auto h-96 w-full md:w-3/4"
      />
    )
  }

  if (hasSearch && !isFullCategorySelection) {
    const showAllAction =
      potentialResultsCount > 0 ? (
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
      )

    return (
      <EmptyState
        title="No vaults found"
        description={`No results for "${currentSearch}" with current filters.`}
        action={showAllAction}
        size="lg"
        unstyled
        className="mx-auto h-96 w-full md:w-3/4"
      />
    )
  }

  return (
    <EmptyState
      title="No vaults found"
      description="No vaults found that match your filters."
      action={
        <Button className={'mt-4 w-full md:w-48'} onClick={onReset}>
          {'Search all vaults'}
        </Button>
      }
      size="lg"
      unstyled
      className="mx-auto h-96 w-full md:w-3/4"
    />
  )
}

export function VaultListEmptyExternalMigration(): ReactElement {
  return (
    <EmptyState
      title="We looked under the cushions..."
      description="Looks like you don't have any tokens to migrate."
      size="lg"
      unstyled
      className="mx-auto h-96 w-full md:w-3/4"
    />
  )
}
