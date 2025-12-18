import {
  AllocationChart,
  DARK_MODE_COLORS,
  LIGHT_MODE_COLORS,
  type TAllocationChartData,
  useDarkMode
} from '@lib/components/AllocationChart'
import { RenderAmount } from '@lib/components/RenderAmount'
import { TokenLogo } from '@lib/components/TokenLogo'
import { useYearn } from '@lib/contexts/useYearn'
import { useYearnTokenPrice } from '@lib/hooks/useYearnTokenPrice'
import { IconChevron } from '@lib/icons/IconChevron'
import { LogoYearn } from '@lib/icons/LogoYearn'
import { cl, formatCounterValue, toAddress, toNormalizedBN } from '@lib/utils'
import type { TYDaemonVault, TYDaemonVaultStrategy } from '@lib/utils/schemas/yDaemonVaultsSchemas'
import { getNetwork } from '@lib/utils/wagmi'
import { VaultAboutSection } from '@nextgen/components/vaults-beta/VaultAboutSection'
import {
  type TVaultChartTab,
  type TVaultChartTimeframe,
  VaultChartsSection
} from '@nextgen/components/vaults-beta/VaultChartsSection'
import { VaultForwardAPY, VaultForwardAPYInlineDetails } from '@vaults-v3/components/table/VaultForwardAPY'
import { VaultHistoricalAPY } from '@vaults-v3/components/table/VaultHistoricalAPY'
import { VaultHoldingsAmount } from '@vaults-v3/components/table/VaultHoldingsAmount'
import { RiskScoreInlineDetails, VaultRiskScoreTag } from '@vaults-v3/components/table/VaultRiskScoreTag'
import type { ReactElement } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { type TVaultsV3ExpandedView, VaultsV3ExpandedSelector } from './VaultsV3ExpandedSelector'

type TVaultRowFlags = {
  hasHoldings?: boolean
  isMigratable?: boolean
  isRetired?: boolean
}

export function VaultsV3ListRow({
  currentVault,
  flags,
  hrefOverride
}: {
  currentVault: TYDaemonVault
  flags?: TVaultRowFlags
  hrefOverride?: string
}): ReactElement {
  const navigate = useNavigate()
  const href = hrefOverride ?? `/vaults/${currentVault.chainID}/${toAddress(currentVault.address)}`
  const network = getNetwork(currentVault.chainID)
  const chainLogoSrc = `${import.meta.env.VITE_BASE_YEARN_ASSETS_URI}/chains/${currentVault.chainID}/logo-32.png`
  const [isApyOpen, setIsApyOpen] = useState(false)
  const [isRiskOpen, setIsRiskOpen] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const [expandedView, setExpandedView] = useState<TVaultsV3ExpandedView>('apy')
  const [expandedTimeframe, setExpandedTimeframe] = useState<TVaultChartTimeframe>('all')
  const isYearnVault = Boolean(currentVault.version?.startsWith('3') || currentVault.version?.startsWith('~3'))
  const isFeatured = Boolean(currentVault.info?.isHighlighted)
  const kindLabel =
    currentVault.kind === 'Multi Strategy'
      ? 'Allocator Vault'
      : currentVault.kind === 'Single Strategy'
        ? 'Strategy Vault'
        : currentVault.kind

  useEffect(() => {
    if (isExpanded) {
      setExpandedView('apy')
    }
  }, [isExpanded])

  return (
    <div
      className={cl(
        'w-full overflow-visible transition-colors bg-surface relative border-b border-border'
        // !isExpanded ? 'hover:z-10 hover:border-x hover:border-border' : ''
        // 'hover:border-x hover:border-border',
        // isExpanded ? 'border-y border-border' : ''
      )}
    >
      <div
        className={cl(
          'grid w-full grid-cols-1 md:grid-cols-24 bg-surface',
          'p-6 pt-2 pb-4 pr-32 md:pr-36',
          'relative group'
        )}
      >
        <button
          type={'button'}
          onClick={(event): void => {
            event.stopPropagation()
            navigate(href)
          }}
          className={cl(
            'absolute top-4 right-4 z-20 flex items-center justify-center rounded-lg border border-primary bg-surface px-3 py-2 text-xs font-semibold text-primary transition-colors',
            'hover:border-primary hover:text-surface hover:bg-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400',
            'md:top-5 md:right-5'
          )}
        >
          {'Go to Vault'}
        </button>

        {!isExpanded ? (
          <button
            type={'button'}
            aria-label={'Expand'}
            onClick={(event): void => {
              event.stopPropagation()
              setIsExpanded(true)
            }}
            className={cl(
              'absolute bottom-2 left-1/2 z-30 -translate-x-1',
              'rounded-full border border-border bg-surface px-3 py-1',
              'text-xs font-semibold text-text-secondary',
              'opacity-100 transition-opacity duration-150',
              'md:opacity-0 md:group-hover:opacity-100 md:group-focus-visible:opacity-100',
              'hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400'
            )}
          >
            <span className={'flex items-center'}>
              <span>{''}</span>
              <span className={'flex flex-col -space-y-2'}>
                <IconChevron size={12} direction={'down'} />
                <IconChevron size={12} direction={'down'} />
              </span>
            </span>
          </button>
        ) : null}

        {/* TODO:on hover add list head categories */}
        <div className={cl('col-span-10 z-10', 'flex flex-row items-center justify-between sm:pt-0')}>
          <div
            className={
              'flex flex-row-reverse sm:flex-row w-full justify-between sm:justify-normal gap-4 overflow-hidden'
            }
          >
            <div className={'flex items-center justify-center self-center size-8 min-h-8 min-w-8 rounded-full'}>
              <TokenLogo
                src={`${import.meta.env.VITE_BASE_YEARN_ASSETS_URI}/tokens/${
                  currentVault.chainID
                }/${currentVault.token.address.toLowerCase()}/logo-128.png`}
                tokenSymbol={currentVault.token.symbol || ''}
                width={32}
                height={32}
              />
            </div>
            <div className={'min-w-0'}>
              <div className={'flex items-center gap-2 min-w-0'}>
                <strong
                  title={currentVault.name}
                  className={'block truncate font-black text-text-primary md:-mb-0.5 text-lg'}
                >
                  {currentVault.name}
                </strong>
                {isYearnVault ? (
                  <span className={'shrink-0'}>
                    <LogoYearn
                      width={16}
                      height={16}
                      className={'size-4'}
                      back={isFeatured ? 'text-primary' : 'text-text-secondary'}
                      front={'text-white'}
                    />
                  </span>
                ) : null}
              </div>
              <div className={'mt-1 flex flex-wrap items-center gap-1 text-xs text-text-primary/70'}>
                <span
                  className={
                    'inline-flex items-center gap-2 rounded-md bg-surface-secondary border border-border px-3 py-1'
                  }
                >
                  <TokenLogo src={chainLogoSrc} tokenSymbol={network.name} width={14} height={14} />
                  <span>{network.name}</span>
                </span>
                {currentVault.category ? (
                  <span
                    className={
                      'inline-flex items-center gap-2 rounded-md bg-surface-secondary border border-border px-3 py-1'
                    }
                  >
                    {currentVault.category}
                  </span>
                ) : null}
                {kindLabel ? (
                  <span
                    className={
                      'inline-flex items-center gap-2 rounded-md bg-surface-secondary border border-border px-3 py-1'
                    }
                  >
                    {kindLabel}
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        {/* Desktop metrics grid */}
        <div className={cl('col-span-14 z-10 gap-4 mt-4', 'md:mt-0 md:grid md:grid-cols-14')}>
          <div className={'yearn--table-data-section-item col-span-3'} datatype={'number'}>
            <VaultForwardAPY currentVault={currentVault} />
          </div>
          <div className={'yearn--table-data-section-item col-span-3'} datatype={'number'}>
            <VaultHistoricalAPY currentVault={currentVault} />
          </div>
          {/* TVL */}
          <div className={'yearn--table-data-section-item col-span-4'} datatype={'number'}>
            <div className={'flex flex-col pt-0 text-right'}>
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
              <small className={'text-xs flex flex-row text-text-primary/40'}>
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
                <p className="pl-1">{currentVault.token.symbol}</p>
              </small>
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
          <div className={'yearn--table-data-section-item col-span-4'} datatype={'number'}>
            <VaultHoldingsAmount currentVault={currentVault} />
          </div>
        </div>

        {/* Mobile metrics grid; conditionally show Deposited if user has holdings */}
        <div
          className={cl(
            'col-span-8 z-10',
            'grid grid-cols-2 gap-4 md:hidden',
            'pt-2 mt-2 md:mt-0 md:pt-0 border-t border-neutral-800/20'
          )}
        >
          {flags?.hasHoldings ? (
            <div className={'yearn--table-data-section-item col-span-2 flex-row items-center'} datatype={'number'}>
              <p className={'inline text-start text-dm text-text-primary'}>{'Your Deposit'}</p>
              <VaultHoldingsAmount currentVault={currentVault} />
            </div>
          ) : null}
          <div className={'yearn--table-data-section-item col-span-2'} datatype={'number'}>
            <div className={'w-full flex flex-col items-start'}>
              <div className={'flex w-full flex-row items-center justify-between'}>
                <p className={'inline text-start text-dm text-text-primary'}>{'Estimated APY'}</p>
                <VaultForwardAPY currentVault={currentVault} onMobileToggle={(): void => setIsApyOpen((v) => !v)} />
              </div>
              {isApyOpen ? (
                <div className={'mt-2 w-full'}>
                  <VaultForwardAPYInlineDetails currentVault={currentVault} />
                </div>
              ) : null}
            </div>
          </div>
          <div className={'yearn--table-data-section-item col-span-2 flex-row items-center'} datatype={'number'}>
            <p className={'inline text-start text-dm text-text-primary'}>{'Historical APY'}</p>
            <VaultHistoricalAPY currentVault={currentVault} />
          </div>
          <div className={'yearn--table-data-section-item col-span-2 flex-row items-center'} datatype={'number'}>
            <p className={'inline text-start text-dm text-text-primary'}>{'TVL'}</p>
            <div className={'flex flex-col pt-0 text-right'}>
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
              <small className={'text-xs flex flex-row text-text-primary/40'}>
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
                <p className="pl-1">{currentVault.token.symbol}</p>
              </small>
            </div>
          </div>
          <div className={'yearn--table-data-section-item col-span-2'} datatype={'number'}>
            <div className={'w-full flex flex-col items-start'} onClick={(event): void => event.stopPropagation()}>
              <VaultRiskScoreTag
                riskLevel={currentVault.info.riskLevel}
                onMobileToggle={(): void => setIsRiskOpen((v) => !v)}
              />
              {isRiskOpen ? (
                <div className={'mt-2 w-full'}>
                  <RiskScoreInlineDetails riskLevel={currentVault.info.riskLevel} />
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {isExpanded ? (
        <div className={'bg-surface'}>
          <div className={'px-6 pb-3'}>
            <div className={'relative border border-border bg-surface'}>
              <VaultsV3ExpandedSelector
                className={'p-3'}
                activeView={expandedView}
                onViewChange={setExpandedView}
                timeframe={expandedTimeframe}
                onTimeframeChange={setExpandedTimeframe}
              />

              {expandedView === 'apy' || expandedView === 'performance' ? (
                <div className={'px-3 pb-4'}>
                  <VaultChartsSection
                    chainId={currentVault.chainID}
                    vaultAddress={currentVault.address}
                    shouldRenderSelectors={false}
                    chartTab={(expandedView === 'apy' ? 'historical-apy' : 'historical-pps') satisfies TVaultChartTab}
                    timeframe={expandedTimeframe}
                    chartHeightPx={150}
                    chartHeightMdPx={150}
                  />
                </div>
              ) : null}

              {expandedView === 'info' ? (
                <div className={'grid md:grid-cols-2'}>
                  <div className={'p-4 md:p-6'}>
                    <VaultStrategyAllocationPreview currentVault={currentVault} />
                  </div>
                  <div className={'p-4 md:p-6'}>
                    <VaultAboutSection currentVault={currentVault} className={'p-0'} />
                  </div>
                </div>
              ) : null}

              <button
                type={'button'}
                aria-label={'Close'}
                onClick={(event): void => {
                  event.stopPropagation()
                  setIsExpanded(false)
                }}
                className={cl(
                  'absolute top-4 left-1/2 z-30 -translate-x-1',
                  'rounded-full border border-border bg-surface px-3 py-1',
                  'text-xs font-semibold text-text-secondary',
                  'hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400'
                )}
              >
                <span className={'flex items-center'}>
                  <span>{''}</span>
                  <span className={'flex flex-col -space-y-2'}>
                    <IconChevron size={12} direction={'up'} />
                    <IconChevron size={12} direction={'up'} />
                  </span>
                </span>
              </button>
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
