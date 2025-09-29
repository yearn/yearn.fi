import type { TMultiSelectOptionProps } from '@lib/components/MultiSelectDropdown'
import { MultiSelectDropdown } from '@lib/components/MultiSelectDropdown'
import { SearchBar } from '@lib/components/SearchBar'
import { useChainOptions } from '@lib/hooks/useChains'
import { IconChevron } from '@lib/icons/IconChevron'
import { cl } from '@lib/utils'
import { ALL_VAULTSV3_CATEGORIES, ALL_VAULTSV3_KINDS } from '@vaults-v3/constants'

import type { ReactElement } from 'react'
import React, { useMemo, useState } from 'react'

type TListHero = {
  types: string[] | null
  categories: string[] | null
  chains: number[] | null
  searchValue: string
  shouldDebounce: boolean
  onChangeTypes: (newType: string[] | null) => void
  onChangeChains: (chains: number[] | null) => void
  onChangeCategories: (categories: string[] | null) => void
  onSearch: (searchValue: string) => void
}

export function Filters({
  types,
  onChangeTypes,
  categories,
  onChangeCategories,
  searchValue,
  chains,
  onSearch,
  shouldDebounce,
  onChangeChains
}: TListHero): ReactElement {
  const [shouldExpandFilters, setShouldExpandFilters] = useState(false)
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null)

  const handleDropdownOpenChange = (dropdownId: string, isOpen: boolean) => {
    if (isOpen) {
      // Close any other open dropdown and open this one
      setActiveDropdown(dropdownId)
    } else if (activeDropdown === dropdownId) {
      // Only close if this dropdown was the active one
      setActiveDropdown(null)
    }
  }

  const chainOptions = useChainOptions(chains).filter(
    (option): boolean =>
      option.value === 1 ||
      option.value === 137 ||
      option.value === 42161 ||
      option.value === 8453 ||
      option.value === 146 ||
      option.value === 747474
  )
  const typeOptions = useMemo((): TMultiSelectOptionProps[] => {
    const options: TMultiSelectOptionProps[] = Object.entries(ALL_VAULTSV3_KINDS).map(
      ([key, value]): TMultiSelectOptionProps => ({
        value: key,
        label: value.replaceAll(' Vaults', ''),
        isSelected: types?.includes(key) || false
      })
    )
    return options
  }, [types])

  const categoryOptions = useMemo((): TMultiSelectOptionProps[] => {
    const options: TMultiSelectOptionProps[] = Object.values(ALL_VAULTSV3_CATEGORIES).map(
      (value): TMultiSelectOptionProps => ({
        value: value,
        label: value,
        isSelected: categories?.includes(value) || false
      })
    )
    return options
  }, [categories])

  return (
    <div className={'relative col-span-12 w-full rounded-3xl bg-neutral-100 p-6 md:col-span-8'}>
      <strong className={'block pb-2 text-3xl font-black text-neutral-900 md:pb-4 md:text-4xl md:leading-[48px]'}>
        {'Filters'}
      </strong>

      <div className={'absolute right-10 top-10 block md:hidden'}>
        <button onClick={(): void => setShouldExpandFilters((prev): boolean => !prev)}>
          <IconChevron
            className={cl(
              'size-4 text-neutral-400 transition-all hover:text-neutral-900',
              !shouldExpandFilters ? '-rotate-90' : 'rotate-0'
            )}
          />
        </button>
      </div>

      <div className={'mb-5 w-full'}>
        <p className={'pb-2 text-[#757CA6]'}>{'Search'}</p>
        <SearchBar
          className={'max-w-none rounded-lg text-neutral-900 md:w-full transition-all'}
          iconClassName={'text-neutral-900'}
          searchPlaceholder={'YFI Vault'}
          searchValue={searchValue}
          onSearch={onSearch}
          shouldDebounce={shouldDebounce || false}
          highlightWhenActive={true}
        />
      </div>
      <div
        className={cl(
          'grid grid-cols-1 gap-6 md:grid-cols-3',
          shouldExpandFilters ? 'h-auto' : 'h-0 overflow-hidden md:h-auto md:overflow-visible'
        )}
      >
        <div className={'w-full'}>
          <p className={'pb-2 text-[#757CA6]'}>{'Select Blockchain'}</p>
          <MultiSelectDropdown
            buttonClassName={'max-w-none rounded-lg bg-neutral-300 text-neutral-900 md:w-full'}
            comboboxOptionsClassName={'bg-neutral-300 rounded-lg'}
            options={chainOptions}
            placeholder={'Select chain'}
            isOpen={activeDropdown === 'chains'}
            onOpenChange={(isOpen): void => handleDropdownOpenChange('chains', isOpen)}
            onSelect={(options): void => {
              const selectedChains = options
                .filter((o): boolean => o.isSelected)
                .map((option): number => Number(option.value))
              onChangeChains(selectedChains)
            }}
            customMultipleRender={(selectedOptions): ReactElement => (
              <div className="flex items-center">
                {selectedOptions.map((option, index) => (
                  <div
                    key={option.value}
                    className={cl('size-6 overflow-hidden rounded-full', option.label === 'Sonic' ? 'bg-white' : '')}
                    style={{ marginLeft: index > 0 ? '-8px' : '0', zIndex: selectedOptions.length - index }}
                  >
                    {option.icon}
                  </div>
                ))}
              </div>
            )}
          />
        </div>

        <div className={'w-full'}>
          <p className={'pb-2 text-[#757CA6]'}>{'Select Category'}</p>
          <MultiSelectDropdown
            buttonClassName={'max-w-none rounded-lg bg-neutral-300 text-neutral-900 md:w-full'}
            comboboxOptionsClassName={'bg-neutral-300 rounded-lg'}
            options={categoryOptions}
            placeholder={'Filter categories'}
            isOpen={activeDropdown === 'categories'}
            onOpenChange={(isOpen): void => handleDropdownOpenChange('categories', isOpen)}
            onSelect={(options): void => {
              const selectedCategories = options
                .filter((o): boolean => o.isSelected)
                .map((option): string => String(option.value))
              onChangeCategories(selectedCategories)
            }}
          />
        </div>

        <div className={'w-full'}>
          <p className={'pb-2 text-[#757CA6]'}>{'Select Type'}</p>
          <MultiSelectDropdown
            buttonClassName={'max-w-none rounded-lg bg-neutral-300 text-neutral-900 md:w-full'}
            comboboxOptionsClassName={'bg-neutral-300 rounded-lg'}
            options={typeOptions}
            placeholder={'Filter list'}
            isOpen={activeDropdown === 'types'}
            onOpenChange={(isOpen): void => handleDropdownOpenChange('types', isOpen)}
            onSelect={(options): void => {
              const selectedTypes = options
                .filter((o): boolean => o.isSelected)
                .map((option): string => String(option.value))
              onChangeTypes(selectedTypes)
            }}
          />
        </div>
      </div>
    </div>
  )
}
