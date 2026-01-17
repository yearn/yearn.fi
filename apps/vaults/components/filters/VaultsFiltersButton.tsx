import { IconFilter } from '@lib/icons/IconFilter'
import type { ReactElement } from 'react'

type TVaultsFiltersButtonProps = {
  filtersCount: number
  onClick: () => void
}

export function VaultsFiltersButton({ filtersCount, onClick }: TVaultsFiltersButtonProps): ReactElement {
  return (
    <button
      type={'button'}
      className={
        'flex shrink-0 items-center justify-center gap-1 border rounded-lg h-10 w-[34px] border-border py-2 text-sm font-medium text-text-secondary bg-surface transition-colors hover:text-text-secondary data-[active=true]:border-border-hover data-[active=true]:text-text-secondary min-[1000px]:w-auto min-[1000px]:px-4 min-[1250px]:w-[34px] min-[1250px]:px-0'
      }
      onClick={onClick}
      aria-label={'Open filters'}
    >
      <IconFilter className={'size-4'} />
      <span className={'hidden min-[1000px]:inline min-[1250px]:hidden'}>{'Filters'}</span>
      {filtersCount > 0 ? (
        <span
          className={
            'inline-flex min-w-5 items-center justify-center rounded-full bg-surface-tertiary px-1.5 text-xs text-text-primary'
          }
        >
          {filtersCount}
        </span>
      ) : null}
    </button>
  )
}
