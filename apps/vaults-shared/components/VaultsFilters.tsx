import { Dialog, Transition, TransitionChild } from '@headlessui/react'
import type { TMultiSelectOptionProps } from '@lib/components/MultiSelectDropdown'
import { SearchBar } from '@lib/components/SearchBar'
import { useChainOptions } from '@lib/hooks/useChains'
import { IconChevron } from '@lib/icons/IconChevron'
import { IconCross } from '@lib/icons/IconCross'
import { IconFilter } from '@lib/icons/IconFilter'
import { IconSearch } from '@lib/icons/IconSearch'
import { LogoYearn } from '@lib/icons/LogoYearn'
import { cl } from '@lib/utils'
import type { ReactElement, ReactNode, RefObject } from 'react'
import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Drawer } from 'vaul'

type TChainButton = {
  id: number
  label: string
  icon?: ReactElement
  isSelected: boolean
}

type TChainConfig = {
  supportedChainIds: number[]
  primaryChainIds?: number[]
  defaultSecondaryChainIds?: number[]
  chainDisplayOrder?: number[]
  showMoreChainsButton?: boolean
  allChainsLabel?: string
}

type TVaultsFiltersProps = {
  chains: number[] | null
  searchValue: string
  onChangeChains: (chains: number[] | null) => void
  onSearch: (searchValue: string) => void
  shouldDebounce?: boolean
  searchAlertContent?: ReactNode
  chainConfig: TChainConfig
  filtersCount?: number
  filtersContent?: ReactNode
  filtersPanelContent?: ReactNode
  onClearFilters?: () => void
  mobileExtraContent?: ReactNode
  trailingControls?: ReactNode
}

export function VaultsFilters({
  chains,
  searchValue,
  onChangeChains,
  onSearch,
  shouldDebounce,
  searchAlertContent,
  chainConfig,
  filtersCount = 0,
  filtersContent,
  filtersPanelContent,
  onClearFilters,
  mobileExtraContent,
  trailingControls
}: TVaultsFiltersProps): ReactElement {
  const SEARCH_MIN_WIDTH = 180
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false)
  const [isMobileSearchExpanded, setIsMobileSearchExpanded] = useState(false)
  const [isChainModalOpen, setIsChainModalOpen] = useState(false)
  const [isFiltersModalOpen, setIsFiltersModalOpen] = useState(false)
  const [isSearchExpanded, setIsSearchExpanded] = useState(false)
  const [isFiltersButtonMinimal, setIsFiltersButtonMinimal] = useState(false)
  const [isChainSelectorMinimal, setIsChainSelectorMinimal] = useState(false)
  const [forceMobileFiltersBar, setForceMobileFiltersBar] = useState(false)
  const hasFiltersContent = Boolean(filtersContent)
  const hasPanelContent = Boolean(filtersPanelContent)

  const {
    supportedChainIds,
    primaryChainIds: primaryChainIdsProp = supportedChainIds,
    defaultSecondaryChainIds = [],
    chainDisplayOrder = supportedChainIds,
    showMoreChainsButton = false,
    allChainsLabel = 'All Chains'
  } = chainConfig

  const [customChainIds, setCustomChainIds] = useState<number[]>(defaultSecondaryChainIds)

  useEffect(() => {
    setCustomChainIds(defaultSecondaryChainIds)
  }, [defaultSecondaryChainIds])

  const chainOptions = useChainOptions(chains).filter((option): boolean =>
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
    chainDisplayOrder.forEach((chainId, index) => {
      map.set(chainId, index)
    })
    return map
  }, [chainDisplayOrder])

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
      if (primaryChainIdSet.has(id) || !chainOptionMap.has(id)) {
        continue
      }
      seen.add(id)
      unique.push(id)
    }
    setCustomChainIds(unique)
  }

  const controlsRowRef = useRef<HTMLDivElement | null>(null)
  const chainSelectorRef = useRef<HTMLDivElement | null>(null)
  const filtersButtonRef = useRef<HTMLButtonElement | null>(null)
  const searchContainerRef = useRef<HTMLDivElement | null>(null)
  const measurementsRef = useRef({
    chain: { full: 0, minimal: 0 },
    filters: { full: 0, minimal: 0 }
  })

  const updateResponsiveControls = useCallback(() => {
    const row = controlsRowRef.current
    if (!row) {
      return
    }
    const clientWidth = row.clientWidth
    if (clientWidth === 0) {
      return
    }
    const searchContainer = searchContainerRef.current
    if (!searchContainer) {
      return
    }
    const scrollWidth = row.scrollWidth
    const searchWidth = searchContainer.offsetWidth
    const chainWidths = measurementsRef.current.chain
    const filtersWidths = measurementsRef.current.filters
    const chainDelta = chainWidths.full && chainWidths.minimal ? chainWidths.full - chainWidths.minimal : 0
    const filtersDelta = filtersWidths.full && filtersWidths.minimal ? filtersWidths.full - filtersWidths.minimal : 0
    const searchSlack = Math.max(0, searchWidth - SEARCH_MIN_WIDTH)
    const isSearchAtMin = searchWidth <= SEARCH_MIN_WIDTH + 1

    let nextFiltersMinimal = hasFiltersContent ? isFiltersButtonMinimal : false
    let nextChainMinimal = isChainSelectorMinimal
    let nextForceMobile = forceMobileFiltersBar
    const hasOverflow = scrollWidth > clientWidth + 1

    if (hasOverflow) {
      if (isSearchAtMin) {
        if (hasFiltersContent && !nextFiltersMinimal) {
          nextFiltersMinimal = true
        } else if (!nextChainMinimal) {
          nextChainMinimal = true
        } else {
          nextForceMobile = true
        }
      }
    } else {
      if (nextForceMobile) {
        nextForceMobile = false
      }
      let remainingSlack = searchSlack
      if (nextChainMinimal && chainDelta > 0 && remainingSlack >= chainDelta) {
        nextChainMinimal = false
        remainingSlack -= chainDelta
      }
      if (nextFiltersMinimal && filtersDelta > 0 && remainingSlack >= filtersDelta) {
        nextFiltersMinimal = false
        remainingSlack -= filtersDelta
      }
    }

    if (nextFiltersMinimal !== isFiltersButtonMinimal) {
      setIsFiltersButtonMinimal(nextFiltersMinimal)
    }
    if (nextChainMinimal !== isChainSelectorMinimal) {
      setIsChainSelectorMinimal(nextChainMinimal)
    }
    if (nextForceMobile !== forceMobileFiltersBar) {
      setForceMobileFiltersBar(nextForceMobile)
    }
  }, [forceMobileFiltersBar, hasFiltersContent, isChainSelectorMinimal, isFiltersButtonMinimal])

  useLayoutEffect(() => {
    const chainSelector = chainSelectorRef.current
    if (!chainSelector) {
      return
    }
    const width = chainSelector.offsetWidth
    if (isChainSelectorMinimal) {
      measurementsRef.current.chain.minimal = width
    } else {
      measurementsRef.current.chain.full = width
    }
    updateResponsiveControls()
  }, [isChainSelectorMinimal, updateResponsiveControls])

  useEffect(() => {
    if (typeof ResizeObserver === 'undefined') {
      return
    }
    const chainSelector = chainSelectorRef.current
    if (!chainSelector) {
      return
    }
    const observer = new ResizeObserver(() => {
      const width = chainSelector.offsetWidth
      if (isChainSelectorMinimal) {
        measurementsRef.current.chain.minimal = width
      } else {
        measurementsRef.current.chain.full = width
      }
      updateResponsiveControls()
    })
    observer.observe(chainSelector)
    return () => observer.disconnect()
  }, [isChainSelectorMinimal, updateResponsiveControls])

  useLayoutEffect(() => {
    if (!hasFiltersContent) {
      measurementsRef.current.filters = { full: 0, minimal: 0 }
      updateResponsiveControls()
      return
    }
    const filtersButton = filtersButtonRef.current
    if (!filtersButton) {
      return
    }
    const width = filtersButton.offsetWidth
    if (isFiltersButtonMinimal) {
      measurementsRef.current.filters.minimal = width
    } else {
      measurementsRef.current.filters.full = width
    }
    updateResponsiveControls()
  }, [hasFiltersContent, isFiltersButtonMinimal, updateResponsiveControls])

  useEffect(() => {
    if (!hasFiltersContent || typeof ResizeObserver === 'undefined') {
      return
    }
    const filtersButton = filtersButtonRef.current
    if (!filtersButton) {
      return
    }
    const observer = new ResizeObserver(() => {
      const width = filtersButton.offsetWidth
      if (isFiltersButtonMinimal) {
        measurementsRef.current.filters.minimal = width
      } else {
        measurementsRef.current.filters.full = width
      }
      updateResponsiveControls()
    })
    observer.observe(filtersButton)
    return () => observer.disconnect()
  }, [hasFiltersContent, isFiltersButtonMinimal, updateResponsiveControls])

  useEffect(() => {
    if (typeof ResizeObserver === 'undefined') {
      return
    }
    const searchContainer = searchContainerRef.current
    if (!searchContainer) {
      return
    }
    const observer = new ResizeObserver(() => {
      window.requestAnimationFrame(updateResponsiveControls)
    })
    observer.observe(searchContainer)
    return () => observer.disconnect()
  }, [updateResponsiveControls])

  useEffect(() => {
    if (typeof ResizeObserver === 'undefined') {
      return
    }
    const row = controlsRowRef.current
    if (!row) {
      return
    }
    const observer = new ResizeObserver(() => {
      window.requestAnimationFrame(updateResponsiveControls)
    })
    observer.observe(row)
    return () => observer.disconnect()
  }, [updateResponsiveControls])

  return (
    <>
      <div className={'relative col-span-24 w-full md:col-span-19'}>
        <div className={cl('md:hidden', forceMobileFiltersBar ? 'md:block' : '')}>
          <Drawer.Root
            open={isMobileFiltersOpen}
            onOpenChange={(isOpen): void => {
              setIsMobileFiltersOpen(isOpen)
            }}
            direction={'bottom'}
          >
            {isMobileSearchExpanded ? (
              <div className={'flex w-full items-center gap-1'}>
                <div className={'flex-1'}>
                  <SearchBar
                    className={'w-full rounded-[4px] border-none bg-neutral-800/20 text-text-primary'}
                    iconClassName={'text-text-primary'}
                    searchPlaceholder={'Search vaults...'}
                    searchValue={searchValue}
                    onSearch={onSearch}
                    shouldDebounce={shouldDebounce || false}
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
                    searchValue ? 'text-text-primary' : ''
                  )}
                  onClick={(): void => setIsMobileSearchExpanded(true)}
                  aria-label={'Search vaults'}
                >
                  <IconSearch className={'size-4'} />
                </button>
              </div>
            )}
            {mobileExtraContent ? <div className={'mt-2 w-full'}>{mobileExtraContent}</div> : null}
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
                    showFiltersButton={hasFiltersContent && !hasPanelContent}
                    filtersCount={filtersCount}
                    onOpenFiltersModal={(): void => setIsFiltersModalOpen(true)}
                    showInlineSearch={false}
                    searchValue={searchValue}
                    onSearch={onSearch}
                    shouldDebounce={shouldDebounce}
                    searchAlertContent={searchAlertContent}
                    enableResponsiveLayout={false}
                  />
                  {hasPanelContent ? filtersPanelContent : null}
                </div>
              </Drawer.Content>
            </Drawer.Portal>
          </Drawer.Root>
        </div>

        <div
          className={cl(
            'hidden md:block',
            forceMobileFiltersBar ? 'md:block absolute inset-x-0 top-0 invisible pointer-events-none' : ''
          )}
        >
          <FilterControls
            chainButtons={chainButtons}
            onSelectAllChains={handleSelectAllChains}
            areAllChainsSelected={areAllChainsSelected}
            onSelectChain={handleChainToggle}
            onOpenChainModal={(): void => setIsChainModalOpen(true)}
            showMoreChainsButton={showMoreChainsButton}
            allChainsLabel={allChainsLabel}
            showFiltersButton={hasFiltersContent}
            filtersCount={filtersCount}
            onOpenFiltersModal={(): void => setIsFiltersModalOpen(true)}
            showInlineSearch={false}
            showSearchButton={true}
            isSearchExpanded={isSearchExpanded}
            onExpandSearch={(): void => setIsSearchExpanded(true)}
            onCollapseSearch={(): void => setIsSearchExpanded(false)}
            searchValue={searchValue}
            onSearch={onSearch}
            shouldDebounce={shouldDebounce}
            searchAlertContent={searchAlertContent}
            isFiltersButtonMinimal={isFiltersButtonMinimal}
            controlsRowRef={controlsRowRef}
            chainSelectorRef={chainSelectorRef}
            filtersButtonRef={filtersButtonRef}
            searchContainerRef={searchContainerRef}
            enableResponsiveLayout={true}
            trailingControls={trailingControls}
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
          onClear={onClearFilters}
          filtersContent={filtersContent}
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
  showSearchButton = false,
  isSearchExpanded = false,
  onExpandSearch,
  onCollapseSearch,
  searchValue,
  onSearch,
  shouldDebounce,
  searchAlertContent,
  isFiltersButtonMinimal = false,
  controlsRowRef,
  chainSelectorRef,
  filtersButtonRef,
  searchContainerRef,
  enableResponsiveLayout = false,
  trailingControls
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
  allChainsLabel: string
  showFiltersButton?: boolean
  filtersCount: number
  onOpenFiltersModal: () => void
  showInlineSearch: boolean
  showSearchButton?: boolean
  isSearchExpanded?: boolean
  onExpandSearch?: () => void
  onCollapseSearch?: () => void
  searchValue: string
  onSearch: (value: string) => void
  shouldDebounce?: boolean
  searchAlertContent?: ReactNode
  isFiltersButtonMinimal?: boolean
  controlsRowRef?: RefObject<HTMLDivElement | null>
  chainSelectorRef?: RefObject<HTMLDivElement | null>
  filtersButtonRef?: RefObject<HTMLButtonElement | null>
  searchContainerRef?: RefObject<HTMLDivElement | null>
  enableResponsiveLayout?: boolean
  trailingControls?: ReactNode
}): ReactElement {
  const showFiltersLabel = !isFiltersButtonMinimal
  return (
    <div className={'flex flex-col gap-4'}>
      <div>
        <div className={'flex flex-col gap-2'}>
          <div
            ref={controlsRowRef}
            className={cl(
              'flex w-full items-center gap-3',
              enableResponsiveLayout ? 'flex-nowrap justify-between' : 'flex-wrap'
            )}
          >
            <div
              ref={chainSelectorRef}
              className={cl(
                'flex h-10 items-stretch overflow-x-auto scrollbar-themed rounded-xl border border-border bg-surface-secondary text-sm text-text-primary divide-x divide-border',
                enableResponsiveLayout ? 'shrink-0' : 'w-full'
              )}
            >
              <button
                type={'button'}
                className={cl(
                  'flex h-full items-center justify-center gap-1 px-2 font-medium transition-colors',
                  'data-[active=false]:text-text-secondary data-[active=false]:hover:bg-surface/30 data-[active=false]:hover:text-text-primary',
                  'data-[active=true]:bg-surface data-[active=true]:text-text-primary',
                  !enableResponsiveLayout ? 'flex-1' : ''
                )}
                data-active={areAllChainsSelected}
                onClick={onSelectAllChains}
                aria-pressed={areAllChainsSelected}
              >
                <span className={'size-5 overflow-hidden rounded-full'}>
                  <LogoYearn className={'size-full'} back={'text-text-primary'} front={'text-surface'} />
                </span>
                {areAllChainsSelected ? <span className={'whitespace-nowrap'}>{allChainsLabel}</span> : null}
              </button>
              {chainButtons.map((chain) => {
                const showChainLabel = chain.isSelected
                return (
                  <button
                    key={chain.id}
                    type={'button'}
                    className={cl(
                      'flex h-full items-center justify-center gap-1 px-2 font-medium transition-colors',
                      'data-[active=false]:text-text-secondary data-[active=false]:hover:bg-surface/30 data-[active=false]:hover:text-text-primary',
                      'data-[active=true]:bg-surface data-[active=true]:text-text-primary',
                      !enableResponsiveLayout ? 'flex-1' : ''
                    )}
                    data-active={chain.isSelected}
                    onClick={(): void => onSelectChain(chain.id)}
                    aria-pressed={chain.isSelected}
                    aria-label={showChainLabel ? undefined : chain.label}
                  >
                    {chain.icon ? (
                      <span className={'size-5 overflow-hidden rounded-full bg-surface/80'}>{chain.icon}</span>
                    ) : null}
                    {showChainLabel ? <span className={'whitespace-nowrap'}>{chain.label}</span> : null}
                  </button>
                )
              })}

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
            <div className={'flex shrink-0 flex-row items-center gap-2'}>
              {showSearchButton && isSearchExpanded ? (
                <div ref={searchContainerRef} className={'min-w-[180px]'}>
                  <SearchBar
                    className={'w-full rounded-lg border-border bg-surface text-text-primary transition-all'}
                    iconClassName={'text-text-primary'}
                    searchPlaceholder={'Find a Vault'}
                    searchValue={searchValue}
                    onSearch={onSearch}
                    shouldDebounce={shouldDebounce || false}
                    highlightWhenActive={true}
                    alertContent={searchAlertContent}
                    onKeyDown={(e): void => {
                      if (e.key === 'Escape' && onCollapseSearch) {
                        onCollapseSearch()
                      }
                    }}
                    autoFocus={true}
                  />
                </div>
              ) : (
                <>
                  {trailingControls}
                  {showFiltersButton ? (
                    <button
                      type={'button'}
                      className={cl(
                        'flex shrink-0 items-center gap-1 border rounded-lg h-10 border-border py-2 text-sm font-medium text-text-secondary bg-surface transition-colors',
                        isFiltersButtonMinimal ? 'px-2' : 'px-4',
                        'hover:text-text-secondary',
                        'data-[active=true]:border-border-hover data-[active=true]:text-text-secondary'
                      )}
                      onClick={onOpenFiltersModal}
                      aria-label={'Open filters'}
                      ref={filtersButtonRef}
                    >
                      <IconFilter className={'size-4'} />
                      {showFiltersLabel ? <span>{'Filters'}</span> : null}
                      {filtersCount > 0 ? (
                        <span
                          className={cl(
                            'inline-flex min-w-5 items-center justify-center rounded-full bg-surface-tertiary px-1.5 text-xs text-text-primary',
                            showFiltersLabel ? 'ml-1' : 'ml-0'
                          )}
                        >
                          {filtersCount}
                        </span>
                      ) : null}
                    </button>
                  ) : null}
                  {showSearchButton && onExpandSearch ? (
                    <button
                      type={'button'}
                      className={cl(
                        'flex shrink-0 items-center justify-center border rounded-lg size-10 border-border text-sm font-medium text-text-secondary bg-surface transition-colors',
                        'hover:text-text-primary hover:border-border-hover',
                        searchValue ? 'border-border-hover text-text-primary' : ''
                      )}
                      onClick={onExpandSearch}
                      aria-label={'Search vaults'}
                      data-active={Boolean(searchValue)}
                    >
                      <IconSearch className={'size-4'} />
                    </button>
                  ) : null}
                </>
              )}
              {showInlineSearch ? (
                <div ref={searchContainerRef} className={'min-w-[180px]'}>
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
    </div>
  )
}

function FiltersModal({
  isOpen,
  onClose,
  onClear,
  filtersContent
}: {
  isOpen: boolean
  onClose: () => void
  onClear?: () => void
  filtersContent: ReactNode
}): ReactElement {
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
                {filtersContent}
                <div className={'mt-6 flex justify-end gap-3'}>
                  {onClear ? (
                    <button
                      type={'button'}
                      className={
                        'rounded-full border border-border px-4 py-2 text-sm font-medium text-text-primary hover:border-border-hover'
                      }
                      onClick={onClear}
                    >
                      {'Clear'}
                    </button>
                  ) : null}
                  <button
                    type={'button'}
                    className={
                      'rounded-full bg-neutral-900 px-4 py-2 text-sm font-semibold text-surface transition-colors hover:bg-neutral-800'
                    }
                    onClick={onClose}
                  >
                    {'Done'}
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
