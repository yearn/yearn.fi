import type { ChartConfig } from '@pages/vaults/components/detail/charts/ChartPrimitives'
import { ChartContainer, ChartTooltip } from '@pages/vaults/components/detail/charts/ChartPrimitives'
import {
  CHART_WITH_AXES_MARGIN,
  CHART_Y_AXIS_TICK_MARGIN,
  CHART_Y_AXIS_TICK_STYLE,
  CHART_Y_AXIS_WIDTH
} from '@pages/vaults/components/detail/charts/chartLayout'
import { getVaultAddress } from '@pages/vaults/domain/kongVaultSelectors'
import {
  formatChartMonthYearLabel,
  formatChartTooltipDate,
  formatChartWeekLabel,
  getChartMonthlyTicks,
  getChartWeeklyTicks,
  getTimeframeLimit
} from '@pages/vaults/utils/charts'
import { useYearn } from '@shared/contexts/useYearn'
import { IconSpinner } from '@shared/icons/IconSpinner'
import { cl, formatPercent, formatUSD, SELECTOR_BAR_STYLES } from '@shared/utils'
import { getVaultName as getDisplayVaultName } from '@shared/utils/helpers'
import type { ReactElement } from 'react'
import { useId, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { Area, CartesianGrid, ComposedChart, Line, XAxis, YAxis } from 'recharts'
import type {
  TPortfolioHistoryChartData,
  TPortfolioHistoryDenomination,
  TPortfolioProtocolReturnHistoryChartData,
  TPortfolioProtocolReturnHistoryFamilySeries,
  TPortfolioProtocolReturnHistorySummary
} from '../types/api'
import { PortfolioHistoryBreakdownModal } from './PortfolioHistoryBreakdownModal'

export type TPortfolioHistoryChartTimeframe = '30d' | '90d' | '1y' | 'all'
type TPortfolioHistoryChartTab = 'balance' | 'growth' | 'return' | 'annualized' | 'index'
type TGrowthDisplayMode = 'auto' | 'index' | 'usd' | 'eth'
type TResolvedGrowthDisplayMode = Exclude<TGrowthDisplayMode, 'auto'>

type TPortfolioHistoryChartProps = {
  balanceData: TPortfolioHistoryChartData | null
  protocolReturnData: TPortfolioProtocolReturnHistoryChartData | null
  protocolReturnSummary: TPortfolioProtocolReturnHistorySummary | null
  protocolReturnFamilySeries: TPortfolioProtocolReturnHistoryFamilySeries
  denomination: TPortfolioHistoryDenomination
  onDenominationChange: (denomination: TPortfolioHistoryDenomination) => void
  timeframe: TPortfolioHistoryChartTimeframe
  onTimeframeChange: (timeframe: TPortfolioHistoryChartTimeframe) => void
  balanceIsLoading: boolean
  balanceIsEmpty?: boolean
  balanceError?: Error | null
  protocolReturnIsLoading: boolean
  protocolReturnIsEmpty?: boolean
  protocolReturnError?: Error | null
  embedded?: boolean
  className?: string
}

type TChartPoint = {
  date: string
  value: number | null
}

type TIndexChartPoint = {
  date: string
  aggregate: number | null
  [seriesKey: string]: string | number | null
}

type TIndexedFamilySeries = {
  key: string
  label: string
  color: string
  points: TChartPoint[]
}

type TPortfolioHistoryTooltipProps = {
  active?: boolean
  payload?: Array<{
    value?: unknown
    payload?: {
      date?: string
      value?: unknown
    }
  }>
}

type TActiveChartState = {
  activeLabel?: string | number
}

const CHART_TABS: Array<{ id: TPortfolioHistoryChartTab; label: string }> = [
  { id: 'balance', label: 'Balance' },
  { id: 'growth', label: 'Growth' },
  { id: 'return', label: 'Cumulative %' },
  { id: 'annualized', label: 'Annualized %' },
  { id: 'index', label: 'Growth Index' }
]
const GROWTH_DISPLAY_MODES: Array<{ id: TGrowthDisplayMode; label: string }> = [
  { id: 'auto', label: 'Auto' },
  { id: 'index', label: 'Index' },
  { id: 'usd', label: 'USD' },
  { id: 'eth', label: 'ETH' }
]

const INDEX_SERIES_COLORS = ['#2578ff', '#46a2ff', '#94adf2', '#7bb3a8', '#e1a23b', '#b67ae5'] as const

const EXAMPLE_PORTFOLIO_USD_DATA: TPortfolioHistoryChartData = [
  { date: '2025-05-01', value: 1800 },
  { date: '2025-06-01', value: 2600 },
  { date: '2025-07-01', value: 2450 },
  { date: '2025-08-01', value: 3900 },
  { date: '2025-09-01', value: 5100 },
  { date: '2025-10-01', value: 6800 },
  { date: '2025-11-01', value: 6400 },
  { date: '2025-12-01', value: 8900 },
  { date: '2026-01-01', value: 10450 },
  { date: '2026-02-01', value: 12100 },
  { date: '2026-03-01', value: 14800 },
  { date: '2026-04-01', value: 17250 }
]

function formatBalanceValue(value: number, denomination: TPortfolioHistoryDenomination): string {
  if (denomination === 'eth') {
    return `${value.toFixed(value >= 100 ? 2 : value >= 1 ? 3 : 4)} ETH`
  }

  return formatUSD(value, 2, 2)
}

function formatEthValue(value: number): string {
  const absoluteValue = Math.abs(value)
  const formattedValue =
    absoluteValue >= 100
      ? absoluteValue.toFixed(2)
      : absoluteValue >= 1
        ? absoluteValue.toFixed(3)
        : absoluteValue.toFixed(4)

  return `${formattedValue} ETH`
}

function formatGrowthValue(value: number, mode: TResolvedGrowthDisplayMode): string {
  if (mode === 'eth') {
    const absolute = formatEthValue(value)
    if (value > 0) {
      return `+${absolute}`
    }
    if (value < 0) {
      return `-${absolute}`
    }
    return absolute
  }

  const absolute = formatUSD(Math.abs(value), 2, 2)
  if (value > 0) {
    return `+${absolute}`
  }
  if (value < 0) {
    return `-${absolute}`
  }
  return absolute
}

function formatReturnValue(value: number): string {
  const absolute = formatPercent(Math.abs(value), 2, 2, 10_000)
  if (value > 0) {
    return `+${absolute}`
  }
  if (value < 0) {
    return `-${absolute}`
  }
  return absolute
}

function formatIndexValue(value: number): string {
  return value >= 1000 ? value.toFixed(0) : value >= 100 ? value.toFixed(1) : value.toFixed(2)
}

function rebaseIndexPoints(points: TChartPoint[]): TChartPoint[] {
  const baseValue = points.find(
    (point): point is { date: string; value: number } =>
      typeof point.value === 'number' && Number.isFinite(point.value) && point.value !== 0
  )?.value

  if (!baseValue) {
    return points
  }

  return points.map((point) => ({
    date: point.date,
    value:
      typeof point.value === 'number' && Number.isFinite(point.value) ? (point.value / baseValue) * 100 : point.value
  }))
}

function resolveGrowthDisplayMode(
  selectedMode: TGrowthDisplayMode,
  summary: TPortfolioProtocolReturnHistorySummary | null,
  protocolReturnData: TPortfolioProtocolReturnHistoryChartData | null
): TResolvedGrowthDisplayMode {
  const recommendedMode = selectedMode === 'auto' ? (summary?.recommendedGrowthDisplay ?? 'index') : selectedMode
  const hasEthSeries = Boolean(protocolReturnData?.some((point) => point.growthWeightEth !== null))

  return recommendedMode === 'eth' && !hasEthSeries ? 'index' : recommendedMode
}

function getAutoGrowthDisplayExplanation(args: {
  summary: TPortfolioProtocolReturnHistorySummary | null
  resolvedMode: TResolvedGrowthDisplayMode
}): string | null {
  const summary = args.summary
  if (!summary) {
    return null
  }

  return summary.recommendedGrowthDisplayReason === 'stable_dominant'
    ? 'Auto: stable-dominant portfolio, showing USD'
    : summary.recommendedGrowthDisplayReason === 'eth_dominant'
      ? args.resolvedMode === 'eth'
        ? 'Auto: ETH-dominant portfolio, showing ETH'
        : 'Auto: ETH-dominant portfolio, ETH history unavailable, showing Index'
      : 'Auto: mixed portfolio, showing Index'
}

function buildIndexedFamilySeries(
  familySeries: TPortfolioProtocolReturnHistoryFamilySeries,
  timeframe: TPortfolioHistoryChartTimeframe,
  labelByVaultKey: Record<string, string>
): TIndexedFamilySeries[] {
  const limit = getTimeframeLimit(timeframe)

  return familySeries
    .map((series) => {
      const points =
        !Number.isFinite(limit) || limit >= series.dataPoints.length
          ? series.dataPoints
          : series.dataPoints.slice(-limit)

      return {
        series,
        points: rebaseIndexPoints(points.map((point) => ({ date: point.date, value: point.growthIndex })))
      }
    })
    .filter(({ points }) => points.some((point) => point.value !== null))
    .slice(0, INDEX_SERIES_COLORS.length - 1)
    .map(({ series, points }, index) => ({
      key: `family_${index}`,
      label:
        labelByVaultKey[`${series.chainId}:${series.vaultAddress.toLowerCase()}`] ??
        series.symbol ??
        `${series.vaultAddress.slice(0, 6)}…${series.vaultAddress.slice(-4)}`,
      color: INDEX_SERIES_COLORS[index + 1],
      points
    }))
}

function PortfolioGrowthIndexTooltip({
  active,
  payload,
  indexSeriesLabels
}: TPortfolioHistoryTooltipProps & {
  indexSeriesLabels: Record<string, string>
}): ReactElement | null {
  if (!active || !payload?.length) {
    return null
  }

  const date = payload[0]?.payload?.date
  if (!date) {
    return null
  }

  const rows = payload
    .flatMap((entry) => {
      const dataKey =
        typeof (entry as { dataKey?: unknown }).dataKey === 'string' ? (entry as { dataKey: string }).dataKey : ''
      const value = typeof entry.value === 'number' ? entry.value : Number(entry.value ?? NaN)
      if (!Number.isFinite(value)) {
        return []
      }

      return [
        {
          key: dataKey,
          label: indexSeriesLabels[dataKey] ?? dataKey,
          value,
          color:
            typeof (entry as { color?: unknown }).color === 'string'
              ? ((entry as { color: string }).color as string)
              : 'var(--color-text-primary)'
        }
      ]
    })
    .sort((left, right) => (left.key === 'aggregate' ? -1 : right.key === 'aggregate' ? 1 : 0))

  return (
    <div
      className={
        'pointer-events-none flex min-w-[13rem] flex-col gap-2 rounded-xl border border-border bg-surface px-3 py-3 shadow-xl'
      }
    >
      <span className={'text-xs font-medium uppercase tracking-[0.12em] text-text-tertiary'}>
        {formatChartTooltipDate(date)}
      </span>
      <div className={'flex flex-col gap-1.5'}>
        {rows.map((row) => (
          <div key={row.key} className={'flex items-center justify-between gap-3'}>
            <span className={'inline-flex items-center gap-2 text-xs text-text-secondary'}>
              <span className={'size-2 rounded-full'} style={{ backgroundColor: row.color }} />
              <span>{row.label}</span>
            </span>
            <span className={'text-sm font-semibold text-text-primary'}>{formatIndexValue(row.value)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function PortfolioHistoryTooltip({
  active,
  payload,
  activeTab,
  denomination,
  growthDisplayMode
}: TPortfolioHistoryTooltipProps & {
  activeTab: TPortfolioHistoryChartTab
  denomination: TPortfolioHistoryDenomination
  growthDisplayMode: TResolvedGrowthDisplayMode
}): ReactElement | null {
  if (!active || !payload?.length) {
    return null
  }

  const point = payload[0]?.payload
  const date = point?.date
  const value = Number(payload[0]?.value ?? point?.value ?? 0)

  if (!date) {
    return null
  }

  const formattedValue =
    activeTab === 'balance'
      ? formatBalanceValue(value, denomination)
      : activeTab === 'growth'
        ? growthDisplayMode === 'index'
          ? formatIndexValue(value)
          : formatGrowthValue(value, growthDisplayMode)
        : activeTab === 'index'
          ? formatIndexValue(value)
          : formatReturnValue(value)

  return (
    <div
      className={
        'pointer-events-none flex min-w-[13rem] flex-col gap-2 rounded-xl border border-border bg-surface px-3 py-3 shadow-xl'
      }
    >
      <div className={'flex flex-col gap-0.5'}>
        <span className={'text-xs font-medium uppercase tracking-[0.12em] text-text-tertiary'}>
          {formatChartTooltipDate(date)}
        </span>
        <span className={'text-sm font-semibold text-text-primary'}>{formattedValue}</span>
      </div>
      {activeTab === 'balance' ? (
        <span className={'text-xs font-medium text-text-secondary'}>
          {value > 0 ? 'Click to see breakdown' : 'No breakdown available for this point'}
        </span>
      ) : null}
    </div>
  )
}

function getChartDescription(
  activeTab: TPortfolioHistoryChartTab,
  growthDisplayMode: TResolvedGrowthDisplayMode
): string {
  if (activeTab === 'growth') {
    return growthDisplayMode === 'index'
      ? 'Normalized protocol-return index for the whole wallet. Starts at 100 at the beginning of the selected timeframe.'
      : growthDisplayMode === 'eth'
        ? 'Cumulative protocol growth earned while funds were held in your wallet, shown in receipt-time ETH equivalent.'
        : 'Cumulative protocol growth earned while funds were held in your wallet, shown in receipt-time USD equivalent.'
  }

  if (activeTab === 'index') {
    return 'Wallet growth index plus vault comparison lines. Each line starts at 100 at the beginning of the selected timeframe.'
  }

  if (activeTab === 'return') {
    return 'Cumulative protocol return with deposits and withdrawals normalized out of the series.'
  }

  if (activeTab === 'annualized') {
    return 'Annualized protocol return based on time-weighted baseline exposure up to each point.'
  }

  return 'Daily settled portfolio value across your current Yearn activity.'
}

function getChartTitle(activeTab: TPortfolioHistoryChartTab, growthDisplayMode: TResolvedGrowthDisplayMode): string {
  if (activeTab === 'growth') {
    return growthDisplayMode === 'index' ? 'Growth Index' : 'Protocol Growth'
  }

  if (activeTab === 'return') {
    return 'Cumulative Return'
  }

  if (activeTab === 'annualized') {
    return 'Annualized Return'
  }

  if (activeTab === 'index') {
    return 'Growth Index'
  }

  return 'Holdings History'
}

function getEmptyMessage(activeTab: TPortfolioHistoryChartTab, growthDisplayMode: TResolvedGrowthDisplayMode): string {
  if (activeTab === 'growth') {
    return growthDisplayMode === 'index'
      ? 'No growth index history available'
      : growthDisplayMode === 'eth'
        ? 'No ETH-equivalent protocol growth history available'
        : 'No protocol growth history available'
  }

  if (activeTab === 'return') {
    return 'No protocol return history available'
  }

  if (activeTab === 'annualized') {
    return 'No annualized return history available'
  }

  if (activeTab === 'index') {
    return 'No growth index history available'
  }

  return 'No holdings history available'
}

export function PortfolioHistoryChart({
  balanceData,
  protocolReturnData,
  protocolReturnSummary,
  protocolReturnFamilySeries,
  denomination,
  onDenominationChange,
  timeframe,
  onTimeframeChange,
  balanceIsLoading,
  balanceIsEmpty = false,
  balanceError,
  protocolReturnIsLoading,
  protocolReturnIsEmpty = false,
  protocolReturnError,
  embedded = false,
  className
}: TPortfolioHistoryChartProps): ReactElement {
  const { allVaults } = useYearn()
  const [activeTab, setActiveTab] = useState<TPortfolioHistoryChartTab>('balance')
  const [growthDisplayMode, setGrowthDisplayMode] = useState<TGrowthDisplayMode>('auto')
  const [hoveredBreakdownDate, setHoveredBreakdownDate] = useState<string | null>(null)
  const [selectedBreakdownDate, setSelectedBreakdownDate] = useState<string | null>(null)
  const [isBreakdownModalOpen, setIsBreakdownModalOpen] = useState(false)
  const gradientId = useId().replace(/:/g, '')
  const resolvedGrowthDisplayMode = resolveGrowthDisplayMode(
    growthDisplayMode,
    protocolReturnSummary,
    protocolReturnData
  )
  const autoGrowthDisplayExplanation =
    growthDisplayMode === 'auto'
      ? getAutoGrowthDisplayExplanation({ summary: protocolReturnSummary, resolvedMode: resolvedGrowthDisplayMode })
      : null

  const sectionClassName = embedded
    ? 'flex h-full flex-col gap-3 bg-surface px-5 py-4 md:px-6 md:pb-0 md:pt-5'
    : 'flex h-full flex-col gap-4 rounded-lg border border-border bg-surface p-6'

  const filteredBalanceData = useMemo<TChartPoint[]>(() => {
    if (!balanceData) {
      return []
    }

    const limit = getTimeframeLimit(timeframe)
    const points = !Number.isFinite(limit) || limit >= balanceData.length ? balanceData : balanceData.slice(-limit)
    return points.map((point) => ({ date: point.date, value: point.value }))
  }, [balanceData, timeframe])

  const filteredGrowthUsdData = useMemo<TChartPoint[]>(() => {
    if (!protocolReturnData) {
      return []
    }

    const limit = getTimeframeLimit(timeframe)
    const points =
      !Number.isFinite(limit) || limit >= protocolReturnData.length
        ? protocolReturnData
        : protocolReturnData.slice(-limit)

    return points.map((point) => ({
      date: point.date,
      value: point.growthWeightUsd
    }))
  }, [protocolReturnData, timeframe])

  const filteredGrowthEthData = useMemo<TChartPoint[]>(() => {
    if (!protocolReturnData) {
      return []
    }

    const limit = getTimeframeLimit(timeframe)
    const points =
      !Number.isFinite(limit) || limit >= protocolReturnData.length
        ? protocolReturnData
        : protocolReturnData.slice(-limit)

    return points.map((point) => ({
      date: point.date,
      value: point.growthWeightEth
    }))
  }, [protocolReturnData, timeframe])

  const filteredGrowthIndexData = useMemo<TChartPoint[]>(() => {
    if (!protocolReturnData) {
      return []
    }

    const limit = getTimeframeLimit(timeframe)
    const points =
      !Number.isFinite(limit) || limit >= protocolReturnData.length
        ? protocolReturnData
        : protocolReturnData.slice(-limit)

    return rebaseIndexPoints(
      points.map((point) => ({
        date: point.date,
        value: point.growthIndex
      }))
    )
  }, [protocolReturnData, timeframe])

  const filteredReturnData = useMemo<TChartPoint[]>(() => {
    if (!protocolReturnData) {
      return []
    }

    const limit = getTimeframeLimit(timeframe)
    const points =
      !Number.isFinite(limit) || limit >= protocolReturnData.length
        ? protocolReturnData
        : protocolReturnData.slice(-limit)

    return points.map((point) => ({
      date: point.date,
      value: point.protocolReturnPct
    }))
  }, [protocolReturnData, timeframe])

  const filteredAnnualizedReturnData = useMemo<TChartPoint[]>(() => {
    if (!protocolReturnData) {
      return []
    }

    const limit = getTimeframeLimit(timeframe)
    const points =
      !Number.isFinite(limit) || limit >= protocolReturnData.length
        ? protocolReturnData
        : protocolReturnData.slice(-limit)

    return points.map((point) => ({
      date: point.date,
      value: point.annualizedProtocolReturnPct
    }))
  }, [protocolReturnData, timeframe])

  const familyLabelByVaultKey = useMemo<Record<string, string>>(() => {
    return Object.values(allVaults).reduce<Record<string, string>>((labels, vault) => {
      labels[`${vault.chainId}:${getVaultAddress(vault).toLowerCase()}`] = getDisplayVaultName(vault)
      return labels
    }, {})
  }, [allVaults])

  const activeData =
    activeTab === 'balance'
      ? filteredBalanceData
      : activeTab === 'growth'
        ? resolvedGrowthDisplayMode === 'eth'
          ? filteredGrowthEthData
          : resolvedGrowthDisplayMode === 'usd'
            ? filteredGrowthUsdData
            : filteredGrowthIndexData
        : activeTab === 'index'
          ? filteredGrowthIndexData
          : activeTab === 'return'
            ? filteredReturnData
            : filteredAnnualizedReturnData
  const activeIsLoading = activeTab === 'balance' ? balanceIsLoading : protocolReturnIsLoading
  const activeIsEmpty = activeTab === 'balance' ? balanceIsEmpty : protocolReturnIsEmpty
  const activeError = activeTab === 'balance' ? balanceError : protocolReturnError
  const activeHasRenderableValue = activeData.some((point) => point.value !== null)
  const tickSourceData = activeData

  const isShortTimeframe = timeframe === '30d'
  const ticks = useMemo(
    () => (isShortTimeframe ? getChartWeeklyTicks(tickSourceData) : getChartMonthlyTicks(tickSourceData)),
    [tickSourceData, isShortTimeframe]
  )
  const tickFormatter = isShortTimeframe ? formatChartWeekLabel : formatChartMonthYearLabel

  const formatValueTick = (value: number | string) => {
    const numericValue = Number(value)
    const absoluteValue = Math.abs(numericValue)
    if (numericValue === 0) {
      return activeTab === 'return' ? '0%' : ''
    }

    if (activeTab === 'balance') {
      if (denomination === 'eth') {
        if (absoluteValue >= 1_000) {
          return `${numericValue < 0 ? '-' : ''}${(absoluteValue / 1_000).toFixed(1)}k`
        }
        return numericValue >= 10 || numericValue <= -10 ? numericValue.toFixed(0) : numericValue.toFixed(2)
      }

      if (absoluteValue >= 1_000_000) {
        return `${numericValue < 0 ? '-' : ''}$${(absoluteValue / 1_000_000).toFixed(1)}M`
      }
      if (absoluteValue >= 1_000) {
        return `${numericValue < 0 ? '-' : ''}$${(absoluteValue / 1_000).toFixed(1)}k`
      }
      return `${numericValue < 0 ? '-' : ''}$${absoluteValue.toFixed(0)}`
    }

    if (activeTab === 'growth') {
      if (resolvedGrowthDisplayMode === 'index') {
        return formatIndexValue(numericValue)
      }

      if (resolvedGrowthDisplayMode === 'eth') {
        if (absoluteValue >= 1_000) {
          return `${numericValue < 0 ? '-' : ''}${(absoluteValue / 1_000).toFixed(1)}k`
        }

        return absoluteValue >= 10
          ? `${numericValue.toFixed(1)}`
          : absoluteValue >= 1
            ? `${numericValue.toFixed(2)}`
            : `${numericValue.toFixed(3)}`
      }

      if (absoluteValue >= 1_000_000) {
        return `${numericValue < 0 ? '-' : ''}$${(absoluteValue / 1_000_000).toFixed(1)}M`
      }
      if (absoluteValue >= 1_000) {
        return `${numericValue < 0 ? '-' : ''}$${(absoluteValue / 1_000).toFixed(1)}k`
      }
      return `${numericValue < 0 ? '-' : ''}$${absoluteValue.toFixed(0)}`
    }

    if (activeTab === 'index') {
      return formatIndexValue(numericValue)
    }

    if (absoluteValue >= 1000) {
      return `${numericValue.toFixed(0)}%`
    }
    if (absoluteValue >= 10) {
      return `${numericValue.toFixed(1)}%`
    }
    return `${numericValue.toFixed(2)}%`
  }

  const chartConfig = useMemo<ChartConfig>(() => {
    return {
      value: {
        label:
          activeTab === 'balance'
            ? denomination === 'eth'
              ? 'Total Value (ETH)'
              : 'Total Value (USD)'
            : activeTab === 'growth'
              ? resolvedGrowthDisplayMode === 'index'
                ? 'Growth Index'
                : resolvedGrowthDisplayMode === 'eth'
                  ? 'Protocol Growth (ETH)'
                  : 'Protocol Growth (USD)'
              : activeTab === 'index'
                ? 'Growth Index'
                : 'Protocol Return (%)',
        color: 'var(--chart-1)'
      }
    }
  }, [activeTab, denomination, resolvedGrowthDisplayMode])

  const exampleChartConfig = useMemo<ChartConfig>(() => {
    return {
      value: {
        label: denomination === 'eth' ? 'Example Value (ETH)' : 'Example Value (USD)',
        color: 'var(--color-neutral-400)'
      }
    }
  }, [denomination])

  const exampleData = useMemo<TPortfolioHistoryChartData>(
    () =>
      denomination === 'eth'
        ? EXAMPLE_PORTFOLIO_USD_DATA.map((point) => ({ ...point, value: point.value / 2500 }))
        : EXAMPLE_PORTFOLIO_USD_DATA,
    [denomination]
  )

  const getBreakdownPoint = (date: string | null) => {
    if (!date || activeTab !== 'balance') {
      return null
    }

    return filteredBalanceData.find((point) => point.date === date) ?? null
  }

  const handleChartMouseMove = (state: TActiveChartState | undefined): void => {
    if (activeTab !== 'balance') {
      return
    }

    const nextDate = typeof state?.activeLabel === 'string' ? state.activeLabel : null
    setHoveredBreakdownDate((currentDate) => (currentDate === nextDate ? currentDate : nextDate))
  }

  const handleChartMouseLeave = (): void => {
    if (activeTab !== 'balance') {
      return
    }

    setHoveredBreakdownDate(null)
  }

  const handleChartClick = (state?: TActiveChartState): void => {
    if (activeTab !== 'balance') {
      return
    }

    const clickedDate = typeof state?.activeLabel === 'string' ? state.activeLabel : hoveredBreakdownDate
    const selectedPoint = getBreakdownPoint(clickedDate)
    if (!selectedPoint || Number(selectedPoint.value ?? 0) <= 0) {
      return
    }

    setSelectedBreakdownDate(selectedPoint.date)
    setIsBreakdownModalOpen(true)
  }

  const renderHeader = (showControls = false): ReactElement => (
    <div className={'flex flex-col gap-2.5 md:gap-3'}>
      <div className={'flex items-start justify-between gap-3'}>
        <div className={'flex min-w-0 flex-1 flex-col gap-0.5'}>
          <h2 className={'text-xl font-semibold text-text-primary'}>
            {getChartTitle(activeTab, resolvedGrowthDisplayMode)}
          </h2>
          <p className={'text-xs text-text-secondary min-h-[2lh]'}>
            {getChartDescription(activeTab, resolvedGrowthDisplayMode)}
          </p>
          <p
            aria-hidden={!autoGrowthDisplayExplanation}
            className={cl(
              'text-[11px] font-medium uppercase tracking-[0.08em] text-text-tertiary',
              autoGrowthDisplayExplanation ? '' : 'invisible'
            )}
          >
            {autoGrowthDisplayExplanation ?? 'Auto: stable-dominant portfolio, showing USD'}
          </p>
        </div>
        {activeTab === 'balance' ? (
          <div className={cl('flex items-center gap-0.5 md:gap-1', SELECTOR_BAR_STYLES.container)}>
            {(['usd', 'eth'] as const).map((nextDenomination) => (
              <button
                key={nextDenomination}
                type={'button'}
                onClick={() => onDenominationChange(nextDenomination)}
                className={cl(
                  'flex-1 md:flex-initial rounded-sm px-2 md:px-3 py-2 md:py-1 text-xs font-semibold uppercase tracking-wide transition-all',
                  'min-h-[36px] md:min-h-0 active:scale-[0.98]',
                  SELECTOR_BAR_STYLES.buttonBase,
                  denomination === nextDenomination
                    ? SELECTOR_BAR_STYLES.buttonActive
                    : SELECTOR_BAR_STYLES.buttonInactive
                )}
              >
                {nextDenomination.toUpperCase()}
              </button>
            ))}
          </div>
        ) : activeTab === 'growth' ? (
          <div className={cl('flex items-center gap-0.5 md:gap-1', SELECTOR_BAR_STYLES.container)}>
            {GROWTH_DISPLAY_MODES.map((mode) => (
              <button
                key={mode.id}
                type={'button'}
                onClick={() => setGrowthDisplayMode(mode.id)}
                className={cl(
                  'flex-1 md:flex-initial rounded-sm px-2 md:px-3 py-2 md:py-1 text-xs font-semibold uppercase tracking-wide transition-all',
                  'min-h-[36px] md:min-h-0 active:scale-[0.98]',
                  SELECTOR_BAR_STYLES.buttonBase,
                  growthDisplayMode === mode.id ? SELECTOR_BAR_STYLES.buttonActive : SELECTOR_BAR_STYLES.buttonInactive
                )}
              >
                {mode.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      {showControls ? (
        <div className={'flex flex-col gap-2 md:flex-row md:items-center md:justify-between'}>
          <div className={cl('flex items-center gap-0.5 md:gap-1 w-full md:w-auto', SELECTOR_BAR_STYLES.container)}>
            {CHART_TABS.map((tab) => (
              <button
                key={tab.id}
                type={'button'}
                onClick={() => setActiveTab(tab.id)}
                className={cl(
                  'flex-1 md:flex-initial rounded-sm px-2 md:px-3 py-2 md:py-1 text-xs font-semibold transition-all',
                  'min-h-[36px] md:min-h-0 active:scale-[0.98]',
                  SELECTOR_BAR_STYLES.buttonBase,
                  activeTab === tab.id ? SELECTOR_BAR_STYLES.buttonActive : SELECTOR_BAR_STYLES.buttonInactive
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className={cl('flex items-center gap-0.5 md:gap-1 w-full md:w-auto', SELECTOR_BAR_STYLES.container)}>
            {(['30d', '90d', '1y', 'all'] as const).map((tf) => (
              <button
                key={tf}
                type={'button'}
                onClick={() => onTimeframeChange(tf)}
                className={cl(
                  'flex-1 md:flex-initial rounded-sm px-2 md:px-3 py-2 md:py-1 text-xs font-semibold uppercase tracking-wide transition-all',
                  'min-h-[36px] md:min-h-0 active:scale-[0.98]',
                  SELECTOR_BAR_STYLES.buttonBase,
                  timeframe === tf ? SELECTOR_BAR_STYLES.buttonActive : SELECTOR_BAR_STYLES.buttonInactive
                )}
              >
                {tf.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )

  if (activeIsLoading) {
    return (
      <section className={cl(sectionClassName, className)}>
        {renderHeader(true)}
        <div className={'flex min-h-[240px] items-center justify-center'}>
          <IconSpinner className={'size-8 animate-spin text-text-secondary'} />
        </div>
      </section>
    )
  }

  if (activeError) {
    return (
      <section className={cl(sectionClassName, className)}>
        {renderHeader(true)}
        <div className={'flex min-h-[240px] items-center justify-center'}>
          <p className={'text-base text-text-secondary'}>
            {activeTab === 'balance'
              ? 'Unable to load holdings history right now'
              : 'Unable to load protocol return history right now'}
          </p>
        </div>
      </section>
    )
  }

  if (activeIsEmpty && activeTab === 'balance') {
    return (
      <section className={cl(sectionClassName, className)}>
        {renderHeader(true)}
        <div
          className={
            'relative h-[320px] overflow-hidden rounded-2xl border border-dashed border-border bg-surface-secondary sm:h-[280px]'
          }
        >
          <div className={'absolute inset-0 opacity-75'}>
            <ChartContainer config={exampleChartConfig} style={{ height: '100%', aspectRatio: 'unset' }}>
              <ComposedChart data={exampleData} margin={CHART_WITH_AXES_MARGIN}>
                <defs>
                  <linearGradient id={`${gradientId}-example`} x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-neutral-400)" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="var(--color-neutral-400)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} strokeDasharray={'4 6'} stroke={'var(--color-border)'} />
                <XAxis
                  dataKey={'date'}
                  ticks={getChartMonthlyTicks(exampleData)}
                  tickFormatter={formatChartMonthYearLabel}
                  tick={{ fill: 'var(--color-text-tertiary)' }}
                  axisLine={{ stroke: 'var(--color-border)' }}
                  tickLine={{ stroke: 'var(--color-border)' }}
                />
                <YAxis
                  domain={[0, 'auto']}
                  tickFormatter={formatValueTick}
                  mirror
                  width={CHART_Y_AXIS_WIDTH}
                  tickMargin={CHART_Y_AXIS_TICK_MARGIN}
                  tick={{ ...CHART_Y_AXIS_TICK_STYLE, fill: 'var(--color-text-tertiary)' }}
                  axisLine={{ stroke: 'var(--color-border)' }}
                  tickLine={{ stroke: 'var(--color-border)' }}
                />
                <Area
                  type={'monotone'}
                  dataKey={'value'}
                  stroke="none"
                  fill={`url(#${gradientId}-example)`}
                  fillOpacity={1}
                  isAnimationActive={false}
                />
                <Line
                  type={'monotone'}
                  dataKey={'value'}
                  stroke={'var(--color-neutral-400)'}
                  strokeWidth={2}
                  strokeDasharray={'6 6'}
                  dot={false}
                  isAnimationActive={false}
                />
              </ComposedChart>
            </ChartContainer>
          </div>
          <div className={'absolute inset-0 bg-linear-to-b from-surface/90 via-surface/55 to-surface/90'} />
          <div
            className={
              'absolute inset-y-0 left-0 w-[68%] bg-linear-to-r from-surface via-surface/78 to-transparent blur-2xl sm:w-[54%]'
            }
          />
          <div className={'relative z-10 flex h-full flex-col justify-between p-6 sm:p-7'}>
            <div className={'max-w-lg'}>
              <p className={'text-sm font-medium text-text-secondary'}>
                {'This is what your portfolio history can look like.'}
              </p>
              <h3 className={'mt-2 max-w-md text-2xl font-semibold tracking-tight text-text-primary sm:text-[2rem]'}>
                {'Your Yearn deposits, yield, and vault rotations will start drawing a story here.'}
              </h3>
              <p className={'mt-3 max-w-md text-sm leading-relaxed text-text-secondary sm:text-base'}>
                {
                  'Once you hold a Yearn vault, this chart will turn into a live timeline of your daily portfolio value.'
                }
              </p>
            </div>
            <div className={'flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between'}>
              <Link to={'/vaults'} className={'yearn--button--nextgen min-h-[44px] px-5'} data-variant={'filled'}>
                {'Explore Vaults'}
              </Link>
            </div>
          </div>
        </div>
      </section>
    )
  }

  if ((activeIsEmpty || activeData.length === 0 || !activeHasRenderableValue) && activeTab !== 'index') {
    return (
      <section className={cl(sectionClassName, className)}>
        {renderHeader(true)}
        <div className={'flex min-h-[240px] items-center justify-center'}>
          <p className={'text-base text-text-secondary'}>{getEmptyMessage(activeTab, resolvedGrowthDisplayMode)}</p>
        </div>
      </section>
    )
  }

  if (activeTab === 'index') {
    const indexedFamilySeries = buildIndexedFamilySeries(protocolReturnFamilySeries, timeframe, familyLabelByVaultKey)
    const limit = getTimeframeLimit(timeframe)
    const aggregatePoints =
      !protocolReturnData || !Number.isFinite(limit) || limit >= protocolReturnData.length
        ? (protocolReturnData ?? [])
        : protocolReturnData.slice(-limit)
    const aggregateIndexPoints = rebaseIndexPoints(
      aggregatePoints.map((point) => ({ date: point.date, value: point.growthIndex }))
    )
    const indexData: TIndexChartPoint[] = aggregateIndexPoints.map((point, index) => {
      const row: TIndexChartPoint = { date: point.date, aggregate: point.value }
      indexedFamilySeries.forEach((family) => {
        row[family.key] = family.points[index]?.value ?? null
      })
      return row
    })
    const indexTicks = isShortTimeframe
      ? getChartWeeklyTicks(aggregateIndexPoints)
      : getChartMonthlyTicks(aggregateIndexPoints)
    const indexSeriesLabels: Record<string, string> = {
      aggregate: 'Wallet',
      ...Object.fromEntries(indexedFamilySeries.map((series) => [series.key, series.label]))
    }

    if (indexData.length === 0) {
      return (
        <section className={cl(sectionClassName, className)}>
          {renderHeader(true)}
          <div className={'flex min-h-[240px] items-center justify-center'}>
            <p className={'text-base text-text-secondary'}>{getEmptyMessage(activeTab, resolvedGrowthDisplayMode)}</p>
          </div>
        </section>
      )
    }

    return (
      <section className={cl(sectionClassName, className)}>
        {renderHeader(true)}
        <div className={'min-h-[240px] flex-1 pt-1'}>
          <ChartContainer
            config={{ aggregate: { label: 'Wallet', color: INDEX_SERIES_COLORS[0] } }}
            style={{ height: '100%', aspectRatio: 'unset' }}
          >
            <ComposedChart data={indexData} margin={CHART_WITH_AXES_MARGIN}>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey={'date'}
                ticks={indexTicks}
                tickFormatter={tickFormatter}
                tick={{ fill: 'var(--chart-axis)' }}
                axisLine={{ stroke: 'var(--chart-axis)' }}
                tickLine={{ stroke: 'var(--chart-axis)' }}
              />
              <YAxis
                domain={['auto', 'auto']}
                tickFormatter={(value: number | string) => {
                  const numericValue = Number(value)
                  const absoluteValue = Math.abs(numericValue)
                  return absoluteValue >= 1000 ? numericValue.toFixed(0) : numericValue.toFixed(1)
                }}
                mirror
                width={CHART_Y_AXIS_WIDTH}
                tickMargin={CHART_Y_AXIS_TICK_MARGIN}
                tick={CHART_Y_AXIS_TICK_STYLE}
                axisLine={{ stroke: 'var(--chart-axis)' }}
                tickLine={{ stroke: 'var(--chart-axis)' }}
              />
              <ChartTooltip
                cursor={{ stroke: 'var(--chart-cursor-line)', strokeWidth: 1 }}
                content={(props) => <PortfolioGrowthIndexTooltip {...props} indexSeriesLabels={indexSeriesLabels} />}
              />
              <Line
                type={'monotone'}
                dataKey={'aggregate'}
                name={'Wallet'}
                stroke={INDEX_SERIES_COLORS[0]}
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0, fill: INDEX_SERIES_COLORS[0] }}
                connectNulls
                isAnimationActive={false}
              />
              {indexedFamilySeries.map((series) => (
                <Line
                  key={series.key}
                  type={'monotone'}
                  dataKey={series.key}
                  name={series.label}
                  stroke={series.color}
                  strokeWidth={1.75}
                  strokeOpacity={0.9}
                  dot={false}
                  activeDot={{ r: 3.5, strokeWidth: 0, fill: series.color }}
                  connectNulls
                  isAnimationActive={false}
                />
              ))}
            </ComposedChart>
          </ChartContainer>
        </div>
        <PortfolioHistoryBreakdownModal
          date={selectedBreakdownDate}
          isOpen={isBreakdownModalOpen}
          onClose={() => setIsBreakdownModalOpen(false)}
        />
      </section>
    )
  }

  return (
    <section className={cl(sectionClassName, className)}>
      {renderHeader(true)}
      <div className={'min-h-[240px] flex-1 pt-1'}>
        <ChartContainer
          config={chartConfig}
          style={{ height: '100%', aspectRatio: 'unset' }}
          className={
            activeTab === 'balance' && Number(getBreakdownPoint(hoveredBreakdownDate)?.value ?? 0) > 0
              ? 'cursor-pointer'
              : undefined
          }
        >
          <ComposedChart
            data={activeData}
            margin={CHART_WITH_AXES_MARGIN}
            onMouseMove={handleChartMouseMove}
            onMouseLeave={handleChartMouseLeave}
            onClick={handleChartClick}
          >
            <defs>
              <linearGradient id={`${gradientId}-history`} x1="0" x2="0" y1="0" y2="1">
                <stop offset="5%" stopColor="var(--color-value)" stopOpacity={0.5} />
                <stop offset="95%" stopColor="var(--color-value)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey={'date'}
              ticks={ticks}
              tickFormatter={tickFormatter}
              tick={{ fill: 'var(--chart-axis)' }}
              axisLine={{ stroke: 'var(--chart-axis)' }}
              tickLine={{ stroke: 'var(--chart-axis)' }}
            />
            <YAxis
              domain={['auto', 'auto']}
              tickFormatter={formatValueTick}
              mirror
              width={CHART_Y_AXIS_WIDTH}
              tickMargin={CHART_Y_AXIS_TICK_MARGIN}
              tick={CHART_Y_AXIS_TICK_STYLE}
              axisLine={{ stroke: 'var(--chart-axis)' }}
              tickLine={{ stroke: 'var(--chart-axis)' }}
            />
            <ChartTooltip
              cursor={{ stroke: 'var(--chart-cursor-line)', strokeWidth: 1 }}
              content={(props) => (
                <PortfolioHistoryTooltip
                  {...props}
                  activeTab={activeTab}
                  denomination={denomination}
                  growthDisplayMode={resolvedGrowthDisplayMode}
                />
              )}
            />
            <Area
              type={'monotone'}
              dataKey={'value'}
              stroke="none"
              fill={`url(#${gradientId}-history)`}
              fillOpacity={1}
              connectNulls
              tooltipType={'none'}
              isAnimationActive={false}
            />
            <Line
              type={'monotone'}
              dataKey={'value'}
              stroke="var(--color-value)"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0, fill: 'var(--color-value)' }}
              connectNulls
              isAnimationActive={false}
            />
          </ComposedChart>
        </ChartContainer>
      </div>
      <PortfolioHistoryBreakdownModal
        date={selectedBreakdownDate}
        isOpen={isBreakdownModalOpen}
        onClose={() => setIsBreakdownModalOpen(false)}
      />
    </section>
  )
}
