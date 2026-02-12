import { usePlausible } from '@hooks/usePlausible'
import { VaultsCompareModal } from '@pages/vaults/components/compare/VaultsCompareModal'
import { VaultsFiltersBar } from '@pages/vaults/components/filters/VaultsFiltersBar'
import { VaultsFiltersPanel } from '@pages/vaults/components/filters/VaultsFiltersPanel'
import { VaultVersionToggle } from '@pages/vaults/components/filters/VaultVersionToggle'
import { VaultsAuxiliaryList } from '@pages/vaults/components/list/VaultsAuxiliaryList'
import { VaultsListEmpty } from '@pages/vaults/components/list/VaultsListEmpty'
import { VaultsListHead } from '@pages/vaults/components/list/VaultsListHead'
import { VaultsListRow } from '@pages/vaults/components/list/VaultsListRow'
import { VaultsListRowSkeleton } from '@pages/vaults/components/list/VaultsListRowSkeleton'
import { VirtualizedVaultsList } from '@pages/vaults/components/list/VirtualizedVaultsList'
import { VaultsWelcomeTour } from '@pages/vaults/components/tour/VaultsWelcomeTour'
import { toggleInArray } from '@pages/vaults/utils/constants'
import { Breadcrumbs } from '@shared/components/Breadcrumbs'
import { Button } from '@shared/components/Button'
import { getVaultKey } from '@shared/hooks/useVaultFilterUtils'
import { IconGitCompare } from '@shared/icons/IconGitCompare'
import { cl } from '@shared/utils'
import { PLAUSIBLE_EVENTS } from '@shared/utils/plausible'
import type { TYDaemonVault } from '@shared/utils/schemas/yDaemonVaultsSchemas'
import type { CSSProperties, ReactElement, ReactNode } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useVaultsPageModel } from './hooks/useVaultsPageModel'

type TVaultsListSectionProps = {
  isUpdatingProductType: boolean
  isUpdatingList: boolean
  listHead: ReactElement
  children: ReactNode
}

function VaultsListSection({
  isUpdatingProductType,
  isUpdatingList,
  listHead,
  children
}: TVaultsListSectionProps): ReactElement {
  const shouldShowSubtleOverlay = isUpdatingList && !isUpdatingProductType
  const isBusy = isUpdatingList || isUpdatingProductType
  return (
    <div aria-busy={isBusy || undefined} className={'relative w-full rounded-lg bg-surface'}>
      <div className={isUpdatingProductType ? 'pointer-events-none opacity-70 transition' : 'transition'}>
        <div
          className={'relative md:sticky md:z-30'}
          style={{
            top: 'calc(var(--header-height) + var(--vaults-filters-height))'
          }}
        >
          <div
            aria-hidden={true}
            className={'pointer-events-none absolute inset-0 z-0 bg-app'}
            style={{ borderColor: 'var(--color-app)' }}
          />
          {listHead}
        </div>
        <div className={'flex flex-col border-x border-b border-border rounded-b-xl overflow-hidden'}>{children}</div>
      </div>
      {shouldShowSubtleOverlay ? (
        <div aria-hidden={true} className={'pointer-events-none absolute inset-0 z-30 rounded-lg bg-app/30'} />
      ) : null}
      {isUpdatingProductType ? (
        <output
          aria-live={'polite'}
          className={'absolute inset-0 z-40 flex items-center justify-center rounded-lg bg-app/30 text-text-primary'}
        >
          <span className={'flex flex-col items-center gap-2'}>
            <span className={'loader'} />
            <span className={'text-sm font-medium'}>{'Updating vaults…'}</span>
          </span>
        </output>
      ) : null}
    </div>
  )
}

export default function Index(): ReactElement {
  const { refs, filtersBar, list } = useVaultsPageModel()
  const trackEvent = usePlausible()
  const { varsRef, filtersRef } = refs
  const { search, filters, chains, shouldStackFilters, activeVaultType, onChangeVaultType } = filtersBar
  const {
    listHeadProps,
    listVaultType,
    shouldCollapseChips,
    displayedShowStrategies,
    activeFilters,
    data,
    handlers,
    onResetFilters,
    resolveApyDisplayVariant
  } = list
  const {
    isLoading,
    pinnedSections,
    pinnedVaults,
    mainVaults,
    vaultFlags,
    listChains,
    totalMatchingVaults,
    hiddenByFiltersCount,
    blockingFilterActions
  } = data
  const { activeChains, activeCategories, activeProductType } = activeFilters
  const { onToggleChain, onToggleCategory, onToggleType, onToggleVaultType } = handlers

  const [compareVaultKeys, setCompareVaultKeys] = useState<string[]>([])
  const [isCompareOpen, setIsCompareOpen] = useState(false)
  const [isCompareMode, setIsCompareMode] = useState(false)
  const [expandedVaultKeys, setExpandedVaultKeys] = useState<Record<string, boolean>>({})
  const [tourState, setTourState] = useState<{ isOpen: boolean; stepId?: string }>({ isOpen: false })
  const tourExpandedKeysRef = useRef<Record<string, boolean> | null>(null)
  const lastLoggedSearchRef = useRef('')

  const handleSearchBlur = useCallback(() => {
    const query = search.value
    const resultCount = totalMatchingVaults
    if (query.length > 0 && query !== lastLoggedSearchRef.current) {
      trackEvent(PLAUSIBLE_EVENTS.FILTER_SEARCH, {
        props: { queryLength: query.length.toString(), resultCount: resultCount.toString() }
      })
      lastLoggedSearchRef.current = query
    }
  }, [search.value, totalMatchingVaults, trackEvent])

  const handleToggleCompare = useCallback(
    (vault: TYDaemonVault): void => {
      const vaultKey = getVaultKey(vault)
      const isAdding = !compareVaultKeys.includes(vaultKey)
      if (isAdding) {
        trackEvent(PLAUSIBLE_EVENTS.COMPARE_VAULT_ADD, {
          props: { vaultKey, chainId: vault.chainID.toString() }
        })
      }
      setCompareVaultKeys((prev) => toggleInArray(prev, vaultKey))
    },
    [compareVaultKeys, trackEvent]
  )

  const handleRemoveCompare = useCallback((vaultKey: string): void => {
    setCompareVaultKeys((prev) => prev.filter((entry) => entry !== vaultKey))
  }, [])

  const handleClearCompare = useCallback((): void => {
    setCompareVaultKeys([])
  }, [])

  const handleOpenCompare = useCallback((): void => {
    trackEvent(PLAUSIBLE_EVENTS.COMPARE_MODAL_OPEN, {
      props: { vaultCount: compareVaultKeys.length.toString() }
    })
    setIsCompareOpen(true)
  }, [compareVaultKeys.length, trackEvent])

  const handleToggleCompareMode = useCallback((): void => {
    const next = !isCompareMode
    trackEvent(PLAUSIBLE_EVENTS.COMPARE_MODE_TOGGLE, { props: { enabled: String(next) } })
    setIsCompareMode(next)
    if (!next) {
      setCompareVaultKeys([])
      setIsCompareOpen(false)
    }
  }, [isCompareMode, trackEvent])

  const handleExpandedChange = useCallback((vaultKey: string, next: boolean): void => {
    setExpandedVaultKeys((prev) => {
      if (next) {
        if (prev[vaultKey]) {
          return prev
        }
        return { ...prev, [vaultKey]: true }
      }
      if (!prev[vaultKey]) {
        return prev
      }
      const updated = { ...prev }
      delete updated[vaultKey]
      return updated
    })
  }, [])

  const visibleVaults = useMemo(() => [...pinnedVaults, ...mainVaults], [pinnedVaults, mainVaults])
  const tourTargetVaultKey = useMemo(() => {
    const firstVault = visibleVaults[0]
    return firstVault ? getVaultKey(firstVault) : null
  }, [visibleVaults])
  const compareVaults = useMemo(() => {
    const vaultMap = new Map<string, TYDaemonVault>()
    for (const vault of visibleVaults) {
      vaultMap.set(getVaultKey(vault), vault)
    }
    return compareVaultKeys.map((key) => vaultMap.get(key)).filter((vault): vault is TYDaemonVault => Boolean(vault))
  }, [compareVaultKeys, visibleVaults])

  const areArraysEquivalent = useCallback(
    (left: Array<string | number> | null | undefined, right: Array<string | number> | null | undefined): boolean => {
      const normalize = (value: Array<string | number> | null | undefined): Array<string | number> => {
        if (!value || value.length === 0) {
          return []
        }
        return [...new Set(value)].sort((a, b) => String(a).localeCompare(String(b)))
      }
      const normalizedLeft = normalize(left)
      const normalizedRight = normalize(right)
      if (normalizedLeft.length !== normalizedRight.length) {
        return false
      }
      return normalizedLeft.every((value, index) => value === normalizedRight[index])
    },
    []
  )

  const listProductType = listVaultType === 'factory' ? 'lp' : listVaultType
  const isUpdatingProductType = activeProductType !== listProductType
  const isUpdatingList = useMemo(() => {
    const chainsMatch = areArraysEquivalent(activeChains, listChains ?? [])
    return !chainsMatch || isUpdatingProductType
  }, [activeChains, listChains, isUpdatingProductType, areArraysEquivalent])

  useEffect(() => {
    if (isCompareOpen && compareVaultKeys.length < 2) {
      setIsCompareOpen(false)
    }
  }, [compareVaultKeys.length, isCompareOpen])

  useEffect(() => {
    if (!tourState.isOpen) {
      if (tourExpandedKeysRef.current) {
        setExpandedVaultKeys((prev) => {
          const next = tourExpandedKeysRef.current ?? {}
          const prevKeys = Object.keys(prev)
          const nextKeys = Object.keys(next)
          if (prevKeys.length === nextKeys.length && prevKeys.every((key) => prev[key] === next[key])) {
            return prev
          }
          return { ...next }
        })
        tourExpandedKeysRef.current = null
      }
      return
    }

    if (!tourExpandedKeysRef.current) {
      tourExpandedKeysRef.current = { ...expandedVaultKeys }
    }

    const shouldForceExpanded = ['expanded', 'expanded-info', 'expanded-strategy'].includes(tourState.stepId ?? '')
    if (shouldForceExpanded && tourTargetVaultKey) {
      setExpandedVaultKeys((prev) => {
        if (prev[tourTargetVaultKey]) {
          return prev
        }
        return { ...prev, [tourTargetVaultKey]: true }
      })
      return
    }

    if (tourExpandedKeysRef.current) {
      const baseline = tourExpandedKeysRef.current
      setExpandedVaultKeys((prev) => {
        const prevKeys = Object.keys(prev)
        const nextKeys = Object.keys(baseline)
        if (prevKeys.length === nextKeys.length && prevKeys.every((key) => prev[key] === baseline[key])) {
          return prev
        }
        return { ...baseline }
      })
    }
  }, [tourState.isOpen, tourState.stepId, tourTargetVaultKey, expandedVaultKeys])

  useEffect(() => {
    const root = varsRef.current
    const filtersNode = filtersRef.current

    if (!root || !filtersNode) {
      return
    }

    let frame = 0
    const update = (): void => {
      frame = 0
      const height = filtersNode.getBoundingClientRect().height
      root.style.setProperty('--vaults-filters-height', `${height}px`)
    }

    const schedule = (): void => {
      if (frame) {
        cancelAnimationFrame(frame)
      }
      frame = requestAnimationFrame(update)
    }

    schedule()

    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(schedule)
    observer?.observe(filtersNode)
    window.addEventListener('resize', schedule)

    return () => {
      if (frame) {
        cancelAnimationFrame(frame)
      }
      observer?.disconnect()
      window.removeEventListener('resize', schedule)
    }
  }, [filtersRef, varsRef])

  const filtersContent = <VaultsFiltersPanel sections={filters.sections} />

  const compareToggleControl = (
    <button
      type={'button'}
      className={cl(
        'flex shrink-0 items-center justify-center h-10 px-4 gap-1 rounded-lg bg-surface border border-border hover:border-hover text-sm font-medium text-text-secondary transition-colors hover:text-text-primary data-[active=true]:border-primary/50 data-[active=true]:text-primary',
        isCompareMode ? 'bg-primary/50' : null
      )}
      onClick={handleToggleCompareMode}
      data-active={isCompareMode}
    >
      <IconGitCompare className={'size-4'} />
      {'Compare'}
    </button>
  )

  const vaultListContent = useMemo(() => {
    if (isLoading) {
      return (
        <div className={'flex flex-col gap-px bg-border'}>
          <VirtualizedVaultsList
            items={[]}
            estimateSize={81}
            itemSpacingClassName={'pb-px'}
            placeholderCount={10}
            getItemKey={(vault): string => getVaultKey(vault)}
            renderItem={(): ReactElement => <VaultsListRowSkeleton />}
            renderPlaceholder={(): ReactElement => <VaultsListRowSkeleton />}
          />
        </div>
      )
    }

    if (pinnedVaults.length === 0 && mainVaults.length === 0) {
      return (
        <VaultsListEmpty
          isLoading={false}
          currentSearch={search.value}
          onReset={onResetFilters}
          hiddenByFiltersCount={hiddenByFiltersCount}
          blockingFilterActions={blockingFilterActions}
        />
      )
    }

    return (
      <div className={'flex flex-col gap-px bg-surface'}>
        {pinnedSections.map((section) => (
          <VaultsAuxiliaryList
            key={section.key}
            vaults={section.vaults}
            vaultFlags={vaultFlags}
            resolveApyDisplayVariant={resolveApyDisplayVariant}
            compareVaultKeys={isCompareMode ? compareVaultKeys : undefined}
            onToggleCompare={isCompareMode ? handleToggleCompare : undefined}
            activeChains={activeChains}
            activeCategories={activeCategories}
            activeProductType={activeProductType}
            onToggleChain={onToggleChain}
            onToggleCategory={onToggleCategory}
            onToggleType={listVaultType === 'v3' ? onToggleType : undefined}
            onToggleVaultType={onToggleVaultType}
            shouldCollapseChips={shouldCollapseChips}
            showStrategies={displayedShowStrategies}
            expandedVaultKeys={expandedVaultKeys}
            onExpandedChange={handleExpandedChange}
          />
        ))}
        {mainVaults.length > 0 ? (
          <VirtualizedVaultsList
            items={mainVaults}
            estimateSize={81}
            itemSpacingClassName={'md:border-b md:border-border'}
            getItemKey={(vault): string => getVaultKey(vault)}
            renderItem={(vault): ReactElement => {
              const key = getVaultKey(vault)
              const rowApyDisplayVariant = resolveApyDisplayVariant(vault)
              return (
                <VaultsListRow
                  currentVault={vault}
                  flags={vaultFlags[key]}
                  apyDisplayVariant={rowApyDisplayVariant}
                  compareVaultKeys={isCompareMode ? compareVaultKeys : undefined}
                  onToggleCompare={isCompareMode ? handleToggleCompare : undefined}
                  activeChains={activeChains}
                  activeCategories={activeCategories}
                  activeProductType={activeProductType}
                  onToggleChain={onToggleChain}
                  onToggleCategory={onToggleCategory}
                  onToggleType={listVaultType === 'v3' ? onToggleType : undefined}
                  onToggleVaultType={onToggleVaultType}
                  shouldCollapseChips={shouldCollapseChips}
                  showStrategies={displayedShowStrategies}
                  isExpanded={Boolean(expandedVaultKeys[key])}
                  onExpandedChange={(next): void => handleExpandedChange(key, next)}
                />
              )
            }}
          />
        ) : null}
      </div>
    )
  }, [
    activeCategories,
    activeChains,
    activeProductType,
    blockingFilterActions,
    compareVaultKeys,
    displayedShowStrategies,
    expandedVaultKeys,
    handleExpandedChange,
    handleToggleCompare,
    hiddenByFiltersCount,
    isCompareMode,
    isLoading,
    listChains,
    listVaultType,
    mainVaults,
    onResetFilters,
    onToggleCategory,
    onToggleChain,
    onToggleType,
    onToggleVaultType,
    pinnedSections,
    pinnedVaults.length,
    resolveApyDisplayVariant,
    search.value,
    shouldCollapseChips,
    vaultFlags
  ])

  const compareCount = compareVaultKeys.length
  const shouldShowCompareBar = isCompareMode && compareCount >= 1 && !isCompareOpen
  const compareBarElement = shouldShowCompareBar ? (
    <div className={'fixed bottom-4 left-1/2 z-55 w-[calc(100%-2rem)] max-w-[720px] -translate-x-1/2'}>
      <div
        className={
          'flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4 shadow-xl sm:flex-row sm:items-center sm:justify-between'
        }
      >
        <div className={'text-sm text-text-secondary'}>
          {compareCount === 1 ? 'Selected 1 vault. Select one more to compare' : `Selected ${compareCount} vaults`}
        </div>
        <div className={'flex flex-wrap gap-2'}>
          <Button
            variant={'outlined'}
            onClick={handleClearCompare}
            classNameOverride={'yearn--button--nextgen yearn--button-smaller'}
          >
            {'Clear'}
          </Button>
          <Button
            variant={'filled'}
            onClick={handleOpenCompare}
            classNameOverride={'yearn--button--nextgen yearn--button-smaller'}
            isDisabled={compareCount < 2}
          >
            {`Compare (${compareCount})`}
          </Button>
        </div>
      </div>
    </div>
  ) : null

  const compareModalElement = (
    <VaultsCompareModal
      isOpen={isCompareOpen}
      onClose={(): void => setIsCompareOpen(false)}
      vaults={compareVaults}
      onRemove={handleRemoveCompare}
    />
  )

  return (
    <>
      <div className={'min-h-[calc(100vh-var(--header-height))] w-full bg-app'}>
        <div className={'mx-auto w-full max-w-[1232px] px-4 pb-4'}>
          <div ref={varsRef} className={'flex flex-col'} style={{ '--vaults-filters-height': '0px' } as CSSProperties}>
            <div
              ref={filtersRef}
              className={'sticky z-40 w-full bg-app pb-2 shrink-0'}
              style={{ top: 'var(--header-height)' }}
            >
              <Breadcrumbs
                className={'mb-3 mt-2'}
                items={[
                  { label: 'Home', href: '/' },
                  { label: 'Vaults', href: '/vaults', isCurrent: true }
                ]}
              />
              {/* turn back on when ready for primetime */}
              {/* <TrendingVaults suggestedVaults={suggestedVaults} /> */}
              <VaultsFiltersBar
                search={{
                  ...search,
                  shouldDebounce: true,
                  onBlur: handleSearchBlur
                }}
                filters={{
                  ...filters,
                  content: filtersContent,
                  trailingControls: compareToggleControl
                }}
                chains={chains}
                mobileExtraContent={
                  <VaultVersionToggle
                    stretch={true}
                    activeType={activeVaultType}
                    onTypeChange={onChangeVaultType}
                    isPending={isUpdatingProductType}
                  />
                }
                trailingControls={
                  <VaultVersionToggle
                    activeType={activeVaultType}
                    onTypeChange={onChangeVaultType}
                    isPending={isUpdatingProductType}
                  />
                }
                isStackedLayout={shouldStackFilters}
              />
            </div>
            <div data-tour="vaults-list">
              <VaultsListSection
                isUpdatingProductType={isUpdatingProductType}
                isUpdatingList={isUpdatingList}
                listHead={<VaultsListHead {...listHeadProps} />}
              >
                {vaultListContent}
              </VaultsListSection>
            </div>
          </div>
        </div>
      </div>
      {compareBarElement}
      {compareModalElement}
      <VaultsWelcomeTour onTourStateChange={setTourState} />
    </>
  )
}
