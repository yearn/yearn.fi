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
import { Tooltip } from '@shared/components/Tooltip'
import { useWeb3 } from '@shared/contexts/useWeb3'
import { useYearn } from '@shared/contexts/useYearn'
import { IconSpinner } from '@shared/icons/IconSpinner'
import { cl, formatPercent, formatUSD, SELECTOR_BAR_STYLES } from '@shared/utils'
import { getVaultName as getDisplayVaultName } from '@shared/utils/helpers'
import type { ReactElement } from 'react'
import { useEffect, useId, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { Area, CartesianGrid, ComposedChart, Line, XAxis, YAxis } from 'recharts'
import type { TPortfolioAllocationScatterPoint } from '../hooks/usePortfolioModel'
import type {
  TPortfolioHistoryChartData,
  TPortfolioHistoryDenomination,
  TPortfolioProtocolReturnHistoryChartData,
  TPortfolioProtocolReturnHistoryFamilySeries,
  TPortfolioProtocolReturnHistorySummary
} from '../types/api'
import { PortfolioHistoryBreakdownModal } from './PortfolioHistoryBreakdownModal'
import type { TPortfolioVaultGrowthChartMode, TPortfolioVaultGrowthChartSeries } from './PortfolioVaultGrowthChart'
import { PortfolioVaultGrowthChart } from './PortfolioVaultGrowthChart'
import { VaultAllocationScatter } from './VaultAllocationScatter'

export type TPortfolioHistoryChartTimeframe = '30d' | '90d' | '1y' | 'all'
type TPortfolioHistoryChartTab = 'balance' | 'growth' | 'annualized' | 'index' | 'scatter'
type TGrowthDisplayMode = 'index' | 'usd' | 'eth'

type TPortfolioHistoryChartProps = {
  balanceData: TPortfolioHistoryChartData | null
  protocolReturnData: TPortfolioProtocolReturnHistoryChartData | null
  protocolReturnSummary: TPortfolioProtocolReturnHistorySummary | null
  protocolReturnFamilySeries: TPortfolioProtocolReturnHistoryFamilySeries
  allocationScatterPoints: TPortfolioAllocationScatterPoint[]
  allocationScatterIsLoading?: boolean
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

type TPortfolioHistoryTooltipProps = {
  active?: boolean
  payload?: Array<{
    value?: unknown
    payload?: {
      date?: string
      value?: unknown
      [key: string]: unknown
    }
  }>
}

type TActiveChartState = {
  activeLabel?: string | number
}

const CHART_TABS: Array<{ id: TPortfolioHistoryChartTab; label: string }> = [
  { id: 'balance', label: 'Balance' },
  { id: 'growth', label: 'Growth' },
  { id: 'annualized', label: 'Annualized %' },
  { id: 'index', label: 'Growth Index' },
  { id: 'scatter', label: 'Scatter' }
]
const GROWTH_DISPLAY_MODES: Array<{ id: TGrowthDisplayMode; label: string }> = [
  { id: 'index', label: 'Index' },
  { id: 'usd', label: 'USD' },
  { id: 'eth', label: 'ETH' }
]
const GROWTH_DISPLAY_TOOLTIP_COPY: Record<TGrowthDisplayMode, { title: string; body: string }> = {
  index: {
    title: 'Index',
    body: 'Normalized protocol-return index that starts at 100 for the selected timeframe. Best for mixed-asset wallets.'
  },
  usd: {
    title: 'USD',
    body: 'Protocol growth during the selected timeframe in receipt-time USD equivalent.'
  },
  eth: {
    title: 'ETH',
    body: 'Protocol growth during the selected timeframe in receipt-time ETH equivalent.'
  }
}
const VAULT_GROWTH_MODES: Array<{ id: TPortfolioVaultGrowthChartMode; label: string }> = [
  { id: 'position', label: 'Position' },
  { id: 'index', label: 'Index' }
]
const VAULT_GROWTH_MODE_TOOLTIP_COPY: Record<TPortfolioVaultGrowthChartMode, { title: string; body: string }> = {
  position: {
    title: 'Position',
    body: 'Shows actual protocol gain from your deposited positions during the selected timeframe.'
  },
  index: {
    title: 'Index',
    body: 'Shows vault performance normalized to 100, ignoring position size.'
  }
}

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

function formatGrowthValue(value: number, mode: TGrowthDisplayMode): string {
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

function rebaseDeltaPoints(points: TChartPoint[]): TChartPoint[] {
  const baseValue = points.find(
    (point): point is { date: string; value: number } => typeof point.value === 'number' && Number.isFinite(point.value)
  )?.value

  if (baseValue === undefined) {
    return points
  }

  return points.map((point) => ({
    date: point.date,
    value: typeof point.value === 'number' && Number.isFinite(point.value) ? point.value - baseValue : point.value
  }))
}

function renderGrowthDisplayTooltip(mode: TGrowthDisplayMode): ReactElement {
  const copy = GROWTH_DISPLAY_TOOLTIP_COPY[mode]

  return (
    <div
      className={
        'max-w-[240px] rounded-lg border border-border bg-surface-secondary px-2 py-1 text-xs leading-relaxed text-text-primary'
      }
    >
      <p className={'font-semibold text-text-primary'}>{copy.title}</p>
      <p>{copy.body}</p>
    </div>
  )
}

function renderVaultGrowthModeTooltip(mode: TPortfolioVaultGrowthChartMode): ReactElement {
  const copy = VAULT_GROWTH_MODE_TOOLTIP_COPY[mode]

  return (
    <div
      className={
        'max-w-[240px] rounded-lg border border-border bg-surface-secondary px-2 py-1 text-xs leading-relaxed text-text-primary'
      }
    >
      <p className={'font-semibold text-text-primary'}>{copy.title}</p>
      <p>{copy.body}</p>
    </div>
  )
}

function renderChartTitleTooltip(
  activeTab: TPortfolioHistoryChartTab,
  growthDisplayMode: TGrowthDisplayMode
): ReactElement {
  return (
    <div
      className={
        'max-w-[260px] rounded-lg border border-border bg-surface-secondary px-2 py-1 text-xs leading-relaxed text-text-primary'
      }
    >
      {getChartDescription(activeTab, growthDisplayMode)}
    </div>
  )
}

function resolveGrowthDisplayMode(
  selectedMode: TGrowthDisplayMode,
  protocolReturnData: TPortfolioProtocolReturnHistoryChartData | null
): TGrowthDisplayMode {
  const hasEthSeries = Boolean(protocolReturnData?.some((point) => point.growthWeightEth !== null))

  return selectedMode === 'eth' && !hasEthSeries ? 'index' : selectedMode
}

function buildPortfolioVaultGrowthSeries(
  familySeries: TPortfolioProtocolReturnHistoryFamilySeries,
  labelByVaultKey: Record<string, string>
): TPortfolioVaultGrowthChartSeries[] {
  return familySeries.map((series) => ({
    vaultAddress: series.vaultAddress,
    vaultName:
      labelByVaultKey[`${series.chainId}:${series.vaultAddress.toLowerCase()}`] ??
      series.symbol ??
      `${series.vaultAddress.slice(0, 6)}…${series.vaultAddress.slice(-4)}`,
    symbol: series.symbol,
    points: series.dataPoints.map((point) => ({
      timestamp: point.timestamp,
      positionValueUsd: point.growthWeightUsd,
      indexValue: point.growthIndex
    }))
  }))
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
  growthDisplayMode: TGrowthDisplayMode
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

function getChartDescription(activeTab: TPortfolioHistoryChartTab, growthDisplayMode: TGrowthDisplayMode): string {
  if (activeTab === 'growth') {
    return growthDisplayMode === 'index'
      ? 'Normalized protocol-return index for the whole wallet. Starts at 100 at the beginning of the selected timeframe.'
      : growthDisplayMode === 'eth'
        ? 'Protocol growth earned during the selected timeframe, shown in receipt-time ETH equivalent.'
        : 'Protocol growth earned during the selected timeframe, shown in receipt-time USD equivalent.'
  }

  if (activeTab === 'index') {
    return 'Compare actual vault contribution with normalized vault performance.'
  }

  if (activeTab === 'scatter') {
    return 'Snapshot of current allocation against vault Net APY. Bubble size reflects vault TVL.'
  }

  if (activeTab === 'annualized') {
    return 'Annualized protocol return based on time-weighted baseline exposure up to each point.'
  }

  return 'Daily settled portfolio value across your current Yearn activity.'
}

function getChartTitle(activeTab: TPortfolioHistoryChartTab, growthDisplayMode: TGrowthDisplayMode): string {
  if (activeTab === 'growth') {
    return growthDisplayMode === 'index' ? 'Growth Index' : 'Protocol Growth'
  }

  if (activeTab === 'annualized') {
    return 'Annualized Return'
  }

  if (activeTab === 'index') {
    return 'Growth Index'
  }

  if (activeTab === 'scatter') {
    return 'Allocation vs Performance'
  }

  return 'Holdings History'
}

function getEmptyMessage(activeTab: TPortfolioHistoryChartTab, growthDisplayMode: TGrowthDisplayMode): string {
  if (activeTab === 'growth') {
    return growthDisplayMode === 'index'
      ? 'No growth index history available'
      : growthDisplayMode === 'eth'
        ? 'No ETH-equivalent protocol growth history available'
        : 'No protocol growth history available'
  }

  if (activeTab === 'annualized') {
    return 'No annualized return history available'
  }

  if (activeTab === 'index') {
    return 'No growth index history available'
  }

  if (activeTab === 'scatter') {
    return 'No visible vaults have Net APY data'
  }

  return 'No holdings history available'
}

export function PortfolioHistoryChart({
  balanceData,
  protocolReturnData,
  protocolReturnSummary,
  protocolReturnFamilySeries,
  allocationScatterPoints,
  allocationScatterIsLoading = false,
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
  const { address } = useWeb3()
  const { allVaults } = useYearn()
  const [activeTab, setActiveTab] = useState<TPortfolioHistoryChartTab>('balance')
  const [growthDisplayModeOverride, setGrowthDisplayModeOverride] = useState<TGrowthDisplayMode | null>(null)
  const [vaultGrowthMode, setVaultGrowthMode] = useState<TPortfolioVaultGrowthChartMode>('position')
  const [hoveredBreakdownDate, setHoveredBreakdownDate] = useState<string | null>(null)
  const [selectedBreakdownDate, setSelectedBreakdownDate] = useState<string | null>(null)
  const [isBreakdownModalOpen, setIsBreakdownModalOpen] = useState(false)
  const gradientId = useId().replace(/:/g, '')
  const recommendedGrowthDisplayMode = resolveGrowthDisplayMode(
    protocolReturnSummary?.recommendedGrowthDisplay ?? 'index',
    protocolReturnData
  )
  const resolvedGrowthDisplayMode = resolveGrowthDisplayMode(
    growthDisplayModeOverride ?? recommendedGrowthDisplayMode,
    protocolReturnData
  )

  useEffect(() => {
    setGrowthDisplayModeOverride(null)
  }, [address])

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

    return rebaseDeltaPoints(
      points.map((point) => ({
        date: point.date,
        value: point.growthWeightUsd
      }))
    )
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

    return rebaseDeltaPoints(
      points.map((point) => ({
        date: point.date,
        value: point.growthWeightEth
      }))
    )
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
          : activeTab === 'scatter'
            ? []
            : filteredAnnualizedReturnData
  const activeIsLoading =
    activeTab === 'balance'
      ? balanceIsLoading
      : activeTab === 'scatter'
        ? allocationScatterIsLoading
        : protocolReturnIsLoading
  const activeIsEmpty =
    activeTab === 'balance'
      ? balanceIsEmpty
      : activeTab === 'scatter'
        ? allocationScatterPoints.length === 0
        : protocolReturnIsEmpty
  const activeError = activeTab === 'balance' ? balanceError : activeTab === 'scatter' ? null : protocolReturnError
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
      return ''
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
      <div className={'flex flex-col gap-px'}>
        <div className={'flex items-center justify-between gap-3 h-[36px] max-md:h-[54px]'}>
          <Tooltip
            className={'h-auto w-auto justify-start gap-0'}
            openDelayMs={150}
            side={'top'}
            tooltip={renderChartTitleTooltip(activeTab, resolvedGrowthDisplayMode)}
          >
            <h2 className={'text-xl font-semibold leading-tight text-text-primary'}>
              {getChartTitle(activeTab, resolvedGrowthDisplayMode)}
            </h2>
          </Tooltip>
          {activeTab === 'balance' ? (
            <div className={cl('flex shrink-0 items-center gap-0.5 md:gap-1', SELECTOR_BAR_STYLES.container)}>
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
            <div className={cl('flex shrink-0 items-center gap-0.5 md:gap-1', SELECTOR_BAR_STYLES.container)}>
              {GROWTH_DISPLAY_MODES.map((mode) => (
                <Tooltip
                  key={mode.id}
                  className={'h-auto w-auto justify-start gap-0'}
                  openDelayMs={150}
                  side={'top'}
                  tooltip={renderGrowthDisplayTooltip(mode.id)}
                >
                  <button
                    type={'button'}
                    onClick={() => setGrowthDisplayModeOverride(mode.id)}
                    className={cl(
                      'flex-1 md:flex-initial rounded-sm px-2 md:px-3 py-2 md:py-1 text-xs font-semibold uppercase tracking-wide transition-all',
                      'min-h-[36px] md:min-h-0 active:scale-[0.98]',
                      SELECTOR_BAR_STYLES.buttonBase,
                      resolvedGrowthDisplayMode === mode.id
                        ? SELECTOR_BAR_STYLES.buttonActive
                        : SELECTOR_BAR_STYLES.buttonInactive
                    )}
                  >
                    {mode.label}
                  </button>
                </Tooltip>
              ))}
            </div>
          ) : activeTab === 'index' ? (
            <div className={cl('flex shrink-0 items-center gap-0.5 md:gap-1', SELECTOR_BAR_STYLES.container)}>
              {VAULT_GROWTH_MODES.map((mode) => (
                <Tooltip
                  key={mode.id}
                  className={'h-auto w-auto justify-start gap-0'}
                  openDelayMs={150}
                  side={'top'}
                  tooltip={renderVaultGrowthModeTooltip(mode.id)}
                >
                  <button
                    type={'button'}
                    onClick={() => setVaultGrowthMode(mode.id)}
                    className={cl(
                      'flex-1 md:flex-initial rounded-sm px-2 md:px-3 py-2 md:py-1 text-xs font-semibold uppercase tracking-wide transition-all',
                      'min-h-[36px] md:min-h-0 active:scale-[0.98]',
                      SELECTOR_BAR_STYLES.buttonBase,
                      vaultGrowthMode === mode.id
                        ? SELECTOR_BAR_STYLES.buttonActive
                        : SELECTOR_BAR_STYLES.buttonInactive
                    )}
                  >
                    {mode.label}
                  </button>
                </Tooltip>
              ))}
            </div>
          ) : null}
        </div>
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
          {activeTab !== 'scatter' ? (
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
          ) : null}
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

  if (
    (activeIsEmpty || activeData.length === 0 || !activeHasRenderableValue) &&
    activeTab !== 'index' &&
    activeTab !== 'scatter'
  ) {
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
    const vaultGrowthSeries = buildPortfolioVaultGrowthSeries(protocolReturnFamilySeries, familyLabelByVaultKey)

    return (
      <section className={cl(sectionClassName, className)}>
        {renderHeader(true)}
        <PortfolioVaultGrowthChart
          series={vaultGrowthSeries}
          mode={vaultGrowthMode}
          onModeChange={setVaultGrowthMode}
          timeframe={timeframe}
          maxVaults={INDEX_SERIES_COLORS.length - 1}
          colors={[...INDEX_SERIES_COLORS.slice(1)]}
          title={''}
          height={236}
          showModeToggle={false}
          className={'pt-1'}
          emptyMessage={getEmptyMessage(activeTab, resolvedGrowthDisplayMode)}
        />
        <PortfolioHistoryBreakdownModal
          date={selectedBreakdownDate}
          isOpen={isBreakdownModalOpen}
          onClose={() => setIsBreakdownModalOpen(false)}
        />
      </section>
    )
  }

  if (activeTab === 'scatter') {
    return (
      <section className={cl(sectionClassName, className)}>
        {renderHeader(true)}
        <VaultAllocationScatter points={allocationScatterPoints} embedded height={236} />
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
