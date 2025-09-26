import type { TMultiSelectOptionProps } from '@lib/components/MultiSelectDropdown'
import { MultiSelectDropdown } from '@lib/components/MultiSelectDropdown'
import { SearchBar } from '@lib/components/SearchBar'
import { useChainOptions } from '@lib/hooks/useChains'
import { IconChevron } from '@lib/icons/IconChevron'
import { cl, formatAmount } from '@lib/utils'
import { ALL_VAULTSV3_CATEGORIES, ALL_VAULTSV3_KINDS } from '@vaults-v3/constants'

import type { ReactElement } from 'react'
import { useMemo, useState } from 'react'
import useWallet from '@lib/contexts/useWallet'
import { useWeb3 } from '@lib/contexts/useWeb3'

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

function PortfolioCard(): ReactElement {
  const { cumulatedValueInV3Vaults, isLoading } = useWallet()
  const { isActive, address, openLoginModal, onSwitchChain } = useWeb3()

  if (!isActive) {
    return (
      <div className={'flex flex-row items-center mb-4 gap-4 h-18'}>
        <button
          className={cl('rounded-lg overflow-hidden flex', 'px-[42px] py-2', 'relative group', 'border-none')}
          onClick={(): void => {
            if (!isActive && address) {
              onSwitchChain(1)
            } else {
              openLoginModal()
            }
          }}
        >
          <div
            className={cl(
              'absolute inset-0',
              'opacity-80 transition-opacity group-hover:opacity-100 pointer-events-none',
              'bg-[linear-gradient(80deg,#D21162,#2C3DA6)]'
            )}
          />
          <p className={'z-10 text-neutral-900'}>{'Connect Wallet'}</p>
        </button>
        <p className={'text-[#757CA6] p-2'}>{'It looks like you need to connect your wallet.'}</p>
      </div>
    )
  }
  return (
    <div className={'flex flex-row justify-between mb-4'}>
      <div className={'flex flex-row gap-4 md:flex-row md:gap-32'}>
        <div>
          <p className={'pb-0 text-[#757CA6] md:pb-2'}>{'Amount Deposited'}</p>
          {isLoading ? (
            <div className={'h-[36.5px] w-32 animate-pulse rounded-sm bg-[#757CA6]'} />
          ) : (
            <b className={'font-number text-xl text-neutral-900 md:text-3xl'}>
              {'$'}
              <span suppressHydrationWarning>{formatAmount(cumulatedValueInV3Vaults.toFixed(2), 2, 2)}</span>
            </b>
          )}
        </div>
      </div>
    </div>
  )
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
      <PortfolioCard />

      <div className={'mb-5 w-full'}>
        <p className={'pb-2 text-[#757CA6]'}>{'Search'}</p>
        <SearchBar
          className={'max-w-none rounded-lg border-none bg-neutral-300 text-neutral-900 md:w-full'}
          iconClassName={'text-neutral-900'}
          searchPlaceholder={'YFI Vault'}
          searchValue={searchValue}
          onSearch={onSearch}
          shouldDebounce={shouldDebounce || false}
        />
      </div>
      <button
        onClick={(): void => setShouldExpandFilters((prev): boolean => !prev)}
        className={
          'w-full py-2 cursor-pointer rounded-[4px] bg-neutral-800/20 text-sm text-neutral-900 transition-colors hover:bg-neutral-800/50 sm:hidden'
        }
      >
        {'Filter Vaults'}
      </button>
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
            onSelect={(options): void => {
              const selectedChains = options
                .filter((o): boolean => o.isSelected)
                .map((option): number => Number(option.value))
              onChangeChains(selectedChains)
            }}
          />
        </div>

        <div className={'w-full'}>
          <p className={'pb-2 text-[#757CA6]'}>{'Select Category'}</p>
          <MultiSelectDropdown
            buttonClassName={'max-w-none rounded-lg bg-neutral-300 text-neutral-900 md:w-full'}
            comboboxOptionsClassName={'bg-neutral-300 rounded-lg'}
            options={categoryOptions}
            placeholder={'Filter categories'}
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
