import { IconChevron } from '@lib/icons/IconChevron'
import { IconMinus } from '@lib/icons/IconMinus'
import { IconPlus } from '@lib/icons/IconPlus'
import type { TSortDirection } from '@lib/types'
import { cl } from '@lib/utils'

import type { ReactElement } from 'react'
import { useCallback, useMemo } from 'react'

type TSortableListHeadItem = {
  type?: 'sort'
  label: string | ReactElement
  value: string
  sortable?: boolean
  disabled?: boolean
  className?: string
}

type TToggleListHeadItem = {
  type: 'toggle'
  label: string | ReactElement
  value: string
  disabled?: boolean
  className?: string
}

type TListHeadItem = TSortableListHeadItem | TToggleListHeadItem

export type TListHead = {
  items: TListHeadItem[]
  sortBy: string
  sortDirection: TSortDirection
  onSort: (sortBy: string, sortDirection: TSortDirection) => void
  onToggle?: (value: string) => void
  activeToggleValues?: Iterable<string>
  wrapperClassName?: string
  containerClassName?: string
}

function isToggleItem(item: TListHeadItem): item is TToggleListHeadItem {
  return item.type === 'toggle'
}

export function VaultsListHead({
  items,
  sortBy,
  sortDirection,
  onSort,
  onToggle,
  activeToggleValues,
  wrapperClassName,
  containerClassName
}: TListHead): ReactElement {
  const activeToggles = useMemo(() => new Set(activeToggleValues || []), [activeToggleValues])

  const toggleSortDirection = (newSortBy: string): TSortDirection => {
    if (sortBy === newSortBy) {
      return sortDirection === 'desc' ? 'asc' : 'desc'
    }
    return 'desc'
  }

  const renderChevron = useCallback(
    (shouldSortBy: boolean): ReactElement => {
      if (shouldSortBy && sortDirection === 'desc') {
        return <IconChevron className={'size-4 min-w-4 cursor-pointer text-text-primary'} />
      }
      if (shouldSortBy && sortDirection === 'asc') {
        return <IconChevron className={'size-4 min-w-4 cursor-pointer text-text-primary'} direction="up" />
      }
      return (
        <IconChevron
          className={
            'size-4 min-w-4 cursor-pointer text-text-primary/60 transition-colors group-hover:text-text-primary'
          }
        />
      )
    },
    [sortDirection]
  )

  const renderSortItem = (
    item: TSortableListHeadItem,
    shouldHighlight: boolean,
    shouldIndent: boolean
  ): ReactElement => {
    const isSortable = item.sortable !== false
    return (
      <button
        key={item.value}
        onClick={(): void => onSort(item.value, toggleSortDirection(item.value))}
        disabled={!isSortable || item.disabled}
        className={cl(
          'yearn--table-head-label-wrapper group w-full',
          shouldIndent ? '' : 'justify-start!',
          item.className
        )}
        datatype={'number'}
      >
        <p
          className={cl(
            'yearn--table-head-label',
            'transition-colors',
            shouldIndent ? '' : 'text-left',
            shouldHighlight
              ? 'text-text-primary'
              : isSortable
                ? 'text-text-primary/60 group-hover:text-text-primary'
                : 'text-text-primary/60'
          )}
        >
          {shouldIndent ? <>&nbsp;{item.label}</> : item.label}
        </p>
        {isSortable ? renderChevron(shouldHighlight) : null}
      </button>
    )
  }

  const renderToggleItem = (item: TToggleListHeadItem, shouldIndent: boolean): ReactElement => {
    const isActive = activeToggles.has(item.value)
    const isDisabled = item.disabled || !onToggle

    return (
      <button
        key={item.value}
        onClick={(): void => {
          if (isDisabled || !onToggle) return
          onToggle(item.value)
        }}
        disabled={isDisabled}
        aria-pressed={isActive}
        className={cl(
          'yearn--table-head-label-wrapper group gap-1 justify-end text-right w-full',
          isActive ? 'text-text-primary' : 'text-text-primary/60 hover:text-text-primary',
          item.className
        )}
      >
        <p
          className={cl(
            'yearn--table-head-label transition-colors text-right',
            isActive ? 'text-text-primary' : undefined
          )}
        >
          {shouldIndent ? <>&nbsp;{item.label}</> : item.label}
        </p>
        <span className={'flex items-center justify-center'}>
          {isActive ? (
            <IconMinus className={'size-2 text-text-primary'} />
          ) : (
            <IconPlus className={'size-2 text-text-primary/60 group-hover:text-text-primary'} />
          )}
        </span>
      </button>
    )
  }

  const renderItem = (item: TListHeadItem, shouldHighlight: boolean, shouldIndent: boolean): ReactElement => {
    if (isToggleItem(item)) {
      return renderToggleItem(item, shouldIndent)
    }
    return renderSortItem(item, shouldHighlight, shouldIndent)
  }

  const [token, ...rest] = items

  if (!token) {
    return <div />
  }

  return (
    <div className={cl('mt-4 hidden w-full grid-cols-1 md:mt-0 md:grid', wrapperClassName)}>
      <div
        className={cl(
          'grid w-full grid-cols-1 md:grid-cols-24 px-4 py-2 md:px-8',
          'border-t border-border md:border-none',
          containerClassName
        )}
      >
        <div
          className={cl(
            'col-span-9',
            'flex flex-row items-center justify-start!',
            'mb-2 py-4 md:mb-0 md:py-0',
            token.className
          )}
        >
          {renderItem(token, !isToggleItem(token) && sortBy === token.value, false)}
        </div>

        <div className={cl('col-span-14 z-10', 'grid grid-cols-1 md:grid-cols-15 md:gap-4', 'mt-4 md:mt-0')}>
          {rest.map(
            (item): ReactElement => (
              <div key={item.value} className="md:col-span-5">
                {renderItem(item, !isToggleItem(item) && sortBy === item.value, true)}
              </div>
            )
          )}
        </div>

        <div className={'col-span-1'} />
      </div>
    </div>
  )
}
