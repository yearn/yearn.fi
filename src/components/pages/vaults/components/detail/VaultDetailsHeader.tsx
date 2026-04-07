import { VaultsListChip } from '@pages/vaults/components/list/VaultsListChip'
import { VaultForwardAPY } from '@pages/vaults/components/table/VaultForwardAPY'
import { VaultHistoricalAPY } from '@pages/vaults/components/table/VaultHistoricalAPY'
import { VaultTVL } from '@pages/vaults/components/table/VaultTVL'
import { WidgetTabs } from '@pages/vaults/components/widget'
import { YvUsdApyTooltipContent, YvUsdTvlTooltipContent } from '@pages/vaults/components/yvUSD/YvUsdBreakdown'
import { YvUsdHeaderBanner } from '@pages/vaults/components/yvUSD/YvUsdHeaderBanner'
import { getVaultView, getVaultYieldSplitter, type TKongVaultInput } from '@pages/vaults/domain/kongVaultSelectors'
import { useHeaderCompression } from '@pages/vaults/hooks/useHeaderCompression'
import { useVaultUserData } from '@pages/vaults/hooks/useVaultUserData'
import { useYvUsdVaults } from '@pages/vaults/hooks/useYvUsdVaults'
import { getYvUsdTvlBreakdown } from '@pages/vaults/hooks/useYvUsdVaults.helpers'
import type { WidgetActionType } from '@pages/vaults/types'
import { deriveListKind } from '@pages/vaults/utils/vaultListFacets'
import { getVaultPrimaryLogoSrc } from '@pages/vaults/utils/vaultLogo'
import {
  getCategoryDescription,
  getChainDescription,
  getKindDescription,
  getProductTypeDescription,
  MIGRATABLE_TAG_DESCRIPTION,
  RETIRED_TAG_DESCRIPTION
} from '@pages/vaults/utils/vaultTagCopy'
import {
  getYvUsdInfinifiPointsNote,
  getYvUsdSharePrice,
  isYvUsdVault,
  type TYvUsdVariant,
  YVUSD_CHAIN_ID,
  YVUSD_LOCKED_ADDRESS,
  YVUSD_UNLOCKED_ADDRESS
} from '@pages/vaults/utils/yvUsd'
import {
  METRIC_FOOTNOTE_CLASS,
  METRIC_VALUE_CLASS,
  MetricHeader,
  MetricsCard,
  type TMetricBlock
} from '@shared/components/MetricsCard'
import { RenderAmount } from '@shared/components/RenderAmount'
import { TokenLogo } from '@shared/components/TokenLogo'
import { Tooltip } from '@shared/components/Tooltip'
import { useWeb3 } from '@shared/contexts/useWeb3'
import { useYearn } from '@shared/contexts/useYearn'
import { IconInfinifiPoints } from '@shared/icons/IconInfinifiPoints'
import { IconLinkOut } from '@shared/icons/IconLinkOut'
import { IconLock } from '@shared/icons/IconLock'
import { IconLockOpen } from '@shared/icons/IconLockOpen'
import { cl, formatApyDisplay, formatUSD, isZero, SELECTOR_BAR_STYLES, toAddress, toNormalizedBN } from '@shared/utils'
import { getVaultName } from '@shared/utils/helpers'
import { getNetwork } from '@shared/utils/wagmi/utils'
import type { ReactElement, Ref } from 'react'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'

type TVaultKindType = 'multi' | 'single' | 'route' | undefined

function noop(): void {}

function noopWidgetModeChange(_mode: WidgetActionType): void {}

function noopSelectSection(_key: string): void {}

function getVaultProductTypeLabel(listKind: ReturnType<typeof deriveListKind>): string {
  if (listKind === 'yieldSplitter') {
    return 'Yield Splitter'
  }

  if (listKind === 'allocator' || listKind === 'strategy') {
    return 'Single Asset'
  }

  if (listKind === 'legacy') {
    return 'Legacy'
  }

  return 'LP Token'
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

function getVaultLogoSize({ isCompressed, isYvUsd }: { isCompressed: boolean; isYvUsd: boolean }): number {
  if (isYvUsd) {
    return 40
  }

  return isCompressed ? 32 : 40
}

function getVaultLogoContainerSizeClassName({
  isCompressed,
  isYvUsd
}: {
  isCompressed: boolean
  isYvUsd: boolean
}): string {
  if (isYvUsd || !isCompressed) {
    return 'size-10'
  }

  return 'size-8'
}

function getYvUsdHistoricalValue(monthAgo: number, weekAgo: number): number {
  return isZero(monthAgo) ? weekAgo : monthAgo
}

function VaultHeaderIdentity({
  currentVault: currentVaultInput,
  isCompressed,
  className,
  includeTourAttributes = true
}: {
  currentVault: TKongVaultInput
  isCompressed: boolean
  className?: string
  includeTourAttributes?: boolean
}): ReactElement {
  const currentVault = getVaultView(currentVaultInput)
  const chainName = getNetwork(currentVault.chainID).name
  const isYvUsd = isYvUsdVault(currentVault)
  const tokenLogoSrc = getVaultPrimaryLogoSrc(currentVault)
  const chainLogoSrc = `${import.meta.env.VITE_BASE_YEARN_ASSETS_URI}/chains/${currentVault.chainID}/logo-32.png`
  const explorerBase = getNetwork(currentVault.chainID).defaultBlockExplorer
  const explorerHref = explorerBase ? `${explorerBase}/address/${currentVault.address}` : ''
  const showChainChip = !isCompressed
  const showCategoryChip = Boolean(currentVault.category)
  const listKind = deriveListKind(currentVault)
  const productTypeLabel = getVaultProductTypeLabel(listKind)
  const kindType = getVaultKindType(currentVault.kind, listKind)
  const kindLabel = getVaultKindLabel(kindType, currentVault.kind)
  const yieldSplitter = getVaultYieldSplitter(currentVault)
  const yieldSplitterRouteLabel =
    yieldSplitter && (yieldSplitter.sourceVaultSymbol || yieldSplitter.wantVaultSymbol)
      ? `${yieldSplitter.sourceVaultSymbol || yieldSplitter.sourceVaultName} -> ${yieldSplitter.wantVaultSymbol || yieldSplitter.wantVaultName}`
      : ''
  const chainDescription = getChainDescription(currentVault.chainID)
  const categoryDescription = getCategoryDescription(currentVault.category)
  const productTypeDescription = getProductTypeDescription(listKind)
  const kindDescription = getKindDescription(kindType, kindLabel)
  const isMigratable = Boolean(currentVault.migration?.available)
  const isRetired = Boolean(currentVault.info?.isRetired)
  const retiredIcon = <span className={'text-xs leading-none'}>{'⚠️'}</span>
  const showKindChip = Boolean(kindLabel)
  const shouldShowMetadata =
    showChainChip || showCategoryChip || showKindChip || Boolean(productTypeLabel) || isMigratable || isRetired
  const [isTitleClipped, setIsTitleClipped] = useState(false)
  const titleRef = useRef<HTMLSpanElement>(null)
  const vaultName = getVaultName(currentVault)
  const tokenLogoSize = getVaultLogoSize({ isCompressed, isYvUsd })
  const tokenLogoContainerSizeClassName = getVaultLogoContainerSizeClassName({ isCompressed, isYvUsd })

  useEffect(() => {
    // Preload chain logo so it appears instantly when the chip mounts
    const preload = new Image()
    preload.src = chainLogoSrc
  }, [chainLogoSrc])

  useEffect(() => {
    if (!isCompressed) {
      setIsTitleClipped(false)
      return
    }

    const measure = (): void => {
      if (!titleRef.current) return
      setIsTitleClipped(titleRef.current.scrollWidth > titleRef.current.clientWidth)
    }

    measure()
    window.addEventListener('resize', measure)

    return () => {
      window.removeEventListener('resize', measure)
    }
  }, [isCompressed])

  return (
    <div
      className={cl('flex flex-col gap-1 px-1 mt-0', isCompressed ? 'md:justify-center' : 'pt-4', className)}
      data-tour={includeTourAttributes ? 'vault-detail-title' : undefined}
    >
      <div className={cl('flex items-center', isCompressed ? 'gap-2' : ' gap-4')}>
        <div
          className={cl(
            'relative flex items-center justify-start rounded-full bg-surface/70',
            tokenLogoContainerSizeClassName
          )}
        >
          <TokenLogo
            src={tokenLogoSrc}
            tokenSymbol={currentVault.token.symbol || ''}
            width={tokenLogoSize}
            height={tokenLogoSize}
          />
          {isCompressed ? (
            <div
              className={
                'absolute -bottom-1 -left-1 flex size-4 items-center justify-center rounded-full border border-border bg-surface'
              }
            >
              <TokenLogo src={chainLogoSrc} tokenSymbol={chainName} width={16} height={16} />
            </div>
          ) : null}
        </div>
        <div className={'flex flex-col'}>
          <div className={cl('flex items-center gap-3', isCompressed && isTitleClipped ? 'relative group' : '')}>
            <strong
              ref={titleRef}
              className={cl(
                'text-lg font-black leading-tight md:text-3xl md:leading-10 text-text-primary',
                isCompressed ? 'md:text-[30px] md:leading-9 max-w-[260px] truncate whitespace-nowrap' : ''
              )}
            >
              {vaultName}
            </strong>
            {isCompressed && isTitleClipped ? (
              <span
                className={
                  'pointer-events-none absolute left-0 top-1/2 z-20 hidden -translate-y-1/2 whitespace-nowrap rounded-md bg-app px-0 py-0 text-[30px] font-black leading-tight text-text-primary group-hover:block'
                }
              >
                {vaultName}
              </span>
            ) : null}
            {!isCompressed && explorerHref ? (
              <a
                href={explorerHref}
                target={'_blank'}
                rel={'noopener noreferrer'}
                className={'text-text-secondary hover:text-text-primary transition-colors h-7 content-end'}
                aria-label={'View vault on block explorer'}
              >
                <IconLinkOut className={'size-4 md:size-4'} />
              </a>
            ) : null}
          </div>
          {!isCompressed && yieldSplitterRouteLabel ? (
            <span className="mt-1 text-sm text-text-secondary">{yieldSplitterRouteLabel}</span>
          ) : null}
        </div>
      </div>
      {shouldShowMetadata ? (
        <div
          className={cl(
            'flex flex-wrap items-center gap-1 text-xs text-text-primary/70 md:text-xs pt-1',
            isCompressed ? 'hidden' : ''
          )}
        >
          {showChainChip ? (
            <VaultsListChip
              label={chainName}
              icon={<TokenLogo src={chainLogoSrc} tokenSymbol={chainName} width={14} height={14} priority />}
              showIconInChip={false}
              isCollapsed={isCompressed}
              showCollapsedTooltip={isCompressed}
              tooltipDescription={chainDescription}
            />
          ) : null}
          {showCategoryChip ? (
            <VaultsListChip
              label={currentVault.category || ''}
              isCollapsed={isCompressed}
              showCollapsedTooltip={isCompressed}
              tooltipDescription={categoryDescription || undefined}
            />
          ) : null}
          <VaultsListChip
            label={productTypeLabel}
            isCollapsed={isCompressed}
            showCollapsedTooltip={isCompressed}
            tooltipDescription={productTypeDescription}
          />
          {showKindChip && kindLabel ? (
            <VaultsListChip
              label={kindLabel}
              isCollapsed={isCompressed}
              showCollapsedTooltip={isCompressed}
              tooltipDescription={kindDescription}
            />
          ) : null}
          {yieldSplitterRouteLabel ? (
            <VaultsListChip
              label={yieldSplitterRouteLabel}
              isCollapsed={isCompressed}
              showCollapsedTooltip={isCompressed}
              tooltipDescription={yieldSplitter?.uiDescription || undefined}
            />
          ) : null}
          {isRetired ? (
            <VaultsListChip
              label={'Retired'}
              icon={retiredIcon}
              isCollapsed={isCompressed}
              showCollapsedTooltip={isCompressed}
              tooltipDescription={RETIRED_TAG_DESCRIPTION}
            />
          ) : null}
          {isMigratable ? (
            <VaultsListChip
              label={'Migratable'}
              isCollapsed={isCompressed}
              showCollapsedTooltip={isCompressed}
              tooltipDescription={MIGRATABLE_TAG_DESCRIPTION}
            />
          ) : null}
          {isCompressed && explorerHref ? (
            <a
              href={explorerHref}
              target={'_blank'}
              rel={'noopener noreferrer'}
              className={
                'inline-flex items-center justify-center px-2 py-1 text-text-secondary hover:text-text-primary transition-colors'
              }
              aria-label={'View vault on block explorer'}
            >
              <IconLinkOut className={'size-4'} />
            </a>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function SectionSelectorBar({
  activeSectionKey,
  onSelectSection,
  sectionSelectorRef,
  sectionTabs,
  isCompressed,
  includeTourAttributes = true
}: {
  activeSectionKey?: string
  onSelectSection?: (key: string) => void
  sectionSelectorRef?: Ref<HTMLDivElement>
  sectionTabs: { key: string; label: string }[]
  isCompressed: boolean
  includeTourAttributes?: boolean
}): ReactElement {
  return (
    <div
      className={'flex flex-wrap gap-2 md:gap-3 w-full'}
      ref={sectionSelectorRef}
      data-tour={includeTourAttributes ? 'vault-detail-section-nav' : undefined}
    >
      <div
        className={cl(
          'flex w-full flex-wrap justify-between gap-2 rounded-b-lg border-border bg-surface-secondary p-1',
          isCompressed ? 'border-t' : 'border-x border-b'
        )}
      >
        {sectionTabs.map((section) => (
          <button
            key={section.key}
            type={'button'}
            onClick={(): void => {
              if (!isCompressed && section.key === 'charts') {
                return
              }
              onSelectSection?.(section.key)
            }}
            className={cl(
              'flex-1 rounded-md px-2 py-2 text-xs font-semibold transition-all md:px-4 md:py-2.5',
              SELECTOR_BAR_STYLES.buttonBase,
              'min-h-9 active:scale-[0.98] truncate',
              activeSectionKey === section.key ? SELECTOR_BAR_STYLES.buttonActive : SELECTOR_BAR_STYLES.buttonInactive
            )}
            aria-disabled={!isCompressed && section.key === 'charts'}
          >
            {section.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function VaultOverviewCard({
  currentVault: currentVaultInput,
  isCompressed,
  includeTourAttributes = true,
  yvUsdApyVariant: controlledYvUsdApyVariant,
  onYvUsdApyVariantChange
}: {
  currentVault: TKongVaultInput
  isCompressed: boolean
  includeTourAttributes?: boolean
  yvUsdApyVariant?: TYvUsdVariant
  onYvUsdApyVariantChange?: (variant: TYvUsdVariant) => void
}): ReactElement {
  const currentVault = getVaultView(currentVaultInput)
  const totalAssets = toNormalizedBN(currentVault.tvl.totalAssets, currentVault.decimals).normalized
  const listKind = deriveListKind(currentVault)
  const isFactoryVault = listKind === 'factory'
  const isYvUsd = isYvUsdVault(currentVault)
  const [internalYvUsdApyVariant, setInternalYvUsdApyVariant] = useState<TYvUsdVariant>('locked')
  const { metrics: yvUsdMetrics, unlockedVault, lockedVault } = useYvUsdVaults()
  const isControlledYvUsdApyVariant = controlledYvUsdApyVariant !== undefined
  const yvUsdApyVariant = isControlledYvUsdApyVariant ? controlledYvUsdApyVariant : internalYvUsdApyVariant
  const unlockedForwardApy =
    yvUsdMetrics?.unlocked.apy ?? (currentVault.apr?.forwardAPR?.netAPR || currentVault.apr?.netAPR || 0)
  const lockedForwardApy = yvUsdMetrics?.locked.apy ?? lockedVault?.apr?.forwardAPR?.netAPR ?? 0
  const unlockedMonthly = unlockedVault?.apr?.points?.monthAgo ?? currentVault.apr.points.monthAgo
  const unlockedWeekly = unlockedVault?.apr?.points?.weekAgo ?? currentVault.apr.points.weekAgo
  const unlockedHistorical = getYvUsdHistoricalValue(unlockedMonthly, unlockedWeekly)
  const lockedMonthly = lockedVault?.apr?.points?.monthAgo ?? 0
  const lockedWeekly = lockedVault?.apr?.points?.weekAgo ?? 0
  const lockedHistorical = getYvUsdHistoricalValue(lockedMonthly, lockedWeekly)
  const totalTvl = currentVault.tvl?.tvl ?? unlockedVault?.tvl?.tvl ?? yvUsdMetrics?.unlocked.tvl ?? 0
  const lockedTvl = lockedVault?.tvl?.tvl ?? yvUsdMetrics?.locked.tvl ?? 0
  const tvlBreakdown = getYvUsdTvlBreakdown({ totalTvl, lockedTvl })
  const unlockedTvl = tvlBreakdown.unlockedTvl
  const combinedTvl = tvlBreakdown.totalTvl
  const isLockedApyVariant = yvUsdApyVariant === 'locked'
  const selectedForwardApy = isLockedApyVariant ? lockedForwardApy : unlockedForwardApy
  const selectedHistoricalApy = isLockedApyVariant ? lockedHistorical : unlockedHistorical
  const hasInfinifiPoints = Boolean(yvUsdMetrics?.locked.hasInfinifiPoints || yvUsdMetrics?.unlocked.hasInfinifiPoints)
  const infinifiPointsNote = hasInfinifiPoints ? getYvUsdInfinifiPointsNote() : undefined
  const selectedApyIcon = isLockedApyVariant ? (
    <IconLock className="size-4 text-text-secondary" />
  ) : (
    <IconLockOpen className="size-4 text-text-secondary" />
  )
  const apyToggleLabel = isLockedApyVariant ? 'Switch to unlocked APY display' : 'Switch to locked APY display'
  const toggleApyVariant = (): void => {
    const nextVariant = yvUsdApyVariant === 'locked' ? 'unlocked' : 'locked'
    if (isControlledYvUsdApyVariant) {
      onYvUsdApyVariantChange?.(nextVariant)
      return
    }
    setInternalYvUsdApyVariant(nextVariant)
  }
  const renderYvUsdApyValue = (value: number): ReactElement => (
    <span className={cl('inline-flex items-center gap-2', METRIC_VALUE_CLASS)}>
      <button
        type="button"
        onClick={toggleApyVariant}
        aria-label={apyToggleLabel}
        className="inline-flex items-center rounded-sm text-text-secondary transition-colors hover:text-text-primary"
      >
        {selectedApyIcon}
      </button>
      {hasInfinifiPoints ? <IconInfinifiPoints className="size-3.5 shrink-0" aria-label="Infinifi points" /> : null}
      {formatApyDisplay(value)}
    </span>
  )
  const yvUsdEstApyTooltip = isYvUsd ? (
    <YvUsdApyTooltipContent
      lockedValue={lockedForwardApy}
      unlockedValue={unlockedForwardApy}
      iconClassName="size-4"
      infinifiPointsNote={infinifiPointsNote}
    />
  ) : undefined
  const yvUsdHistoricalApyTooltip = isYvUsd ? (
    <YvUsdApyTooltipContent
      lockedValue={lockedHistorical}
      unlockedValue={unlockedHistorical}
      iconClassName="size-4"
      infinifiPointsNote={infinifiPointsNote}
    />
  ) : undefined
  const yvUsdTvlTooltip = isYvUsd ? (
    <YvUsdTvlTooltipContent
      lockedValue={lockedTvl}
      unlockedValue={unlockedTvl}
      className="border-0 bg-transparent p-0"
      iconClassName="size-4"
    />
  ) : undefined
  const metrics: TMetricBlock[] = [
    {
      key: 'est-apy',
      header: <MetricHeader label={'Est. APY'} tooltip={'Projected APY based on underlying markets'} />,
      value: isYvUsd ? (
        <Tooltip className={'gap-0 h-auto'} openDelayMs={150} tooltip={yvUsdEstApyTooltip ?? ''} align={'center'}>
          {renderYvUsdApyValue(selectedForwardApy)}
        </Tooltip>
      ) : (
        <VaultForwardAPY
          currentVault={currentVault}
          showSubline={false}
          showSublineTooltip
          className={'items-start text-left'}
          valueClassName={METRIC_VALUE_CLASS}
        />
      )
    },
    {
      key: 'historical-apy',
      header: <MetricHeader label={'30 Day APY'} tooltip={'Average realized APY over the previous 30 days'} />,
      value: isYvUsd ? (
        <Tooltip
          className={'gap-0 h-auto'}
          openDelayMs={150}
          tooltip={yvUsdHistoricalApyTooltip ?? ''}
          align={'center'}
        >
          {renderYvUsdApyValue(selectedHistoricalApy)}
        </Tooltip>
      ) : (
        <VaultHistoricalAPY
          currentVault={currentVault}
          showSublineTooltip
          showBoostDetails={!isFactoryVault}
          className={'items-start text-left'}
          valueClassName={METRIC_VALUE_CLASS}
        />
      )
    },
    {
      key: 'tvl',
      header: <MetricHeader label={'TVL'} tooltip={'Total value currently deposited into this vault'} />,
      value: isYvUsd ? (
        <span className={METRIC_VALUE_CLASS}>
          <RenderAmount
            value={combinedTvl || 0}
            symbol={'USD'}
            decimals={0}
            options={{
              shouldCompactValue: true,
              maximumFractionDigits: 2,
              minimumFractionDigits: 0
            }}
          />
        </span>
      ) : (
        <VaultTVL currentVault={currentVault} valueClassName={METRIC_VALUE_CLASS} />
      ),
      footnote: isYvUsd ? (
        yvUsdTvlTooltip
      ) : (
        <p className={METRIC_FOOTNOTE_CLASS} suppressHydrationWarning>
          <RenderAmount
            value={Number(totalAssets)}
            symbol={currentVault.token.symbol}
            decimals={currentVault.decimals}
            shouldFormatDust
            options={{
              shouldDisplaySymbol: false,
              maximumFractionDigits: Number(totalAssets) > 1000 ? 2 : 4
            }}
          />
          <span className={'pl-1'}>{currentVault.token.symbol || 'tokens'}</span>
        </p>
      )
    }
  ]

  return (
    <div data-tour={includeTourAttributes ? 'vault-detail-overview' : undefined}>
      <MetricsCard
        items={metrics}
        className={cl(
          'rounded-b-none',
          isCompressed ? 'border-l border-border rounded-l-none' : 'border border-border'
        )}
        footnoteDisplay={'tooltip'}
      />
    </div>
  )
}

function YvUsdUserHoldingsCard({
  isCompressed,
  includeTourAttributes = true
}: {
  isCompressed: boolean
  includeTourAttributes?: boolean
}): ReactElement {
  const { address } = useWeb3()
  const { getPrice } = useYearn()
  const { unlockedVault, lockedVault } = useYvUsdVaults()
  const account = address ? toAddress(address) : undefined
  const unlockedAssetAddress = toAddress(unlockedVault?.token.address ?? YVUSD_UNLOCKED_ADDRESS)

  const unlockedUserData = useVaultUserData({
    vaultAddress: toAddress(unlockedVault?.address ?? YVUSD_UNLOCKED_ADDRESS),
    assetAddress: unlockedAssetAddress,
    chainId: YVUSD_CHAIN_ID,
    account
  })
  const lockedUserData = useVaultUserData({
    vaultAddress: toAddress(lockedVault?.address ?? YVUSD_LOCKED_ADDRESS),
    assetAddress: YVUSD_UNLOCKED_ADDRESS,
    chainId: YVUSD_CHAIN_ID,
    account
  })

  const unlockedAmount = toNormalizedBN(
    unlockedUserData.depositedValue,
    unlockedUserData.assetToken?.decimals ?? 6
  ).normalized
  const lockedAmount = toNormalizedBN(
    lockedUserData.depositedValue,
    lockedUserData.assetToken?.decimals ?? 18
  ).normalized
  const unlockedAssetPrice =
    getPrice({ address: unlockedAssetAddress, chainID: YVUSD_CHAIN_ID }).normalized || unlockedVault?.tvl.price || 0
  const unlockedSharePrice = getYvUsdSharePrice(unlockedVault, unlockedAssetPrice)
  const unlockedValueUsd = unlockedAmount * unlockedAssetPrice
  const lockedValueUsd = lockedAmount * unlockedSharePrice
  const totalValueUsd = unlockedValueUsd + lockedValueUsd

  const sections: TMetricBlock[] = [
    {
      key: 'deposited',
      header: (
        <MetricHeader
          label={'Your Deposits'}
          tooltip={'Review the USD value of everything you have supplied to this vault so far.'}
        />
      ),
      value: (
        <span className={METRIC_VALUE_CLASS} suppressHydrationWarning>
          {formatUSD(totalValueUsd)}
        </span>
      ),
      footnote: (
        <div className={cl(METRIC_FOOTNOTE_CLASS, 'flex flex-col gap-1')} suppressHydrationWarning>
          <div className="flex items-center justify-between gap-4">
            <span className="inline-flex items-center gap-2 text-text-secondary">
              <IconLock className="size-3" />
              {'Locked Deposits'}
            </span>
            <RenderAmount
              value={lockedValueUsd}
              symbol={'USD'}
              decimals={0}
              options={{ maximumFractionDigits: 2, minimumFractionDigits: 2 }}
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="inline-flex items-center gap-2 text-text-secondary">
              <IconLockOpen className="size-3" />
              {'Unlocked Deposits'}
            </span>
            <RenderAmount
              value={unlockedValueUsd}
              symbol={'USD'}
              decimals={0}
              options={{ maximumFractionDigits: 2, minimumFractionDigits: 2 }}
            />
          </div>
        </div>
      )
    }
  ]

  return (
    <div data-tour={includeTourAttributes ? 'vault-detail-user-holdings' : undefined}>
      <MetricsCard
        items={sections}
        className={cl(
          'rounded-b-none',
          isCompressed ? 'rounded-tl-lg border-t border-x border-border' : 'border-t border-x border-border'
        )}
        footnoteDisplay={'tooltip'}
      />
    </div>
  )
}

function UserHoldingsCard({
  currentVault: currentVaultInput,
  depositedValue,
  tokenPrice,
  isCompressed,
  includeTourAttributes = true
}: {
  currentVault: TKongVaultInput
  depositedValue: bigint
  tokenPrice: number
  isCompressed: boolean
  includeTourAttributes?: boolean
}): ReactElement {
  const currentVault = getVaultView(currentVaultInput)
  if (isYvUsdVault(currentVault)) {
    return <YvUsdUserHoldingsCard isCompressed={isCompressed} includeTourAttributes={includeTourAttributes} />
  }

  const depositedAmount = toNormalizedBN(depositedValue, currentVault.token.decimals)
  const depositedValueUSD = depositedAmount.normalized * tokenPrice
  const sections: TMetricBlock[] = [
    {
      key: 'deposited',
      header: (
        <MetricHeader
          label={'Your Deposits'}
          tooltip={'Review the USD value of everything you have supplied to this vault so far.'}
        />
      ),
      value: (
        <span className={METRIC_VALUE_CLASS} suppressHydrationWarning>
          {formatUSD(depositedValueUSD)}
        </span>
      ),
      footnote: (
        <p className={METRIC_FOOTNOTE_CLASS} suppressHydrationWarning>
          <RenderAmount
            value={Number(depositedAmount.normalized)}
            symbol={currentVault.token.symbol}
            decimals={currentVault.token.decimals}
            shouldFormatDust
            options={{
              shouldDisplaySymbol: false,
              maximumFractionDigits: Number(depositedAmount.normalized) > 1000 ? 2 : 4
            }}
          />
          <span className={'pl-1'}>{currentVault.token.symbol || 'tokens'}</span>
        </p>
      )
    }
  ]

  return (
    <div data-tour={includeTourAttributes ? 'vault-detail-user-holdings' : undefined}>
      <MetricsCard
        items={sections}
        className={cl(
          'rounded-b-none',
          isCompressed ? 'rounded-tl-lg border-t border-x border-border' : 'border-t border-x border-border'
        )}
        footnoteDisplay={'tooltip'}
      />
    </div>
  )
}

type TVaultDetailsHeaderBaseProps = {
  currentVault: TKongVaultInput
  depositedValue: bigint
  yvUsdApyVariant?: TYvUsdVariant
  sectionTabs?: { key: string; label: string }[]
  activeSectionKey?: string
  onSelectSection?: (key: string) => void
  sectionSelectorRef?: Ref<HTMLDivElement>
  widgetActions?: WidgetActionType[]
  widgetMode?: WidgetActionType
  onWidgetModeChange?: (mode: WidgetActionType) => void
  onYvUsdApyVariantChange?: (variant: TYvUsdVariant) => void
  onWidgetWalletOpen?: () => void
  isWidgetWalletOpen?: boolean
  onWidgetCloseOverlays?: () => void
}

type TVaultDetailsHeaderPresentationProps = TVaultDetailsHeaderBaseProps & {
  isCompressed: boolean
  includeTourAttributes?: boolean
}

export function VaultDetailsHeaderPresentation({
  currentVault: currentVaultInput,
  depositedValue,
  yvUsdApyVariant,
  sectionTabs = [],
  activeSectionKey,
  onSelectSection,
  sectionSelectorRef,
  widgetActions = [],
  widgetMode,
  onWidgetModeChange,
  onYvUsdApyVariantChange,
  onWidgetWalletOpen,
  isWidgetWalletOpen,
  onWidgetCloseOverlays,
  isCompressed,
  includeTourAttributes = true
}: TVaultDetailsHeaderPresentationProps): ReactElement {
  const currentVault = getVaultView(currentVaultInput)
  const tokenPrice = currentVault.tvl.price || 0
  const isYvUsd = isYvUsdVault(currentVault)
  const handleSelectSection = onSelectSection ?? noopSelectSection
  const handleWidgetModeChange = onWidgetModeChange ?? noopWidgetModeChange
  const handleWidgetWalletOpen = onWidgetWalletOpen ?? noop
  const handleWidgetCloseOverlays = onWidgetCloseOverlays ?? noop

  return (
    <div
      className={'grid w-full grid-cols-1 gap-y-0 gap-x-6 text-left md:auto-rows-min md:grid-cols-20 bg-app rounded-lg'}
    >
      <div className={'hidden md:flex items-center gap-2 text-sm text-text-secondary md:col-span-20 px-1'}>
        <Link to={'/'} className={'transition-colors hover:text-text-primary'}>
          {'Home'}
        </Link>
        <span>{'>'}</span>
        <Link to={'/v3'} className={'transition-colors hover:text-text-primary'}>
          {'Vaults'}
        </Link>
        <span>{'>'}</span>
        <span className={'font-medium text-text-primary'}>{getVaultName(currentVault)}</span>
      </div>
      {isCompressed ? (
        <div className={'md:col-span-13 md:row-start-2 pt-4'}>
          <div
            className={cl(
              'rounded-lg border border-border bg-surface'
              // 'border border-border',
            )}
          >
            <div className={'grid grid-cols-13 gap-y-0 gap-x-6'}>
              <VaultHeaderIdentity
                currentVault={currentVault}
                isCompressed={isCompressed}
                className={'col-span-5 pl-6'}
                includeTourAttributes={includeTourAttributes}
              />
              <div className={'col-span-8 pl-4'}>
                <VaultOverviewCard
                  currentVault={currentVault}
                  isCompressed={isCompressed}
                  includeTourAttributes={includeTourAttributes}
                  yvUsdApyVariant={yvUsdApyVariant}
                  onYvUsdApyVariantChange={onYvUsdApyVariantChange}
                />
              </div>
              {sectionTabs.length > 0 ? (
                <div className={'col-span-13'}>
                  <SectionSelectorBar
                    activeSectionKey={activeSectionKey}
                    onSelectSection={handleSelectSection}
                    sectionSelectorRef={sectionSelectorRef}
                    sectionTabs={sectionTabs}
                    isCompressed={isCompressed}
                    includeTourAttributes={includeTourAttributes}
                  />
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : (
        <>
          {isYvUsd ? (
            <div className={'md:col-span-20 md:row-start-2 md:flex md:items-stretch md:gap-6'}>
              <VaultHeaderIdentity
                currentVault={currentVault}
                isCompressed={isCompressed}
                className={'md:w-[20%] md:min-w-[300px] md:max-w-[420px] md:flex-none'}
                includeTourAttributes={includeTourAttributes}
              />
              <div className={'hidden md:flex md:min-w-0 md:flex-1 self-stretch'}>
                <YvUsdHeaderBanner className={'w-full max-h-[85px] self-stretch'} />
              </div>
            </div>
          ) : (
            <VaultHeaderIdentity
              currentVault={currentVault}
              isCompressed={isCompressed}
              className={'md:col-span-20 md:row-start-2'}
              includeTourAttributes={includeTourAttributes}
            />
          )}
          <div className={cl('md:col-span-13 md:row-start-3')}>
            {' '}
            {/* step 2 should be here*/}
            <div className={'flex flex-col'}>
              <div className={'pt-4'}>
                <VaultOverviewCard
                  currentVault={currentVault}
                  isCompressed={isCompressed}
                  includeTourAttributes={includeTourAttributes}
                  yvUsdApyVariant={yvUsdApyVariant}
                  onYvUsdApyVariantChange={onYvUsdApyVariantChange}
                />
              </div>
              {sectionTabs.length > 0 ? (
                <SectionSelectorBar
                  activeSectionKey={activeSectionKey}
                  onSelectSection={handleSelectSection}
                  sectionSelectorRef={sectionSelectorRef}
                  sectionTabs={sectionTabs}
                  isCompressed={isCompressed}
                  includeTourAttributes={includeTourAttributes}
                />
              ) : null}
            </div>
          </div>
        </>
      )}

      <div
        className={cl(
          'flex flex-col pt-4',
          isCompressed ? 'md:col-span-7 md:col-start-14 md:row-start-2' : 'md:col-span-7 md:col-start-14 md:row-start-3'
        )}
      >
        {' '}
        {/* step 3 should be here */}
        <UserHoldingsCard
          currentVault={currentVault}
          depositedValue={depositedValue}
          tokenPrice={tokenPrice}
          isCompressed={isCompressed}
          includeTourAttributes={includeTourAttributes}
        />
        {widgetActions.length > 0 && widgetMode && onWidgetModeChange ? (
          <WidgetTabs
            actions={widgetActions}
            activeAction={widgetMode}
            onActionChange={handleWidgetModeChange}
            className={isCompressed ? '-mt-px rounded-t-none' : undefined}
            onOpenWallet={handleWidgetWalletOpen}
            isWalletOpen={isWidgetWalletOpen}
            onCloseOverlays={handleWidgetCloseOverlays}
            dataTour={includeTourAttributes ? 'vault-detail-widget-tabs' : undefined}
            walletDataTour={includeTourAttributes ? 'vault-detail-widget-my-info' : undefined}
          />
        ) : null}
      </div>
    </div>
  )
}

export function VaultDetailsHeader({
  isCollapsibleMode = true,
  onCompressionChange,
  ...presentationProps
}: TVaultDetailsHeaderBaseProps & {
  isCollapsibleMode?: boolean
  onCompressionChange?: (isCompressed: boolean) => void
}): ReactElement {
  const [forceCompressed, setForceCompressed] = useState(false)
  const { isCompressed } = useHeaderCompression({ enabled: isCollapsibleMode, forceCompressed })

  useEffect(() => {
    if (typeof window === 'undefined') return
    const updateViewport = (): void => {
      setForceCompressed(window.innerHeight < 890)
    }
    updateViewport()
    window.addEventListener('resize', updateViewport)
    return (): void => window.removeEventListener('resize', updateViewport)
  }, [])

  useEffect(() => {
    onCompressionChange?.(isCompressed)
  }, [isCompressed, onCompressionChange])

  return <VaultDetailsHeaderPresentation {...presentationProps} isCompressed={isCompressed} />
}
