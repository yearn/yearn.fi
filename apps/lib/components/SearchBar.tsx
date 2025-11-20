import { IconCross } from '@lib/icons/IconCross'
import { IconEnter } from '@lib/icons/IconEnter'
import { IconSearch } from '@lib/icons/IconSearch'
import { cl } from '@lib/utils'
import { useDebouncedCallback } from '@react-hookz/web'
import { type ChangeEvent, type ReactElement, type ReactNode, useEffect, useState } from 'react'

type TSearchBar = {
  searchPlaceholder: string
  searchValue: string
  onSearch: (searchValue: string) => void
  className?: string
  iconClassName?: string
  inputClassName?: string
  shouldSearchByClick?: boolean
  shouldDebounce?: boolean
  onSearchClick?: () => void
  highlightWhenActive?: boolean
  alertContent?: ReactNode
}

export function SearchBar(props: TSearchBar): ReactElement {
  /**********************************************************************************************
   ** Create local search state for immediate UI feedback while debouncing the actual search
   ** functionality. This provides a responsive user experience while preventing excessive
   ** filtering operations and URL updates that could degrade performance.
   *********************************************************************************************/
  const [localSearchValue, setLocalSearchValue] = useState<string>(props.searchValue || '')

  /**********************************************************************************************
   ** Create a debounced search handler that delays the actual search operation by 300ms.
   ** This prevents excessive filtering and URL updates while the user is actively typing,
   ** improving both performance and user experience.
   *********************************************************************************************/
  const debouncedSearch = useDebouncedCallback(
    (searchValue: string) => {
      props.onSearch(searchValue)
    },
    [props.onSearch],
    1000
  )

  /**********************************************************************************************
   ** Handle search input changes by immediately updating the local state for UI responsiveness
   ** and triggering the debounced search operation for the actual filtering.
   *********************************************************************************************/
  const handleSearchChange = (searchValue: string): void => {
    setLocalSearchValue(searchValue)
    if (props.shouldDebounce) {
      debouncedSearch(searchValue)
      return
    }
    props.onSearch(searchValue)
  }

  /**********************************************************************************************
   ** Synchronize local search state when the search prop changes from external sources
   ** such as URL navigation, browser back/forward, or programmatic updates.
   *********************************************************************************************/
  useEffect(() => {
    setLocalSearchValue(props.searchValue || '')
  }, [props.searchValue])

  return (
    <div
      className={cl(
        'flex h-10 items-center gap-2 px-2',
        props.highlightWhenActive
          ? localSearchValue
            ? 'bg-neutral-100 border border-neutral-300'
            : 'border border-neutral-300 bg-neutral-100 focus-within:bg-neutral-100 focus-within:border-neutral-400'
          : 'border border-neutral-300 bg-neutral-0',
        props.className
      )}
    >
      <div className={'flex h-full w-full items-center gap-2 overflow-hidden '}>
        <input
          id={'search'}
          suppressHydrationWarning
          className={cl(
            props.inputClassName,
            'h-full flex-1 bg-transparent py-2 text-base text-neutral-700 placeholder:text-neutral-400'
          )}
          type={'text'}
          placeholder={props.searchPlaceholder}
          value={localSearchValue || ''}
          onChange={(e: ChangeEvent<HTMLInputElement>): void => {
            handleSearchChange(e.target.value)
          }}
          onKeyDown={(e) => {
            if (!props.shouldSearchByClick) {
              return
            }
            if (e.key === 'Enter') {
              return props.onSearchClick?.()
            }
          }}
        />
        {props.alertContent ? (
          <div className={'flex shrink-0 items-center gap-2 text-xs text-neutral-700'}>{props.alertContent}</div>
        ) : null}
        <div
          role={localSearchValue ? 'button' : 'div'}
          onClick={() => {
            if (props.shouldSearchByClick && localSearchValue) {
              return props.onSearchClick?.()
            }
            if (!props.shouldSearchByClick && localSearchValue) {
              props.onSearch('')
            }
          }}
          className={cl(
            props.iconClassName,
            'flex h-8 w-8 shrink-0 items-center justify-center rounded text-neutral-400 transition-colors',
            localSearchValue && !props.shouldSearchByClick ? 'cursor-pointer hover:text-neutral-600' : 'cursor-default'
          )}
        >
          {props.shouldSearchByClick && localSearchValue ? (
            <div className={'rounded-md border border-gray-500 p-[6px]'}>
              <IconEnter className={'size-3'} />
            </div>
          ) : localSearchValue && !props.shouldSearchByClick ? (
            <IconCross className={'size-3 text-neutral-600 transition-all hover:text-neutral-500'} />
          ) : (
            <IconSearch className={'size-4 text-neutral-400'} />
          )}
        </div>
      </div>
    </div>
  )
}
