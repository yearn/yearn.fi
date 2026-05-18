import type { TVaultsBlockingFilterAction } from '@pages/vaults/hooks/useVaultsPageModel'
import { Button } from '@shared/components/Button'
import type { ReactElement } from 'react'

type TVaultsListSearchRecoveryRowProps = {
  currentSearch: string
  hiddenByFiltersCount: number
  blockingFilterActions: TVaultsBlockingFilterAction[]
}

function formatActionLabel(action: TVaultsBlockingFilterAction): string {
  return `${action.label}${action.additionalResults > 0 ? ` (+${action.additionalResults})` : ''}`
}

export function VaultsListSearchRecoveryRow({
  currentSearch,
  hiddenByFiltersCount,
  blockingFilterActions
}: TVaultsListSearchRecoveryRowProps): ReactElement | null {
  if (currentSearch === '' || hiddenByFiltersCount <= 0 || blockingFilterActions.length === 0) {
    return null
  }

  return (
    <div
      className={
        'grid w-full grid-cols-1 gap-3 border-t border-border bg-surface p-4 md:grid-cols-24 md:items-center md:gap-4 md:p-6'
      }
    >
      <div className={'col-span-12 flex min-w-0 flex-col gap-1 md:col-span-10'}>
        <p className={'text-sm font-medium text-text-primary'}>{`Still looking for "${currentSearch}"?`}</p>
        <p className={'text-sm text-text-secondary'}>{'Show additional matching vaults hidden by filters.'}</p>
      </div>

      <div className={'col-span-12 flex flex-wrap gap-2 md:col-span-14 md:justify-end'}>
        {blockingFilterActions.map((action) => (
          <Button
            key={action.key}
            type={'button'}
            variant={'outlined'}
            classNameOverride={'yearn--button--nextgen yearn--button-smaller'}
            onClick={action.onApply}
          >
            {formatActionLabel(action)}
          </Button>
        ))}
      </div>
    </div>
  )
}
