import { Dialog, Transition, TransitionChild } from '@headlessui/react'
import type { TMultiSelectOptionProps } from '@lib/components/MultiSelectDropdown'
import { MultiSelectDropdown } from '@lib/components/MultiSelectDropdown'
import { SearchBar } from '@lib/components/SearchBar'
import { useChainOptions } from '@lib/hooks/useChains'
import { IconChevron } from '@lib/icons/IconChevron'
import { IconCross } from '@lib/icons/IconCross'
import { IconFilter } from '@lib/icons/IconFilter'
import { LogoYearn } from '@lib/icons/LogoYearn'
import { cl } from '@lib/utils'
import type { TYDaemonVault } from '@lib/utils/schemas/yDaemonVaultsSchemas'
import { ALL_VAULTSV3_CATEGORIES, ALL_VAULTSV3_KINDS } from '@vaults-v3/constants'

import type { ReactElement, ReactNode } from 'react'
import { Fragment, useEffect, useMemo, useState } from 'react'
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
  holdingsVaults: TYDaemonVault[]
}

const CHAIN_DISPLAY_ORDER = [1, 747474, 8453, 42161, 137]
const PRIMARY_CHAIN_IDS = [1, 747474]
const DEFAULT_SECONDARY_CHAIN_IDS = [8453, 42161, 137]

const isPrimaryChain = (chainId: number): boolean => PRIMARY_CHAIN_IDS.includes(chainId)

type TChainButton = {
  id: number
  label: string
  icon?: ReactElement
  isSelected: boolean
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
  const [isChainModalOpen, setIsChainModalOpen] = useState(false)
  const [customChainIds, setCustomChainIds] = useState<number[]>(DEFAULT_SECONDARY_CHAIN_IDS)
  const [isMoreFiltersOpen, setIsMoreFiltersOpen] = useState(false)

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
      option.value === 747474
  )

  const chainOptionMap = useMemo(() => {
    const map = new Map<number, TMultiSelectOptionProps>()
    for (const option of chainOptions) {
      map.set(Number(option.value), option)
    }
    return map
  }, [chainOptions])

  const pinnedChainIds = useMemo(() => {
    const seen = new Set<number>()
    const sanitized: number[] = []
    for (const id of customChainIds) {
      const chainId = Number(id)
      if (!seen.has(chainId) && !isPrimaryChain(chainId) && chainOptionMap.has(chainId)) {
        seen.add(chainId)
        sanitized.push(chainId)
      }
    }
    return sanitized
  }, [customChainIds, chainOptionMap])

  const visibleChainIds = useMemo(() => {
    const ordered: number[] = []
    const push = (chainId: number): void => {
      if (!chainOptionMap.has(chainId)) {
        return
      }
      if (!ordered.includes(chainId)) {
        ordered.push(chainId)
      }
    }

    for (const id of PRIMARY_CHAIN_IDS) {
      push(id)
    }
    for (const id of pinnedChainIds) {
      push(id)
    }

    return ordered
  }, [chainOptionMap, pinnedChainIds])

  const selectedChainSet = useMemo(() => new Set(chains ?? []), [chains])

  const chainButtons = useMemo((): TChainButton[] => {
    return visibleChainIds
      .map((id) => {
        const option = chainOptionMap.get(id)
        if (!option) {
          return null
        }
        return {
          id,
          label: option.label,
          icon: option.icon,
          isSelected: selectedChainSet.has(id)
        }
      })
      .filter(Boolean) as TChainButton[]
  }, [visibleChainIds, chainOptionMap, selectedChainSet])

  const areAllChainsSelected = !chains || chains.length === 0

  const chainOrderMap = useMemo(() => {
    const map = new Map<number, number>()
    CHAIN_DISPLAY_ORDER.forEach((chainId, index) => {
      map.set(chainId, index)
    })
    return map
  }, [])

  const chainModalOptions = useMemo(() => {
    return [...chainOptions].sort((a, b) => {
      const rankA = chainOrderMap.get(Number(a.value)) ?? Number.MAX_SAFE_INTEGER
      const rankB = chainOrderMap.get(Number(b.value)) ?? Number.MAX_SAFE_INTEGER
      if (rankA === rankB) {
        return String(a.label).localeCompare(String(b.label))
      }
      return rankA - rankB
    })
  }, [chainOptions, chainOrderMap])

  const handleSelectAllChains = (): void => {
    onChangeChains(null)
  }

  const handleChainToggle = (chainId: number): void => {
    if (chains && chains.length === 1 && chains[0] === chainId) {
      onChangeChains(null)
      return
    }
    onChangeChains([chainId])
  }

  const handleApplyAdditionalChains = (ids: number[]): void => {
    const unique: number[] = []
    const seen = new Set<number>()
    for (const id of ids) {
      if (seen.has(id)) {
        continue
      }
      if (isPrimaryChain(id) || !chainOptionMap.has(id)) {
        continue
      }
      seen.add(id)
      unique.push(id)
    }
    setCustomChainIds(unique)
  }

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
    <>
      <div className={'relative col-span-24 w-full  md:col-span-19'}>
        <div className={'md:hidden'}>
          <div className={'mb-5 w-full'}>
            <p className={'pb-2 text-[#757CA6]'}>{'Search'}</p>
            <SearchBar
              className={
                'max-w-none rounded-lg border-none bg-surface-secondary text-text-primary transition-all md:w-full'
              }
              iconClassName={'text-text-primary'}
              searchPlaceholder={'YFI Vault'}
              searchValue={searchValue}
              onSearch={onSearch}
              shouldDebounce={shouldDebounce || false}
              highlightWhenActive={true}
              alertContent={searchAlertContent}
            />
          </div>

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
                  'w-full cursor-pointer rounded-[4px] bg-neutral-800/20 py-2 text-sm text-text-primary transition-colors hover:bg-neutral-800/50'
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
                    'w-full max-w-[520px] rounded-t-3xl bg-surface-secondary p-6 border border-border shadow-sm'
                  }
                  style={{ height: '75vh', overflowY: 'auto' }}
                >
                  <div className={'mb-4 flex items-center justify-between'}>
                    <p className={'text-base font-medium text-text-primary'}>{'Filter Vaults'}</p>
                    <Drawer.Close
                      className={'rounded-full p-2 text-text-primary transition-colors hover:text-text-secondary'}
                    >
                      <IconCross className={'size-4'} />
                    </Drawer.Close>
                  </div>
                  <FilterControls
                    chainButtons={chainButtons}
                    onSelectAllChains={handleSelectAllChains}
                    areAllChainsSelected={areAllChainsSelected}
                    onSelectChain={handleChainToggle}
                    onOpenChainModal={(): void => setIsChainModalOpen(true)}
                    showMoreChainsButton={false}
                    isMoreFiltersOpen={isMoreFiltersOpen}
                    onToggleMoreFilters={(): void => setIsMoreFiltersOpen((prev) => !prev)}
                    categoryOptions={categoryOptions}
                    onChangeCategories={onChangeCategories}
                    typeOptions={typeOptions}
                    onChangeTypes={onChangeTypes}
                    activeDropdown={activeDropdown}
                    onDropdownOpenChange={handleDropdownOpenChange}
                    showInlineSearch={false}
                    searchValue={searchValue}
                    onSearch={onSearch}
                    shouldDebounce={shouldDebounce}
                    searchAlertContent={searchAlertContent}
                  />
                </div>
              </Drawer.Content>
            </Drawer.Portal>
          </Drawer.Root>
        </div>

        <div className={'hidden md:block'}>
          <FilterControls
            chainButtons={chainButtons}
            onSelectAllChains={handleSelectAllChains}
            areAllChainsSelected={areAllChainsSelected}
            onSelectChain={handleChainToggle}
            onOpenChainModal={(): void => setIsChainModalOpen(true)}
            showMoreChainsButton={false}
            isMoreFiltersOpen={isMoreFiltersOpen}
            onToggleMoreFilters={(): void => setIsMoreFiltersOpen((prev) => !prev)}
            categoryOptions={categoryOptions}
            onChangeCategories={onChangeCategories}
            typeOptions={typeOptions}
            onChangeTypes={onChangeTypes}
            activeDropdown={activeDropdown}
            onDropdownOpenChange={handleDropdownOpenChange}
            showInlineSearch={true}
            searchValue={searchValue}
            onSearch={onSearch}
            shouldDebounce={shouldDebounce}
            searchAlertContent={searchAlertContent}
          />
        </div>
      </div>
      <ChainSelectionModal
        isOpen={isChainModalOpen}
        onClose={(): void => setIsChainModalOpen(false)}
        options={chainModalOptions}
        selectedChainIds={pinnedChainIds}
        lockedChainIds={PRIMARY_CHAIN_IDS}
        onApply={handleApplyAdditionalChains}
      />
    </>
  )
}

function FilterControls({
  chainButtons,
  onSelectAllChains,
  areAllChainsSelected,
  onSelectChain,
  onOpenChainModal,
  showMoreChainsButton = true,
  isMoreFiltersOpen,
  onToggleMoreFilters,
  categoryOptions,
  onChangeCategories,
  typeOptions,
  onChangeTypes,
  activeDropdown,
  onDropdownOpenChange,
  showInlineSearch,
  searchValue,
  onSearch,
  shouldDebounce,
  searchAlertContent
}: {
  chainButtons: TChainButton[]
  onSelectAllChains: () => void
  areAllChainsSelected: boolean
  onSelectChain: (chainId: number) => void
  onOpenChainModal: () => void
  /**
   * Controls whether the "More" chain button is shown.
   * Disable when all supported chains fit inline; re-enable if/when we add more chains.
   */
  showMoreChainsButton?: boolean
  isMoreFiltersOpen: boolean
  onToggleMoreFilters: () => void
  categoryOptions: TMultiSelectOptionProps[]
  onChangeCategories: (categories: string[] | null) => void
  typeOptions: TMultiSelectOptionProps[]
  onChangeTypes: (types: string[] | null) => void
  activeDropdown: string | null
  onDropdownOpenChange: (dropdownId: string, isOpen: boolean) => void
  showInlineSearch: boolean
  searchValue: string
  onSearch: (value: string) => void
  shouldDebounce?: boolean
  searchAlertContent?: ReactNode
}): ReactElement {
  return (
    <div className={'flex flex-col gap-4'}>
      <div>
        <div className={'flex flex-col gap-2'}>
          <div className={'flex w-full flex-wrap items-center gap-3'}>
            <div
              className={
                'flex h-10 shrink-0 items-stretch overflow-hidden rounded-xl border border-border bg-surface-secondary text-sm text-text-primary divide-x divide-border'
              }
            >
              <button
                type={'button'}
                className={cl(
                  'flex h-full items-center gap-2 px-3 font-medium transition-colors',
                  'data-[active=false]:text-text-secondary data-[active=false]:hover:bg-surface/30 data-[active=false]:hover:text-text-primary',
                  'data-[active=true]:bg-surface data-[active=true]:text-text-primary'
                )}
                data-active={areAllChainsSelected}
                onClick={onSelectAllChains}
                aria-pressed={areAllChainsSelected}
              >
                <span className={'size-5 overflow-hidden rounded-full'}>
                  <LogoYearn className={'size-full'} back={'text-text-primary'} front={'text-surface'} />
                </span>
                <span className={'whitespace-nowrap'}>{'All Chains'}</span>
              </button>
              {chainButtons.map((chain) => (
                <button
                  key={chain.id}
                  type={'button'}
                  className={cl(
                    'flex h-full items-center gap-2 px-3 font-medium transition-colors',
                    'data-[active=false]:text-text-secondary data-[active=false]:hover:bg-surface/30 data-[active=false]:hover:text-text-primary',
                    'data-[active=true]:bg-surface data-[active=true]:text-text-primary'
                  )}
                  data-active={chain.isSelected}
                  onClick={(): void => onSelectChain(chain.id)}
                  aria-pressed={chain.isSelected}
                >
                  {chain.icon ? (
                    <span className={'size-5 overflow-hidden rounded-full bg-surface/80'}>{chain.icon}</span>
                  ) : null}
                  <span className={'whitespace-nowrap'}>{chain.label}</span>
                </button>
              ))}

              {showMoreChainsButton ? (
                <button
                  type={'button'}
                  className={cl(
                    'flex h-full items-center gap-2 px-3 font-medium transition-colors',
                    'text-text-secondary hover:bg-surface/30 hover:text-text-primary'
                  )}
                  onClick={onOpenChainModal}
                >
                  <span className={'whitespace-nowrap'}>{'More'}</span>
                  <span className={'flex items-center'}>
                    <IconChevron direction={'right'} className={'size-4'} />
                    <IconChevron direction={'right'} className={'-ml-3 size-4'} />
                  </span>
                </button>
              ) : null}
            </div>
            <div className={'flex flex-row items-center gap-3 flex-1'}>
              <button
                type={'button'}
                className={cl(
                  'flex shrink-0 items-center gap-1 border rounded-lg h-10 border-border px-4 py-2 text-sm font-medium text-text-secondary bg-surface transition-colors',
                  'hover:text-text-secondary',
                  'data-[active=true]:border-border-hover data-[active=true]:text-text-secondary'
                )}
                data-active={isMoreFiltersOpen}
                onClick={onToggleMoreFilters}
                aria-expanded={isMoreFiltersOpen}
              >
                <IconFilter className={'size-4'} />
                <span>{isMoreFiltersOpen ? 'Filters' : 'Filters'}</span>
              </button>
              {showInlineSearch ? (
                <div className={'flex-1'}>
                  <SearchBar
                    className={'w-full rounded-lg border-border bg-surface text-text-primary transition-all'}
                    iconClassName={'text-text-primary'}
                    searchPlaceholder={'Find a Vault'}
                    searchValue={searchValue}
                    onSearch={onSearch}
                    shouldDebounce={shouldDebounce || false}
                    highlightWhenActive={true}
                    alertContent={searchAlertContent}
                  />
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
      {isMoreFiltersOpen ? (
        <div className={'grid grid-cols-1 gap-4 md:grid-cols-2'}>
          <div className={'w-full'}>
            <p className={'pb-2 text-text-secondary'}>{'Select Category'}</p>
            <MultiSelectDropdown
              buttonClassName={'max-w-none rounded-lg bg-surface-tertiary text-text-primary md:w-full'}
              comboboxOptionsClassName={'bg-surface-tertiary rounded-lg'}
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
            <p className={'pb-2 text-text-secondary'}>{'Select Type'}</p>
            <MultiSelectDropdown
              buttonClassName={'max-w-none rounded-lg bg-surface-tertiary text-text-primary md:w-full'}
              comboboxOptionsClassName={'bg-surface-tertiary rounded-lg'}
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
      ) : null}
    </div>
  )
}

function ChainSelectionModal({
  isOpen,
  onClose,
  options,
  selectedChainIds,
  lockedChainIds,
  onApply
}: {
  isOpen: boolean
  onClose: () => void
  options: TMultiSelectOptionProps[]
  selectedChainIds: number[]
  lockedChainIds: number[]
  onApply: (chainIds: number[]) => void
}): ReactElement {
  const [pendingSelection, setPendingSelection] = useState<number[]>(selectedChainIds)

  useEffect(() => {
    if (isOpen) {
      setPendingSelection(selectedChainIds)
    }
  }, [isOpen, selectedChainIds])

  const toggleChain = (chainId: number): void => {
    if (lockedChainIds.includes(chainId)) {
      return
    }
    setPendingSelection((prev) => {
      if (prev.includes(chainId)) {
        return prev.filter((id) => id !== chainId)
      }
      return [...prev, chainId]
    })
  }

  const handleApply = (): void => {
    onApply(pendingSelection)
    onClose()
  }

  return (
    <Transition show={isOpen} as={Fragment}>
      <Dialog as={'div'} className={'relative z-[60]'} onClose={onClose}>
        <TransitionChild
          as={Fragment}
          enter={'duration-200 ease-out'}
          enterFrom={'opacity-0'}
          enterTo={'opacity-100'}
          leave={'duration-150 ease-in'}
          leaveFrom={'opacity-100'}
          leaveTo={'opacity-0'}
        >
          <div className={'fixed inset-0 bg-black/40'} />
        </TransitionChild>
        <div className={'fixed inset-0 overflow-y-auto'}>
          <div className={'flex min-h-full items-center justify-center p-4'}>
            <TransitionChild
              as={Fragment}
              enter={'duration-200 ease-out'}
              enterFrom={'opacity-0 scale-95'}
              enterTo={'opacity-100 scale-100'}
              leave={'duration-150 ease-in'}
              leaveFrom={'opacity-100 scale-100'}
              leaveTo={'opacity-0 scale-95'}
            >
              <Dialog.Panel
                className={
                  'w-full max-w-lg rounded-3xl border border-border bg-surface p-6 text-text-primary shadow-lg'
                }
              >
                <div className={'flex items-start justify-between gap-4'}>
                  <Dialog.Title className={'text-lg font-semibold text-text-primary'}>{'Select chains'}</Dialog.Title>
                  <button
                    type={'button'}
                    onClick={onClose}
                    className={
                      'inline-flex size-8 items-center justify-center rounded-full border border-transparent text-text-secondary hover:border-border hover:text-text-primary'
                    }
                    aria-label={'Close chain selector'}
                  >
                    <IconCross className={'size-4'} />
                  </button>
                </div>
                <div className={'mt-4 max-h-[400px] space-y-1 overflow-y-auto pr-1'}>
                  {options.length === 0 ? (
                    <p className={'text-sm text-text-secondary'}>{'No additional chains are available right now.'}</p>
                  ) : (
                    options.map((option) => {
                      const chainId = Number(option.value)
                      const isLocked = lockedChainIds.includes(chainId)
                      const isChecked = isLocked || pendingSelection.includes(chainId)
                      return (
                        <label
                          key={chainId}
                          className={cl(
                            'flex items-center justify-between gap-2 rounded-lg border px-3 py-2 transition-colors',
                            isChecked ? 'border-border bg-surface-tertiary/80' : 'border-border',
                            isLocked ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:bg-surface-tertiary/50'
                          )}
                        >
                          <div className={'flex items-center gap-3'}>
                            {option.icon ? (
                              <span className={'size-5 overflow-hidden rounded-full'}>{option.icon}</span>
                            ) : null}
                            <span className={'text-sm font-medium text-text-primary'}>{option.label}</span>
                          </div>
                          <input
                            type={'checkbox'}
                            className={'checkbox accent-blue-500'} // or any other accent color
                            checked={isChecked}
                            disabled={isLocked}
                            onChange={(): void => toggleChain(chainId)}
                          />
                        </label>
                      )
                    })
                  )}
                </div>
                <div className={'mt-6 flex justify-end gap-3'}>
                  <button
                    type={'button'}
                    className={
                      'rounded-full border border-border px-4 py-2 text-sm font-medium text-text-primary hover:border-border-hover'
                    }
                    onClick={onClose}
                  >
                    {'Cancel'}
                  </button>
                  <button
                    type={'button'}
                    className={
                      'rounded-full bg-neutral-900 px-4 py-2 text-sm font-semibold text-surface transition-colors hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60'
                    }
                    onClick={handleApply}
                    disabled={options.length === 0}
                  >
                    {'Save'}
                  </button>
                </div>
              </Dialog.Panel>
            </TransitionChild>
          </div>
        </div>
      </Dialog>
    </Transition>
  )
}
