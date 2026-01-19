import { Dialog, Transition, TransitionChild } from '@headlessui/react'
import type { TMultiSelectOptionProps } from '@lib/components/MultiSelectDropdown'
import { SearchBar } from '@lib/components/SearchBar'
import { useChainOptions } from '@lib/hooks/useChains'
import { IconCross } from '@lib/icons/IconCross'
import { IconSearch } from '@lib/icons/IconSearch'
import { cl } from '@lib/utils'
import type { ReactElement, ReactNode, RefObject } from 'react'
import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { Drawer } from 'vaul'
import { type TVaultsChainButton, VaultsChainSelector } from './VaultsChainSelector'
import { VaultsFiltersButton } from './VaultsFiltersButton'
import { type TFiltersConfig, type TPendingFiltersState, VaultsFiltersPanelControlled } from './VaultsFiltersPanel'

export type TChainConfig = {
  supportedChainIds: number[]
  primaryChainIds?: number[]
  defaultSecondaryChainIds?: number[]
  chainDisplayOrder?: number[]
  showMoreChainsButton?: boolean
  allChainsLabel?: string
}

export type TSearchProps = {
  value: string
  onChange: (value: string) => void
  shouldDebounce?: boolean
  alertContent?: ReactNode
  trailingControls?: ReactNode
}

export type TFiltersProps = {
  count: number
  content?: ReactNode
  config?: TFiltersConfig
  initialState?: TPendingFiltersState
  onApply?: (state: TPendingFiltersState) => void
  onClear?: () => void
  trailingControls?: ReactNode
}

export type TChainProps = {
  selected: number[] | null
  onChange: (chains: number[] | null) => void
  config: TChainConfig
}

type TVaultsFiltersBarProps = {
  search: TSearchProps
  filters: TFiltersProps
  chains: TChainProps
  mobileExtraContent?: ReactNode
  trailingControls?: ReactNode
  isStackedLayout?: boolean
}

export function VaultsFiltersBar({
  search,
  filters,
  chains,
  mobileExtraContent,
  trailingControls,
  isStackedLayout: isStackedLayoutProp
}: TVaultsFiltersBarProps): ReactElement {
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false)
  const [isMobileSearchExpanded, setIsMobileSearchExpanded] = useState(false)
  const [isChainModalOpen, setIsChainModalOpen] = useState(false)
  const [isFiltersModalOpen, setIsFiltersModalOpen] = useState(false)
  const isStackedLayout = Boolean(isStackedLayoutProp)
  const hasFiltersContent = Boolean(filters.content)

  const {
    supportedChainIds,
    primaryChainIds: primaryChainIdsProp = supportedChainIds,
    defaultSecondaryChainIds = [],
    chainDisplayOrder = supportedChainIds,
    showMoreChainsButton = false,
    allChainsLabel = 'All Chains'
  } = chains.config

  const [customChainIds, setCustomChainIds] = useState<number[]>(defaultSecondaryChainIds)

  useEffect(() => {
    setCustomChainIds(defaultSecondaryChainIds)
  }, [defaultSecondaryChainIds])

  const chainOptions = useChainOptions(chains.selected).filter((option): boolean =>
    supportedChainIds.includes(Number(option.value))
  )

  const chainOptionMap = useMemo(() => {
    const map = new Map<number, TMultiSelectOptionProps>()
    for (const option of chainOptions) {
      map.set(Number(option.value), option)
    }
    return map
  }, [chainOptions])

  const primaryChainIds = useMemo(() => {
    return primaryChainIdsProp.filter((chainId) => chainOptionMap.has(chainId))
  }, [primaryChainIdsProp, chainOptionMap])

  const primaryChainIdSet = useMemo(() => new Set(primaryChainIds), [primaryChainIds])

  const pinnedChainIds = useMemo(() => {
    const seen = new Set<number>()
    const sanitized: number[] = []
    for (const id of customChainIds) {
      const chainId = Number(id)
      if (!seen.has(chainId) && !primaryChainIdSet.has(chainId) && chainOptionMap.has(chainId)) {
        seen.add(chainId)
        sanitized.push(chainId)
      }
    }
    return sanitized
  }, [customChainIds, primaryChainIdSet, chainOptionMap])

  const visibleChainIds = useMemo(() => {
    const ordered: number[] = []
    const baseIds = primaryChainIds.length > 0 ? primaryChainIds : supportedChainIds
    const push = (chainId: number): void => {
      if (!chainOptionMap.has(chainId)) {
        return
      }
      if (!ordered.includes(chainId)) {
        ordered.push(chainId)
      }
    }

    for (const id of baseIds) {
      push(id)
    }
    for (const id of pinnedChainIds) {
      push(id)
    }

    return ordered
  }, [primaryChainIds, supportedChainIds, pinnedChainIds, chainOptionMap])

  const selectedChainSet = useMemo(() => new Set(chains.selected ?? []), [chains.selected])

  const chainButtons = useMemo((): TVaultsChainButton[] => {
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
      .filter(Boolean) as TVaultsChainButton[]
  }, [visibleChainIds, chainOptionMap, selectedChainSet])

  const areAllChainsSelected = !chains.selected || chains.selected.length === 0

  const chainOrderMap = useMemo(() => {
    const map = new Map<number, number>()
    chainDisplayOrder.forEach((chainId, index) => {
      map.set(chainId, index)
    })
    return map
  }, [chainDisplayOrder])

  const chainModalOptions = useMemo(() => {
    return [...chainOptions].toSorted((a, b) => {
      const rankA = chainOrderMap.get(Number(a.value)) ?? Number.MAX_SAFE_INTEGER
      const rankB = chainOrderMap.get(Number(b.value)) ?? Number.MAX_SAFE_INTEGER
      if (rankA === rankB) {
        return String(a.label).localeCompare(String(b.label))
      }
      return rankA - rankB
    })
  }, [chainOptions, chainOrderMap])

  const handleSelectAllChains = (): void => {
    chains.onChange(null)
  }

  const handleChainToggle = (chainId: number): void => {
    if (chains.selected && chains.selected.length === 1 && chains.selected[0] === chainId) {
      chains.onChange(null)
      return
    }
    chains.onChange([chainId])
  }

  const handleApplyAdditionalChains = (ids: number[]): void => {
    const unique: number[] = []
    const seen = new Set<number>()
    for (const id of ids) {
      if (seen.has(id)) {
        continue
      }
      if (primaryChainIdSet.has(id) || !chainOptionMap.has(id)) {
        continue
      }
      seen.add(id)
      unique.push(id)
    }
    setCustomChainIds(unique)
  }

  const controlsRowRef = useRef<HTMLDivElement | null>(null)
  const searchContainerRef = useRef<HTMLDivElement | null>(null)

  const stackedControls = mobileExtraContent ?? trailingControls

  return (
    <>
      <div className={'relative col-span-24 w-full md:col-span-19'}>
        <div className={'md:hidden'}>
          <Drawer.Root
            open={isMobileFiltersOpen}
            onOpenChange={(isOpen): void => {
              setIsMobileFiltersOpen(isOpen)
            }}
            direction={'bottom'}
          >
            {mobileExtraContent ? <div className={'mb-2 w-full'}>{mobileExtraContent}</div> : null}
            {isMobileSearchExpanded ? (
              <div className={'flex w-full items-center gap-1'}>
                <div className={'flex-1'}>
                  <SearchBar
                    className={'w-full rounded-[4px] border-none bg-neutral-800/20 text-text-primary'}
                    iconClassName={'text-text-primary'}
                    searchPlaceholder={'Search vaults...'}
                    searchValue={search.value}
                    onSearch={search.onChange}
                    shouldDebounce={search.shouldDebounce || false}
                    highlightWhenActive={false}
                    autoFocus={true}
                    onKeyDown={(e): void => {
                      if (e.key === 'Escape') {
                        setIsMobileSearchExpanded(false)
                      }
                    }}
                  />
                </div>
                <button
                  type={'button'}
                  className={
                    'flex size-10 shrink-0 items-center justify-center rounded-[4px] bg-neutral-800/20 text-text-secondary transition-colors hover:text-text-primary'
                  }
                  onClick={(): void => setIsMobileSearchExpanded(false)}
                  aria-label={'Close search'}
                >
                  <IconCross className={'size-3'} />
                </button>
              </div>
            ) : (
              <div className={'flex w-full items-center gap-1'}>
                <Drawer.Trigger asChild>
                  <button
                    className={
                      'h-10 flex-1 cursor-pointer rounded-[4px] bg-neutral-800/20 text-sm text-text-primary transition-colors hover:bg-neutral-800/40'
                    }
                  >
                    {'Filter Vaults'}
                  </button>
                </Drawer.Trigger>
                <button
                  type={'button'}
                  className={cl(
                    'flex size-10 shrink-0 items-center justify-center rounded-[4px] bg-neutral-800/20 text-text-secondary transition-colors hover:text-text-primary',
                    search.value ? 'text-text-primary' : ''
                  )}
                  onClick={(): void => setIsMobileSearchExpanded(true)}
                  aria-label={'Search vaults'}
                >
                  <IconSearch className={'size-4'} />
                </button>
              </div>
            )}
            <Drawer.Portal>
              <Drawer.Overlay className={'fixed inset-0 z-99998 bg-black/40 backdrop-blur-xs transition-opacity'} />
              <Drawer.Content className={'fixed inset-x-0 bottom-0 z-99999 flex justify-center outline-hidden'}>
                <div
                  className={
                    'w-full max-w-full rounded-t-3xl bg-surface-secondary p-6 border border-border shadow-sm max-h-[75vh] overflow-y-auto scrollbar-themed'
                  }
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
                    showMoreChainsButton={showMoreChainsButton}
                    allChainsLabel={allChainsLabel}
                    showFiltersButton={false}
                    filtersCount={filters.count}
                    onOpenFiltersModal={(): void => setIsFiltersModalOpen(true)}
                    showInlineSearch={false}
                    searchValue={search.value}
                    onSearch={search.onChange}
                    shouldDebounce={search.shouldDebounce}
                    searchAlertContent={search.alertContent}
                    searchTrailingControls={search.trailingControls}
                  />
                  {filters.content}
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
            showMoreChainsButton={showMoreChainsButton}
            allChainsLabel={allChainsLabel}
            showFiltersButton={hasFiltersContent}
            filtersCount={filters.count}
            onOpenFiltersModal={(): void => setIsFiltersModalOpen(true)}
            showInlineSearch={true}
            searchValue={search.value}
            onSearch={search.onChange}
            shouldDebounce={search.shouldDebounce}
            searchAlertContent={search.alertContent}
            controlsRowRef={controlsRowRef}
            searchContainerRef={searchContainerRef}
            layout={isStackedLayout ? 'stacked' : 'inline'}
            leadingControls={isStackedLayout ? stackedControls : trailingControls}
            searchTrailingControls={search.trailingControls}
            filtersTrailingControls={filters.trailingControls}
          />
        </div>
      </div>
      {showMoreChainsButton ? (
        <ChainSelectionModal
          isOpen={isChainModalOpen}
          onClose={(): void => setIsChainModalOpen(false)}
          options={chainModalOptions}
          selectedChainIds={pinnedChainIds}
          lockedChainIds={primaryChainIds}
          onApply={handleApplyAdditionalChains}
        />
      ) : null}
      {hasFiltersContent ? (
        <FiltersModal
          isOpen={isFiltersModalOpen}
          onClose={(): void => setIsFiltersModalOpen(false)}
          onClear={filters.onClear}
          filtersContent={filters.content}
          filtersConfig={filters.config}
          filtersInitialState={filters.initialState}
          onApplyFilters={filters.onApply}
        />
      ) : null}
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
  allChainsLabel,
  showFiltersButton = true,
  filtersCount,
  onOpenFiltersModal,
  showInlineSearch,
  searchValue,
  onSearch,
  shouldDebounce,
  searchAlertContent,
  controlsRowRef,
  searchContainerRef,
  searchTrailingControls,
  filtersTrailingControls,
  layout = 'inline',
  leadingControls
}: {
  chainButtons: TVaultsChainButton[]
  onSelectAllChains: () => void
  areAllChainsSelected: boolean
  onSelectChain: (chainId: number) => void
  onOpenChainModal: () => void
  showMoreChainsButton?: boolean
  allChainsLabel: string
  showFiltersButton?: boolean
  filtersCount: number
  onOpenFiltersModal: () => void
  showInlineSearch: boolean
  searchValue: string
  onSearch: (value: string) => void
  shouldDebounce?: boolean
  searchAlertContent?: ReactNode
  controlsRowRef?: RefObject<HTMLDivElement | null>
  searchContainerRef?: RefObject<HTMLDivElement | null>
  searchTrailingControls?: ReactNode
  filtersTrailingControls?: ReactNode
  layout?: 'inline' | 'stacked'
  leadingControls?: ReactNode
}): ReactElement {
  const isStacked = layout === 'stacked'
  const filtersButtonElement = showFiltersButton ? (
    <VaultsFiltersButton filtersCount={filtersCount} onClick={onOpenFiltersModal} />
  ) : null
  const inlineSearchElement = showInlineSearch ? (
    <div ref={searchContainerRef} className={'flex-1 min-w-0'}>
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
  ) : null
  const chainSelectorElement = (
    <VaultsChainSelector
      chainButtons={chainButtons}
      areAllChainsSelected={areAllChainsSelected}
      allChainsLabel={allChainsLabel}
      showMoreChainsButton={showMoreChainsButton}
      isStacked={isStacked}
      onSelectAllChains={onSelectAllChains}
      onSelectChain={onSelectChain}
      onOpenChainModal={onOpenChainModal}
    />
  )
  const searchTrailingElement =
    showInlineSearch && searchTrailingControls ? <div className={'shrink-0'}>{searchTrailingControls}</div> : null

  if (isStacked) {
    return (
      <div className={'flex flex-col gap-3'}>
        {leadingControls ? <div className={'w-full'}>{leadingControls}</div> : null}
        <div ref={controlsRowRef} className={'flex w-full items-center gap-3'}>
          {chainSelectorElement}
          {filtersButtonElement}
          {filtersTrailingControls ? <div className={'shrink-0'}>{filtersTrailingControls}</div> : null}
          {inlineSearchElement}
          {searchTrailingElement}
        </div>
      </div>
    )
  }

  return (
    <div className={'flex flex-col gap-4'}>
      <div>
        <div className={'flex flex-col gap-2'}>
          <div ref={controlsRowRef} className={'flex w-full items-center gap-3 flex-wrap'}>
            {leadingControls ? <div className={'shrink-0'}>{leadingControls}</div> : null}
            <div className={'shrink min-w-0 max-w-[580px]'}>{chainSelectorElement}</div>
            <div className={'flex flex-row items-center gap-3 flex-1 min-w-0'}>
              {filtersButtonElement}
              {filtersTrailingControls ? <div className={'shrink-0'}>{filtersTrailingControls}</div> : null}
              {inlineSearchElement}
              {searchTrailingElement}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

const EMPTY_FILTERS_STATE: TPendingFiltersState = {
  categories: [],
  aggressiveness: [],
  showStrategies: false,
  showLegacyVaults: false,
  showHiddenVaults: false
}

function FiltersModal({
  isOpen,
  onClose,
  onClear,
  filtersContent,
  filtersConfig,
  filtersInitialState,
  onApplyFilters
}: {
  isOpen: boolean
  onClose: () => void
  onClear?: () => void
  filtersContent?: ReactNode
  filtersConfig?: TFiltersConfig
  filtersInitialState?: TPendingFiltersState
  onApplyFilters?: (state: TPendingFiltersState) => void
}): ReactElement {
  const [pendingState, setPendingState] = useState<TPendingFiltersState>(filtersInitialState ?? EMPTY_FILTERS_STATE)

  useEffect(() => {
    if (isOpen && filtersInitialState) {
      setPendingState(filtersInitialState)
    }
  }, [isOpen, filtersInitialState])

  const handleClear = (): void => {
    setPendingState(EMPTY_FILTERS_STATE)
  }

  const handleSave = (): void => {
    if (onApplyFilters) {
      onApplyFilters(pendingState)
    }
    onClose()
  }

  const useDeferredMode = Boolean(filtersConfig && onApplyFilters)

  const renderedContent = useDeferredMode ? (
    <VaultsFiltersPanelControlled config={filtersConfig!} state={pendingState} onStateChange={setPendingState} />
  ) : (
    filtersContent
  )

  return (
    <Transition show={isOpen} as={Fragment}>
      <Dialog as={'div'} className={'relative z-70'} onClose={onClose}>
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
                  'w-full max-w-3xl rounded-3xl border border-border bg-surface p-6 text-text-primary shadow-lg'
                }
              >
                <div className={'flex items-start justify-between gap-4'}>
                  <Dialog.Title className={'text-lg font-semibold text-text-primary'}>{'Filters'}</Dialog.Title>
                  <button
                    type={'button'}
                    onClick={onClose}
                    className={
                      'inline-flex size-8 items-center justify-center rounded-full border border-transparent text-text-secondary hover:border-border hover:text-text-primary'
                    }
                    aria-label={'Close filters'}
                  >
                    <IconCross className={'size-4'} />
                  </button>
                </div>
                {renderedContent}
                <div className={'mt-6 flex justify-end gap-3'}>
                  {(useDeferredMode || onClear) && (
                    <button
                      type={'button'}
                      className={
                        'rounded-full border border-border px-4 py-2 text-sm font-medium text-text-primary hover:border-border-hover'
                      }
                      onClick={useDeferredMode ? handleClear : onClear}
                    >
                      {'Clear'}
                    </button>
                  )}
                  <button
                    type={'button'}
                    className={
                      'rounded-full bg-neutral-900 px-4 py-2 text-sm font-semibold text-surface transition-colors hover:bg-neutral-800'
                    }
                    onClick={useDeferredMode ? handleSave : onClose}
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
      <Dialog as={'div'} className={'relative z-70'} onClose={onClose}>
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
                <div className={'mt-4 max-h-[400px] space-y-1 overflow-y-auto scrollbar-themed pr-1'}>
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
                            className={'checkbox accent-blue-500'}
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
