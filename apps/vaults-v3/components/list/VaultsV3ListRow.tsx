import {
  AllocationChart,
  DARK_MODE_COLORS,
  LIGHT_MODE_COLORS,
  type TAllocationChartData,
  useDarkMode
} from '@lib/components/AllocationChart'
import { RenderAmount } from '@lib/components/RenderAmount'
import { TokenLogo } from '@lib/components/TokenLogo'
import { Tooltip } from '@lib/components/Tooltip'
import { useYearn } from '@lib/contexts/useYearn'
import { useYearnTokenPrice } from '@lib/hooks/useYearnTokenPrice'
import { IconChevron } from '@lib/icons/IconChevron'
import { IconSettings } from '@lib/icons/IconSettings'
import { IconStablecoin } from '@lib/icons/IconStablecoin'
import { IconStack } from '@lib/icons/IconStack'
import { IconVolatile } from '@lib/icons/IconVolatile'
import { cl, formatCounterValue, toAddress, toNormalizedBN } from '@lib/utils'
import type { TYDaemonVault, TYDaemonVaultStrategy } from '@lib/utils/schemas/yDaemonVaultsSchemas'
import { getNetwork } from '@lib/utils/wagmi'
import { VaultAboutSection } from '@nextgen/components/vaults-beta/VaultAboutSection'
import {
  type TVaultChartTab,
  type TVaultChartTimeframe,
  VaultChartsSection
} from '@nextgen/components/vaults-beta/VaultChartsSection'
import {
  type TVaultForwardAPYVariant,
  VaultForwardAPY
  // VaultForwardAPYInlineDetails
} from '@vaults-v3/components/table/VaultForwardAPY'
import { VaultHoldingsAmount } from '@vaults-v3/components/table/VaultHoldingsAmount'
import type { ReactElement } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { VaultsListChip } from './VaultsListChip'
import { type TVaultsV3ExpandedView, VaultsV3ExpandedSelector } from './VaultsV3ExpandedSelector'

type TVaultRowFlags = {
  hasHoldings?: boolean
  isMigratable?: boolean
  isRetired?: boolean
}

type TVaultsV3ListRowLayout = 'default' | 'balanced'

export function VaultsV3ListRow({
  currentVault,
  flags,
  hrefOverride,
  apyDisplayVariant = 'default',
  showBoostDetails = true,
  activeChains,
  activeCategories,
  activeTypes,
  onToggleChain,
  onToggleCategory,
  onToggleType,
  showStrategies = false,
  layoutVariant = 'default'
}: {
  currentVault: TYDaemonVault
  flags?: TVaultRowFlags
  hrefOverride?: string
  apyDisplayVariant?: TVaultForwardAPYVariant
  showBoostDetails?: boolean
  activeChains?: number[]
  activeCategories?: string[]
  activeTypes?: string[]
  onToggleChain?: (chainId: number) => void
  onToggleCategory?: (category: string) => void
  onToggleType?: (type: string) => void
  showStrategies?: boolean
  layoutVariant?: TVaultsV3ListRowLayout
}): ReactElement {
  const navigate = useNavigate()
  const href = hrefOverride ?? `/vaults/${currentVault.chainID}/${toAddress(currentVault.address)}`
  const network = getNetwork(currentVault.chainID)
  const chainLogoSrc = `${import.meta.env.VITE_BASE_YEARN_ASSETS_URI}/chains/${currentVault.chainID}/logo-32.png`
  const [isExpanded, setIsExpanded] = useState(false)
  const [expandedView, setExpandedView] = useState<TVaultsV3ExpandedView>('apy')
  const [expandedTimeframe, setExpandedTimeframe] = useState<TVaultChartTimeframe>('all')
  const isBalancedLayout = layoutVariant === 'balanced'
  const leftColumnSpan = isBalancedLayout ? 'col-span-12' : 'col-span-9'
  const rightColumnSpan = isBalancedLayout ? 'col-span-12' : 'col-span-15'
  const rightGridColumns = isBalancedLayout ? 'md:grid-cols-12' : 'md:grid-cols-15'
  const metricsColumnSpan = isBalancedLayout ? 'col-span-4' : 'col-span-5'
  const kindLabel =
    currentVault.kind === 'Multi Strategy'
      ? 'Allocator Vault'
      : currentVault.kind === 'Single Strategy'
        ? 'Strategy Vault'
        : currentVault.kind
  const kindType =
    currentVault.kind === 'Multi Strategy' ? 'multi' : currentVault.kind === 'Single Strategy' ? 'single' : undefined
  const activeChainIds = activeChains ?? []
  const activeCategoryLabels = activeCategories ?? []
  const activeTypeLabels = activeTypes ?? []
  const showKindChip = showStrategies && Boolean(kindType)
  const categoryIcon =
    currentVault.category === 'Stablecoin' ? (
      <IconStablecoin className={'size-3.5'} />
    ) : currentVault.category === 'Volatile' ? (
      <IconVolatile className={'size-3.5'} />
    ) : null
  const kindIcon =
    kindType === 'multi' ? (
      <IconSettings className={'size-3.5'} />
    ) : kindType === 'single' ? (
      <IconStack className={'size-3.5'} />
    ) : null
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

  const handleRowClick = (): void => {
    navigate(href)
  }

  const handleKeyDown: React.KeyboardEventHandler<HTMLDivElement> = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      navigate(href)
    }
  }

  useEffect(() => {
    if (isExpanded) {
      setExpandedView('apy')
    }
  }, [isExpanded])

  return (
    <div className={cl('w-full overflow-hidden transition-colors bg-surface')}>
      {/* biome-ignore lint/a11y/useSemanticElements: Using a div with link-like behavior for row navigation */}
      <div
        role={'link'}
        tabIndex={0}
        onClick={handleRowClick}
        onKeyDown={handleKeyDown}
        className={cl(
          'grid w-full grid-cols-1 md:grid-cols-24 bg-surface',
          'p-6 pt-2 pb-4 md:pr-20',
          'cursor-pointer relative group'
        )}
      >
        <div
          className={cl(
            'absolute inset-0',
            'opacity-0 transition-opacity duration-300 group-hover:opacity-20 group-focus-visible:opacity-20 pointer-events-none',
            'bg-[linear-gradient(80deg,#2C3DA6,#D21162)]'
          )}
        />

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

        <div className={cl(leftColumnSpan, 'z-10', 'flex flex-row items-center justify-between sm:pt-0')}>
          <div className={'flex flex-row w-full gap-4 overflow-hidden'}>
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
              <div className={'mt-1 flex flex-wrap items-center gap-1 text-xs text-text-primary/70'}>
                <div className={'hidden md:block'}>
                  <VaultsListChip
                    label={network.name}
                    icon={<TokenLogo src={chainLogoSrc} tokenSymbol={network.name} width={14} height={14} />}
                    isActive={activeChainIds.includes(currentVault.chainID)}
                    onClick={onToggleChain ? (): void => onToggleChain(currentVault.chainID) : undefined}
                    ariaLabel={`Filter by ${network.name}`}
                  />
                </div>
                {currentVault.category ? (
                  <VaultsListChip
                    label={currentVault.category}
                    icon={categoryIcon}
                    isActive={activeCategoryLabels.includes(currentVault.category)}
                    onClick={onToggleCategory ? (): void => onToggleCategory(currentVault.category) : undefined}
                    ariaLabel={`Filter by ${currentVault.category}`}
                  />
                ) : null}
                {showKindChip && kindLabel ? (
                  <VaultsListChip
                    label={kindLabel}
                    icon={kindIcon}
                    isActive={kindType ? activeTypeLabels.includes(kindType) : false}
                    onClick={kindType && onToggleType ? (): void => onToggleType(kindType) : undefined}
                    ariaLabel={`Filter by ${kindLabel}`}
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
          {/* <div className={'col-span-3'}>
            <VaultRiskScoreTag riskLevel={currentVault.info.riskLevel} />
          </div> */}
          {/* Available to deposit */}
          {/* <div className={'yearn--table-data-section-item col-span-3 flex-row md:flex-col'} datatype={'number'}>
            <p
              className={`yearn--table-data-section-item-value ${isZero(availableToDeposit) ? 'text-neutral-400' : 'text-neutral-900'}`}
            >
              <RenderAmount
                value={Number(toNormalizedBN(availableToDeposit, currentVault.token.decimals).normalized)}
                symbol={currentVault.token.symbol}
                decimals={currentVault.token.decimals}
                shouldFormatDust
                options={{
                  shouldDisplaySymbol: false,
                  maximumFractionDigits:
                    Number(toNormalizedBN(availableToDeposit, currentVault.token.decimals).normalized) > 1000 ? 2 : 4
                }}
              />
            </p>
          </div> */}
          <div className={cl('yearn--table-data-section-item', metricsColumnSpan)} datatype={'number'}>
            <VaultHoldingsAmount currentVault={currentVault} />
          </div>
        </div>
      </div>

      {isExpanded ? (
        <div className={'hidden md:block bg-surface'}>
          <div className={'px-6 pb-6 pt-3'}>
            <div className={' bg-surface'}>
              <VaultsV3ExpandedSelector
                className={'p-3'}
                activeView={expandedView}
                onViewChange={setExpandedView}
                timeframe={expandedTimeframe}
                onTimeframeChange={setExpandedTimeframe}
                rightElement={
                  <button
                    type={'button'}
                    onClick={(event): void => {
                      event.stopPropagation()
                      navigate(href)
                    }}
                    className={
                      'rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400'
                    }
                  >
                    {'Go to Vault'}
                  </button>
                }
              />

              {expandedView === 'apy' || expandedView === 'performance' || expandedView === 'tvl' ? (
                <div className={'px-3 pb-4'}>
                  <VaultChartsSection
                    chainId={currentVault.chainID}
                    vaultAddress={currentVault.address}
                    shouldRenderSelectors={false}
                    chartTab={
                      (expandedView === 'apy'
                        ? 'historical-apy'
                        : expandedView === 'performance'
                          ? 'historical-pps'
                          : 'historical-tvl') satisfies TVaultChartTab
                    }
                    timeframe={expandedTimeframe}
                    chartHeightPx={200}
                    chartHeightMdPx={200}
                  />
                </div>
              ) : null}

              {expandedView === 'info' ? (
                <div className={'grid md:grid-cols-2 divide-y divide-border md:divide-y-0 md:divide-x'}>
                  <div className={'p-4 md:p-6'}>
                    <VaultStrategyAllocationPreview currentVault={currentVault} />
                  </div>
                  <div className={'p-4 md:p-6'}>
                    <VaultAboutSection currentVault={currentVault} className={'p-0'} />
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function VaultStrategyAllocationPreview({ currentVault }: { currentVault: TYDaemonVault }): ReactElement {
  const { vaults } = useYearn()
  const tokenPrice = useYearnTokenPrice({
    address: currentVault.token.address,
    chainID: currentVault.chainID
  })
  const isDark = useDarkMode()

  const vaultList = useMemo(() => {
    const list: (TYDaemonVault & {
      details: TYDaemonVaultStrategy['details']
      status: TYDaemonVaultStrategy['status']
    })[] = []

    for (const strategy of currentVault?.strategies || []) {
      const linkedVault = vaults[strategy.address]
      if (linkedVault?.address) {
        list.push({
          ...linkedVault,
          details: strategy.details,
          status: strategy.status
        })
      }
    }

    return list
  }, [currentVault?.strategies, vaults])

  const strategyList = useMemo(() => {
    const list: TYDaemonVaultStrategy[] = []

    for (const strategy of currentVault?.strategies || []) {
      if (!vaults[strategy.address]) {
        list.push(strategy)
      }
    }

    return list
  }, [currentVault?.strategies, vaults])

  const mergedList = useMemo(
    () =>
      [...vaultList, ...strategyList] as (TYDaemonVault & {
        details: TYDaemonVaultStrategy['details']
        status: TYDaemonVaultStrategy['status']
      })[],
    [vaultList, strategyList]
  )

  const filteredVaultList = useMemo(
    () => mergedList.filter((strategy) => strategy.status !== 'not_active'),
    [mergedList]
  )

  const activeStrategyData = useMemo(
    () =>
      filteredVaultList
        .filter((strategy) => {
          const hasAllocation =
            strategy.details?.totalDebt && strategy.details.totalDebt !== '0' && strategy.details?.debtRatio
          return hasAllocation
        })
        .map(
          (strategy): TAllocationChartData => ({
            id: strategy.address,
            name: strategy.name,
            value: (strategy.details?.debtRatio || 0) / 100,
            amount: formatCounterValue(
              toNormalizedBN(strategy.details?.totalDebt || 0, currentVault.token.decimals).display,
              tokenPrice
            )
          })
        ),
    [filteredVaultList, currentVault.token.decimals, tokenPrice]
  )

  const unallocatedPercentage =
    100 * 100 - mergedList.reduce((acc, strategy) => acc + (strategy.details?.debtRatio || 0), 0)
  const unallocatedValue =
    Number(currentVault.tvl?.totalAssets || 0) -
    mergedList.reduce((acc, strategy) => acc + Number(strategy.details?.totalDebt || 0), 0)

  const unallocatedData = useMemo(() => {
    if (unallocatedValue > 0 && unallocatedPercentage > 0) {
      return {
        id: 'unallocated',
        name: 'Unallocated',
        value: unallocatedPercentage / 100,
        amount: formatCounterValue(toNormalizedBN(unallocatedValue, currentVault.token.decimals).display, tokenPrice)
      }
    }
    return null
  }, [currentVault.token.decimals, tokenPrice, unallocatedPercentage, unallocatedValue])

  const allocationChartData = useMemo(
    () => [...activeStrategyData, unallocatedData].filter(Boolean) as TAllocationChartData[],
    [activeStrategyData, unallocatedData]
  )

  const legendColors = useMemo(() => (isDark ? DARK_MODE_COLORS : LIGHT_MODE_COLORS), [isDark])

  if (allocationChartData.length === 0) {
    return <div className={'text-sm text-text-secondary'}>{'No strategy allocation data available.'}</div>
  }

  return (
    <div className={'flex flex-col gap-6'}>
      <div className={'flex flex-col gap-6 lg:flex-row lg:items-center'}>
        <AllocationChart allocationChartData={allocationChartData} />
        <div className={'flex flex-col gap-3'}>
          {activeStrategyData.map((item, index) => (
            <div key={item.id} className={'flex flex-row items-center gap-3'}>
              <div
                className={'h-3 w-3 rounded-sm'}
                style={{
                  backgroundColor: legendColors[index % legendColors.length]
                }}
              />
              <div className={'flex flex-col'}>
                <span className={'text-sm text-text-primary'}>{item.name}</span>
                <span className={'text-xs text-text-secondary'}>{item.amount}</span>
              </div>
            </div>
          ))}
          {unallocatedData ? (
            <div className={'flex flex-row items-center gap-3'}>
              <div className={'h-3 w-3 rounded-sm bg-surface-tertiary'} />
              <div className={'flex flex-col'}>
                <span className={'text-sm text-text-secondary'}>{'Unallocated'}</span>
                <span className={'text-xs text-text-secondary'}>{unallocatedData.amount}</span>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
