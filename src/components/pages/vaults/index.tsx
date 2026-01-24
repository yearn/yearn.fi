import { VaultsCompareModal } from '@pages/vaults/components/compare/VaultsCompareModal'
import { VaultsFiltersBar } from '@pages/vaults/components/filters/VaultsFiltersBar'
import { VaultsFiltersPanel } from '@pages/vaults/components/filters/VaultsFiltersPanel'
import { VaultVersionToggle } from '@pages/vaults/components/filters/VaultVersionToggle'
import { VaultsAuxiliaryList } from '@pages/vaults/components/list/VaultsAuxiliaryList'
import { VaultsListEmpty } from '@pages/vaults/components/list/VaultsListEmpty'
import { VaultsListHead } from '@pages/vaults/components/list/VaultsListHead'
import { VaultsListRow } from '@pages/vaults/components/list/VaultsListRow'
import { toggleInArray } from '@pages/vaults/utils/constants'
import { getVaultTypeLabel } from '@pages/vaults/utils/vaultTypeCopy'
import { Breadcrumbs } from '@shared/components/Breadcrumbs'
import { Button } from '@shared/components/Button'
import { getVaultKey } from '@shared/hooks/useVaultFilterUtils'
import { IconGitCompare } from '@shared/icons/IconGitCompare'
import { cl } from '@shared/utils'
import type { TYDaemonVault } from '@shared/utils/schemas/yDaemonVaultsSchemas'
import type { CSSProperties, ReactElement, ReactNode } from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'
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
    <div aria-busy={isBusy || undefined} className={'relative w-full rounded-xl bg-surface'}>
      <div className={isUpdatingProductType ? 'pointer-events-none opacity-70 transition' : 'transition'}>
        <div
          className={'relative md:sticky md:z-30'}
          style={{
            top: 'calc(var(--header-height) + var(--vaults-filters-height))'
          }}
        >
          <div
            aria-hidden={true}
            className={'pointer-events-none absolute inset-0 z-0 bg-app border-2'}
            style={{ borderColor: 'var(--color-app)' }}
          />
          {listHead}
        </div>
        <div className={'flex flex-col border-x border-b border-border rounded-b-xl overflow-hidden'}>{children}</div>
      </div>
      {shouldShowSubtleOverlay ? (
        <div aria-hidden={true} className={'pointer-events-none absolute inset-0 z-30 rounded-xl bg-app/30'} />
      ) : null}
      {isUpdatingProductType ? (
        <output
          aria-live={'polite'}
          className={'absolute inset-0 z-40 flex items-center justify-center rounded-xl bg-app/30 text-text-primary'}
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
  const { refs, header, filtersBar, list } = useVaultsPageModel()
  const { varsRef, filtersRef } = refs
  const { vaultType } = header
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
    listCategoriesSanitized,
    listChains,
    defaultCategories,
    totalMatchingVaults
  } = data
  const { activeChains, activeCategories, activeProductType } = activeFilters
  const { onToggleChain, onToggleCategory, onToggleType, onToggleVaultType } = handlers

  const [compareVaultKeys, setCompareVaultKeys] = useState<string[]>([])
  const [isCompareOpen, setIsCompareOpen] = useState(false)
  const [isCompareMode, setIsCompareMode] = useState(false)

  const handleToggleCompare = useCallback((vault: TYDaemonVault): void => {
    setCompareVaultKeys((prev) => toggleInArray(prev, getVaultKey(vault)))
  }, [])

  const handleRemoveCompare = useCallback((vaultKey: string): void => {
    setCompareVaultKeys((prev) => prev.filter((entry) => entry !== vaultKey))
  }, [])

  const handleClearCompare = useCallback((): void => {
    setCompareVaultKeys([])
  }, [])

  const handleToggleCompareMode = useCallback((): void => {
    setIsCompareMode((prev) => {
      const next = !prev
      if (!next) {
        setCompareVaultKeys([])
        setIsCompareOpen(false)
      }
      return next
    })
  }, [])

  const visibleVaults = useMemo(() => [...pinnedVaults, ...mainVaults], [pinnedVaults, mainVaults])
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
        <VaultsListEmpty
          isLoading={isLoading}
          currentSearch={search.value}
          currentCategories={listCategoriesSanitized}
          currentChains={listChains}
          onReset={onResetFilters}
          defaultCategories={defaultCategories}
          potentialResultsCount={totalMatchingVaults}
        />
      )
    }

    if (pinnedVaults.length === 0 && mainVaults.length === 0) {
      return (
        <VaultsListEmpty
          isLoading={false}
          currentSearch={search.value}
          currentCategories={listCategoriesSanitized}
          currentChains={listChains}
          onReset={onResetFilters}
          defaultCategories={defaultCategories}
          potentialResultsCount={totalMatchingVaults}
        />
      )
    }

    return (
      <div className={'flex flex-col gap-px bg-border'}>
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
          />
        ))}
        {mainVaults.length > 0 ? (
          <div className={'flex flex-col gap-0.5 md:gap-px bg-border'}>
            {mainVaults.map((vault) => {
              const key = getVaultKey(vault)
              const rowApyDisplayVariant = resolveApyDisplayVariant(vault)
              return (
                <VaultsListRow
                  key={key}
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
                />
              )
            })}
          </div>
        ) : null}
      </div>
    )
  }, [
    activeCategories,
    activeChains,
    activeProductType,
    compareVaultKeys,
    defaultCategories,
    displayedShowStrategies,
    handleToggleCompare,
    isCompareMode,
    isLoading,
    listCategoriesSanitized,
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
    totalMatchingVaults,
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
            onClick={(): void => setIsCompareOpen(true)}
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
                  { label: 'Vaults', href: '/vaults' },
                  { label: getVaultTypeLabel(vaultType), isCurrent: true }
                ]}
              />
              {/* turn back on when ready for primetime */}
              {/* <TrendingVaults suggestedVaults={suggestedVaults} /> */}
              <VaultsFiltersBar
                search={{
                  ...search,
                  shouldDebounce: true
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
      {compareBarElement}
      {compareModalElement}
    </>
  )
}
