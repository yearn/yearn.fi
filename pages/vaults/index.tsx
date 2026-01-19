import { Breadcrumbs } from '@lib/components/Breadcrumbs'
import { Button } from '@lib/components/Button'
import { ShareButton } from '@lib/components/ShareButton'
import { getVaultKey } from '@lib/hooks/useVaultFilterUtils'
import { cl } from '@lib/utils'
import type { TYDaemonVault } from '@lib/utils/schemas/yDaemonVaultsSchemas'
import { VaultsCompareModal } from '@vaults/components/compare/VaultsCompareModal'
import { VaultsFiltersBar } from '@vaults/components/filters/VaultsFiltersBar'
import { VaultsFiltersPanel } from '@vaults/components/filters/VaultsFiltersPanel'
import { VaultVersionToggle } from '@vaults/components/filters/VaultVersionToggle'
import { VaultsAuxiliaryList } from '@vaults/components/list/VaultsAuxiliaryList'
import { VaultsListEmpty } from '@vaults/components/list/VaultsListEmpty'
import { VaultsListHead } from '@vaults/components/list/VaultsListHead'
import { VaultsListRow } from '@vaults/components/list/VaultsListRow'
import { TrendingVaults } from '@vaults/components/TrendingVaults'
import { toggleInArray } from '@vaults/utils/constants'
import { getVaultTypeLabel } from '@vaults/utils/vaultTypeCopy'
import type { CSSProperties, ReactElement, ReactNode } from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useVaultsPageModel } from './hooks/useVaultsPageModel'

type TVaultsListSectionProps = {
  isSwitchingVaultType: boolean
  listHead: ReactElement
  children: ReactNode
}

function VaultsListSection({ isSwitchingVaultType, listHead, children }: TVaultsListSectionProps): ReactElement {
  return (
    <div aria-busy={isSwitchingVaultType || undefined} className={'relative w-full rounded-xl bg-surface'}>
      <div className={isSwitchingVaultType ? 'pointer-events-none opacity-70 transition' : 'transition'}>
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
      {isSwitchingVaultType ? (
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
  const { vaultType, suggestedVaults } = header
  const {
    searchValue,
    chains,
    chainConfig,
    filtersCount,
    filtersSections,
    shouldStackFilters,
    isSwitchingVaultType,
    activeVaultType,
    onSearch,
    onChangeChains,
    onClearFilters,
    onShareFilters,
    onChangeVaultType
  } = filtersBar
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

  useEffect(() => {
    if (isCompareOpen && compareVaultKeys.length < 2) {
      setIsCompareOpen(false)
    }
  }, [compareVaultKeys.length, isCompareOpen])

  const filtersContent = <VaultsFiltersPanel sections={filtersSections} />

  const shareButtonElement = <ShareButton onClick={onShareFilters} ariaLabel={'Share filters'} />

  const compareToggleControl = (
    <button
      type={'button'}
      className={cl(
        'flex shrink-0 items-center gap-2 border rounded-lg h-10 border-border px-4 text-sm font-medium text-text-secondary bg-surface transition-colors',
        'hover:text-text-secondary',
        'data-[active=true]:border-primary  data-[active=true]:text-text-primary',
        isCompareMode ? 'bg-primary/50' : null
      )}
      onClick={handleToggleCompareMode}
      data-active={isCompareMode}
    >
      {'Compare'}
    </button>
  )

  const vaultListContent = useMemo(() => {
    if (isLoading) {
      return (
        <VaultsListEmpty
          isLoading={isLoading}
          currentSearch={searchValue}
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
          currentSearch={searchValue}
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
          <div className={'flex flex-col gap-px bg-border'}>
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
    searchValue,
    shouldCollapseChips,
    totalMatchingVaults,
    vaultFlags
  ])

  const compareCount = compareVaultKeys.length
  const shouldShowCompareBar = isCompareMode && compareCount >= 1 && !isCompareOpen
  const compareBarElement = shouldShowCompareBar ? (
    <div className={'fixed bottom-4 left-1/2 z-[55] w-[calc(100%-2rem)] max-w-[720px] -translate-x-1/2'}>
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
      onClear={handleClearCompare}
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
              <TrendingVaults suggestedVaults={suggestedVaults} />
              <VaultsFiltersBar
                shouldDebounce={true}
                searchValue={searchValue}
                chains={chains}
                onChangeChains={onChangeChains}
                onSearch={onSearch}
                chainConfig={chainConfig}
                filtersCount={filtersCount}
                filtersContent={filtersContent}
                onClearFilters={onClearFilters}
                searchTrailingControls={shareButtonElement}
                filtersTrailingControls={compareToggleControl}
                mobileExtraContent={
                  <VaultVersionToggle
                    stretch={true}
                    activeType={activeVaultType}
                    onTypeChange={onChangeVaultType}
                    isPending={isSwitchingVaultType}
                  />
                }
                trailingControls={
                  <VaultVersionToggle
                    activeType={activeVaultType}
                    onTypeChange={onChangeVaultType}
                    isPending={isSwitchingVaultType}
                  />
                }
                isStackedLayout={shouldStackFilters}
              />
            </div>
            <VaultsListSection
              isSwitchingVaultType={isSwitchingVaultType}
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
