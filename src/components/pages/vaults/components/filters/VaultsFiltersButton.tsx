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
        'relative flex shrink-0 items-center justify-center gap-1 overflow-visible border rounded-lg h-10 w-[34px] py-2 text-sm font-medium bg-surface transition-colors min-[1075px]:w-auto min-[1075px]:px-4',
        isActive ? 'border-primary/50 text-primary' : 'border-border text-text-secondary hover:text-text-primary'
      )}
      onClick={onClick}
      data-active={isActive}
      aria-label={'Open filters'}
    >
      <IconFilter className={'size-4 shrink-0'} />
      <span className={'hidden min-[1075px]:inline'}>{'Filters'}</span>
      {isActive ? (
        <>
          <span
            className={
              'absolute -right-1 -top-1 z-10 size-5 rounded-full border border-primary/50 bg-surface text-[11px] font-semibold leading-none text-primary shadow-sm min-[1075px]:hidden'
            }
          >
            <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">{filtersCount}</span>
          </span>
          <span
            className={
              'relative hidden size-5 shrink-0 rounded-full border border-primary/50 text-[11px] font-semibold leading-none min-[1075px]:inline-block'
            }
          >
            <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">{filtersCount}</span>
          </span>
        </>
      ) : null}
    </button>
  )
}
