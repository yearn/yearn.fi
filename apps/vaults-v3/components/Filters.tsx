import type { TMultiSelectOptionProps } from '@lib/components/MultiSelectDropdown'
import { MultiSelectDropdown } from '@lib/components/MultiSelectDropdown'
import { SearchBar } from '@lib/components/SearchBar'
import { useChainOptions } from '@lib/hooks/useChains'
import { IconCross } from '@lib/icons/IconCross'
import { cl } from '@lib/utils'
import { ALL_VAULTSV3_CATEGORIES, ALL_VAULTSV3_KINDS } from '@vaults-v3/constants'

import type { ReactElement, ReactNode } from 'react'
import { useMemo, useState } from 'react'
import { Drawer } from 'vaul'

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
  searchAlertContent?: ReactNode
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
  onChangeChains,
  searchAlertContent
}: TListHero): ReactElement {
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false)
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null)

  const handleDropdownOpenChange = (dropdownId: string, isOpen: boolean): void => {
    if (isOpen) {
      setActiveDropdown(dropdownId)
    } else if (activeDropdown === dropdownId) {
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
    return Object.entries(ALL_VAULTSV3_KINDS).map(
      ([key, value]): TMultiSelectOptionProps => ({
        value: key,
        label: value.replaceAll(' Vaults', ''),
        isSelected: types?.includes(key) || false
      })
    )
  }, [types])

  const categoryOptions = useMemo((): TMultiSelectOptionProps[] => {
    return Object.values(ALL_VAULTSV3_CATEGORIES).map(
      (value): TMultiSelectOptionProps => ({
        value: value,
        label: value,
        isSelected: categories?.includes(value) || false
      })
    )
  }, [categories])

  return (
    <div className={'relative col-span-12 w-full rounded-3xl bg-neutral-100 p-6 md:col-span-8'}>
      <strong className={'block pb-2 text-3xl font-black text-neutral-900 md:pb-4 md:text-4xl md:leading-[48px]'}>
        {'Filters'}
      </strong>

      <div className={'mb-5 w-full'}>
        <p className={'pb-2 text-[#757CA6]'}>{'Search'}</p>
        <SearchBar
          className={'max-w-none rounded-lg text-neutral-900 transition-all md:w-full'}
          iconClassName={'text-neutral-900'}
          searchPlaceholder={'YFI Vault'}
          searchValue={searchValue}
          onSearch={onSearch}
          shouldDebounce={shouldDebounce || false}
          highlightWhenActive={true}
          alertContent={searchAlertContent}
        />
      </div>

      <div className={'md:hidden'}>
        <Drawer.Root
          open={isMobileFiltersOpen}
          onOpenChange={(isOpen): void => {
            setIsMobileFiltersOpen(isOpen)
            if (!isOpen) {
              setActiveDropdown(null)
            }
          }}
          direction={'bottom'}
        >
          <Drawer.Trigger asChild>
            <button
              className={
                'w-full cursor-pointer rounded-[4px] bg-neutral-800/20 py-2 text-sm text-neutral-900 transition-colors hover:bg-neutral-800/50'
              }
            >
              {'Filter Vaults'}
            </button>
          </Drawer.Trigger>
          <Drawer.Portal>
            <Drawer.Overlay className={'fixed inset-0 z-99998 bg-black/40 backdrop-blur-xs transition-opacity'} />
            <Drawer.Content className={'fixed inset-x-0 bottom-0 z-99999 flex justify-center outline-hidden'}>
              <div
                className={
                  'w-full max-w-[520px] rounded-t-3xl bg-neutral-100 p-6 shadow-[0_-16px_60px_rgba(15,23,42,0.35)]'
                }
                style={{ height: '75vh', overflowY: 'auto' }}
              >
                <div className={'mb-4 flex items-center justify-between'}>
                  <p className={'text-base font-medium text-neutral-900'}>{'Filter Vaults'}</p>
                  <Drawer.Close
                    className={'rounded-full p-2 text-neutral-900 transition-colors hover:text-neutral-600'}
                  >
                    <IconCross className={'size-4'} />
                  </Drawer.Close>
                </div>
                <FilterControls
                  chainOptions={chainOptions}
                  onChangeChains={onChangeChains}
                  categoryOptions={categoryOptions}
                  onChangeCategories={onChangeCategories}
                  typeOptions={typeOptions}
                  onChangeTypes={onChangeTypes}
                  activeDropdown={activeDropdown}
                  onDropdownOpenChange={handleDropdownOpenChange}
                />
              </div>
            </Drawer.Content>
          </Drawer.Portal>
        </Drawer.Root>
      </div>

      <div className={'hidden md:block'}>
        <FilterControls
          chainOptions={chainOptions}
          onChangeChains={onChangeChains}
          categoryOptions={categoryOptions}
          onChangeCategories={onChangeCategories}
          typeOptions={typeOptions}
          onChangeTypes={onChangeTypes}
          activeDropdown={activeDropdown}
          onDropdownOpenChange={handleDropdownOpenChange}
        />
      </div>
    </div>
  )
}

function FilterControls({
  chainOptions,
  onChangeChains,
  categoryOptions,
  onChangeCategories,
  typeOptions,
  onChangeTypes,
  activeDropdown,
  onDropdownOpenChange
}: {
  chainOptions: TMultiSelectOptionProps[]
  onChangeChains: (chains: number[] | null) => void
  categoryOptions: TMultiSelectOptionProps[]
  onChangeCategories: (categories: string[] | null) => void
  typeOptions: TMultiSelectOptionProps[]
  onChangeTypes: (types: string[] | null) => void
  activeDropdown: string | null
  onDropdownOpenChange: (dropdownId: string, isOpen: boolean) => void
}): ReactElement {
  return (
    <div className={'grid grid-cols-1 gap-6 md:grid-cols-3'}>
      <div className={'w-full'}>
        <p className={'pb-2 text-[#757CA6]'}>{'Select Blockchain'}</p>
        <MultiSelectDropdown
          buttonClassName={'max-w-none rounded-lg bg-neutral-300 text-neutral-900 md:w-full'}
          comboboxOptionsClassName={'bg-neutral-300 rounded-lg'}
          options={chainOptions}
          placeholder={'Select chain'}
          isOpen={activeDropdown === 'chains'}
          onOpenChange={(isOpen): void => onDropdownOpenChange('chains', isOpen)}
          onSelect={(options): void => {
            const selectedChains = options
              .filter((o): boolean => o.isSelected)
              .map((option): number => Number(option.value))
            onChangeChains(selectedChains)
          }}
          customMultipleRender={(selectedOptions): ReactElement => (
            <div className={'flex items-center'}>
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
          onOpenChange={(isOpen): void => onDropdownOpenChange('categories', isOpen)}
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
          onOpenChange={(isOpen): void => onDropdownOpenChange('types', isOpen)}
          onSelect={(options): void => {
            const selectedTypes = options
              .filter((o): boolean => o.isSelected)
              .map((option): string => String(option.value))
            onChangeTypes(selectedTypes)
          }}
        />
      </div>
    </div>
  )
}
