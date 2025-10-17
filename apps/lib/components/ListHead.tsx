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
  dataClassName?: string
  wrapperClassName?: string
  tokenClassName?: string
  sortBy: string
  sortDirection: TSortDirection
  onSort: (sortBy: string, sortDirection: TSortDirection) => void
  onToggle?: (value: string) => void
  activeToggleValues?: Iterable<string>
}

export function ListHead({
  items,
  dataClassName,
  wrapperClassName,
  tokenClassName,
  sortBy,
  sortDirection,
  onSort,
  onToggle,
  activeToggleValues
}: TListHead): ReactElement {
  const toggleSortDirection = (newSortBy: string): TSortDirection => {
    return sortBy === newSortBy ? (sortDirection === '' ? 'desc' : sortDirection === 'desc' ? 'asc' : 'desc') : 'desc'
  }

  const activeToggles = useMemo(() => new Set(activeToggleValues || []), [activeToggleValues])

  const isToggleItem = (item: TListHeadItem): item is TToggleListHeadItem => item.type === 'toggle'

  const renderChevron = useCallback(
    (shouldSortBy: boolean): ReactElement => {
      if (shouldSortBy && sortDirection === 'desc') {
        return <IconChevron className={'yearn--sort-chevron'} />
      }
      if (shouldSortBy && sortDirection === 'asc') {
        return <IconChevron className={'yearn--sort-chevron'} direction="up" />
      }
      return <IconChevron className={'yearn--sort-chevron--off text-neutral-300 group-hover:text-neutral-500'} />
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
        className={cl('yearn--table-head-label-wrapper group', item.className)}
        datatype={'number'}
      >
        <p
          className={cl(
            'yearn--table-head-label whitespace-nowrap transition-colors',
            shouldHighlight
              ? 'text-neutral-800'
              : isSortable
                ? 'text-neutral-800/60 group-hover:text-neutral-800'
                : 'text-neutral-800/60'
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
          'yearn--table-head-label-wrapper group gap-1 justify-end text-right',
          isActive ? 'text-neutral-800' : 'text-neutral-800/60 hover:text-neutral-800',
          item.className
        )}
      >
        <p
          className={cl(
            'yearn--table-head-label whitespace-nowrap transition-colors text-right',
            isActive ? 'text-neutral-800' : undefined
          )}
        >
          {shouldIndent ? <>&nbsp;{item.label}</> : item.label}
        </p>
        <span className={'flex items-center justify-center'}>
          {isActive ? (
            <IconMinus className={'size-2 text-neutral-800'} />
          ) : (
            <IconPlus className={'size-2 text-neutral-800/60 group-hover:text-neutral-800'} />
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

  const [chain, token, ...rest] = items
  return (
    <div className={'mt-4 grid w-full grid-cols-1 md:mt-0'}>
      <div className={cl('mb-2 hidden w-full px-10 md:grid md:grid-cols-12', wrapperClassName)}>
        <div className={cl('col-span-4 flex gap-6', tokenClassName)}>
          <p className={'yearn--table-head-label max-w-[32px]'}>{chain.label}</p>
          {renderItem(token, !isToggleItem(token) && sortBy === token.value, false)}
        </div>

        <div />
        <div className={cl('col-span-7 grid grid-cols-10 gap-1', dataClassName)}>
          {rest.map((item): ReactElement => renderItem(item, !isToggleItem(item) && sortBy === item.value, true))}
        </div>
      </div>
    </div>
  )
}
