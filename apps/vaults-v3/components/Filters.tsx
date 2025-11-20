import Link from '@components/Link'
import { Dialog, Transition, TransitionChild } from '@headlessui/react'
import type { TMultiSelectOptionProps } from '@lib/components/MultiSelectDropdown'
import { MultiSelectDropdown } from '@lib/components/MultiSelectDropdown'
import { SearchBar } from '@lib/components/SearchBar'
// import useWallet from '@lib/contexts/useWallet'
// import { useWeb3 } from '@lib/contexts/useWeb3'
import { useChainOptions } from '@lib/hooks/useChains'
import { IconCross } from '@lib/icons/IconCross'
import { IconFilter } from '@lib/icons/IconFilter'
import { LogoYearn } from '@lib/icons/LogoYearn'
import { cl } from '@lib/utils'
import type { TYDaemonVault } from '@lib/utils/schemas/yDaemonVaultsSchemas'
import { ALL_VAULTSV3_CATEGORIES, ALL_VAULTSV3_KINDS } from '@vaults-v3/constants'

import type { ReactElement, ReactNode } from 'react'
import { Fragment, useEffect, useMemo, useState } from 'react'
import { Drawer } from 'vaul'

// import HoldingsMarquee from './list/HoldingsMarquee'

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

const CHAIN_DISPLAY_ORDER = [1, 747474, 8453, 42161, 137, 146]
const PRIMARY_CHAIN_IDS = [1, 747474]
const DEFAULT_SECONDARY_CHAIN_IDS = [8453, 42161]

const isPrimaryChain = (chainId: number): boolean => PRIMARY_CHAIN_IDS.includes(chainId)

type TChainButton = {
  id: number
  label: string
  icon?: ReactElement
  isSelected: boolean
}

// function PortfolioCard({ holdingsVaults }: { holdingsVaults: TYDaemonVault[] }): ReactElement {
//   const { cumulatedValueInV3Vaults, isLoading } = useWallet()
//   const { isActive, address, openLoginModal, onSwitchChain } = useWeb3()

//   if (!isActive) {
//     return (
//       <div className={'mb-4 flex h-18 flex-row items-center gap-2'}>
//         <button
//           className={cl('relative flex overflow-hidden rounded-lg group', 'px-[42px] py-2', 'border-none')}
//           onClick={(): void => {
//             if (!isActive && address) {
//               onSwitchChain(1)
//             } else {
//               openLoginModal()
//             }
//           }}
//         >
//           <div
//             className={cl(
//               'absolute inset-0',
//               'pointer-events-none opacity-80 transition-opacity group-hover:opacity-100',
//               'bg-[linear-gradient(80deg,#D21162,#2C3DA6)]'
//             )}
//           />
//           <p className={'z-10 text-neutral-900'}>{'Connect Wallet'}</p>
//         </button>
//         <p className={'p-2 text-[#757CA6]'}>{'It looks like you need to connect your wallet.'}</p>
//       </div>
//     )
//   }
//   return (
//     <div className={'mb-2 flex flex-col gap-0 md:min-h-18'}>
//       <div className={'flex flex-row justify-between'}>
//         <p className={'pb-0 text-[#757CA6] md:pb-2'}>{'Your Deposits:'}</p>
//         <div className={'flex flex-row gap-4 md:flex-row md:gap-2 pr-4'}>
//           <p className={'pb-0 text-[#757CA6] md:pb-2'}>{'Value of your Deposits:'}</p>
//           {isLoading ? (
//             <div className={'h-[36.5px] w-32 animate-pulse rounded-sm bg-[#757CA6]'} />
//           ) : (
//             <b className={'font-number text-neutral-900 '}>
//               {'$'}
//               <span suppressHydrationWarning>{formatAmount(cumulatedValueInV3Vaults.toFixed(2), 2, 2)}</span>
//             </b>
//           )}
//         </div>
//       </div>
//       <HoldingsMarquee holdingsVaults={holdingsVaults} />
//     </div>
//   )
// }

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
}: // holdingsVaults
TListHero): ReactElement {
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
      option.value === 146 ||
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
      <div className={'mb-3 mt-2 flex items-center gap-2 text-sm text-neutral-500'}>
        <Link to={'/'} className={'transition-colors hover:text-neutral-900'}>
          {'Home'}
        </Link>
        <span>{'>'}</span>
        <span className={'font-medium text-neutral-900'}>{'Vaults'}</span>
      </div>
      <div className={'relative col-span-24 w-full rounded-lg bg-neutral-0 p-2 md:col-span-19'}>
        {/* <PortfolioCard holdingsVaults={holdingsVaults} /> */}

        <div className={'md:hidden'}>
          <div className={'mb-5 w-full'}>
            <p className={'pb-2 text-[#757CA6]'}>{'Search'}</p>
            <SearchBar
              className={'max-w-none rounded-lg border-none bg-neutral-100 text-neutral-900 transition-all md:w-full'}
              iconClassName={'text-neutral-900'}
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
                    'w-full max-w-[520px] rounded-t-3xl bg-neutral-100 p-6 border border-neutral-300 shadow-sm'
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
                    chainButtons={chainButtons}
                    onSelectAllChains={handleSelectAllChains}
                    areAllChainsSelected={areAllChainsSelected}
                    onSelectChain={handleChainToggle}
                    onOpenChainModal={(): void => setIsChainModalOpen(true)}
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
          <div className={'flex w-full flex-nowrap justify-between items-center gap-3'}>
            <div
              className={
                'flex shrink-0 flex-wrap items-center gap-px rounded-lg h-10 bg-neutral-100 border border-neutral-200 px-2 py-1 text-sm text-neutral-900'
              }
            >
              {chainButtons.map((chain) => (
                <button
                  key={chain.id}
                  type={'button'}
                  className={cl(
                    'flex items-center gap-2 rounded-lg px-3 py-1 font-medium transition-all',
                    'hover:bg-neutral-0/70',
                    'data-[active=false]:text-neutral-500 data-[active=false]:opacity-60 data-[active=false]:hover:text-neutral-900 data-[active=false]:hover:opacity-100 data-[active=false]:hover:bg-neutral-100/40',
                    'data-[active=true]:bg-neutral-0 data-[active=true]:text-neutral-900 data-[active=true]:opacity-100 data-[active=true]:shadow-sm'
                  )}
                  data-active={chain.isSelected}
                  onClick={(): void => onSelectChain(chain.id)}
                  aria-pressed={chain.isSelected}
                >
                  {chain.icon ? (
                    <span
                      className={cl(
                        'size-5 overflow-hidden rounded-full bg-neutral-0/80',
                        chain.label === 'Sonic' ? 'bg-white' : ''
                      )}
                    >
                      {chain.icon}
                    </span>
                  ) : null}
                  <span>{chain.label}</span>
                </button>
              ))}
              <button
                type={'button'}
                className={cl(
                  'flex items-center gap-2 rounded-lg px-3 py-1 font-medium transition-all',
                  'hover:bg-neutral-0/70',
                  'data-[active=false]:text-neutral-500 data-[active=false]:opacity-60 data-[active=false]:hover:text-neutral-900 data-[active=false]:hover:opacity-100 data-[active=false]:hover:bg-neutral-100/40',
                  'data-[active=true]:bg-neutral-100/40 data-[active=true]:text-neutral-900 data-[active=true]:opacity-100 data-[active=true]:shadow-sm'
                )}
                data-active={areAllChainsSelected}
                onClick={onSelectAllChains}
                aria-pressed={areAllChainsSelected}
              >
                <span className={'size-5 overflow-hidden rounded-full'}>
                  <LogoYearn
                    className={'size-full'}
                    back={areAllChainsSelected ? 'text-neutral-900' : 'text-neutral-500'}
                    front={'text-neutral-0'}
                  />
                </span>
                <span>{'All'}</span>
              </button>
              <button
                type={'button'}
                className={
                  'flex items-center gap-1 rounded-full px-3 py-1 font-medium text-neutral-700 transition-colors hover:bg-neutral-0/70'
                }
                onClick={onOpenChainModal}
              >
                <span className={'text-base leading-none'}>{'+'}</span>
                <span>{'More'}</span>
              </button>
            </div>
            <div className={'flex flex-row items-center gap-3 min-w-[300px] max-w-[500px] flex-1'}>
              <button
                type={'button'}
                className={cl(
                  'flex shrink-0 items-center gap-1 border rounded-lg h-10 border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-500 bg-surface transition-colors',
                  'hover:text-neutral-700',
                  'data-[active=true]:border-neutral-400 data-[active=true]:text-neutral-700'
                )}
                data-active={isMoreFiltersOpen}
                onClick={onToggleMoreFilters}
                aria-expanded={isMoreFiltersOpen}
              >
                <IconFilter className={'size-4'} />
                <span>{isMoreFiltersOpen ? 'Filters' : 'Filters'}</span>
              </button>
              {showInlineSearch ? (
                <div className={'min-w-[200px] flex-1'}>
                  <SearchBar
                    className={'w-full rounded-lg border-neutral-300 bg-neutral-0 text-neutral-900 transition-all'}
                    iconClassName={'text-neutral-900'}
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
            <p className={'pb-2 text-neutral-500'}>{'Select Category'}</p>
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
            <p className={'pb-2 text-neutral-500'}>{'Select Type'}</p>
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
                  'w-full max-w-lg rounded-3xl border border-neutral-200 bg-neutral-0 p-6 text-neutral-900 shadow-lg'
                }
              >
                <div className={'flex items-start justify-between gap-4'}>
                  <Dialog.Title className={'text-lg font-semibold text-neutral-900'}>{'Select chains'}</Dialog.Title>
                  <button
                    type={'button'}
                    onClick={onClose}
                    className={
                      'inline-flex size-8 items-center justify-center rounded-full border border-transparent text-neutral-500 hover:border-neutral-300 hover:text-neutral-900'
                    }
                    aria-label={'Close chain selector'}
                  >
                    <IconCross className={'size-4'} />
                  </button>
                </div>
                <div className={'mt-4 max-h-[320px] space-y-3 overflow-y-auto pr-1'}>
                  {options.length === 0 ? (
                    <p className={'text-sm text-neutral-600'}>{'No additional chains are available right now.'}</p>
                  ) : (
                    options.map((option) => {
                      const chainId = Number(option.value)
                      const isLocked = lockedChainIds.includes(chainId)
                      const isChecked = isLocked || pendingSelection.includes(chainId)
                      return (
                        <label
                          key={chainId}
                          className={cl(
                            'flex items-center justify-between gap-3 rounded-lg border px-3 py-2 transition-colors',
                            isChecked ? 'border-neutral-300 bg-neutral-300/80' : 'border-neutral-200',
                            isLocked ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:bg-neutral-300/50'
                          )}
                        >
                          <div className={'flex items-center gap-3'}>
                            {option.icon ? (
                              <span
                                className={cl(
                                  'size-8 overflow-hidden rounded-full',
                                  option.label === 'Sonic' ? 'bg-white' : ''
                                )}
                              >
                                {option.icon}
                              </span>
                            ) : null}
                            <span className={'text-sm font-medium text-neutral-900'}>{option.label}</span>
                          </div>
                          <input
                            type={'checkbox'}
                            className={'checkbox'}
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
                      'rounded-full border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-900 hover:border-neutral-400'
                    }
                    onClick={onClose}
                  >
                    {'Cancel'}
                  </button>
                  <button
                    type={'button'}
                    className={
                      'rounded-full bg-neutral-900 px-4 py-2 text-sm font-semibold text-neutral-0 transition-colors hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60'
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
