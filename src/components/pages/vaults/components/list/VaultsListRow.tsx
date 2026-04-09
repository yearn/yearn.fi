import Link from '@components/Link'
import { usePlausible } from '@hooks/usePlausible'
import { APYDetailsModal } from '@pages/vaults/components/table/APYDetailsModal'
import { type TVaultForwardAPYVariant, VaultForwardAPY } from '@pages/vaults/components/table/VaultForwardAPY'
import { VaultHoldingsAmount } from '@pages/vaults/components/table/VaultHoldingsAmount'
import { VaultTVL } from '@pages/vaults/components/table/VaultTVL'
import {
  YvUsdApyDetailsContent,
  YvUsdApyTooltipContent,
  YvUsdTvlTooltipContent
} from '@pages/vaults/components/yvUSD/YvUsdBreakdown'
import {
  getVaultAddress,
  getVaultAPR,
  getVaultCategory,
  getVaultChainID,
  getVaultName as getVaultDisplayName,
  getVaultKind,
  getVaultSymbol,
  getVaultToken,
  getVaultTVL,
  getVaultYieldSplitter,
  type TKongVaultInput
} from '@pages/vaults/domain/kongVaultSelectors'
import { useYvUsdVaults } from '@pages/vaults/hooks/useYvUsdVaults'
import { getYvUsdTvlBreakdown } from '@pages/vaults/hooks/useYvUsdVaults.helpers'
import { KONG_REST_BASE } from '@pages/vaults/utils/kongRest'
import { deriveListKind } from '@pages/vaults/utils/vaultListFacets'
import { getVaultPrimaryLogoSrc } from '@pages/vaults/utils/vaultLogo'
import {
  getCategoryDescription,
  getChainDescription,
  getKindDescription,
  getProductTypeDescription,
  HIDDEN_TAG_DESCRIPTION,
  MIGRATABLE_TAG_DESCRIPTION,
  NOT_YEARN_TAG_DESCRIPTION,
  RETIRED_TAG_DESCRIPTION
} from '@pages/vaults/utils/vaultTagCopy'
import {
  getYvUsdInfinifiPointsNote,
  getYvUsdSharePrice,
  isYvUsdAddress,
  YVUSD_CHAIN_ID,
  YVUSD_LOCKED_ADDRESS,
  YVUSD_UNLOCKED_ADDRESS
} from '@pages/vaults/utils/yvUsd'
import { useMediaQuery } from '@react-hookz/web'
import { RenderAmount } from '@shared/components/RenderAmount'
import { TokenLogo } from '@shared/components/TokenLogo'
import { Tooltip } from '@shared/components/Tooltip'
import { useWallet } from '@shared/contexts/useWallet'
import { useWeb3 } from '@shared/contexts/useWeb3'
import { fetchWithSchema, getFetchQueryKey } from '@shared/hooks/useFetch'
import { IconChevron } from '@shared/icons/IconChevron'
import { IconEyeOff } from '@shared/icons/IconEyeOff'
import { IconInfinifiPoints } from '@shared/icons/IconInfinifiPoints'
import { cl, formatAmount, formatApyDisplay, formatTvlDisplay, getVaultName, toAddress } from '@shared/utils'
import { PLAUSIBLE_EVENTS } from '@shared/utils/plausible'
import { kongVaultSnapshotSchema } from '@shared/utils/schemas/kongVaultSnapshotSchema'
import { getNetwork } from '@shared/utils/wagmi'
import { useQueryClient } from '@tanstack/react-query'
import type { MouseEvent, ReactElement } from 'react'
import { lazy, memo, Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import type { TVaultsExpandedView } from './VaultsExpandedSelector'
import { VaultsListChip } from './VaultsListChip'

const VaultsListRowExpandedContent = lazy(() => import('./VaultsListRowExpandedContent'))

function ExpandedRowFallback(): ReactElement {
  return (
    <div className={'hidden md:block bg-surface'}>
      <div className={'px-6 pb-6 pt-3'}>
        <div className={'flex min-h-60 items-center justify-center'}>
          <span className={'loader'} />
        </div>
      </div>
    </div>
  )
}

type TVaultRowFlags = {
  hasHoldings?: boolean
  isMigratable?: boolean
  isRetired?: boolean
  isHidden?: boolean
  isNotYearn?: boolean
}

type TVaultKindType = 'multi' | 'single' | 'route' | undefined
type TVaultProductType = 'v3' | 'lp'
type TVaultProductTypePresentation = {
  productType: TVaultProductType
  label: string
  ariaLabel: string
  isLegacy: boolean
  isFilterable: boolean
}

type TYvUsdListMetrics = {
  unlockedApy: number
  lockedApy: number
  unlockedTvl: number
  lockedTvl: number
  combinedTvl: number
  hasInfinifiPointsNote: boolean
}

const YVUSD_HOLDINGS_FORMAT_OPTIONS = {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
} as const

const prefetchedSnapshotEndpoints = new Set<string>()

function buildSnapshotEndpoint(chainId: number, address: string): string {
  return `${KONG_REST_BASE}/snapshot/${chainId}/${toAddress(address)}`
}

function getVaultProductTypePresentation(listKind: ReturnType<typeof deriveListKind>): TVaultProductTypePresentation {
  if (listKind === 'yieldSplitter') {
    return {
      productType: 'v3',
      label: 'Yield Splitter',
      ariaLabel: 'Yield splitter vault',
      isLegacy: false,
      isFilterable: false
    }
  }

  if (listKind === 'allocator' || listKind === 'strategy') {
    return {
      productType: 'v3',
      label: 'Single Asset',
      ariaLabel: 'Show single asset vaults',
      isLegacy: false,
      isFilterable: true
    }
  }

  if (listKind === 'legacy') {
    return {
      productType: 'lp',
      label: 'Legacy',
      ariaLabel: 'Legacy vault',
      isLegacy: true,
      isFilterable: true
    }
  }

  return {
    productType: 'lp',
    label: 'LP Token',
    ariaLabel: 'Show LP token vaults',
    isLegacy: false,
    isFilterable: true
  }
}

function getVaultKindType(
  kind: string | null | undefined,
  listKind: ReturnType<typeof deriveListKind>
): TVaultKindType {
  if (listKind === 'yieldSplitter') {
    return 'route'
  }

  if (kind === 'Multi Strategy') {
    return 'multi'
  }

  if (kind === 'Single Strategy') {
    return 'single'
  }

  if (listKind === 'allocator') {
    return 'multi'
  }

  if (listKind === 'strategy') {
    return 'single'
  }

  return undefined
}

function getVaultKindLabel(kindType: TVaultKindType, fallbackKind: string | null | undefined): string | undefined {
  if (kindType === 'multi') {
    return 'Allocator'
  }

  if (kindType === 'single') {
    return 'Strategy'
  }

  if (kindType === 'route') {
    return 'Vault-to-Vault'
  }

  return fallbackKind ?? undefined
}

function getYvUsdListMetrics({
  currentVault,
  apr,
  isYvUsd,
  yvUsdMetrics
}: {
  currentVault: TKongVaultInput
  apr: ReturnType<typeof getVaultAPR>
  isYvUsd: boolean
  yvUsdMetrics: ReturnType<typeof useYvUsdVaults>['metrics']
}): TYvUsdListMetrics | null {
  if (!isYvUsd) {
    return null
  }

  const vaultTvl = getVaultTVL(currentVault)
  const unlockedApy = yvUsdMetrics?.unlocked.apy ?? (apr?.forwardAPR?.netAPR || apr?.netAPR || 0)
  const lockedApy = yvUsdMetrics?.locked.apy ?? 0
  const lockedTvl = yvUsdMetrics?.locked.tvl ?? 0
  const totalTvl = vaultTvl.tvl ?? yvUsdMetrics?.unlocked.tvl ?? 0
  const tvlBreakdown = getYvUsdTvlBreakdown({ totalTvl, lockedTvl })

  return {
    unlockedApy,
    lockedApy,
    unlockedTvl: tvlBreakdown.unlockedTvl,
    lockedTvl: tvlBreakdown.lockedTvl,
    combinedTvl: tvlBreakdown.totalTvl,
    hasInfinifiPointsNote: Boolean(yvUsdMetrics?.locked.hasInfinifiPoints || yvUsdMetrics?.unlocked.hasInfinifiPoints)
  }
}

type TVaultsListRowProps = {
  currentVault: TKongVaultInput
  flags?: TVaultRowFlags
  hrefOverride?: string
  apyDisplayVariant?: TVaultForwardAPYVariant
  showBoostDetails?: boolean
  compareVaultKeys?: string[]
  onToggleCompare?: (vault: TKongVaultInput) => void
  activeChains?: number[]
  activeCategories?: string[]
  onToggleChain?: (chainId: number) => void
  onToggleCategory?: (category: string) => void
  onToggleType?: (type: string) => void
  activeProductType?: 'v3' | 'lp' | 'all'
  onToggleVaultType?: (type: 'v3' | 'lp') => void
  showStrategies?: boolean
  shouldCollapseChips?: boolean
  isExpanded?: boolean
  onExpandedChange?: (vaultKey: string, next: boolean) => void
  showAllocatorChip?: boolean
  showHoldingsChipOverride?: boolean
  showProductTypeChipOverride?: boolean
  mobileSecondaryMetric?: 'tvl' | 'holdings'
}

function VaultsListRowComponent({
  currentVault,
  flags,
  hrefOverride,
  apyDisplayVariant = 'default',
  showBoostDetails = true,
  compareVaultKeys,
  onToggleCompare,
  activeChains,
  activeCategories,
  onToggleChain,
  onToggleCategory,
  onToggleType,
  activeProductType,
  onToggleVaultType,
  showStrategies = false,
  shouldCollapseChips = false,
  isExpanded: isExpandedProp,
  onExpandedChange,
  showHoldingsChipOverride,
  showProductTypeChipOverride,
  mobileSecondaryMetric = 'tvl',
  showAllocatorChip = true
}: TVaultsListRowProps): ReactElement {
  const navigate = useNavigate()
  const trackEvent = usePlausible()
  const chainID = getVaultChainID(currentVault)
  const vaultAddress = getVaultAddress(currentVault)
  const vaultSymbol = getVaultSymbol(currentVault)
  const vaultName = getVaultDisplayName(currentVault)
  const vaultToken = getVaultToken(currentVault)
  const apr = getVaultAPR(currentVault)
  const vaultKind = getVaultKind(currentVault)
  const vaultCategory = getVaultCategory(currentVault)
  const yieldSplitter = getVaultYieldSplitter(currentVault)
  const href = hrefOverride ?? `/vaults/${chainID}/${toAddress(vaultAddress)}`
  const network = getNetwork(chainID)
  const chainLogoSrc = `${import.meta.env.VITE_BASE_YEARN_ASSETS_URI}/chains/${chainID}/logo-32.png`
  const isYvUsd = isYvUsdAddress(vaultAddress)
  const tokenLogoSrc = getVaultPrimaryLogoSrc(currentVault)
  const { address } = useWeb3()
  const { getVaultHoldingsUsd, getBalance, isLoading: isWalletLoading } = useWallet()
  const isMobile = useMediaQuery('(max-width: 767px)', { initializeWithValue: false }) ?? false
  const [isExpandedState, setIsExpandedState] = useState(false)
  const isExpanded = isExpandedProp ?? isExpandedState
  const [expandedView, setExpandedView] = useState<TVaultsExpandedView>('strategies')
  const [interactiveHoverCount, setInteractiveHoverCount] = useState(0)
  const [isYvUsdModalOpen, setIsYvUsdModalOpen] = useState(false)
  const queryClient = useQueryClient()
  const listKind = deriveListKind(currentVault)
  const {
    productType,
    label: productTypeLabel,
    ariaLabel: productTypeAriaLabel,
    isLegacy: isLegacyVault,
    isFilterable: isProductTypeFilterable
  } = getVaultProductTypePresentation(listKind)
  const showProductTypeChip = showProductTypeChipOverride ?? (Boolean(activeProductType) || Boolean(onToggleVaultType))
  const isProductTypeActive = isProductTypeFilterable && activeProductType === productType
  const shouldCollapseProductTypeChip =
    isProductTypeFilterable && !isLegacyVault && activeProductType !== 'all' && activeProductType === productType
  const isChipsCompressed = Boolean(shouldCollapseChips) || isMobile
  const shouldCollapseProductType = isChipsCompressed || shouldCollapseProductTypeChip
  const showCollapsedTooltip = isChipsCompressed
  const leftColumnSpan = 'col-span-12'
  const rightColumnSpan = 'col-span-12'
  const rightGridColumns = 'md:grid-cols-12'
  const showHoldingsColumn = !!address
  const apyColumnSpan = showHoldingsColumn ? 'col-span-4' : 'col-span-6'
  const tvlColumnSpan = showHoldingsColumn ? 'col-span-4' : 'col-span-5'
  const holdingsColumnSpan = 'col-span-4'
  const showCompareToggle = Boolean(onToggleCompare)
  const vaultKey = `${chainID}_${toAddress(vaultAddress)}`
  const isCompareSelected = compareVaultKeys?.includes(vaultKey) ?? false
  const isHoveringInteractive = interactiveHoverCount > 0
  const handleInteractiveHoverChange = (isHovering: boolean): void => {
    setInteractiveHoverCount((count) => Math.max(0, count + (isHovering ? 1 : -1)))
  }
  const { metrics: yvUsdMetrics, unlockedVault: yvUsdUnlockedVault, lockedVault: yvUsdLockedVault } = useYvUsdVaults()
  const resolvedYvUsdMetrics = useMemo(
    () => getYvUsdListMetrics({ currentVault, apr, isYvUsd, yvUsdMetrics }),
    [apr, currentVault, isYvUsd, yvUsdMetrics]
  )

  const yvUsdApyTooltip = resolvedYvUsdMetrics ? (
    <YvUsdApyTooltipContent
      lockedValue={resolvedYvUsdMetrics.lockedApy}
      unlockedValue={resolvedYvUsdMetrics.unlockedApy}
      infinifiPointsNote={resolvedYvUsdMetrics.hasInfinifiPointsNote ? getYvUsdInfinifiPointsNote() : undefined}
    />
  ) : undefined

  const yvUsdApyValue = resolvedYvUsdMetrics ? (
    <>
      {resolvedYvUsdMetrics.hasInfinifiPointsNote ? (
        <IconInfinifiPoints className={'size-3.5 shrink-0'} aria-label={'Infinifi points'} />
      ) : null}
      {formatApyDisplay(resolvedYvUsdMetrics.lockedApy)}
    </>
  ) : null

  const yvUsdTvlTooltip = resolvedYvUsdMetrics ? (
    <YvUsdTvlTooltipContent
      lockedValue={resolvedYvUsdMetrics.lockedTvl}
      unlockedValue={resolvedYvUsdMetrics.unlockedTvl}
    />
  ) : undefined

  const handleYvUsdApyClick = (event: MouseEvent<HTMLButtonElement>): void => {
    event.stopPropagation()
    event.preventDefault()
    setIsYvUsdModalOpen(true)
  }
  const handleExpandedChange = (next: boolean): void => {
    if (onExpandedChange) {
      onExpandedChange(vaultKey, next)
      return
    }
    setIsExpandedState(next)
  }

  const prefetchSnapshot = useCallback((): void => {
    const endpoint = buildSnapshotEndpoint(chainID, vaultAddress)
    if (prefetchedSnapshotEndpoints.has(endpoint)) {
      return
    }

    prefetchedSnapshotEndpoints.add(endpoint)
    const queryKey = getFetchQueryKey(endpoint)
    if (!queryKey) {
      return
    }

    void queryClient.prefetchQuery({
      queryKey,
      queryFn: () => fetchWithSchema(endpoint, kongVaultSnapshotSchema),
      staleTime: 30 * 1000
    })
  }, [vaultAddress, chainID, queryClient])

  const isHiddenVault = Boolean(flags?.isHidden)
  const kindType = getVaultKindType(vaultKind, listKind)
  const kindLabel = getVaultKindLabel(kindType, vaultKind)
  const yieldSplitterRouteFrom = yieldSplitter?.sourceVaultSymbol || yieldSplitter?.sourceVaultName || ''
  const yieldSplitterRouteTo = yieldSplitter?.wantVaultSymbol || yieldSplitter?.wantVaultName || ''
  const yieldSplitterRouteLabel =
    yieldSplitterRouteFrom && yieldSplitterRouteTo ? `${yieldSplitterRouteFrom} -> ${yieldSplitterRouteTo}` : ''
  const activeChainIds = activeChains ?? []
  const activeCategoryLabels = activeCategories ?? []
  const showKindChip =
    Boolean(kindType) && (kindType === 'route' || (showStrategies && (showAllocatorChip || kindType !== 'multi')))
  const isKindActive = false
  const chainDescription = getChainDescription(chainID)
  const categoryDescription = getCategoryDescription(vaultCategory)
  const productTypeDescription = getProductTypeDescription(listKind)
  const kindDescription = getKindDescription(kindType, kindLabel)
  const fees = apr?.fees
  const showFeesChip = Boolean(fees) && !isChipsCompressed
  const feesChipLabel = fees
    ? `Fees: ${formatAmount((fees.management || 0) * 100, 0, 2)}% | ${formatAmount(
        (fees.performance || 0) * 100,
        0,
        2
      )}%`
    : ''
  const retiredIcon = <span className={'text-xs leading-none'}>{'⚠️'}</span>
  const holdingsIcon = (
    <svg
      xmlns={'http://www.w3.org/2000/svg'}
      viewBox={'0 0 24 24'}
      fill={'none'}
      stroke={'currentColor'}
      strokeWidth={2}
      strokeLinecap={'round'}
      strokeLinejoin={'round'}
      className={'size-3.5'}
      aria-hidden={true}
    >
      <path d={'M11 15h2a2 2 0 1 0 0-4h-3c-.6 0-1.1.2-1.4.6L3 17'} />
      <path d={'m7 21 1.6-1.4c.3-.4.8-.6 1.4-.6h4c1.1 0 2.1-.4 2.8-1.2l4.6-4.4a2 2 0 0 0-2.75-2.91l-4.2 3.9'} />
      <path d={'m2 16 6 6'} />
      <circle cx={16} cy={9} r={2.9} />
      <circle cx={6} cy={5} r={3} />
    </svg>
  )
  const hasHoldings = Boolean(flags?.hasHoldings)
  const showHoldingsChip = showHoldingsChipOverride ?? hasHoldings
  const showHoldingsValue = hasHoldings
  const holdingsFormatOptions = isYvUsd ? YVUSD_HOLDINGS_FORMAT_OPTIONS : undefined
  const holdingsValue = useMemo(() => {
    if (isWalletLoading) {
      return 0
    }
    if (!showHoldingsChip && mobileSecondaryMetric !== 'holdings') {
      return 0
    }
    if (isYvUsd) {
      const unlockedBalance = getBalance({ address: YVUSD_UNLOCKED_ADDRESS, chainID: YVUSD_CHAIN_ID }).normalized
      const lockedBalance = getBalance({ address: YVUSD_LOCKED_ADDRESS, chainID: YVUSD_CHAIN_ID }).normalized
      const unlockedSharePrice = getYvUsdSharePrice(yvUsdUnlockedVault)
      const lockedSharePrice = getYvUsdSharePrice(yvUsdLockedVault)
      return unlockedBalance * unlockedSharePrice + lockedBalance * lockedSharePrice
    }
    return getVaultHoldingsUsd(currentVault)
  }, [
    showHoldingsChip,
    mobileSecondaryMetric,
    isYvUsd,
    isWalletLoading,
    getBalance,
    yvUsdLockedVault,
    yvUsdUnlockedVault,
    currentVault,
    getVaultHoldingsUsd
  ])

  useEffect(() => {
    if (isExpanded) {
      setExpandedView('strategies')
    }
  }, [isExpanded])

  return (
    <div
      className={cl(
        'w-full overflow-hidden transition-colors bg-surface relative max-md:border-b-2 max-md:border-border'
      )}
    >
      <button
        type={'button'}
        aria-label={isExpanded ? 'Collapse row' : 'Expand row'}
        aria-expanded={isExpanded}
        data-tour="vaults-row-expand"
        onClick={(event): void => {
          event.stopPropagation()
          if (!isExpanded) {
            trackEvent(PLAUSIBLE_EVENTS.VAULT_EXPAND, {
              props: {
                vaultAddress: toAddress(vaultAddress),
                vaultSymbol,
                chainID: chainID.toString()
              }
            })
          }
          handleExpandedChange(!isExpanded)
        }}
        className={cl(
          'absolute top-6.5 right-5 z-20 hidden md:flex size-9 items-center justify-center rounded-full border border-white/30 bg-app text-text-secondary transition-colors duration-150',
          'hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400'
        )}
      >
        <IconChevron className={'size-4'} direction={isExpanded ? 'up' : 'down'} />
      </button>
      <Link
        href={href}
        className={cl(
          'grid w-full grid-cols-1 md:grid-cols-24 bg-surface',
          'p-4 pb-4 md:p-6 md:pt-4 md:pb-4 md:pr-20',
          'cursor-pointer relative group'
        )}
        data-tour="vaults-row"
        onMouseEnter={prefetchSnapshot}
        onFocus={prefetchSnapshot}
        onClickCapture={(event): void => {
          const target = event.target as HTMLElement | null
          if (!target) return
          if (target.closest('button, input, select, textarea, [role="button"], [role="checkbox"]')) {
            event.preventDefault()
            return
          }
          if (showCompareToggle && onToggleCompare) {
            event.preventDefault()
            onToggleCompare(currentVault)
            return
          }
          trackEvent(PLAUSIBLE_EVENTS.VAULT_CLICK_LIST_ROW, {
            props: {
              vaultAddress: toAddress(vaultAddress),
              vaultSymbol,
              chainID: chainID.toString()
            }
          })
        }}
      >
        <div
          className={cl(
            'absolute inset-0',
            'opacity-0 transition-opacity duration-100 pointer-events-none',
            !isHoveringInteractive ? 'group-hover:opacity-20 group-focus-visible:opacity-20' : '',
            'bg-[linear-gradient(80deg,#2C3DA6,#D21162)]'
          )}
        />
        {isExpanded ? (
          <div
            className={cl(
              'absolute inset-0',
              'opacity-0 transition-opacity duration-100 pointer-events-none',
              !isHoveringInteractive ? 'group-hover:opacity-100 group-focus-visible:opacity-100' : '',
              'bg-[linear-gradient(180deg,transparent,var(--color-surface))]'
            )}
          />
        ) : null}

        <div
          className={cl(
            leftColumnSpan,
            'z-10',
            isYvUsd ? '-ml-2' : '',
            'flex flex-col items-start sm:pt-0 md:flex-row md:items-center md:justify-between'
          )}
        >
          <div
            className={cl(
              'flex w-full overflow-visible border-b border-border pb-2',
              isYvUsd ? 'gap-4' : 'gap-6',
              'md:border-none md:pb-0'
            )}
          >
            {showCompareToggle ? (
              // biome-ignore lint/a11y/useSemanticElements: native checkbox has double-firing issues with parent Link's onClickCapture
              <div
                role={'checkbox'}
                aria-checked={isCompareSelected}
                aria-label={
                  isCompareSelected ? `Remove ${vaultName} from comparison` : `Add ${vaultName} to comparison`
                }
                tabIndex={0}
                className={cl('flex cursor-pointer items-center justify-center', isYvUsd ? 'ml-2' : '')}
                onClick={(event): void => {
                  event.stopPropagation()
                  event.preventDefault()
                  onToggleCompare?.(currentVault)
                }}
                onKeyDown={(event): void => {
                  event.stopPropagation()
                  if (event.key === ' ' || event.key === 'Enter') {
                    event.preventDefault()
                    onToggleCompare?.(currentVault)
                  }
                }}
              >
                <div
                  className={cl(
                    'size-4 rounded border-2 flex items-center justify-center transition-colors',
                    isCompareSelected
                      ? 'bg-blue-500 border-blue-500'
                      : 'border-text-secondary/50 hover:border-text-secondary'
                  )}
                >
                  {isCompareSelected ? (
                    <svg className={'size-3 text-white'} fill={'none'} viewBox={'0 0 24 24'} stroke={'currentColor'}>
                      <path strokeLinecap={'round'} strokeLinejoin={'round'} strokeWidth={3} d={'M5 13l4 4L19 7'} />
                    </svg>
                  ) : null}
                </div>
              </div>
            ) : null}
            <div
              className={cl(
                'relative flex items-center justify-center self-center',
                isYvUsd ? 'size-12' : 'size-8',
                'min-h-8 min-w-8'
              )}
            >
              {isYvUsd ? (
                <TokenLogo src={tokenLogoSrc} tokenSymbol={'yvUSD'} width={48} height={48} />
              ) : (
                <TokenLogo src={tokenLogoSrc} tokenSymbol={vaultToken.symbol || ''} width={32} height={32} />
              )}
              <div
                className={
                  'absolute -bottom-1 -left-1 flex size-4 items-center justify-center rounded-full border border-border bg-surface'
                }
              >
                <TokenLogo src={chainLogoSrc} tokenSymbol={network.name} width={16} height={16} />
              </div>
            </div>
            <div className={'min-w-0 flex-1'}>
              <strong
                title={vaultName}
                className={
                  'block truncate-safe whitespace-nowrap font-black text-text-primary md:mb-0 text-lg leading-tight'
                }
              >
                {getVaultName(currentVault)}
              </strong>
              <div className={'mt-1 flex items-center gap-2 text-xs text-text-primary/70 whitespace-nowrap'}>
                <div className={'hidden md:block'}>
                  <VaultsListChip
                    label={network.name}
                    icon={<TokenLogo src={chainLogoSrc} tokenSymbol={network.name} width={14} height={14} />}
                    showIconInChip={false}
                    isActive={activeChainIds.includes(chainID)}
                    isCollapsed={isChipsCompressed}
                    showCollapsedTooltip={showCollapsedTooltip}
                    tooltipDescription={chainDescription}
                    onClick={onToggleChain ? (): void => onToggleChain(chainID) : undefined}
                    onHoverChange={handleInteractiveHoverChange}
                    ariaLabel={`Filter by ${network.name}`}
                  />
                </div>
                {vaultCategory ? (
                  <VaultsListChip
                    label={vaultCategory}
                    isActive={activeCategoryLabels.includes(vaultCategory)}
                    isCollapsed={isChipsCompressed}
                    showCollapsedTooltip={showCollapsedTooltip}
                    tooltipDescription={categoryDescription || undefined}
                    onClick={onToggleCategory ? (): void => onToggleCategory(vaultCategory) : undefined}
                    onHoverChange={handleInteractiveHoverChange}
                    ariaLabel={`Filter by ${vaultCategory}`}
                  />
                ) : null}
                {showProductTypeChip ? (
                  <VaultsListChip
                    label={productTypeLabel}
                    isActive={isProductTypeActive}
                    isCollapsed={shouldCollapseProductType}
                    showCollapsedTooltip={showCollapsedTooltip}
                    tooltipDescription={productTypeDescription}
                    onClick={
                      isProductTypeFilterable && onToggleVaultType
                        ? (): void => onToggleVaultType(productType)
                        : undefined
                    }
                    onHoverChange={handleInteractiveHoverChange}
                    ariaLabel={productTypeAriaLabel}
                  />
                ) : null}
                {showFeesChip ? (
                  <VaultsListChip
                    label={feesChipLabel}
                    isCollapsed={isChipsCompressed}
                    showCollapsedTooltip={showCollapsedTooltip}
                    tooltipDescription={'Management fee | Performance fee'}
                    onHoverChange={handleInteractiveHoverChange}
                  />
                ) : null}
                {showKindChip && kindLabel ? (
                  <VaultsListChip
                    label={kindLabel}
                    isActive={isKindActive}
                    isCollapsed={isChipsCompressed}
                    showCollapsedTooltip={showCollapsedTooltip}
                    tooltipDescription={kindDescription}
                    onClick={
                      kindType && kindType !== 'route' && onToggleType ? (): void => onToggleType(kindType) : undefined
                    }
                    onHoverChange={handleInteractiveHoverChange}
                    ariaLabel={`Filter by ${kindLabel}`}
                  />
                ) : null}
                {yieldSplitterRouteLabel ? (
                  <VaultsListChip
                    label={yieldSplitterRouteLabel}
                    isCollapsed={isChipsCompressed}
                    showCollapsedTooltip={showCollapsedTooltip}
                    tooltipDescription={yieldSplitter?.uiDescription || undefined}
                    onHoverChange={handleInteractiveHoverChange}
                  />
                ) : null}
                {flags?.isRetired ? (
                  <VaultsListChip
                    label={'Retired'}
                    icon={retiredIcon}
                    isCollapsed={isChipsCompressed}
                    showCollapsedTooltip={showCollapsedTooltip}
                    tooltipDescription={RETIRED_TAG_DESCRIPTION}
                    onHoverChange={handleInteractiveHoverChange}
                  />
                ) : null}
                {flags?.isMigratable ? (
                  <VaultsListChip
                    label={'Migratable'}
                    isCollapsed={isChipsCompressed}
                    showCollapsedTooltip={showCollapsedTooltip}
                    tooltipDescription={MIGRATABLE_TAG_DESCRIPTION}
                    onHoverChange={handleInteractiveHoverChange}
                  />
                ) : null}
                {isHiddenVault ? (
                  <VaultsListChip
                    label={'Hidden'}
                    icon={<IconEyeOff className={'size-3.5'} />}
                    isCollapsed={isChipsCompressed}
                    showCollapsedTooltip={showCollapsedTooltip}
                    tooltipDescription={HIDDEN_TAG_DESCRIPTION}
                    onHoverChange={handleInteractiveHoverChange}
                  />
                ) : null}
                {flags?.isNotYearn ? (
                  <VaultsListChip
                    label={'Not Yearn'}
                    isCollapsed={isChipsCompressed}
                    showCollapsedTooltip={showCollapsedTooltip}
                    tooltipDescription={NOT_YEARN_TAG_DESCRIPTION}
                    onHoverChange={handleInteractiveHoverChange}
                  />
                ) : null}
                {showHoldingsChip && isMobile ? (
                  <span
                    className={
                      'inline-flex items-center rounded-lg border border-primary/50 px-1 py-0.5 text-xs font-medium transition-colors bg-surface-secondary text-primary gap-1 shadow-[0_0_12px_rgba(59,130,246,0.12)]'
                    }
                    aria-label={'Holdings'}
                  >
                    <span className={'flex size-4 items-center justify-center text-primary'}>{holdingsIcon}</span>
                    {formatTvlDisplay(holdingsValue, holdingsFormatOptions)}
                  </span>
                ) : null}
              </div>
            </div>
          </div>
          <div className={'mt-2 flex w-full flex-col gap-2 md:hidden'}>
            <div className={'grid w-full grid-cols-2 gap-2 text-sm text-text-secondary'}>
              <div className={'flex items-center justify-center gap-2 whitespace-nowrap'}>
                <span className={'text-text-primary/60'}>{'Est. APY:'}</span>
                {resolvedYvUsdMetrics ? (
                  <Tooltip
                    className={'apy-subline-tooltip gap-0 h-auto md:justify-end'}
                    openDelayMs={150}
                    tooltip={yvUsdApyTooltip ?? ''}
                    align={'center'}
                    zIndex={90}
                  >
                    <button
                      type={'button'}
                      onClick={handleYvUsdApyClick}
                      onMouseEnter={() => handleInteractiveHoverChange(true)}
                      onMouseLeave={() => handleInteractiveHoverChange(false)}
                      className={'inline-flex flex-col items-start gap-0.5 text-left leading-none'}
                      aria-label={'View yvUSD APY details'}
                    >
                      <span className={'text-[10px] uppercase tracking-wide text-text-secondary'}>{'Up to'}</span>
                      <b
                        className={
                          'yearn--table-data-section-item-value inline-flex items-center gap-2 text-lg font-semibold text-text-primary'
                        }
                      >
                        {yvUsdApyValue}
                      </b>
                    </button>
                  </Tooltip>
                ) : (
                  <VaultForwardAPY
                    currentVault={currentVault}
                    className={'flex-row items-center text-left'}
                    valueClassName={'text-lg font-semibold'}
                    showSubline={false}
                    displayVariant={apyDisplayVariant}
                    showBoostDetails={showBoostDetails}
                    onInteractiveHoverChange={handleInteractiveHoverChange}
                  />
                )}
              </div>
              <div className={'flex items-center justify-center gap-2 whitespace-nowrap'}>
                <span className={'text-text-primary/60'}>
                  {mobileSecondaryMetric === 'holdings' ? 'Holdings:' : 'TVL:'}
                </span>
                {mobileSecondaryMetric === 'holdings' ? (
                  <span className={'text-lg font-semibold text-text-primary'}>
                    {showHoldingsValue ? formatTvlDisplay(holdingsValue, holdingsFormatOptions) : '—'}
                  </span>
                ) : resolvedYvUsdMetrics ? (
                  <Tooltip
                    className={'tvl-subline-tooltip gap-0 h-auto md:justify-end'}
                    openDelayMs={150}
                    toggleOnClick={false}
                    tooltip={yvUsdTvlTooltip ?? ''}
                  >
                    <span className={'text-lg font-semibold text-text-primary font-number'}>
                      <RenderAmount
                        value={resolvedYvUsdMetrics.combinedTvl}
                        symbol={'USD'}
                        decimals={0}
                        options={{
                          shouldCompactValue: true,
                          maximumFractionDigits: 2,
                          minimumFractionDigits: 0
                        }}
                      />
                    </span>
                  </Tooltip>
                ) : (
                  <VaultTVL currentVault={currentVault} valueClassName={'text-lg font-semibold text-text-primary'} />
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Desktop metrics grid */}
        <div
          className={cl(rightColumnSpan, 'z-10 gap-4 mt-4', 'hidden md:mt-0 md:grid md:items-center', rightGridColumns)}
        >
          <div className={cl('yearn--table-data-section-item', apyColumnSpan)} datatype={'number'}>
            {resolvedYvUsdMetrics ? (
              <div
                className={'flex justify-end text-right'}
                onMouseEnter={() => handleInteractiveHoverChange(true)}
                onMouseLeave={() => handleInteractiveHoverChange(false)}
              >
                <Tooltip
                  className={'apy-subline-tooltip gap-0 h-auto md:justify-end'}
                  openDelayMs={150}
                  tooltip={yvUsdApyTooltip ?? ''}
                  align={'center'}
                  zIndex={90}
                >
                  <button
                    type={'button'}
                    onClick={handleYvUsdApyClick}
                    className={'inline-flex items-center gap-2 text-right'}
                    aria-label={'View yvUSD APY details'}
                  >
                    {resolvedYvUsdMetrics.hasInfinifiPointsNote ? (
                      <IconInfinifiPoints className={'size-3.5 shrink-0'} aria-label={'Infinifi points'} />
                    ) : null}
                    <span className={'relative inline-flex'}>
                      <span
                        className={
                          'pointer-events-none absolute bottom-full left-0 mb-0.5 whitespace-nowrap text-[10px] uppercase tracking-wide text-text-secondary'
                        }
                      >
                        {'Up to'}
                      </span>
                      <b className={'yearn--table-data-section-item-value font-semibold text-text-primary'}>
                        {formatApyDisplay(resolvedYvUsdMetrics.lockedApy)}
                      </b>
                    </span>
                  </button>
                </Tooltip>
              </div>
            ) : (
              <VaultForwardAPY
                currentVault={currentVault}
                showSubline={false}
                showSublineTooltip
                displayVariant={apyDisplayVariant}
                showBoostDetails={showBoostDetails}
                onInteractiveHoverChange={handleInteractiveHoverChange}
              />
            )}
          </div>
          {/* TVL */}
          <div className={cl('yearn--table-data-section-item', tvlColumnSpan)} datatype={'number'}>
            {resolvedYvUsdMetrics ? (
              <div
                className={'flex justify-end text-right'}
                onMouseEnter={() => handleInteractiveHoverChange(true)}
                onMouseLeave={() => handleInteractiveHoverChange(false)}
              >
                <Tooltip
                  className={'tvl-subline-tooltip gap-0 h-auto md:justify-end'}
                  openDelayMs={150}
                  toggleOnClick={false}
                  tooltip={yvUsdTvlTooltip ?? ''}
                >
                  <p className={'yearn--table-data-section-item-value'}>
                    <RenderAmount
                      value={resolvedYvUsdMetrics.combinedTvl}
                      symbol={'USD'}
                      decimals={0}
                      options={{
                        shouldCompactValue: true,
                        maximumFractionDigits: 2,
                        minimumFractionDigits: 0
                      }}
                    />
                  </p>
                </Tooltip>
              </div>
            ) : (
              <div className={'flex justify-end text-right'}>
                <VaultTVL currentVault={currentVault} showNativeTooltip tooltipClassName={'md:justify-end'} />
              </div>
            )}
          </div>
          {!showHoldingsColumn ? <div className={'col-span-1'} /> : null}
          {showHoldingsColumn ? (
            <div className={cl('yearn--table-data-section-item', holdingsColumnSpan)} datatype={'number'}>
              <VaultHoldingsAmount value={holdingsValue} formatOptions={holdingsFormatOptions} />
            </div>
          ) : null}
        </div>
      </Link>

      {isExpanded ? (
        <Suspense fallback={<ExpandedRowFallback />}>
          <VaultsListRowExpandedContent
            currentVault={currentVault}
            expandedView={expandedView}
            onExpandedViewChange={setExpandedView}
            onNavigateToVault={() => navigate(href)}
            showKindTag={showKindChip}
            showHiddenTag={isHiddenVault}
            isHidden={isHiddenVault}
          />
        </Suspense>
      ) : null}
      {isYvUsd && resolvedYvUsdMetrics ? (
        <APYDetailsModal isOpen={isYvUsdModalOpen} onClose={() => setIsYvUsdModalOpen(false)} title={'yvUSD APY'}>
          <YvUsdApyDetailsContent
            lockedValue={resolvedYvUsdMetrics.lockedApy}
            unlockedValue={resolvedYvUsdMetrics.unlockedApy}
          />
        </APYDetailsModal>
      ) : null}
    </div>
  )
}

export const VaultsListRow = memo(VaultsListRowComponent)
VaultsListRow.displayName = 'VaultsListRow'
