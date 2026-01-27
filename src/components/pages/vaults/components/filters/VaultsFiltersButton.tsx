import { IconFilter } from '@shared/icons/IconFilter'
import { cl } from '@shared/utils'
import type { ReactElement } from 'react'

type TVaultsFiltersButtonProps = {
  filtersCount: number
  onClick: () => void
}

export function VaultsFiltersButton({ filtersCount, onClick }: TVaultsFiltersButtonProps): ReactElement {
  const isActive = filtersCount > 0

  return (
    <button
      type={'button'}
      className={cl(
        'flex shrink-0 items-center justify-center gap-1 border rounded-lg h-10 w-[34px] py-2 text-sm font-medium bg-surface transition-colors min-[1075px]:w-auto min-[1075px]:px-4',
        isActive ? 'border-primary/50 text-primary' : 'border-border text-text-secondary hover:text-text-primary'
      )}
      onClick={onClick}
      data-active={isActive}
      aria-label={'Open filters'}
    >
      <IconFilter className={'size-4'} />
      <span className={'hidden min-[1075px]:inline'}>{'Filters'}</span>
      {isActive ? (
        <span
          className={
            'inline-flex min-w-5 items-center justify-center rounded-full border border-primary/50 px-1.5 text-xs font-semibold'
          }
        >
          {filtersCount}
        </span>
      ) : null}
    </button>
  )
}
