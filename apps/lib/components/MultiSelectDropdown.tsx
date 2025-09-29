import { Combobox, ComboboxButton, ComboboxInput, ComboboxOption, ComboboxOptions, Transition } from '@headlessui/react'
import { Renderable } from '@lib/components/Renderable'
import { useWeb3 } from '@lib/contexts/useWeb3'
import { IconChevron } from '@lib/icons/IconChevron'
import { cl } from '@lib/utils'
import { useClickOutside, useThrottledState } from '@react-hookz/web'
import type { ReactElement, RefObject } from 'react'
import { useCallback, useMemo, useRef, useState } from 'react'

export type TMultiSelectOptionProps = {
  label: string
  value: number | string
  isSelected: boolean
  icon?: ReactElement
  onCheckboxClick?: (event: React.MouseEvent<HTMLElement>) => void
  onContainerClick?: (event: React.MouseEvent<HTMLElement>) => void
}

type TMultiSelectProps = {
  options: TMultiSelectOptionProps[]
  placeholder?: string
  onSelect: (options: TMultiSelectOptionProps[]) => void
  buttonClassName?: string
  comboboxOptionsClassName?: string
  customRender?: ReactElement
  customDefaultLabel?: string
}

function SelectAllOption({
  option,
  onSelectAll
}: {
  option: TMultiSelectOptionProps
  onSelectAll: () => void
}): ReactElement {
  return (
    <button type={'button'} onClick={onSelectAll} className={'mb-2 cursor-pointer border-b border-neutral-100 pb-2'}>
      <div className={'flex w-full items-center justify-between p-2 transition-colors hover:bg-neutral-100'}>
        <p className={'pl-0 font-normal text-neutral-900'}>{option.label}</p>
        <input
          type={'checkbox'}
          checked={option.isSelected}
          onChange={(): void => {}}
          onClick={(e): void => {
            e.stopPropagation()
            onSelectAll()
          }}
          className={'checkbox'}
        />
      </div>
    </button>
  )
}

function Option(option: TMultiSelectOptionProps): ReactElement {
  return (
    <ComboboxOption
      onClick={option.onContainerClick}
      value={option}
      className={'transition-colors hover:bg-neutral-100'}
    >
      <div className={'flex w-full items-center justify-between p-2'}>
        <div className={'flex items-center'}>
          {option?.icon ? <div className={'size-8 overflow-hidden rounded-full bg-white'}>{option.icon}</div> : null}
          <p className={`${option.icon ? 'pl-2' : 'pl-0'} font-normal text-neutral-900`}>
            {option.label}{' '}
            <span className={'pl-1 text-xs text-neutral-900 transition-opacity hover:opacity-100'}>{'(only)'}</span>
          </p>
        </div>
        <input
          type={'checkbox'}
          checked={option.isSelected}
          onChange={(): void => {}}
          className={'checkbox'}
          onClick={(event: React.MouseEvent<HTMLElement>): void => {
            event.stopPropagation()
            option.onCheckboxClick?.(event)
          }}
          readOnly
        />
      </div>
    </ComboboxOption>
  )
}

function DropdownEmpty({ query }: { query: string }): ReactElement {
  const { isActive, openLoginModal } = useWeb3()

  if (!isActive) {
    return (
      <button
        type={'button'}
        onClick={(): void => openLoginModal()}
        className={
          'flex h-14 cursor-pointer flex-col items-center justify-center px-4 text-center transition-colors hover:bg-neutral-300'
        }
      >
        <b className={'text-neutral-900'}>{'Connect Wallet'}</b>
      </button>
    )
  }
  if (query !== '') {
    return (
      <div className={'relative flex h-14 flex-col items-center justify-center px-4 text-center'}>
        <div className={'flex h-10 items-center justify-center'}>
          <p className={'text-sm text-neutral-400'}>{'Nothing found.'}</p>
        </div>
      </div>
    )
  }
  return (
    <div className={'relative flex h-14 flex-col items-center justify-center px-4 text-center'}>
      <div className={'flex h-10 items-center justify-center'}>
        <span className={'loader'} />
      </div>
    </div>
  )
}

const getFilteredOptions = ({
  query,
  currentOptions
}: {
  query: string
  currentOptions: TMultiSelectOptionProps[]
}): TMultiSelectOptionProps[] => {
  if (query === '') {
    return currentOptions
  }

  return currentOptions.filter((option): boolean => {
    return option.label.toLowerCase().includes(query.toLowerCase())
  })
}

export function MultiSelectDropdown({
  options,
  onSelect,
  placeholder = '',
  customDefaultLabel = 'All',
  customRender,
  ...props
}: TMultiSelectProps): ReactElement {
  const [isOpen, setIsOpen] = useThrottledState(false, 400)
  const [query, setQuery] = useState('')
  const areAllSelected = useMemo((): boolean => options.every(({ isSelected }): boolean => isSelected), [options])
  const componentRef = useRef<HTMLDivElement | null>(null)

  const selectedValues = useMemo(() => {
    return options.filter((opt) => opt.isSelected).map((opt) => opt.value)
  }, [options])

  useClickOutside(componentRef as RefObject<HTMLElement>, (): void => {
    setIsOpen(false)
  })

  const filteredOptions = useMemo(
    (): TMultiSelectOptionProps[] => getFilteredOptions({ query, currentOptions: options }),
    [options, query]
  )

  const getDisplayName = useCallback(
    (options: TMultiSelectOptionProps[]): string => {
      if (areAllSelected) {
        return customDefaultLabel
      }

      const selectedOptions = options.filter(({ isSelected }): boolean => isSelected)

      if (selectedOptions.length === 0) {
        return placeholder
      }

      if (selectedOptions.length === 1) {
        return selectedOptions[0].label
      }

      return 'Multiple'
    },
    [areAllSelected, placeholder, customDefaultLabel]
  )

  const handleOnCheckboxClick = useCallback(
    ({ value }: TMultiSelectOptionProps): void => {
      const currentState = options.map(
        (o): TMultiSelectOptionProps => (o.value === value ? { ...o, isSelected: !o.isSelected } : o)
      )
      onSelect(currentState)
    },
    [options, onSelect]
  )

  const handleOnContainerClick = useCallback(
    ({ value }: TMultiSelectOptionProps): void => {
      const currentState = options.map(
        (o): TMultiSelectOptionProps => (o.value === value ? { ...o, isSelected: true } : { ...o, isSelected: false })
      )
      onSelect(currentState)
    },
    [options, onSelect]
  )

  const handleSelectAll = useCallback((): void => {
    const newState = options.map(
      (option): TMultiSelectOptionProps => ({
        ...option,
        isSelected: !areAllSelected
      })
    )
    onSelect(newState)
  }, [options, areAllSelected, onSelect])

  return (
    <Combobox key={selectedValues.join(',')} ref={componentRef} value={selectedValues} multiple>
      <div className={'relative w-full'}>
        {customRender ? (
          <ComboboxButton
            className={'flex items-center justify-between'}
            onClick={(): void => setIsOpen((o: boolean): boolean => !o)}
          >
            {customRender}
          </ComboboxButton>
        ) : (
          <ComboboxButton
            onClick={(): void => setIsOpen((o: boolean): boolean => !o)}
            className={cl(
              props.buttonClassName,
              'flex h-10 w-full items-center justify-between bg-neutral-0 p-2 text-base text-neutral-900 md:px-3'
            )}
          >
            <ComboboxInput
              className={cl(
                'w-full cursor-default overflow-x-scroll border-none bg-transparent p-0 outline-hidden scrollbar-none',
                options.every(({ isSelected }): boolean => !isSelected) ? 'text-neutral-400' : 'text-neutral-900'
              )}
              displayValue={getDisplayName}
              placeholder={placeholder}
              spellCheck={false}
              onChange={(event): void => setQuery(event.target.value)}
            />
            <IconChevron
              aria-hidden={'true'}
              className={`size-6 transition-transform duration-300 ease-in-out ${isOpen ? '-rotate-180' : 'rotate-0'}`}
            />
          </ComboboxButton>
        )}
        <Transition
          show={isOpen}
          enter={'transition-all duration-300 ease-out'}
          enterFrom={'opacity-0 translate-y-[-4px]'}
          enterTo={'opacity-100 translate-y-0'}
          leave={'transition-all duration-200 ease-in'}
          leaveFrom={'opacity-100 translate-y-0'}
          leaveTo={'opacity-0 translate-y-[-4px]'}
          afterLeave={(): void => setQuery('')}
        >
          <ComboboxOptions
            className={cl(
              props.comboboxOptionsClassName,
              'absolute top-12 z-50 flex w-full min-w-[256px] cursor-pointer flex-col overflow-y-auto bg-neutral-0 px-2 py-3 scrollbar-none origin-top will-change-[opacity,transform] transform-gpu'
            )}
          >
            <SelectAllOption
              option={{
                label: areAllSelected ? 'Unselect All' : 'Select All',
                isSelected: areAllSelected,
                value: 'select_all'
              }}
              onSelectAll={handleSelectAll}
            />
            <Renderable shouldRender={filteredOptions.length > 0} fallback={<DropdownEmpty query={query} />}>
              {filteredOptions.map(
                (option): ReactElement => (
                  <Option
                    key={option.value}
                    onCheckboxClick={(): void => handleOnCheckboxClick(option)}
                    onContainerClick={(): void => handleOnContainerClick(option)}
                    {...option}
                  />
                )
              )}
            </Renderable>
          </ComboboxOptions>
        </Transition>
      </div>
    </Combobox>
  )
}
