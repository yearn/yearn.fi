import { IconChevron } from '@shared/icons/IconChevron'
import type { TSortDirection } from '@shared/types'
import { cl } from '@shared/utils'
import type { ReactElement } from 'react'

type TSortOption = {
  label: string
  value: string
}

const SORT_OPTIONS: TSortOption[] = [
  { label: 'Featured', value: 'featuringScore' },
  { label: 'APY', value: 'estAPY' },
  { label: 'TVL', value: 'tvl' },
  { label: 'Holdings', value: 'deposited' }
]

type TVaultsMobileSortSelectorProps = {
  sortBy: string
  sortDirection: TSortDirection
  onSort: (sortBy: string, sortDirection: TSortDirection) => void
  hasHoldings?: boolean
}

export function VaultsMobileSortSelector({
  sortBy,
  sortDirection,
  onSort,
  hasHoldings = false
}: TVaultsMobileSortSelectorProps): ReactElement {
  const visibleOptions = hasHoldings ? SORT_OPTIONS : SORT_OPTIONS.filter((o) => o.value !== 'deposited')

  const handleSortChange = (value: string): void => {
    if (value === sortBy) {
      onSort(value, sortDirection === 'desc' ? 'asc' : 'desc')
    } else {
      onSort(value, 'desc')
    }
  }

  return (
    <div className={'flex flex-col gap-2'}>
      <p className={'text-sm font-medium text-text-primary'}>{'Sort by'}</p>
      <div className={'flex flex-wrap gap-2'}>
        {visibleOptions.map((option) => {
          const isActive = sortBy === option.value
          return (
            <button
              key={option.value}
              type={'button'}
              onClick={(): void => handleSortChange(option.value)}
              className={cl(
                'flex items-center gap-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors touch-target',
                isActive
                  ? 'border-primary bg-primary/10 text-text-primary'
                  : 'border-border bg-surface text-text-secondary hover:border-border-hover hover:text-text-primary'
              )}
            >
              <span>{option.label}</span>
              {isActive ? (
                <IconChevron className={'size-4'} direction={sortDirection === 'desc' ? 'down' : 'up'} />
              ) : null}
            </button>
          )
        })}
      </div>
    </div>
  )
}
