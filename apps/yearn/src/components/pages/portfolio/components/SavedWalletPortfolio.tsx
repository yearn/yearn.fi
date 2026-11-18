import { PortfolioDropdown } from '@pages/portfolio/components/PortfolioDropdown'
import { PortfolioHeaderSection } from '@pages/portfolio/components/PortfolioHeaderSection'
import {
  PortfolioHistoryChart,
  PortfolioHistoryChartControls,
  type TGrowthDisplayMode,
  type TPortfolioHistoryChartTab,
  type TPortfolioHistoryChartTimeframe
} from '@pages/portfolio/components/PortfolioHistoryChart'
import { PortfolioOverview } from '@pages/portfolio/components/PortfolioOverview'
import { PortfolioWalletLabel } from '@pages/portfolio/components/PortfolioWalletLabel'
import {
  getPortfolioGrowthVaultKey,
  mapPortfolioGrowthVaults,
  type TMappedPortfolioGrowthVault,
  toPortfolioGrowthDisplay
} from '@pages/portfolio/hooks/usePortfolioGrowth'
import { useSavedWalletGrowth, useSavedWalletPortfolio } from '@pages/portfolio/hooks/useSavedWalletPortfolio'
import type { TPortfolioHistoryDenomination, TPortfolioHistoryTimeframe } from '@pages/portfolio/types/api'
import { combineWalletHistory, combineWalletPositions } from '@pages/portfolio/utils/savedWalletPortfolio'
import { ChartContainer, ChartTooltip } from '@pages/vaults/components/detail/charts/ChartPrimitives'
import {
  CHART_WITH_AXES_MARGIN,
  CHART_Y_AXIS_TICK_MARGIN,
  CHART_Y_AXIS_TICK_STYLE,
  CHART_Y_AXIS_WIDTH
} from '@pages/vaults/components/detail/charts/chartLayout'
import { VaultsListHead } from '@pages/vaults/components/list/VaultsListHead'
import { formatSignedPortfolioGrowthUsd, VaultsListRowPresentation } from '@pages/vaults/components/list/VaultsListRow'
import type { TKongVault } from '@pages/vaults/domain/kongVaultSelectors'
import { useYvUsdVaults } from '@pages/vaults/hooks/useYvUsdVaults'
import {
  formatChartMonthYearLabel,
  formatChartTooltipDate,
  getChartMonthlyTicks,
  getTimeframeLimit
} from '@pages/vaults/utils/charts'
import {
  getYvUsdPositionApyBreakdown,
  YVUSD_CHAIN_ID,
  YVUSD_LOCKED_ADDRESS,
  YVUSD_UNLOCKED_ADDRESS
} from '@pages/vaults/utils/yvUsd'
import { EmptyState } from '@shared/components/EmptyState'
import { YearnLogoSpinner } from '@shared/components/YearnLogoSpinner'
import { useYearn } from '@shared/contexts/useYearn'
import type { TSortDirection } from '@shared/types'
import { formatAmount, formatTvlDisplay, formatUSD, toAddress, truncateHex } from '@shared/utils'
import { PLAUSIBLE_EVENTS } from '@shared/utils/plausible'
import { calculateVaultEstimatedAPY, calculateVaultHistoricalAPY } from '@shared/utils/vaultApy'
import Link from 'next/link'
import { useId, useState } from 'react'
import { Area, CartesianGrid, ComposedChart, Line, XAxis, YAxis } from 'recharts'
import { type Address, formatUnits } from 'viem'
import { canonicalChains } from '@/config/chainDefinitions'

const chartConfig = {
  value: { color: 'var(--chart-1)' }
}

function displayValue(value: number | null) {
  return value === null ? 'Unavailable' : formatUSD(value)
}

function SavedWalletHistoryChart({
  data,
  denomination
}: {
  data: ReturnType<typeof combineWalletHistory>
  denomination: TPortfolioHistoryDenomination
}) {
  const gradientId = useId()
  return (
    <div className="h-[290px]">
      <ChartContainer
        config={chartConfig}
        aria-label={`Settled wallet balance history in ${denomination.toUpperCase()}`}
      >
        <ComposedChart data={data} margin={CHART_WITH_AXES_MARGIN} accessibilityLayer>
          <defs>
            <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
              <stop offset="5%" stopColor="var(--color-value)" stopOpacity={0.5} />
              <stop offset="95%" stopColor="var(--color-value)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="date"
            ticks={getChartMonthlyTicks(data)}
            tickFormatter={formatChartMonthYearLabel}
            tick={{ fill: 'var(--chart-axis)' }}
            axisLine={{ stroke: 'var(--chart-axis)' }}
            tickLine={{ stroke: 'var(--chart-axis)' }}
          />
          <YAxis
            domain={[0, 'auto']}
            tickFormatter={(value: number) =>
              value
                ? denomination === 'eth'
                  ? formatAmount(value, 0, 2)
                  : formatTvlDisplay(value, {
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 0
                    })
                : ''
            }
            mirror
            width={CHART_Y_AXIS_WIDTH}
            tickMargin={CHART_Y_AXIS_TICK_MARGIN}
            tick={CHART_Y_AXIS_TICK_STYLE}
            axisLine={{ stroke: 'var(--chart-axis)' }}
            tickLine={{ stroke: 'var(--chart-axis)' }}
          />
          <ChartTooltip
            filterNull={false}
            content={({ active, payload }) => {
              const point = payload?.[0]?.payload as (typeof data)[number] | undefined
              if (!active || !point) return null
              return (
                <div className="rounded-md border border-border bg-surface p-2">
                  <div>{formatChartTooltipDate(point.date)} UTC</div>
                  <div className="font-semibold">
                    {denomination === 'eth' && point.value !== null
                      ? `${formatAmount(point.value, 2, 4)} ETH`
                      : displayValue(point.value)}
                  </div>
                </div>
              )
            }}
          />
          <Area
            type="monotone"
            dataKey="value"
            fill={`url(#${gradientId})`}
            fillOpacity={1}
            stroke="none"
            isAnimationActive={false}
            tooltipType="none"
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke="var(--color-value)"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0, fill: 'var(--color-value)' }}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ChartContainer>
    </div>
  )
}

type TSavedWalletPosition = ReturnType<typeof combineWalletPositions>['rows'][number]
type TSavedWalletVaultRow = {
  position: TSavedWalletPosition
  vault?: TKongVault
  yvUsdApy?: number | null
}

function WalletBreakdown({ position }: { position: TSavedWalletPosition }) {
  return (
    <div className="space-y-2 border-border border-t bg-surface-secondary/40 px-4 py-3 text-sm md:px-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-2">
        <h3 className="font-semibold">Wallet breakdown</h3>
        {position.decimals !== undefined ? (
          <p className="break-all text-text-secondary">{formatUnits(position.shares, position.decimals)} shares</p>
        ) : null}
      </div>
      <ul className="divide-y divide-border">
        {position.wallets.map(({ address, value }) => (
          <li key={address} className="flex justify-between gap-2 py-1">
            <span className="font-mono" title={address}>
              {truncateHex(address, 6)}
            </span>
            <span>{displayValue(value)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function UncataloguedVaultRow({
  position,
  growth
}: {
  position: TSavedWalletPosition
  growth?: TMappedPortfolioGrowthVault
}) {
  const { chainId, vaultAddress, value } = position
  const chain = canonicalChains.find(({ id }) => id === chainId)?.name ?? `Chain ${chainId}`
  return (
    <details className="bg-surface">
      <summary className="relative cursor-pointer list-none px-4 py-4 md:grid md:grid-cols-24 md:items-center md:px-6 md:pr-20">
        <span className="flex min-w-0 flex-col md:col-span-9">
          <Link className="font-black text-lg hover:underline" href={`/vaults/${chainId}/${vaultAddress}`}>
            {position.symbol || truncateHex(vaultAddress, 6)}
          </Link>
          <span className="text-xs text-text-secondary">{chain}</span>
        </span>
        <span className="hidden justify-end text-text-secondary md:col-span-3 md:flex">—</span>
        <span className="hidden justify-end text-text-secondary md:col-span-3 md:flex">—</span>
        <span className="flex justify-end md:col-span-3">
          {growth?.growthUsd != null ? formatSignedPortfolioGrowthUsd(growth.growthUsd, growth.status !== 'ok') : '—'}
        </span>
        <span className="mt-2 flex gap-2 border-border border-t pt-2 md:col-span-3 md:mt-0 md:justify-end md:border-0 md:pt-0">
          <span className="text-sm text-text-secondary md:hidden">Holdings</span>
          <span className="font-semibold">{displayValue(value)}</span>
        </span>
        <span className="absolute top-4 right-5 text-text-secondary" aria-hidden="true">
          ⌄
        </span>
      </summary>
      <WalletBreakdown position={position} />
    </details>
  )
}

const vaultViewOptions = ['Bundle', 'Wallet'] as const
type TVaultView = (typeof vaultViewOptions)[number]

function getEmptyPositionsMessage(isLoading: boolean, isComplete: boolean) {
  if (isLoading) return 'Searching for Yearn balances…'
  return isComplete ? 'No open indexed Yearn positions' : 'Positions are unavailable'
}

function SavedWalletVaultRows({
  rows,
  wallets,
  growthByVault,
  isGrowthLoading,
  sortDirection
}: {
  rows: TSavedWalletVaultRow[]
  wallets: readonly Address[]
  growthByVault: ReadonlyMap<string, TMappedPortfolioGrowthVault>
  isGrowthLoading: boolean
  sortDirection: TSortDirection
}) {
  const sorted =
    sortDirection === 'asc'
      ? rows.toSorted(
          (a, b) => (a.position.value ?? Number.POSITIVE_INFINITY) - (b.position.value ?? Number.POSITIVE_INFINITY)
        )
      : rows

  return (
    <>
      {sorted.map(({ position, vault, yvUsdApy }) => {
        const key = `${position.chainId}:${position.vaultAddress}`
        const growth = growthByVault.get(getPortfolioGrowthVaultKey(position))
        if (!vault) return <UncataloguedVaultRow key={key} position={position} growth={growth} />
        const isLockedYvUsd = toAddress(position.vaultAddress) === YVUSD_LOCKED_ADDRESS
        const yvUsdPositionApy =
          yvUsdApy === undefined || position.value === null
            ? undefined
            : getYvUsdPositionApyBreakdown(
                isLockedYvUsd
                  ? { lockedValue: position.value, lockedApy: yvUsdApy }
                  : { unlockedValue: position.value, unlockedApy: yvUsdApy }
              )

        return (
          <VaultsListRowPresentation
            key={key}
            currentVault={vault}
            estimatedApyOverride={yvUsdApy}
            yvUsdPositionApy={yvUsdPositionApy}
            flags={{ hasHoldings: true }}
            hasWalletAddress
            holdingsValue={position.value}
            holdingsBreakdown={<WalletBreakdown position={position} />}
            portfolioWallets={wallets}
            isPortfolioGrowthLoading={isGrowthLoading}
            portfolioGrowth={toPortfolioGrowthDisplay(growth)}
            showBoostDetails={false}
            activeProductType="all"
            showStrategies
            showAllocatorChip={false}
            showProductTypeChipOverride
            showHoldingsChipOverride={false}
            mobileSecondaryMetric="holdings"
            expandedChartVariant="portfolio-user-tvl-overlay"
            clickEventName={PLAUSIBLE_EVENTS.VAULT_CLICK_PORTFOLIO_LIST_ROW}
          />
        )
      })}
    </>
  )
}

function WalletVaultGroup({
  wallet,
  rows,
  emptyMessage,
  date,
  timeframe,
  sortDirection
}: {
  wallet: Address
  rows: TSavedWalletVaultRow[]
  emptyMessage: string
  date: string
  timeframe: TPortfolioHistoryTimeframe
  sortDirection: TSortDirection
}) {
  const headingId = useId()
  const growth = useSavedWalletGrowth([wallet], date, timeframe, rows.length > 0)

  return (
    <section aria-labelledby={headingId} className="bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-2 border-border border-b bg-surface-secondary px-4 py-2.5 md:px-6">
        <h3 id={headingId} className="min-w-0 font-semibold text-sm">
          <PortfolioWalletLabel wallet={wallet} className="wrap-anywhere" />
        </h3>
        {growth.isError ? (
          <button type="button" className="text-sm underline" onClick={() => void growth.refetch()}>
            Retry growth
          </button>
        ) : null}
      </div>
      {rows.length ? (
        <div className="flex flex-col gap-px bg-border">
          <SavedWalletVaultRows
            rows={rows}
            wallets={[wallet]}
            growthByVault={mapPortfolioGrowthVaults(growth.data?.growth.vaults ?? [])}
            isGrowthLoading={growth.isPending}
            sortDirection={sortDirection}
          />
        </div>
      ) : (
        <p className="px-4 py-3 text-sm text-text-secondary md:px-6">{emptyMessage}</p>
      )}
    </section>
  )
}

export function SavedWalletPortfolio({ wallets }: { wallets: Address[] }) {
  const { allVaults } = useYearn()
  const { metrics: yvUsdMetrics } = useYvUsdVaults()
  const [denomination, setDenomination] = useState<TPortfolioHistoryDenomination>('usd')
  const [timeframe, setTimeframe] = useState<TPortfolioHistoryChartTimeframe>('1y')
  const [tab, setTab] = useState<TPortfolioHistoryChartTab>('balance')
  const [mode, setMode] = useState<TGrowthDisplayMode | null>(null)
  const [viewBy, setViewBy] = useState<TVaultView>('Bundle')
  const [sortDirection, setSortDirection] = useState<TSortDirection>('desc')
  const showWalletGroups = wallets.length > 1 && viewBy === 'Wallet'
  const settledDate = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10)
  const fetchTimeframe = timeframe === 'all' ? 'all' : '1y'
  const { positions, history, growth } = useSavedWalletPortfolio(wallets, settledDate, denomination, fetchTimeframe)
  const combined = combineWalletPositions(
    positions.map(({ data }) => data),
    settledDate
  )
  const chart = combineWalletHistory(
    history.map(({ data }) => data),
    settledDate
  ).slice(-getTimeframeLimit(timeframe))
  const protocolReturn = growth.data?.protocolReturn
  const annualized = protocolReturn?.dataPoints.at(-1)?.annualizedProtocolReturnPct
  const growthByVault = mapPortfolioGrowthVaults(growth.data?.growth.vaults ?? [])
  const loadingPositions = positions.some(({ isPending }) => isPending)
  const loadingHistory = history.some(({ isPending }) => isPending)
  const retryPositions = positions.filter(
    (query) =>
      !query.isPending &&
      (query.isError ||
        query.data?.summary.hasIncompleteShares ||
        query.data?.vaults.some((vault) => vault.status !== 'ok'))
  )
  const yvUsdApyByAddress: Partial<Record<Address, number | null>> = {
    [YVUSD_LOCKED_ADDRESS]: yvUsdMetrics.locked.apy || null,
    [YVUSD_UNLOCKED_ADDRESS]: yvUsdMetrics.unlocked.apy || null
  }
  function toVaultRow(position: TSavedWalletPosition): TSavedWalletVaultRow {
    const address = toAddress(position.vaultAddress)
    const vault = allVaults[address]
    return {
      position,
      vault: vault?.chainId === position.chainId ? vault : undefined,
      yvUsdApy: position.chainId === YVUSD_CHAIN_ID ? yvUsdApyByAddress[address] : undefined
    }
  }
  const rows = combined.rows.map(toVaultRow)
  const apy = rows.reduce(
    (totals, { position: { value }, vault, yvUsdApy }) => {
      if (value === null || value <= 0) return totals
      const estimated = vault ? calculateVaultEstimatedAPY(vault) : null
      const current =
        yvUsdApy !== undefined ? yvUsdApy : estimated === 0 && !vault?.performance?.historical?.net ? null : estimated
      const historical = vault ? calculateVaultHistoricalAPY(vault) : null
      return {
        current: totals.current !== null && current !== null ? totals.current + current * value : null,
        historical: totals.historical !== null && historical !== null ? totals.historical + historical * value : null
      }
    },
    { current: 0, historical: 0 } as { current: number | null; historical: number | null }
  )
  const completeValue = combined.fullyValuedWallets === wallets.length && combined.value ? combined.value : null

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <PortfolioOverview
        allowOverflow={tab === 'growth'}
        chart={
          <PortfolioHistoryChartControls
            activeTab={tab}
            onActiveTabChange={setTab}
            denomination={denomination}
            onDenominationChange={setDenomination}
            timeframe={timeframe}
            onTimeframeChange={setTimeframe}
            resolvedGrowthDisplayMode={mode ?? protocolReturn?.summary.recommendedGrowthDisplay ?? 'index'}
            onGrowthDisplayModeOverrideChange={setMode}
            className="h-full"
          >
            {tab === 'balance' ? (
              <section className="flex min-h-[380px] flex-col pt-16" aria-label="Balance history">
                {chart.some((point) => point.value !== null) ? (
                  <SavedWalletHistoryChart data={chart} denomination={denomination} />
                ) : (
                  <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 text-sm text-text-secondary">
                    {loadingHistory ? <YearnLogoSpinner className="size-10" logoClassName="size-6" /> : null}
                    {loadingHistory ? 'Loading balance history…' : 'Balance history is unavailable.'}
                  </div>
                )}
              </section>
            ) : (
              <div className="h-[380px]">
                <PortfolioHistoryChart
                  balanceData={null}
                  balanceIsLoading={false}
                  protocolReturnData={protocolReturn?.dataPoints ?? null}
                  protocolReturnSummary={protocolReturn?.summary ?? null}
                  protocolReturnFamilySeries={protocolReturn?.familySeries ?? []}
                  protocolReturnIsLoading={growth.isPending}
                  protocolReturnIsEmpty={protocolReturn?.dataPoints.length === 0}
                  protocolReturnError={growth.error}
                  denomination={denomination}
                  timeframe={timeframe}
                  activeTab={tab}
                  growthDisplayModeOverride={mode}
                  onGrowthDisplayModeOverrideChange={setMode}
                  embedded
                />
              </div>
            )}
          </PortfolioHistoryChartControls>
        }
        metrics={
          <PortfolioHeaderSection
            totalPortfolioValue={combined.value}
            balanceNote={
              retryPositions.length || growth.isError ? (
                <div className="mt-1 space-y-0.5 text-xs text-text-secondary">
                  {retryPositions.length ? (
                    <button
                      type="button"
                      className="underline"
                      onClick={() => retryPositions.forEach(({ refetch }) => void refetch())}
                    >
                      Retry positions
                    </button>
                  ) : null}
                  {growth.isError ? (
                    <button type="button" className="block underline" onClick={() => void growth.refetch()}>
                      Retry growth
                    </button>
                  ) : null}
                </div>
              ) : undefined
            }
            blendedMetrics={{
              blendedCurrentAPY: completeValue && apy.current !== null ? (apy.current / completeValue) * 100 : null,
              blendedHistoricalAPY:
                completeValue && apy.historical !== null ? (apy.historical / completeValue) * 100 : null,
              estimatedAnnualReturn: completeValue ? apy.current : null
            }}
            hasKatanaHoldings={combined.rows.some(({ chainId }) => chainId === 747474)}
            isHoldingsLoading={loadingPositions && combined.value === null}
            isSearchingBalances={false}
            isProtocolReturnLoading={growth.isPending}
            annualizedProtocolReturnPct={annualized}
            annualizedIsPartial={Boolean(protocolReturn?.summary.growthIsPartial?.usd)}
          />
        }
      />
      <section className="flex flex-col gap-2" aria-label="Vault positions">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-semibold text-lg text-text-primary">Vaults</h2>
          {wallets.length > 1 ? (
            <PortfolioDropdown
              label={`View by: ${viewBy}`}
              value={viewBy}
              onChange={setViewBy}
              groups={[{ options: vaultViewOptions.map((option) => ({ value: option, label: option })) }]}
            />
          ) : null}
        </div>
        {showWalletGroups || rows.length ? (
          <div className="rounded-lg">
            <VaultsListHead
              sortBy="holdings"
              sortDirection={sortDirection}
              onSort={(_, direction) => setSortDirection(direction)}
              wrapperClassName="rounded-t-lg border border-border bg-surface-secondary"
              containerClassName="rounded-t-lg bg-surface-secondary"
              leftColumnClassName="col-span-9"
              rightColumnClassName="col-span-15"
              items={[
                { label: 'Vault Name', value: 'vault', sortable: false, className: 'col-span-12' },
                { label: 'Est. APY', value: 'apy', sortable: false, className: 'col-span-3' },
                { label: 'TVL', value: 'tvl', sortable: false, className: 'col-span-3' },
                { label: 'Growth', value: 'growth', sortable: false, className: 'col-span-3' },
                { label: 'Holdings', value: 'holdings', className: 'col-span-3 justify-end' }
              ]}
            />
            <div className="flex flex-col gap-px overflow-hidden rounded-lg border border-border bg-border md:rounded-t-none md:border-t-0">
              {showWalletGroups ? (
                wallets.map((wallet, index) => {
                  const query = positions[index]
                  const group = combineWalletPositions([query?.data], settledDate)
                  return (
                    <WalletVaultGroup
                      key={wallet}
                      wallet={wallet}
                      rows={group.rows.map(toVaultRow)}
                      emptyMessage={getEmptyPositionsMessage(Boolean(query?.isPending), group.fullyValuedWallets === 1)}
                      date={settledDate}
                      timeframe={fetchTimeframe}
                      sortDirection={sortDirection}
                    />
                  )
                })
              ) : (
                <SavedWalletVaultRows
                  rows={rows}
                  wallets={wallets}
                  growthByVault={growthByVault}
                  isGrowthLoading={growth.isPending}
                  sortDirection={sortDirection}
                />
              )}
            </div>
          </div>
        ) : (
          <EmptyState
            size="sm"
            title={getEmptyPositionsMessage(loadingPositions, combined.fullyValuedWallets === wallets.length)}
            icon={loadingPositions ? <YearnLogoSpinner className="size-10" logoClassName="size-6" /> : undefined}
          />
        )}
      </section>
    </div>
  )
}
