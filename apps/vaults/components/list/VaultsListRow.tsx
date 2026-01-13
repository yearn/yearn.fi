import Link from '@components/Link'
import { RenderAmount } from '@lib/components/RenderAmount'
import { TokenLogo } from '@lib/components/TokenLogo'
import { Tooltip } from '@lib/components/Tooltip'
import { IconChevron } from '@lib/icons/IconChevron'
import { IconCirclePile } from '@lib/icons/IconCirclePile'
import { IconEyeOff } from '@lib/icons/IconEyeOff'
import { IconMigratable } from '@lib/icons/IconMigratable'
import { IconRewind } from '@lib/icons/IconRewind'
import { IconStablecoin } from '@lib/icons/IconStablecoin'
import { IconStack } from '@lib/icons/IconStack'
import { IconVolatile } from '@lib/icons/IconVolatile'
import { cl, toAddress, toNormalizedBN } from '@lib/utils'
import type { TYDaemonVault } from '@lib/utils/schemas/yDaemonVaultsSchemas'
import { getNetwork } from '@lib/utils/wagmi'
import type { TVaultChartTimeframe } from '@vaults/components/detail/VaultChartsSection'
import { type TVaultForwardAPYVariant, VaultForwardAPY } from '@vaults/components/table/VaultForwardAPY'
import { VaultHoldingsAmount } from '@vaults/components/table/VaultHoldingsAmount'
import { deriveListKind } from '@vaults/shared/utils/vaultListFacets'
import type { ReactElement } from 'react'
import { lazy, Suspense, useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import type { TVaultsExpandedView } from './VaultsExpandedSelector'
import { VaultsListChip } from './VaultsListChip'

const VaultsListRowExpandedContent = lazy(() => import('./VaultsListRowExpandedContent'))

const ExpandedRowFallback = (): ReactElement => (
  <div className={'hidden md:block bg-surface'}>
    <div className={'px-6 pb-6 pt-3'}>
      <div className={'flex min-h-[240px] items-center justify-center'}>
        <span className={'loader'} />
      </div>
    </div>
  </div>
)

type TVaultRowFlags = {
  hasHoldings?: boolean
  isMigratable?: boolean
  isRetired?: boolean
  isHidden?: boolean
}

export function VaultsListRow({
  currentVault,
  flags,
  hrefOverride,
  apyDisplayVariant = 'default',
  showBoostDetails = true,
  activeChains,
  activeCategories,
  onToggleChain,
  onToggleCategory,
  onToggleType,
  activeProductType,
  onToggleVaultType,
  showStrategies = false,
  shouldCollapseChips = false
}: {
  currentVault: TYDaemonVault
  flags?: TVaultRowFlags
  hrefOverride?: string
  apyDisplayVariant?: TVaultForwardAPYVariant
  showBoostDetails?: boolean
  activeChains?: number[]
  activeCategories?: string[]
  onToggleChain?: (chainId: number) => void
  onToggleCategory?: (category: string) => void
  onToggleType?: (type: string) => void
  activeProductType?: 'v3' | 'lp' | 'all'
  onToggleVaultType?: (type: 'v3' | 'lp') => void
  showStrategies?: boolean
  shouldCollapseChips?: boolean
}): ReactElement {
  const navigate = useNavigate()
  const href = hrefOverride ?? `/vaults/${currentVault.chainID}/${toAddress(currentVault.address)}`
  const network = getNetwork(currentVault.chainID)
  const chainLogoSrc = `${import.meta.env.VITE_BASE_YEARN_ASSETS_URI}/chains/${currentVault.chainID}/logo-32.png`
  const [isExpanded, setIsExpanded] = useState(false)
  const [expandedView, setExpandedView] = useState<TVaultsExpandedView>('apy')
  const [expandedTimeframe, setExpandedTimeframe] = useState<TVaultChartTimeframe>('all')
  const listKind = deriveListKind(currentVault)
  const isAllocatorVault = listKind === 'allocator' || listKind === 'strategy'
  const isLegacyVault = listKind === 'legacy'
  const productType = isAllocatorVault ? 'v3' : 'lp'
  const productTypeLabel = isAllocatorVault ? 'Single Asset Vault' : isLegacyVault ? 'Legacy' : 'LP Token Vault'
  const productTypeIcon = isAllocatorVault ? (
    <span className={'text-sm leading-none'}>{'⚙️'}</span>
  ) : isLegacyVault ? (
    <IconRewind className={'size-3.5'} />
  ) : (
    <span className={'text-sm leading-none'}>{'🏭'}</span>
  )
  const productTypeAriaLabel = isAllocatorVault
    ? 'Show single asset vaults'
    : isLegacyVault
      ? 'Legacy vault'
      : 'Show LP token vaults'
  const showProductTypeChip = Boolean(activeProductType) || Boolean(onToggleVaultType)
  const isProductTypeActive = activeProductType === productType
  const shouldCollapseProductTypeChip =
    !isLegacyVault && activeProductType !== 'all' && activeProductType === productType
  const isChipsCompressed = Boolean(shouldCollapseChips)
  const shouldCollapseProductType = isChipsCompressed || shouldCollapseProductTypeChip
  const showCollapsedTooltip = isChipsCompressed
  const leftColumnSpan = 'col-span-12'
  const rightColumnSpan = 'col-span-12'
  const rightGridColumns = 'md:grid-cols-12'
  const metricsColumnSpan = 'col-span-4'

  const isHiddenVault = Boolean(flags?.isHidden)
  const baseKindType =
    currentVault.kind === 'Multi Strategy' ? 'multi' : currentVault.kind === 'Single Strategy' ? 'single' : undefined
  const fallbackKindType = listKind === 'allocator' ? 'multi' : listKind === 'strategy' ? 'single' : undefined
  const kindType = baseKindType ?? fallbackKindType
  const kindLabel = kindType === 'multi' ? 'Allocator' : kindType === 'single' ? 'Strategy' : currentVault.kind
  const activeChainIds = activeChains ?? []
  const activeCategoryLabels = activeCategories ?? []
  const showKindChip = showStrategies && Boolean(kindType)
  const isKindActive = false
  const categoryIcon =
    currentVault.category === 'Stablecoin' ? (
      <IconStablecoin className={'size-3.5'} />
    ) : currentVault.category === 'Volatile' ? (
      <IconVolatile className={'size-3.5'} />
    ) : null
  const kindIcon =
    kindType === 'multi' ? (
      <IconCirclePile className={'size-3.5'} />
    ) : kindType === 'single' ? (
      <IconStack className={'size-3.5'} />
    ) : null
  const migratableIcon = <IconMigratable className={'size-3.5'} />
  const retiredIcon = <span className={'text-xs leading-none'}>{'⚠️'}</span>
  const tvlNativeTooltip = (
    <div className={'rounded-xl border border-border bg-surface-secondary p-2 text-xs text-text-primary'}>
      <span className={'font-number'}>
        <RenderAmount
          value={Number(toNormalizedBN(currentVault.tvl.totalAssets, currentVault.token.decimals).normalized)}
          symbol={''}
          decimals={6}
          shouldFormatDust
          options={{
            shouldCompactValue: true,
            maximumFractionDigits: 2,
            minimumFractionDigits: 2
          }}
        />
      </span>
      <span className={'pl-1'}>{currentVault.token.symbol}</span>
    </div>
  )

  useEffect(() => {
    if (isExpanded) {
      setExpandedView('apy')
    }
  }, [isExpanded])

  return (
    <div className={cl('w-full overflow-hidden transition-colors bg-surface relative')}>
      <button
        type={'button'}
        aria-label={isExpanded ? 'Collapse row' : 'Expand row'}
        aria-expanded={isExpanded}
        onClick={(event): void => {
          event.stopPropagation()
          setIsExpanded((value) => !value)
        }}
        className={cl(
          'absolute top-5 right-5 z-20 hidden md:flex size-9 items-center justify-center rounded-full border border-white/30 bg-app text-text-secondary transition-colors duration-150',
          'hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400'
        )}
      >
        <IconChevron className={'size-4'} direction={isExpanded ? 'up' : 'down'} />
      </button>
      <Link
        href={href}
        className={cl(
          'grid w-full grid-cols-1 md:grid-cols-24 bg-surface',
          'p-6 pt-2 pb-4 md:pr-20',
          'cursor-pointer relative group'
        )}
        onClickCapture={(event): void => {
          const target = event.target as HTMLElement | null
          if (!target) return
          if (target.closest('button, input, select, textarea, [role="button"]')) {
            event.preventDefault()
          }
        }}
      >
        <div
          className={cl(
            'absolute inset-0',
            'opacity-0 transition-opacity duration-300 group-hover:opacity-20 group-focus-visible:opacity-20 pointer-events-none',
            'bg-[linear-gradient(80deg,#2C3DA6,#D21162)]'
          )}
        />

        <div className={cl(leftColumnSpan, 'z-10', 'flex flex-row items-center justify-between sm:pt-0')}>
          <div className={'flex flex-row w-full gap-4 overflow-visible'}>
            <div className={'relative flex items-center justify-center self-center size-8 min-h-8 min-w-8'}>
              <TokenLogo
                src={`${import.meta.env.VITE_BASE_YEARN_ASSETS_URI}/tokens/${
                  currentVault.chainID
                }/${currentVault.token.address.toLowerCase()}/logo-128.png`}
                tokenSymbol={currentVault.token.symbol || ''}
                width={32}
                height={32}
              />
              <div
                className={
                  'absolute -bottom-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full border border-border bg-surface md:hidden'
                }
              >
                <TokenLogo src={chainLogoSrc} tokenSymbol={network.name} width={12} height={12} />
              </div>
            </div>
            <div className={'min-w-0 flex-1'}>
              <strong
                title={currentVault.name}
                className={'block truncate font-black text-text-primary md:-mb-0.5 text-lg'}
              >
                {currentVault.name}
              </strong>
              <div className={'mt-1 flex items-center gap-1 text-xs text-text-primary/70 whitespace-nowrap'}>
                <div className={'hidden md:block'}>
                  <VaultsListChip
                    label={network.name}
                    icon={<TokenLogo src={chainLogoSrc} tokenSymbol={network.name} width={14} height={14} />}
                    isActive={activeChainIds.includes(currentVault.chainID)}
                    isCollapsed={isChipsCompressed}
                    showCollapsedTooltip={showCollapsedTooltip}
                    onClick={onToggleChain ? (): void => onToggleChain(currentVault.chainID) : undefined}
                    ariaLabel={`Filter by ${network.name}`}
                  />
                </div>
                {currentVault.category ? (
                  <VaultsListChip
                    label={currentVault.category}
                    icon={categoryIcon}
                    isActive={activeCategoryLabels.includes(currentVault.category)}
                    isCollapsed={isChipsCompressed}
                    showCollapsedTooltip={showCollapsedTooltip}
                    onClick={onToggleCategory ? (): void => onToggleCategory(currentVault.category) : undefined}
                    ariaLabel={`Filter by ${currentVault.category}`}
                  />
                ) : null}
                {showProductTypeChip ? (
                  <VaultsListChip
                    label={productTypeLabel}
                    icon={productTypeIcon}
                    isActive={isProductTypeActive}
                    isCollapsed={shouldCollapseProductType}
                    showCollapsedTooltip={showCollapsedTooltip}
                    onClick={onToggleVaultType ? (): void => onToggleVaultType(productType) : undefined}
                    ariaLabel={productTypeAriaLabel}
                  />
                ) : null}
                {showKindChip && kindLabel ? (
                  <VaultsListChip
                    label={kindLabel}
                    icon={kindIcon}
                    isActive={isKindActive}
                    isCollapsed={isChipsCompressed}
                    showCollapsedTooltip={showCollapsedTooltip}
                    onClick={kindType && onToggleType ? (): void => onToggleType(kindType) : undefined}
                    ariaLabel={`Filter by ${kindLabel}`}
                  />
                ) : null}
                {flags?.isRetired ? (
                  <VaultsListChip
                    label={'Retired'}
                    icon={retiredIcon}
                    isCollapsed={isChipsCompressed}
                    showCollapsedTooltip={showCollapsedTooltip}
                  />
                ) : null}
                {flags?.isMigratable ? (
                  <VaultsListChip
                    label={'Migratable'}
                    icon={migratableIcon}
                    isCollapsed={isChipsCompressed}
                    showCollapsedTooltip={showCollapsedTooltip}
                  />
                ) : null}
                {isHiddenVault ? (
                  <VaultsListChip
                    label={'Hidden'}
                    icon={<IconEyeOff className={'size-3.5'} />}
                    isCollapsed={isChipsCompressed}
                    showCollapsedTooltip={showCollapsedTooltip}
                  />
                ) : null}
              </div>
            </div>
            {/* Mobile Holdings + APY + TVL inline */}
            <div className={'hidden max-md:flex items-center shrink-0 gap-4 text-right'}>
              {/* Holdings - shown on wider mobile screens */}
              {flags?.hasHoldings ? (
                <div className={'hidden min-[420px]:block'}>
                  <p className={'text-xs text-text-primary/60'}>{'Holdings'}</p>
                  <VaultHoldingsAmount currentVault={currentVault} valueClassName={'text-sm font-semibold'} />
                </div>
              ) : null}
              <div>
                <p className={'text-xs text-text-primary/60'}>{'Est. APY'}</p>
                <VaultForwardAPY
                  currentVault={currentVault}
                  valueClassName={'text-sm font-semibold'}
                  showSubline={false}
                />
              </div>
              <div className={'relative'}>
                <p className={'text-xs text-text-primary/60'}>{'TVL'}</p>
                <p className={'text-sm font-semibold text-text-primary'}>
                  <RenderAmount
                    value={currentVault.tvl?.tvl}
                    symbol={'USD'}
                    decimals={0}
                    options={{
                      shouldCompactValue: true,
                      maximumFractionDigits: 2,
                      minimumFractionDigits: 0
                    }}
                  />
                </p>
                {/* Holdings indicator dot - shown on narrow screens when user has holdings */}
                {flags?.hasHoldings ? (
                  <div
                    className={'absolute -right-2 top-0 size-2 rounded-full bg-green-500 min-[420px]:hidden'}
                    title={'You have holdings in this vault'}
                  />
                ) : null}
              </div>
            </div>
          </div>
        </div>

        {/* Desktop metrics grid */}
        <div
          className={cl(rightColumnSpan, 'z-10 gap-4 mt-4', 'hidden md:mt-0 md:grid md:items-center', rightGridColumns)}
        >
          <div className={cl('yearn--table-data-section-item', metricsColumnSpan)} datatype={'number'}>
            <VaultForwardAPY
              currentVault={currentVault}
              showSubline={false}
              showSublineTooltip
              displayVariant={apyDisplayVariant}
              showBoostDetails={showBoostDetails}
            />
          </div>
          {/* TVL */}
          <div className={cl('yearn--table-data-section-item', metricsColumnSpan)} datatype={'number'}>
            <div className={'flex justify-end text-right'}>
              <Tooltip
                className={'tvl-subline-tooltip gap-0 h-auto md:justify-end'}
                openDelayMs={150}
                toggleOnClick={false}
                tooltip={tvlNativeTooltip}
              >
                <p className={'yearn--table-data-section-item-value'}>
                  <RenderAmount
                    value={currentVault.tvl?.tvl}
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
          </div>
          <div className={cl('yearn--table-data-section-item', metricsColumnSpan)} datatype={'number'}>
            <VaultHoldingsAmount currentVault={currentVault} />
          </div>
        </div>
      </Link>

      {isExpanded ? (
        <Suspense fallback={<ExpandedRowFallback />}>
          <VaultsListRowExpandedContent
            currentVault={currentVault}
            expandedView={expandedView}
            expandedTimeframe={expandedTimeframe}
            onExpandedViewChange={setExpandedView}
            onExpandedTimeframeChange={setExpandedTimeframe}
            onNavigateToVault={() => navigate(href)}
          />
        </Suspense>
      ) : null}
    </div>
  )
}
