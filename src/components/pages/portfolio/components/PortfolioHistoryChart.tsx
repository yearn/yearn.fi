import { usePlausible } from '@hooks/usePlausible'
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
import { YearnLogoSpinner } from '@shared/components/YearnLogoSpinner'
import { useWeb3 } from '@shared/contexts/useWeb3'
import { useYearn } from '@shared/contexts/useYearn'
import { IconChevron } from '@shared/icons/IconChevron'
import { cl, formatPercent, formatUSD, SELECTOR_BAR_STYLES } from '@shared/utils'
import { getVaultName as getDisplayVaultName } from '@shared/utils/helpers'
import { PLAUSIBLE_EVENTS } from '@shared/utils/plausible'
import Link from 'next/link'
import type { ReactElement } from 'react'
import { useEffect, useId, useMemo, useState } from 'react'
import { Area, CartesianGrid, ComposedChart, Line, XAxis, YAxis } from 'recharts'
import type { AxisDomain } from 'recharts/types/util/types'
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

export type TPortfolioHistoryChartTimeframe = '30d' | '90d' | '1y' | 'all'
export type TPortfolioHistoryChartTab = 'balance' | 'growth' | 'annualized' | 'index'
export type TGrowthDisplayMode = 'index' | 'usd' | 'eth'
type TPortfolioHistoryValueType = TGrowthDisplayMode | TPortfolioVaultGrowthChartMode

type TPortfolioHistoryChartProps = {
  balanceData: TPortfolioHistoryChartData | null
  protocolReturnData: TPortfolioProtocolReturnHistoryChartData | null
  protocolReturnSummary: TPortfolioProtocolReturnHistorySummary | null
  protocolReturnFamilySeries: TPortfolioProtocolReturnHistoryFamilySeries
  denomination: TPortfolioHistoryDenomination
  timeframe: TPortfolioHistoryChartTimeframe
  activeTab: TPortfolioHistoryChartTab
  growthDisplayModeOverride: TGrowthDisplayMode | null
  onGrowthDisplayModeOverrideChange: (mode: TGrowthDisplayMode | null) => void
  vaultGrowthMode: TPortfolioVaultGrowthChartMode
  onVaultGrowthModeChange: (mode: TPortfolioVaultGrowthChartMode) => void
  balanceIsLoading: boolean
  balanceIsEmpty?: boolean
  balanceError?: Error | null
  protocolReturnIsLoading: boolean
  protocolReturnIsEmpty?: boolean
  protocolReturnError?: Error | null
  embedded?: boolean
  reserveControlSpace?: boolean
  loadingProgress?: {
    progress: number
    message: string
    detail: string | null
  } | null
  className?: string
}

type TChartPoint = {
  date: string
  value: number | null
  isLive?: boolean
}

type TPortfolioHistoryTooltipProps = {
  active?: boolean
  payload?: Array<{
    value?: unknown
    payload?: {
      date?: string
      value?: unknown
      isLive?: boolean
      [key: string]: unknown
    }
  }>
}

type TActiveChartState = {
  activeLabel?: string | number
}

const NON_NEGATIVE_AUTO_DOMAIN: AxisDomain = [
  (dataMin: number) => (Number.isFinite(dataMin) && dataMin < 0 ? dataMin : 0),
  (dataMax: number) => (Number.isFinite(dataMax) ? dataMax : 0)
]
const EVEN_Y_AXIS_TICK_COUNT = 5
const Y_AXIS_ZERO_EPSILON = 1e-9
const Y_AXIS_HEADROOM_MULTIPLIER = 1.05

function getNiceCeiling(value: number, intervals: number): number {
  const roughStep = value / intervals
  const magnitude = 10 ** Math.floor(Math.log10(roughStep))
  const normalizedStep = roughStep / magnitude
  const niceStep =
    normalizedStep <= 1 ? 1 : normalizedStep <= 2 ? 2 : normalizedStep <= 2.5 ? 2.5 : normalizedStep <= 5 ? 5 : 10

  return niceStep * magnitude * intervals
}

function buildNonNegativeEvenTicks(values: Array<number | null | undefined>, floor = 0): number[] | undefined {
  const finiteValues = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value))

  if (!finiteValues.length || finiteValues.some((value) => value < -Y_AXIS_ZERO_EPSILON)) {
    return undefined
  }

  const maxValue = Math.max(...finiteValues)
  if (maxValue <= floor) {
    return [floor]
  }

  const intervals = EVEN_Y_AXIS_TICK_COUNT - 1
  const ceiling = floor + getNiceCeiling((maxValue - floor) * Y_AXIS_HEADROOM_MULTIPLIER, intervals)

  return Array.from({ length: EVEN_Y_AXIS_TICK_COUNT }, (_, index) => floor + ((ceiling - floor) * index) / intervals)
}

type TPortfolioHistoryChartControlsProps = {
  activeTab: TPortfolioHistoryChartTab
  onActiveTabChange: (tab: TPortfolioHistoryChartTab) => void
  denomination: TPortfolioHistoryDenomination
  onDenominationChange: (denomination: TPortfolioHistoryDenomination) => void
  timeframe: TPortfolioHistoryChartTimeframe
  onTimeframeChange: (timeframe: TPortfolioHistoryChartTimeframe) => void
  resolvedGrowthDisplayMode: TGrowthDisplayMode
  onGrowthDisplayModeOverrideChange: (mode: TGrowthDisplayMode | null) => void
  vaultGrowthMode: TPortfolioVaultGrowthChartMode
  onVaultGrowthModeChange: (mode: TPortfolioVaultGrowthChartMode) => void
  isEthGrowthAvailable?: boolean
  children?: ReactElement
  className?: string
}

const CHART_TABS: Array<{ id: TPortfolioHistoryChartTab; label: string }> = [
  { id: 'balance', label: 'Balance' },
  { id: 'growth', label: 'Growth' },
  { id: 'annualized', label: 'Annualized %' },
  { id: 'index', label: 'Growth Index' }
]
const TIMEFRAME_OPTIONS: Array<{ id: TPortfolioHistoryChartTimeframe; label: string }> = [
  { id: '30d', label: '30D' },
  { id: '90d', label: '90D' },
  { id: '1y', label: '1Y' },
  { id: 'all', label: 'ALL' }
]
const GROWTH_DISPLAY_MODES: Array<{ id: TGrowthDisplayMode; label: string }> = [
  { id: 'index', label: 'Index' },
  { id: 'usd', label: 'USD' },
  { id: 'eth', label: 'ETH' }
]
const VAULT_GROWTH_VALUE_TYPES: Array<{ id: TPortfolioVaultGrowthChartMode; label: string }> = [
  { id: 'position', label: 'Position' },
  { id: 'index', label: 'Index' }
]
const INDEX_SERIES_COLORS = ['#2578ff', '#46a2ff', '#94adf2', '#7bb3a8', '#e1a23b', '#b67ae5'] as const
const PORTFOLIO_CHART_MARGIN = {
  ...CHART_WITH_AXES_MARGIN,
  bottom: 4
}

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

function PortfolioChartDropdown<TValue extends string>({
  label,
  value,
  options,
  onChange,
  className
}: {
  label: string
  value: TValue | ''
  options: Array<{ id: TValue; label: string }>
  onChange: (value: TValue) => void
  className?: string
}): ReactElement {
  return (
    <label className={cl('relative', className ?? 'min-w-[92px]')}>
      <span className={'sr-only'}>{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as TValue)}
        className={cl(
          'h-10 w-full appearance-none rounded-lg border border-border bg-surface-secondary py-2 pr-8 pl-3 md:h-8 md:py-1',
          'text-xs font-semibold uppercase text-text-primary shadow-inner transition-colors',
          'hover:border-text-tertiary focus:border-primary focus:outline-none'
        )}
        aria-label={label}
      >
        {value === '' ? (
          <option value={''} disabled>
            {'Value'}
          </option>
        ) : null}
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
      <IconChevron
        className={'pointer-events-none absolute top-1/2 right-2 size-4 -translate-y-1/2 text-text-secondary'}
      />
    </label>
  )
}

function resolveGrowthDisplayMode(
  selectedMode: TGrowthDisplayMode,
  protocolReturnData: TPortfolioProtocolReturnHistoryChartData | null
): TGrowthDisplayMode {
  const hasEthSeries = Boolean(protocolReturnData?.some((point) => point.growthWeightEth !== null))

  return selectedMode === 'eth' && !hasEthSeries ? 'index' : selectedMode
}

export function resolvePortfolioGrowthDisplayMode(
  selectedMode: TGrowthDisplayMode,
  protocolReturnData: TPortfolioProtocolReturnHistoryChartData | null
): TGrowthDisplayMode {
  return resolveGrowthDisplayMode(selectedMode, protocolReturnData)
}

function PortfolioHistoryChartLoading({
  serverProgress
}: {
  serverProgress?: TPortfolioHistoryChartProps['loadingProgress']
}): ReactElement {
  const displayedMessage = serverProgress?.message ?? 'Building portfolio history'
  const detail = serverProgress?.detail

  return (
    <div
      className={
        'flex h-full min-h-[240px] flex-col items-center justify-center gap-3 px-4 py-12 text-sm text-text-secondary sm:px-6 sm:py-16'
      }
    >
      <YearnLogoSpinner className={'size-12'} logoClassName={'size-8'} />
      <span>{displayedMessage}</span>
      {detail ? <span className={'text-xs text-text-tertiary'}>{detail}</span> : null}
      {serverProgress ? (
        <div
          className={'h-1.5 w-full max-w-[240px] overflow-hidden rounded-full bg-border'}
          role={'progressbar'}
          aria-label={displayedMessage}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={serverProgress.progress}
        >
          <div
            className={'h-full rounded-full bg-primary transition-[width] duration-700 ease-out'}
            style={{ width: `${serverProgress.progress}%` }}
          />
        </div>
      ) : null}
    </div>
  )
}

export function PortfolioHistoryChartControls({
  activeTab,
  onActiveTabChange,
  denomination,
  onDenominationChange,
  timeframe,
  onTimeframeChange,
  resolvedGrowthDisplayMode,
  onGrowthDisplayModeOverrideChange,
  vaultGrowthMode,
  onVaultGrowthModeChange,
  isEthGrowthAvailable = true,
  children,
  className
}: TPortfolioHistoryChartControlsProps): ReactElement {
  const trackEvent = usePlausible()
  const unitOptions = GROWTH_DISPLAY_MODES.map((mode) => {
    const isAvailable =
      activeTab === 'balance'
        ? mode.id !== 'index'
        : activeTab === 'growth'
          ? mode.id !== 'eth' || isEthGrowthAvailable
          : activeTab === 'index'
            ? mode.id === 'index'
            : false
    const isActive =
      activeTab === 'balance'
        ? denomination === mode.id
        : activeTab === 'growth'
          ? resolvedGrowthDisplayMode === mode.id
          : activeTab === 'index' && mode.id === 'index'

    return { ...mode, isActive, isAvailable }
  })
  const valueTypeOptions: Array<{ id: TPortfolioHistoryValueType; label: string }> =
    activeTab === 'index'
      ? VAULT_GROWTH_VALUE_TYPES
      : unitOptions
          .filter((mode) => mode.isAvailable)
          .map((mode) => ({
            id: mode.id,
            label: mode.label
          }))
  const activeUnitValue: TPortfolioHistoryValueType | '' =
    activeTab === 'index' ? vaultGrowthMode : (unitOptions.find((mode) => mode.isActive)?.id ?? '')
  const shouldShowValueTypeSelector = activeTab !== 'annualized'

  const handleValueTypeChange = (mode: TPortfolioHistoryValueType): void => {
    if (activeTab === 'balance') {
      if (mode === 'usd' || mode === 'eth') {
        onDenominationChange(mode)
      }
      return
    }

    if (activeTab === 'growth') {
      if (mode === 'index' || mode === 'usd' || mode === 'eth') {
        onGrowthDisplayModeOverrideChange(mode)
      }
      return
    }

    if (activeTab === 'index') {
      if (mode === 'position' || mode === 'index') {
        onVaultGrowthModeChange(mode)
      }
    }
  }

  const handleChartTabChange = (tab: TPortfolioHistoryChartTab): void => {
    if (tab !== activeTab) {
      trackEvent(PLAUSIBLE_EVENTS.PORTFOLIO_HISTORY_TAB_SELECT, {
        props: {
          fromTab: activeTab,
          tab,
          timeframe
        }
      })
    }
    onActiveTabChange(tab)
    if (tab === 'index') {
      onVaultGrowthModeChange('index')
    }
  }

  return (
    <div className={cl('relative min-h-0', className)}>
      <div className={'absolute inset-x-0 top-0 z-10 flex items-center gap-2 p-4 md:justify-between md:px-6'}>
        <PortfolioChartDropdown
          label={'Chart type'}
          value={activeTab}
          options={CHART_TABS}
          onChange={handleChartTabChange}
          className={'min-w-[140px] flex-1 md:hidden'}
        />
        <div className={cl('hidden items-center gap-1 md:flex md:w-auto', SELECTOR_BAR_STYLES.container)}>
          {CHART_TABS.map((tab) => (
            <button
              key={tab.id}
              type={'button'}
              onClick={() => handleChartTabChange(tab.id)}
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
        <div className={'flex shrink-0 items-center justify-end gap-2 md:w-auto'}>
          <PortfolioChartDropdown
            label={'Chart timeframe'}
            value={timeframe}
            options={TIMEFRAME_OPTIONS}
            onChange={onTimeframeChange}
            className={'min-w-[76px]'}
          />
          {shouldShowValueTypeSelector ? (
            <PortfolioChartDropdown
              label={'Asset value type'}
              value={activeUnitValue}
              options={valueTypeOptions}
              onChange={handleValueTypeChange}
            />
          ) : null}
        </div>
      </div>
      {children}
    </div>
  )
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
        'pointer-events-none flex min-w-[13rem] flex-col gap-2 rounded-lg border border-border bg-surface px-3 py-3 shadow-xl'
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
          {value > 0 && !point?.isLive ? 'Click to see breakdown' : 'No breakdown available for this point'}
        </span>
      ) : null}
    </div>
  )
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

  return 'No holdings history available'
}

export function PortfolioHistoryChart({
  balanceData,
  protocolReturnData,
  protocolReturnSummary,
  protocolReturnFamilySeries,
  denomination,
  timeframe,
  activeTab,
  growthDisplayModeOverride,
  onGrowthDisplayModeOverrideChange,
  vaultGrowthMode,
  onVaultGrowthModeChange,
  balanceIsLoading,
  balanceIsEmpty = false,
  balanceError,
  protocolReturnIsLoading,
  protocolReturnIsEmpty = false,
  protocolReturnError,
  embedded = false,
  reserveControlSpace = true,
  loadingProgress,
  className
}: TPortfolioHistoryChartProps): ReactElement {
  const trackEvent = usePlausible()
  const { address } = useWeb3()
  const { allVaults } = useYearn()
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
    onGrowthDisplayModeOverrideChange(null)
  }, [address, onGrowthDisplayModeOverrideChange])

  const sectionClassName = embedded
    ? reserveControlSpace
      ? 'flex h-full min-h-[260px] flex-col bg-surface px-5 pt-16 pb-2 md:min-h-0 md:px-6 md:pt-16 md:pb-3'
      : 'flex h-full min-h-0 flex-col bg-surface p-5 md:p-6'
    : 'flex h-full flex-col gap-4 rounded-lg border border-border bg-surface p-6'

  const filteredBalanceData = useMemo<TChartPoint[]>(() => {
    if (!balanceData) {
      return []
    }

    const limit = getTimeframeLimit(timeframe)
    const points = !Number.isFinite(limit) || limit >= balanceData.length ? balanceData : balanceData.slice(-limit)
    return points.map((point) => ({ date: point.date, value: point.value, isLive: point.isLive }))
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
          : filteredAnnualizedReturnData
  const activeIsLoading = activeTab === 'balance' ? balanceIsLoading : protocolReturnIsLoading
  const activeIsEmpty = activeTab === 'balance' ? balanceIsEmpty : protocolReturnIsEmpty
  const activeError = activeTab === 'balance' ? balanceError : protocolReturnError
  const activeHasRenderableValue = activeData.some((point) => point.value !== null)
  const yAxisFloor = activeTab === 'growth' && resolvedGrowthDisplayMode === 'index' ? 100 : 0
  const yAxisTicks = useMemo(
    () =>
      buildNonNegativeEvenTicks(
        activeData.map((point) => point.value),
        yAxisFloor
      ),
    [activeData, yAxisFloor]
  )
  const yAxisDomain = useMemo<AxisDomain>(
    () => (yAxisTicks ? [yAxisFloor, yAxisTicks.at(-1) ?? yAxisFloor] : NON_NEGATIVE_AUTO_DOMAIN),
    [yAxisFloor, yAxisTicks]
  )
  const tickSourceData = activeData

  const isShortTimeframe = timeframe === '30d'
  const ticks = useMemo(
    () => (isShortTimeframe ? getChartWeeklyTicks(tickSourceData) : getChartMonthlyTicks(tickSourceData)),
    [tickSourceData, isShortTimeframe]
  )
  const tickFormatter = isShortTimeframe ? formatChartWeekLabel : formatChartMonthYearLabel

  const formatValueTick = (value: number | string, index?: number) => {
    if (index === 0) {
      return ''
    }

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
        color: 'var(--chart-1)'
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

    const point = filteredBalanceData.find((balancePoint) => balancePoint.date === date) ?? null
    return point?.isLive ? null : point
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

    trackEvent(PLAUSIBLE_EVENTS.PORTFOLIO_HISTORY_BREAKDOWN_CLICK, {
      props: {
        denomination,
        timeframe
      }
    })
    setSelectedBreakdownDate(selectedPoint.date)
    setIsBreakdownModalOpen(true)
  }

  if (activeIsLoading) {
    return (
      <section className={cl(sectionClassName, className)}>
        <PortfolioHistoryChartLoading serverProgress={loadingProgress} />
      </section>
    )
  }

  if (activeError) {
    return (
      <section className={cl(sectionClassName, className)}>
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
                    <stop offset="0%" stopColor="var(--color-value)" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="var(--color-value)" stopOpacity={0} />
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
                  stroke={'var(--color-value)'}
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
              <h3 className={'mt-2 max-w-md text-2xl font-semibold tracking-tight text-text-primary sm:text-[1.5rem]'}>
                {
                  'Once you have a deposit in a Yearn Vault, you’ll see your portfolio balances and growth over time here.'
                }
              </h3>
            </div>
            <div className={'flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between'}>
              <Link href={'/vaults'} className={'yearn--button--nextgen min-h-[44px] px-5'} data-variant={'filled'}>
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
        <PortfolioVaultGrowthChart
          series={vaultGrowthSeries}
          mode={vaultGrowthMode}
          onModeChange={onVaultGrowthModeChange}
          timeframe={timeframe}
          maxVaults={INDEX_SERIES_COLORS.length - 1}
          colors={[...INDEX_SERIES_COLORS.slice(1)]}
          title={''}
          height={'100%'}
          showModeToggle={false}
          className={'h-full min-h-0 pt-1'}
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

  return (
    <section className={cl(sectionClassName, className)}>
      <div className={'min-h-0 flex-1'}>
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
            margin={PORTFOLIO_CHART_MARGIN}
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
              domain={yAxisDomain}
              allowDataOverflow
              ticks={yAxisTicks}
              tickCount={EVEN_Y_AXIS_TICK_COUNT}
              interval={0}
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
