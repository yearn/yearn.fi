import { IconFilter } from '@lib/icons/IconFilter'
import { cl } from '@lib/utils'
import type { ReactElement, RefObject } from 'react'

type TVaultsFiltersButtonProps = {
  filtersCount: number
  isMinimal?: boolean
  onClick: () => void
  buttonRef?: RefObject<HTMLButtonElement | null>
}

export function VaultsFiltersButton({
  filtersCount,
  isMinimal = false,
  onClick,
  buttonRef
}: TVaultsFiltersButtonProps): ReactElement {
  const showLabel = !isMinimal

  return (
    <button
      type={'button'}
      className={cl(
        'flex shrink-0 items-center gap-1 border rounded-lg h-10 border-border py-2 text-sm font-medium text-text-secondary bg-surface transition-colors',
        isMinimal ? 'px-2' : 'px-4',
        'hover:text-text-secondary',
        'data-[active=true]:border-border-hover data-[active=true]:text-text-secondary'
      )}
      onClick={onClick}
      aria-label={'Open filters'}
      ref={buttonRef}
    >
      <IconFilter className={'size-4'} />
      {showLabel ? <span>{'Filters'}</span> : null}
      {filtersCount > 0 ? (
        <span
          className={cl(
            'inline-flex min-w-5 items-center justify-center rounded-full bg-surface-tertiary px-1.5 text-xs text-text-primary',
            showLabel ? 'ml-1' : 'ml-0'
          )}
        >
          {filtersCount}
        </span>
      ) : null}
    </button>
  )
}
