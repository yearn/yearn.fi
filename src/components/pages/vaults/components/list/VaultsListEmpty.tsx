import { Switch as HeadlessSwitch } from '@headlessui/react'
import { Button } from '@shared/components/Button'
import { EmptyState } from '@shared/components/EmptyState'
import { cl } from '@shared/utils'
import type { TYDaemonVaults } from '@shared/utils/schemas/yDaemonVaultsSchemas'
import { type ReactElement, useCallback, useEffect, useState } from 'react'

type TVaultsBlockingFilterAction = {
  key: string
  label: string
  additionalResults: number
  onApply: () => void
}

type TVaultListEmpty = {
  currentSearch: string
  currentCategories?: string[] | null
  onReset: () => void
  hiddenByFiltersCount?: number
  blockingFilterActions?: TVaultsBlockingFilterAction[]
  isLoading: boolean
  loadingLabel?: string
  // @deprecated: retained for compatibility with existing usages in worktrees being cleaned up
  sortedVaultsToDisplay?: TYDaemonVaults
}
export function VaultsListEmpty({
  currentSearch,
  currentCategories = null,
  onReset,
  hiddenByFiltersCount = 0,
  blockingFilterActions = [],
  isLoading,
  loadingLabel
}: TVaultListEmpty): ReactElement {
  const hasSearch = currentSearch !== ''
  const hasBlockingFilterActions = blockingFilterActions.length > 0
  const hasHiddenByFiltersResults = hiddenByFiltersCount > 0
  const [selectedBlockingFilters, setSelectedBlockingFilters] = useState<string[]>([])

  useEffect(() => {
    setSelectedBlockingFilters((prev) =>
      prev.filter((key) => blockingFilterActions.some((action) => action.key === key))
    )
  }, [blockingFilterActions])

  const toggleBlockingFilter = useCallback((key: string): void => {
    setSelectedBlockingFilters((prev) => (prev.includes(key) ? prev.filter((entry) => entry !== key) : [...prev, key]))
  }, [])

  const applySelectedBlockingFilters = useCallback((): void => {
    const selected = new Set(selectedBlockingFilters)
    for (const action of blockingFilterActions) {
      if (selected.has(action.key)) {
        action.onApply()
      }
    }
  }, [blockingFilterActions, selectedBlockingFilters])

  const hasSelectedBlockingFilters = selectedBlockingFilters.length > 0

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

  if (hasSearch && (hasBlockingFilterActions || hasHiddenByFiltersResults)) {
    const hiddenByFiltersLabel = `${hiddenByFiltersCount} vault${hiddenByFiltersCount > 1 ? 's' : ''}`
    return (
      <div className={'mx-auto flex h-96 w-full flex-col items-center justify-center gap-2 px-10 py-2 md:w-3/4'}>
        <b className={'text-center text-lg font-normal'}>{'No vaults found'}</b>
        <p className={'text-center text-neutral-600'}>{`No results for "${currentSearch}" with current filters.`}</p>
        {hiddenByFiltersCount > 0 ? (
          <p
            className={'text-center font-normal text-neutral-600'}
          >{`${hiddenByFiltersLabel} found that are hidden by filters. Enable them below.`}</p>
        ) : null}
        {hasBlockingFilterActions ? (
          <div className={'mt-2 flex w-full flex-col gap-2 md:w-96'}>
            {blockingFilterActions.map((action) => {
              const isSelected = selectedBlockingFilters.includes(action.key)
              return (
                <div
                  key={action.key}
                  className={
                    'flex items-center justify-between gap-3 rounded-lg border border-border bg-surface px-3 py-2'
                  }
                >
                  <p className={'text-sm text-text-primary'}>
                    {`${action.label}${action.additionalResults > 0 ? ` (+${action.additionalResults})` : ''}`}
                  </p>
                  <HeadlessSwitch
                    checked={isSelected}
                    onChange={(): void => toggleBlockingFilter(action.key)}
                    className={cl(
                      'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors duration-200',
                      isSelected ? 'border-blue-500 bg-blue-500' : 'border-neutral-300 bg-white'
                    )}
                  >
                    <span className={'sr-only'}>{`Enable ${action.label}`}</span>
                    <span
                      aria-hidden={'true'}
                      className={cl(
                        'inline-block size-4 transform rounded-full shadow transition-transform duration-200',
                        isSelected ? 'translate-x-6 bg-white' : 'translate-x-1 bg-neutral-500'
                      )}
                    />
                  </HeadlessSwitch>
                </div>
              )
            })}
            <Button
              className={'mt-2 w-full'}
              onClick={applySelectedBlockingFilters}
              isDisabled={!hasSelectedBlockingFilters}
            >
              {'Search'}
            </Button>
          </div>
        ) : (
          <p className={'text-center font-normal text-neutral-600'}>{'Try adjusting your selected filters.'}</p>
        )}
      </div>
    )
  }

  if (hasSearch) {
    return (
      <div className={'mx-auto flex h-96 w-full flex-col items-center justify-center gap-2 px-10 py-2 md:w-3/4'}>
        <b className={'text-center text-lg font-normal'}>{'No vaults found'}</b>
        <p className={'text-center text-neutral-600'}>{`The vault "${currentSearch}" does not exist`}</p>
      </div>
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
