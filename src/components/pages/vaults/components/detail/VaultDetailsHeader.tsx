import { useThemePreference } from '@hooks/useThemePreference'
import { VaultsListChip } from '@pages/vaults/components/list/VaultsListChip'
import { VaultForwardAPY } from '@pages/vaults/components/table/VaultForwardAPY'
import { VaultHistoricalAPY } from '@pages/vaults/components/table/VaultHistoricalAPY'
import { VaultTVL } from '@pages/vaults/components/table/VaultTVL'
import { WidgetTabs } from '@pages/vaults/components/widget'
import { useHeaderCompression } from '@pages/vaults/hooks/useHeaderCompression'
import { useVaultUserData } from '@pages/vaults/hooks/useVaultUserData'
import type { WidgetActionType } from '@pages/vaults/types'
import { deriveListKind } from '@pages/vaults/utils/vaultListFacets'
import {
  getCategoryDescription,
  getChainDescription,
  getKindDescription,
  getProductTypeDescription,
  MIGRATABLE_TAG_DESCRIPTION,
  RETIRED_TAG_DESCRIPTION
} from '@pages/vaults/utils/vaultTagCopy'
import {
  METRIC_FOOTNOTE_CLASS,
  METRIC_VALUE_CLASS,
  MetricHeader,
  MetricsCard,
  type TMetricBlock
} from '@shared/components/MetricsCard'
import { RenderAmount } from '@shared/components/RenderAmount'
import { TokenLogo } from '@shared/components/TokenLogo'
import { useWeb3 } from '@shared/contexts/useWeb3'
import { IconLinkOut } from '@shared/icons/IconLinkOut'
import { cl, formatUSD, toAddress, toNormalizedBN } from '@shared/utils'
import { getVaultName } from '@shared/utils/helpers'
import type { TYDaemonVault } from '@shared/utils/schemas/yDaemonVaultsSchemas'
import { getNetwork } from '@shared/utils/wagmi/utils'
import type { ReactElement, Ref } from 'react'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'

function VaultHeaderIdentity({
  currentVault,
  isCompressed,
  isDarkTheme,
  className
}: {
  currentVault: TYDaemonVault
  isCompressed: boolean
  isDarkTheme: boolean
  className?: string
}): ReactElement {
  const chainName = getNetwork(currentVault.chainID).name
  const tokenLogoSrc = `${import.meta.env.VITE_BASE_YEARN_ASSETS_URI}/tokens/${
    currentVault.chainID
  }/${currentVault.token.address.toLowerCase()}/logo-128.png`
  const chainLogoSrc = `${import.meta.env.VITE_BASE_YEARN_ASSETS_URI}/chains/${currentVault.chainID}/logo-32.png`
  const explorerBase = getNetwork(currentVault.chainID).defaultBlockExplorer
  const explorerHref = explorerBase ? `${explorerBase}/address/${currentVault.address}` : ''
  const showChainChip = !isCompressed
  const showCategoryChip = Boolean(currentVault.category)
  const listKind = deriveListKind(currentVault)
  const isAllocatorVault = listKind === 'allocator' || listKind === 'strategy'
  const isLegacyVault = listKind === 'legacy'
  const productTypeLabel = isAllocatorVault ? 'Single Asset' : isLegacyVault ? 'Legacy' : 'LP Token'

  const baseKindType: 'multi' | 'single' | undefined = ((): 'multi' | 'single' | undefined => {
    if (currentVault.kind === 'Multi Strategy') return 'multi'
    if (currentVault.kind === 'Single Strategy') return 'single'
    return undefined
  })()

  const fallbackKindType: 'multi' | 'single' | undefined = ((): 'multi' | 'single' | undefined => {
    if (listKind === 'allocator') return 'multi'
    if (listKind === 'strategy') return 'single'
    return undefined
  })()
  const kindType = baseKindType ?? fallbackKindType

  const kindLabel: string | undefined = ((): string | undefined => {
    if (kindType === 'multi') return 'Allocator'
    if (kindType === 'single') return 'Strategy'
    return currentVault.kind
  })()
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
    <div className={cl('flex flex-col gap-1 px-1 mt-0', isCompressed ? 'md:justify-center' : 'pt-4', className)}>
      <div className={cl('flex items-center', isCompressed ? 'gap-2' : ' gap-4')}>
        <div
          className={cl(
            'relative flex items-center justify-start rounded-full bg-surface/70',
            isCompressed ? 'size-8' : 'size-10'
          )}
        >
          <TokenLogo
            src={tokenLogoSrc}
            tokenSymbol={currentVault.token.symbol || ''}
            width={isCompressed ? 32 : 40}
            height={isCompressed ? 32 : 40}
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
                'text-lg font-black leading-tight md:text-3xl md:leading-10',
                isDarkTheme ? 'text-text-primary' : 'text-text-secondary',
                isCompressed ? 'md:text-[30px] md:leading-9 max-w-[260px] truncate whitespace-nowrap' : ''
              )}
            >
              {vaultName} {' yVault'}
            </strong>
            {isCompressed && isTitleClipped ? (
              <span
                className={cl(
                  'pointer-events-none absolute left-0 top-1/2 z-20 hidden -translate-y-1/2 whitespace-nowrap rounded-md bg-app px-0 py-0 text-[30px] font-black leading-tight group-hover:block',
                  isDarkTheme ? 'text-text-primary' : 'text-text-secondary'
                )}
              >
                {vaultName} {' yVault'}
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
  isCompressed
}: {
  activeSectionKey?: string
  onSelectSection?: (key: string) => void
  sectionSelectorRef?: Ref<HTMLDivElement>
  sectionTabs: { key: string; label: string }[]
  isCompressed: boolean
}): ReactElement {
  return (
    <div className={'flex flex-wrap gap-2 md:gap-3 w-full'} ref={sectionSelectorRef}>
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
              'flex-1 min-w-[120px] rounded-md px-3 py-2 text-xs font-semibold transition-all md:min-w-0 md:flex-1 md:px-4 md:py-2.5',
              'border border-transparent focus-visible:outline-none focus-visible:ring-0',
              'min-h-[36px] active:scale-[0.98]',
              activeSectionKey === section.key
                ? 'bg-surface text-text-primary !border-border'
                : 'bg-transparent text-text-secondary hover:text-text-primary'
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
  currentVault,
  isCompressed
}: {
  currentVault: TYDaemonVault
  isCompressed: boolean
}): ReactElement {
  const totalAssets = toNormalizedBN(currentVault.tvl.totalAssets, currentVault.decimals).normalized
  const listKind = deriveListKind(currentVault)
  const isFactoryVault = listKind === 'factory'
  const metrics: TMetricBlock[] = [
    {
      key: 'est-apy',
      header: <MetricHeader label={'Est. APY'} tooltip={'Projected APY for the next period'} />,
      value: (
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
      value: (
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
      value: <VaultTVL currentVault={currentVault} valueClassName={METRIC_VALUE_CLASS} />,
      footnote: (
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
    <MetricsCard
      items={metrics}
      className={cl('rounded-b-none', isCompressed ? 'border-l border-border rounded-l-none' : 'border border-border')}
      footnoteDisplay={'tooltip'}
    />
  )
}

function UserHoldingsCard({
  currentVault,
  depositedValue,
  tokenPrice,
  isCompressed
}: {
  currentVault: TYDaemonVault
  depositedValue: bigint
  tokenPrice: number
  isCompressed: boolean
}): ReactElement {
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
    <MetricsCard
      items={sections}
      className={cl(
        'rounded-b-none',
        isCompressed ? 'rounded-tl-lg border-t border-x border-border' : 'border-t border-x border-border'
      )}
      footnoteDisplay={'tooltip'}
    />
  )
}

export function VaultDetailsHeader({
  currentVault,
  isCollapsibleMode = true,
  sectionTabs = [],
  activeSectionKey,
  onSelectSection,
  sectionSelectorRef,
  widgetActions = [],
  widgetMode,
  onWidgetModeChange,
  onCompressionChange,
  onWidgetSettingsOpen,
  isWidgetSettingsOpen,
  onWidgetWalletOpen,
  isWidgetWalletOpen,
  onWidgetCloseOverlays
}: {
  currentVault: TYDaemonVault
  isCollapsibleMode?: boolean
  sectionTabs?: { key: string; label: string }[]
  activeSectionKey?: string
  onSelectSection?: (key: string) => void
  sectionSelectorRef?: Ref<HTMLDivElement>
  widgetActions?: WidgetActionType[]
  widgetMode?: WidgetActionType
  onWidgetModeChange?: (mode: WidgetActionType) => void
  onCompressionChange?: (isCompressed: boolean) => void
  onWidgetSettingsOpen?: () => void
  isWidgetSettingsOpen?: boolean
  onWidgetWalletOpen?: () => void
  isWidgetWalletOpen?: boolean
  onWidgetCloseOverlays?: () => void
}): ReactElement {
  const { address } = useWeb3()
  const themePreference = useThemePreference()
  const isDarkTheme = themePreference !== 'light'
  const { isCompressed } = useHeaderCompression({ enabled: isCollapsibleMode })

  useEffect(() => {
    onCompressionChange?.(isCompressed)
  }, [isCompressed, onCompressionChange])

  // Shared hook with widget - cache updates automatically when widget refetches
  const { depositedValue } = useVaultUserData({
    vaultAddress: toAddress(currentVault.address),
    assetAddress: toAddress(currentVault.token.address),
    stakingAddress: currentVault.staking.available ? toAddress(currentVault.staking.address) : undefined,
    chainId: currentVault.chainID,
    account: address
  })
  const tokenPrice = currentVault.tvl.price || 0

  return (
    <div className={'grid w-full grid-cols-1 gap-y-0 gap-x-6 text-left md:auto-rows-min md:grid-cols-20 bg-app'}>
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
                isDarkTheme={isDarkTheme}
                className={'col-span-5 pl-6'}
              />
              <div className={'col-span-8 pl-4'}>
                <VaultOverviewCard currentVault={currentVault} isCompressed={isCompressed} />
              </div>
              {sectionTabs.length > 0 ? (
                <div className={'col-span-13'}>
                  <SectionSelectorBar
                    activeSectionKey={activeSectionKey}
                    onSelectSection={onSelectSection}
                    sectionSelectorRef={sectionSelectorRef}
                    sectionTabs={sectionTabs}
                    isCompressed={isCompressed}
                  />
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : (
        <>
          <VaultHeaderIdentity
            currentVault={currentVault}
            isCompressed={isCompressed}
            isDarkTheme={isDarkTheme}
            className={'md:col-span-20 md:row-start-2'}
          />
          <div className={cl('md:col-span-13 md:row-start-3')}>
            <div className={'flex flex-col'}>
              <div className={'pt-4'}>
                <VaultOverviewCard currentVault={currentVault} isCompressed={isCompressed} />
              </div>
              {sectionTabs.length > 0 ? (
                <SectionSelectorBar
                  activeSectionKey={activeSectionKey}
                  onSelectSection={onSelectSection}
                  sectionSelectorRef={sectionSelectorRef}
                  sectionTabs={sectionTabs}
                  isCompressed={isCompressed}
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
        <UserHoldingsCard
          currentVault={currentVault}
          depositedValue={depositedValue}
          tokenPrice={tokenPrice}
          isCompressed={isCompressed}
        />
        {widgetActions.length > 0 && widgetMode && onWidgetModeChange ? (
          <WidgetTabs
            actions={widgetActions}
            activeAction={widgetMode}
            onActionChange={onWidgetModeChange}
            className={isCompressed ? '-mt-px rounded-t-none' : undefined}
            onOpenSettings={onWidgetSettingsOpen}
            isSettingsOpen={isWidgetSettingsOpen}
            onOpenWallet={onWidgetWalletOpen}
            isWalletOpen={isWidgetWalletOpen}
            onCloseOverlays={onWidgetCloseOverlays}
          />
        ) : null}
      </div>
    </div>
  )
}
