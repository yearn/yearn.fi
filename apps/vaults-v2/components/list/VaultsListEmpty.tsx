import { Button } from '@lib/components/Button'
import { ALL_VAULTS_CATEGORIES_KEYS } from '@vaults-v2/constants'
import type { ReactElement } from 'react'

type TVaultListEmpty = {
  currentSearch: string
  currentCategories: string[] | null
  currentChains: number[] | null
  onReset: () => void
  isLoading: boolean
  defaultCategories?: string[]
  potentialResultsCount?: number
}
export function VaultsListEmpty({
  currentSearch,
  currentCategories,
  currentChains,
  onReset,
  isLoading,
  defaultCategories = ALL_VAULTS_CATEGORIES_KEYS,
  potentialResultsCount = 0
}: TVaultListEmpty): ReactElement {
  if (isLoading) {
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

  if (!isLoading && currentCategories?.length === 1 && currentCategories?.includes('holdings')) {
    return (
      <div className={'mx-auto flex h-96 w-full flex-col items-center justify-center gap-2 px-10 py-2 md:w-3/4'}>
        <b className={'text-center text-lg font-normal'}>{'No vaults found'}</b>
        <p className={'text-center text-sm text-neutral-600'}>
          {"You don't appear to have any Yearn Vaults deposits."}
        </p>
      </div>
    )
  }

  if (!isLoading) {
    return (
      <div className={'mx-auto flex h-96 w-full flex-col items-center justify-center gap-2 px-10 py-2 md:w-3/4'}>
        <b className={'text-center text-lg font-normal'}>{'No vaults found'}</b>
        {(currentCategories?.length || 0) >= defaultCategories.length && currentSearch !== '' ? (
          <p className={'text-center text-neutral-600'}>{`The vault "${currentSearch}" does not exist`}</p>
        ) : (currentCategories?.length || 0) < defaultCategories.length && currentSearch !== '' ? (
          <>
            <p
              className={'text-center text-neutral-600'}
            >{`No results for "${currentSearch}" with current filters.`}</p>
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
              <p className={'text-center font-normal text-neutral-600'}>
                {`The vault "${currentSearch}" does not exist.`}
              </p>
            )}
          </>
        ) : (
          <>
            <p className={'text-center font-normal text-neutral-600'}>{'No vaults found that match your filters.'}</p>
            <Button className={'mt-4 w-full md:w-48'} onClick={onReset}>
              {'Search all vaults'}
            </Button>
          </>
        )}
      </div>
    )
  }
  if (!isLoading && currentChains && currentChains.length > 0) {
    return (
      <div className={'mx-auto flex h-96 w-full flex-col items-center justify-center gap-4 px-10 py-2 md:w-3/4'}>
        <b className={'text-center text-lg'}>{'No data found'}</b>

        <p className={'text-center text-neutral-600'}>{'Please, select a chain. At least one, just one.'}</p>
        <Button className={'w-full md:w-48'} onClick={onReset}>
          {'Search all vaults'}
        </Button>
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
