import { Dialog, Transition, TransitionChild } from '@headlessui/react'
import type { TMultiSelectOptionProps } from '@lib/components/MultiSelectDropdown'
import { SearchBar } from '@lib/components/SearchBar'
import { useChainOptions } from '@lib/hooks/useChains'
import { IconChevron } from '@lib/icons/IconChevron'
import { IconCross } from '@lib/icons/IconCross'
import { IconFilter } from '@lib/icons/IconFilter'
import { LogoYearn } from '@lib/icons/LogoYearn'
import { cl } from '@lib/utils'
import type { TYDaemonVault } from '@lib/utils/schemas/yDaemonVaultsSchemas'
import { ALL_VAULTSV3_CATEGORIES } from '@vaults-v3/constants'

import type { ReactElement, ReactNode } from 'react'
import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { Drawer } from 'vaul'

type TListHero = {
  types: string[] | null
  categories: string[] | null
  protocols: string[] | null
  aggressiveness: number[] | null
  showHiddenYearnVaults: boolean
  chains: number[] | null
  searchValue: string
  shouldDebounce: boolean
  onChangeTypes: (newType: string[] | null) => void
  onChangeChains: (chains: number[] | null) => void
  onChangeCategories: (categories: string[] | null) => void
  onChangeProtocols: (protocols: string[] | null) => void
  onChangeAggressiveness: (aggressiveness: number[] | null) => void
  onChangeShowHiddenYearnVaults: (value: boolean) => void
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
  protocols,
  onChangeProtocols,
  aggressiveness,
  onChangeAggressiveness,
  showHiddenYearnVaults,
  onChangeShowHiddenYearnVaults,
  searchValue,
  chains,
  onSearch,
  shouldDebounce,
  onChangeChains,
  searchAlertContent
}: TListHero): ReactElement {
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false)
  const [isChainModalOpen, setIsChainModalOpen] = useState(false)
  const [customChainIds, setCustomChainIds] = useState<number[]>(DEFAULT_SECONDARY_CHAIN_IDS)
  const [isFiltersModalOpen, setIsFiltersModalOpen] = useState(false)
  const lastSelectedKindRef = useRef<'multi' | 'single'>('multi')
  if (types?.length === 1 && (types[0] === 'multi' || types[0] === 'single')) {
    lastSelectedKindRef.current = types[0]
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

  const facetOptions = useMemo(() => {
    const kindOptions = [
      { value: 'multi', label: 'Allocator Vault' },
      { value: 'single', label: 'Strategy Vault' }
    ]

    const assetCategoryOptions = [
      { value: ALL_VAULTSV3_CATEGORIES.Stablecoin, label: 'Stablecoin' },
      { value: ALL_VAULTSV3_CATEGORIES.Volatile, label: 'Volatile' }
    ]

    const protocolOptions = [
      'Curve',
      'Velodrome',
      'Aerodrome',
      'Balancer',
      'Fluid',
      'Morpho',
      'Aave',
      'Sky',
      'Silo',
      'Compound'
    ]

    const aggressivenessOptions = [-1, -2, -3]

    return { kindOptions, assetCategoryOptions, protocolOptions, aggressivenessOptions }
  }, [])

  const selectedFacetCount = useMemo(() => {
    const kindMode =
      types?.includes('multi') && types?.includes('single') ? 'both' : types?.includes('multi') ? 'multi' : 'single'
    const typeCount = kindMode === 'multi' ? 0 : 1
    const categoryCount = (categories?.length ?? 0) > 0 ? (categories?.length ?? 0) : 0
    const protocolCount = (protocols?.length ?? 0) > 0 ? (protocols?.length ?? 0) : 0
    const aggressivenessCount = (aggressiveness?.length ?? 0) > 0 ? (aggressiveness?.length ?? 0) : 0
    return typeCount + categoryCount + protocolCount + aggressivenessCount
  }, [types, categories, protocols, aggressiveness])

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
                    showFiltersButton={false}
                    filtersCount={selectedFacetCount}
                    onOpenFiltersModal={(): void => setIsFiltersModalOpen(true)}
                    showInlineSearch={false}
                    searchValue={searchValue}
                    onSearch={onSearch}
                    shouldDebounce={shouldDebounce}
                    searchAlertContent={searchAlertContent}
                  />
                  <VaultFacetFiltersPanel
                    kindOptions={facetOptions.kindOptions}
                    selectedKinds={types}
                    onChangeKinds={onChangeTypes}
                    lastSelectedKind={lastSelectedKindRef.current}
                    showHiddenYearnVaults={showHiddenYearnVaults}
                    onChangeShowHiddenYearnVaults={onChangeShowHiddenYearnVaults}
                    assetCategoryOptions={facetOptions.assetCategoryOptions}
                    selectedCategories={categories}
                    onChangeCategories={onChangeCategories}
                    protocolOptions={facetOptions.protocolOptions}
                    selectedProtocols={protocols}
                    onChangeProtocols={onChangeProtocols}
                    aggressivenessOptions={facetOptions.aggressivenessOptions}
                    selectedAggressiveness={aggressiveness}
                    onChangeAggressiveness={onChangeAggressiveness}
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
            filtersCount={selectedFacetCount}
            onOpenFiltersModal={(): void => setIsFiltersModalOpen(true)}
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
      <VaultFacetFiltersModal
        isOpen={isFiltersModalOpen}
        onClose={(): void => setIsFiltersModalOpen(false)}
        kindOptions={facetOptions.kindOptions}
        selectedKinds={types}
        onChangeKinds={onChangeTypes}
        lastSelectedKind={lastSelectedKindRef.current}
        showHiddenYearnVaults={showHiddenYearnVaults}
        onChangeShowHiddenYearnVaults={onChangeShowHiddenYearnVaults}
        assetCategoryOptions={facetOptions.assetCategoryOptions}
        selectedCategories={categories}
        onChangeCategories={onChangeCategories}
        protocolOptions={facetOptions.protocolOptions}
        selectedProtocols={protocols}
        onChangeProtocols={onChangeProtocols}
        aggressivenessOptions={facetOptions.aggressivenessOptions}
        selectedAggressiveness={aggressiveness}
        onChangeAggressiveness={onChangeAggressiveness}
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
  showFiltersButton = true,
  filtersCount,
  onOpenFiltersModal,
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
  showFiltersButton?: boolean
  filtersCount: number
  onOpenFiltersModal: () => void
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
              {showFiltersButton ? (
                <button
                  type={'button'}
                  className={cl(
                    'flex shrink-0 items-center gap-1 border rounded-lg h-10 border-border px-4 py-2 text-sm font-medium text-text-secondary bg-surface transition-colors',
                    'hover:text-text-secondary',
                    'data-[active=true]:border-border-hover data-[active=true]:text-text-secondary'
                  )}
                  onClick={onOpenFiltersModal}
                  aria-label={'Open filters'}
                >
                  <IconFilter className={'size-4'} />
                  <span>{'Filters'}</span>
                  {filtersCount > 0 ? (
                    <span
                      className={
                        'ml-1 inline-flex min-w-5 items-center justify-center rounded-full bg-surface-tertiary px-1.5 text-xs text-text-primary'
                      }
                    >
                      {filtersCount}
                    </span>
                  ) : null}
                </button>
              ) : null}
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
    </div>
  )
}

function VaultFacetFiltersPanel({
  kindOptions,
  selectedKinds,
  onChangeKinds,
  lastSelectedKind,
  showHiddenYearnVaults,
  onChangeShowHiddenYearnVaults,
  assetCategoryOptions,
  selectedCategories,
  onChangeCategories,
  protocolOptions,
  selectedProtocols,
  onChangeProtocols,
  aggressivenessOptions,
  selectedAggressiveness,
  onChangeAggressiveness
}: {
  kindOptions: Array<{ value: string; label: string }>
  selectedKinds: string[] | null
  onChangeKinds: (kinds: string[] | null) => void
  lastSelectedKind: 'multi' | 'single'
  showHiddenYearnVaults: boolean
  onChangeShowHiddenYearnVaults: (value: boolean) => void
  assetCategoryOptions: Array<{ value: string; label: string }>
  selectedCategories: string[] | null
  onChangeCategories: (categories: string[] | null) => void
  protocolOptions: string[]
  selectedProtocols: string[] | null
  onChangeProtocols: (protocols: string[] | null) => void
  aggressivenessOptions: number[]
  selectedAggressiveness: number[] | null
  onChangeAggressiveness: (aggressiveness: number[] | null) => void
}): ReactElement {
  const toggleString = (current: string[] | null, next: string): string[] => {
    const existing = current ?? []
    if (existing.includes(next)) {
      return existing.filter((value) => value !== next)
    }
    return [...existing, next]
  }

  const toggleNumber = (current: number[] | null, next: number): number[] => {
    const existing = current ?? []
    if (existing.includes(next)) {
      return existing.filter((value) => value !== next)
    }
    return [...existing, next]
  }

  const isAllocatorOnly = Boolean(selectedKinds?.includes('multi') && !selectedKinds?.includes('single'))
  const isStrategyOnly = Boolean(selectedKinds?.includes('single') && !selectedKinds?.includes('multi'))
  const isBoth = Boolean(selectedKinds?.includes('multi') && selectedKinds?.includes('single'))
  const allocatorLabel = kindOptions.find((option) => option.value === 'multi')?.label ?? 'Allocator Vaults'
  const strategyLabel = kindOptions.find((option) => option.value === 'single')?.label ?? 'Strategy Vaults'

  return (
    <div className={'mt-4 grid grid-cols-1 gap-6 md:grid-cols-2'}>
      <div className={'flex flex-col gap-6'}>
        <div>
          <p className={'mb-2 text-sm text-text-secondary'}>{'Asset Category'}</p>
          <div className={'space-y-2'}>
            {assetCategoryOptions.map((option) => {
              const isChecked = Boolean(selectedCategories?.includes(option.value))
              return (
                <label
                  key={option.value}
                  className={cl(
                    'flex cursor-pointer items-center justify-between gap-2 rounded-lg border px-3 py-2 transition-colors',
                    isChecked ? 'border-border bg-surface-tertiary/80' : 'border-border hover:bg-surface-tertiary/40'
                  )}
                >
                  <span className={'text-sm font-medium text-text-primary'}>{option.label}</span>
                  <input
                    type={'checkbox'}
                    className={'checkbox accent-blue-500'}
                    checked={isChecked}
                    onChange={(): void => onChangeCategories(toggleString(selectedCategories, option.value))}
                  />
                </label>
              )
            })}
          </div>
        </div>
      </div>
      <div className={'flex flex-col gap-6'}>
        <div>
          <p className={'mb-2 text-sm text-text-secondary'}>{'Protocol'}</p>
          <div className={'max-h-[260px] space-y-2 overflow-y-auto pr-1'}>
            {protocolOptions.map((protocol) => {
              const isChecked = Boolean(selectedProtocols?.includes(protocol))
              return (
                <label
                  key={protocol}
                  className={cl(
                    'flex cursor-pointer items-center justify-between gap-2 rounded-lg border px-3 py-2 transition-colors',
                    isChecked ? 'border-border bg-surface-tertiary/80' : 'border-border hover:bg-surface-tertiary/40'
                  )}
                >
                  <span className={'text-sm font-medium text-text-primary'}>{protocol}</span>
                  <input
                    type={'checkbox'}
                    className={'checkbox accent-blue-500'}
                    checked={isChecked}
                    onChange={(): void => onChangeProtocols(toggleString(selectedProtocols, protocol))}
                  />
                </label>
              )
            })}
          </div>
        </div>
        <div>
          <p className={'mb-2 text-sm text-text-secondary'}>{'Aggressiveness'}</p>
          <div className={'space-y-2'}>
            {aggressivenessOptions.map((value) => {
              const isChecked = Boolean(selectedAggressiveness?.includes(value))
              return (
                <label
                  key={value}
                  className={cl(
                    'flex cursor-pointer items-center justify-between gap-2 rounded-lg border px-3 py-2 transition-colors',
                    isChecked ? 'border-border bg-surface-tertiary/80' : 'border-border hover:bg-surface-tertiary/40'
                  )}
                >
                  <span className={'text-sm font-medium text-text-primary'}>{value}</span>
                  <input
                    type={'checkbox'}
                    className={'checkbox accent-blue-500'}
                    checked={isChecked}
                    onChange={(): void => onChangeAggressiveness(toggleNumber(selectedAggressiveness, value))}
                  />
                </label>
              )
            })}
          </div>
        </div>
        <details className={'rounded-xl border border-border bg-surface-secondary p-4'}>
          <summary className={'cursor-pointer text-sm font-semibold text-text-primary'}>{'Advanced'}</summary>
          <div className={'mt-4 flex flex-col gap-6'}>
            <label
              className={
                'flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-border bg-surface px-3 py-2'
              }
            >
              <div className={'min-w-0'}>
                <p className={'text-sm font-medium text-text-primary'}>{'Show hidden vaults & strategies'}</p>
                <p className={'text-xs text-text-secondary'}>
                  {'Includes allocators & strategies that are not featured.'}
                </p>
              </div>
              <input
                type={'checkbox'}
                className={'checkbox accent-blue-500'}
                checked={showHiddenYearnVaults}
                onChange={(e): void => onChangeShowHiddenYearnVaults(e.target.checked)}
              />
            </label>

            <div>
              <p className={'mb-2 text-sm text-text-secondary'}>{'Vault Kind'}</p>
              <div className={'flex flex-col gap-3'}>
                <div className={'flex items-center gap-2'}>
                  <button
                    type={'button'}
                    className={cl(
                      'flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
                      isAllocatorOnly || isBoth
                        ? 'border-border bg-surface text-text-primary'
                        : 'border-border bg-transparent text-text-secondary hover:text-text-primary'
                    )}
                    onClick={(): void => onChangeKinds(['multi'])}
                  >
                    {allocatorLabel}
                  </button>
                  <button
                    type={'button'}
                    className={cl(
                      'flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
                      isStrategyOnly || isBoth
                        ? 'border-border bg-surface text-text-primary'
                        : 'border-border bg-transparent text-text-secondary hover:text-text-primary'
                    )}
                    onClick={(): void => onChangeKinds(['single'])}
                  >
                    {strategyLabel}
                  </button>
                </div>
                <label
                  className={cl(
                    'flex cursor-pointer items-center justify-between gap-3 rounded-lg border px-3 py-2 transition-colors',
                    isBoth ? 'border-border bg-surface-tertiary/80' : 'border-border hover:bg-surface-tertiary/40'
                  )}
                >
                  <div className={'min-w-0'}>
                    <p className={'text-sm font-medium text-text-primary'}>{'Show both together'}</p>
                    <p className={'text-xs text-text-secondary'}>{'Displays allocators and strategies at once.'}</p>
                  </div>
                  <input
                    type={'checkbox'}
                    className={'checkbox accent-blue-500'}
                    checked={isBoth}
                    onChange={(e): void => {
                      if (e.target.checked) {
                        onChangeKinds(['multi', 'single'])
                        return
                      }
                      onChangeKinds([lastSelectedKind])
                    }}
                  />
                </label>
              </div>
            </div>
          </div>
        </details>
      </div>
    </div>
  )
}

function VaultFacetFiltersModal({
  isOpen,
  onClose,
  kindOptions,
  selectedKinds,
  onChangeKinds,
  lastSelectedKind,
  showHiddenYearnVaults,
  onChangeShowHiddenYearnVaults,
  assetCategoryOptions,
  selectedCategories,
  onChangeCategories,
  protocolOptions,
  selectedProtocols,
  onChangeProtocols,
  aggressivenessOptions,
  selectedAggressiveness,
  onChangeAggressiveness
}: {
  isOpen: boolean
  onClose: () => void
  kindOptions: Array<{ value: string; label: string }>
  selectedKinds: string[] | null
  onChangeKinds: (kinds: string[] | null) => void
  lastSelectedKind: 'multi' | 'single'
  showHiddenYearnVaults: boolean
  onChangeShowHiddenYearnVaults: (value: boolean) => void
  assetCategoryOptions: Array<{ value: string; label: string }>
  selectedCategories: string[] | null
  onChangeCategories: (categories: string[] | null) => void
  protocolOptions: string[]
  selectedProtocols: string[] | null
  onChangeProtocols: (protocols: string[] | null) => void
  aggressivenessOptions: number[]
  selectedAggressiveness: number[] | null
  onChangeAggressiveness: (aggressiveness: number[] | null) => void
}): ReactElement {
  const clearAll = (): void => {
    onChangeKinds(['multi'])
    onChangeCategories([])
    onChangeProtocols([])
    onChangeAggressiveness([])
    onChangeShowHiddenYearnVaults(false)
  }

  return (
    <Transition show={isOpen} as={Fragment}>
      <Dialog as={'div'} className={'relative z-[70]'} onClose={onClose}>
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
                <VaultFacetFiltersPanel
                  kindOptions={kindOptions}
                  selectedKinds={selectedKinds}
                  onChangeKinds={onChangeKinds}
                  lastSelectedKind={lastSelectedKind}
                  showHiddenYearnVaults={showHiddenYearnVaults}
                  onChangeShowHiddenYearnVaults={onChangeShowHiddenYearnVaults}
                  assetCategoryOptions={assetCategoryOptions}
                  selectedCategories={selectedCategories}
                  onChangeCategories={onChangeCategories}
                  protocolOptions={protocolOptions}
                  selectedProtocols={selectedProtocols}
                  onChangeProtocols={onChangeProtocols}
                  aggressivenessOptions={aggressivenessOptions}
                  selectedAggressiveness={selectedAggressiveness}
                  onChangeAggressiveness={onChangeAggressiveness}
                />
                <div className={'mt-6 flex justify-end gap-3'}>
                  <button
                    type={'button'}
                    className={
                      'rounded-full border border-border px-4 py-2 text-sm font-medium text-text-primary hover:border-border-hover'
                    }
                    onClick={clearAll}
                  >
                    {'Clear'}
                  </button>
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
