import {
  Dialog,
  Listbox,
  ListboxButton,
  ListboxOption,
  ListboxOptions,
  Transition,
  TransitionChild
} from '@headlessui/react'
import { usePlausible } from '@hooks/usePlausible'
import { mergeChainMerkleData } from '@pages/portfolio/claimRewards.helpers'
import { EmptySectionCard } from '@pages/portfolio/components/EmptySectionCard'
import { GovernancePositionRow } from '@pages/portfolio/components/GovernancePositionRow'
import { usePortfolioEntryRefresh } from '@pages/portfolio/hooks/usePortfolioEntryRefresh'
import { type TPortfolioModel, usePortfolioModel } from '@pages/portfolio/hooks/usePortfolioModel'
import { useVaultWithStakingRewards } from '@pages/portfolio/hooks/useVaultWithStakingRewards'
import { type TVaultsChainButton, VaultsChainSelector } from '@pages/vaults/components/filters/VaultsChainSelector'
import { VaultsListChip } from '@pages/vaults/components/list/VaultsListChip'
import { VaultsListHead } from '@pages/vaults/components/list/VaultsListHead'
import { VaultsListRow } from '@pages/vaults/components/list/VaultsListRow'
import { VirtualizedVaultsList } from '@pages/vaults/components/list/VirtualizedVaultsList'
import { SuggestedVaultCard } from '@pages/vaults/components/SuggestedVaultCard'
import { MerkleRewardRow } from '@pages/vaults/components/widget/rewards/MerkleRewardRow'
import { StakingRewardRow } from '@pages/vaults/components/widget/rewards/StakingRewardRow'
import type { TGroupedMerkleReward, TStakingReward } from '@pages/vaults/components/widget/rewards/types'
import { TransactionOverlay, type TransactionStep } from '@pages/vaults/components/widget/shared/TransactionOverlay'
import {
  getVaultAddress,
  getVaultChainID,
  getVaultName,
  getVaultStaking,
  getVaultSymbol,
  getVaultToken,
  type TKongVault
} from '@pages/vaults/domain/kongVaultSelectors'
import { useMerkleRewards } from '@pages/vaults/hooks/rewards/useMerkleRewards'
import { useStakingRewards } from '@pages/vaults/hooks/rewards/useStakingRewards'
import type { TPossibleSortBy } from '@pages/vaults/hooks/useSortVaults'
import { resolveNextSingleChainSelection } from '@pages/vaults/utils/chainSelection'
import { Breadcrumbs } from '@shared/components/Breadcrumbs'
import { METRIC_VALUE_CLASS, MetricHeader, type TMetricBlock } from '@shared/components/MetricsCard'
import { SearchBar } from '@shared/components/SearchBar'
import { SwitchChainPrompt } from '@shared/components/SwitchChainPrompt'
import { TokenLogo } from '@shared/components/TokenLogo'
import { Tooltip } from '@shared/components/Tooltip'
import { YearnLogoSpinner } from '@shared/components/YearnLogoSpinner'
import { useNotifications } from '@shared/contexts/useNotifications'
import { useWalletActions } from '@shared/contexts/useWallet'
import { useWeb3 } from '@shared/contexts/useWeb3'
import { useYearn } from '@shared/contexts/useYearn'
import { useTokenList } from '@shared/contexts/WithTokenList'
import { useChainId, useSwitchChain } from '@shared/hooks/useAppWagmi'
import { useChainOptions } from '@shared/hooks/useChains'
import { getVaultKey } from '@shared/hooks/useVaultFilterUtils'
import { IconCalendarDays } from '@shared/icons/IconCalendarDays'
import { IconCheck } from '@shared/icons/IconCheck'
import { IconChevron } from '@shared/icons/IconChevron'
import { IconCopy } from '@shared/icons/IconCopy'
import { IconCross } from '@shared/icons/IconCross'
import { IconDeposit } from '@shared/icons/IconDeposit'
import { IconGitCompare } from '@shared/icons/IconGitCompare'
import { IconHandCoins } from '@shared/icons/IconHandCoins'
import { IconLinkOut } from '@shared/icons/IconLinkOut'
import { IconSearch } from '@shared/icons/IconSearch'
import { IconSpinner } from '@shared/icons/IconSpinner'
import { IconStake } from '@shared/icons/IconStake'
import { IconUnstake } from '@shared/icons/IconUnstake'
import { IconWithdraw } from '@shared/icons/IconWithdraw'
import { LogoYearn } from '@shared/icons/LogoYearn'
import type { TSortDirection } from '@shared/types'
import { cl, formatPercent, isZeroAddress, SUPPORTED_NETWORKS, toAddress, truncateHex } from '@shared/utils'
import { formatUSD } from '@shared/utils/format'
import { copyToClipboard } from '@shared/utils/helpers'
import { PLAUSIBLE_EVENTS } from '@shared/utils/plausible'
import { getNetwork } from '@shared/utils/wagmi'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import type { CSSProperties, ReactElement } from 'react'
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { env } from '@/env'
import Image from '/src/components/Image'
import {
  doesActivityEntryMatchSearch,
  doesLocalActivityMatchFilters,
  isRecentLocalActivityEntry,
  isZapNotification,
  toLocalActivityEntry
} from './activity.helpers'
import type {
  TGrowthDisplayMode,
  TPortfolioHistoryChartTab,
  TPortfolioHistoryChartTimeframe
} from './components/PortfolioHistoryChart'
import {
  PortfolioHistoryChart,
  PortfolioHistoryChartControls,
  resolvePortfolioGrowthDisplayMode
} from './components/PortfolioHistoryChart'
import type { TPortfolioVaultGrowthChartMode } from './components/PortfolioVaultGrowthChart'
import { usePortfolioActivity } from './hooks/usePortfolioActivity'
import { usePortfolioHistory } from './hooks/usePortfolioHistory'
import { usePortfolioProtocolReturnHistory } from './hooks/usePortfolioProtocolReturnHistory'
import type {
  TPortfolioActivityEntry,
  TPortfolioActivityTypeFilter,
  TPortfolioHistoryDenomination,
  TPortfolioHistoryTimeframe
} from './types/api'

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
})

const headingTooltipClassName =
  'rounded-lg border border-border bg-surface-secondary px-2 py-1 text-xs text-text-primary'
const metricTooltipContentClassName = 'flex max-w-[280px] flex-col gap-1 leading-relaxed'
const metricCardClassName = 'bg-surface px-5 py-3 md:px-5 md:py-2.5'
const PORTFOLIO_TABS = [
  { key: 'positions', label: 'Account Overview' },
  { key: 'activity', label: 'Activity' },
  { key: 'claim-rewards', label: 'Claim Rewards' }
] as const

type TPortfolioTabKey = (typeof PORTFOLIO_TABS)[number]['key']

type TPortfolioHeaderProps = Pick<
  TPortfolioModel,
  'blendedMetrics' | 'hasKatanaHoldings' | 'isHoldingsLoading' | 'isSearchingBalances' | 'totalPortfolioValue'
> & {
  isProtocolReturnLoading: boolean
  annualizedProtocolReturnPct: number | null | undefined
}

type TPortfolioHoldingsProps = Pick<
  TPortfolioModel,
  | 'hasHoldings'
  | 'holdingsRows'
  | 'isActive'
  | 'isHoldingsLoading'
  | 'openLoginModal'
  | 'sortBy'
  | 'sortDirection'
  | 'setSortBy'
  | 'setSortDirection'
  | 'vaultFlags'
>

type TPortfolioSuggestedProps = Pick<TPortfolioModel, 'hasHoldings' | 'isActive' | 'suggestedRows'>

type TPortfolioActivityProps = Pick<TPortfolioModel, 'isActive' | 'openLoginModal'>

type TPortfolioClaimRewardsProps = Pick<TPortfolioModel, 'isActive' | 'openLoginModal'>

const ACTIVITY_ACTION_LABELS: Record<TPortfolioActivityEntry['action'], string> = {
  deposit: 'Deposit',
  withdraw: 'Withdraw',
  stake: 'Stake',
  unstake: 'Unstake',
  transfer: 'Transfer',
  swap: 'Swap'
}
const ACTIVITY_TYPE_FILTERS: Array<{ key: TPortfolioActivityTypeFilter; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'deposit', label: 'Deposit' },
  { key: 'withdraw', label: 'Withdraw' },
  { key: 'stake', label: 'Stake' },
  { key: 'unstake', label: 'Unstake' },
  { key: 'transfer', label: 'Transfer' },
  { key: 'swap', label: 'Swap' }
]
const ACTIVITY_CALENDAR_DAY_LABELS = [
  { key: 'sunday', label: 'S' },
  { key: 'monday', label: 'M' },
  { key: 'tuesday', label: 'T' },
  { key: 'wednesday', label: 'W' },
  { key: 'thursday', label: 'T' },
  { key: 'friday', label: 'F' },
  { key: 'saturday', label: 'S' }
] as const

type TActivityModalFilters = {
  types: TPortfolioActivityEntry['action'][]
  startDate: string
  endDate: string
}
type TActivityDateField = 'startDate' | 'endDate'

function getTodayDateInputValue(): string {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

const DEFAULT_ACTIVITY_MODAL_FILTERS: TActivityModalFilters = {
  types: [],
  startDate: '',
  endDate: getTodayDateInputValue()
}

function formatActivityDisplayAmount(amountFormatted: number | null, symbol: string | null): string {
  if (amountFormatted === null) {
    return symbol ? `Unknown ${symbol}` : 'Unknown amount'
  }

  return `${amountFormatted.toLocaleString(undefined, { maximumFractionDigits: 6 })} ${symbol ?? ''}`.trim()
}

function formatActivityFixedValue(amountFormatted: number | null): string {
  if (amountFormatted === null) {
    return 'Unknown'
  }

  const countableLength = (value: string): number => value.replace(/[.,]/g, '').length
  const absoluteAmount = Math.abs(amountFormatted)
  if (absoluteAmount === 0) {
    return '0'
  }

  const units = [
    { divisor: 1_000_000_000, suffix: 'B', threshold: 1_000_000_000 },
    { divisor: 1_000_000, suffix: 'M', threshold: 1_000_000 },
    { divisor: 1000, suffix: 'K', threshold: 10_000 }
  ]
  const unit = units.find((item) => absoluteAmount >= item.threshold)

  if (unit) {
    const scaledAmount = absoluteAmount / unit.divisor
    for (let decimals = 2; decimals >= 0; decimals -= 1) {
      const fixedAmount = scaledAmount.toFixed(decimals)
      const trimmedAmount = fixedAmount.replace(/\.?0+$/, '')
      const formatted = `${countableLength(fixedAmount) <= 4 ? fixedAmount : trimmedAmount}${unit.suffix}`
      if (countableLength(formatted) <= 4) {
        return formatted
      }
    }
  }

  if (absoluteAmount >= 1000) {
    return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(absoluteAmount)
  }

  for (let decimals = 3; decimals >= 0; decimals -= 1) {
    const formatted = absoluteAmount.toFixed(decimals)
    if (countableLength(formatted) <= 4) {
      return formatted
    }
  }

  return absoluteAmount.toPrecision(1)
}

function truncateActivityHash(hashValue: string, size: number): string {
  if (size === 0 || hashValue.length <= size * 2 + 4 || !hashValue.startsWith('0x')) {
    return hashValue
  }

  return `0x${hashValue.slice(2, size + 2)}...${hashValue.slice(-size)}`
}

function getActivityExplorerUrl(chainId: number, txHash: string): string | null {
  const network = SUPPORTED_NETWORKS.find((item) => item.id === chainId)
  const explorerBaseUrl = network?.blockExplorers?.default?.url

  return explorerBaseUrl ? `${explorerBaseUrl}/tx/${txHash}` : null
}

function getActivityChainName(chainId: number): string {
  return SUPPORTED_NETWORKS.find((item) => item.id === chainId)?.name ?? `Chain ${chainId}`
}

function getActivityChainLogoUrl(chainId: number): string {
  return `${env.NEXT_PUBLIC_BASE_YEARN_ASSETS_URI}/chains/${chainId}/logo.svg`
}

function formatIndexedActivityDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

function formatIndexedActivityDateTime(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric'
  })
}

function formatIndexedActivityTime(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: 'numeric'
  })
}

function formatActivityDateInputValue(timestamp: number): string {
  const date = new Date(timestamp * 1000)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function getActivityDateBoundaryTimestamp(date: string, boundary: 'start' | 'end'): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  if (!match) {
    return null
  }

  const [, year, month, day] = match
  const yearNumber = Number(year)
  const monthIndex = Number(month) - 1
  const dayNumber = Number(day)
  const dateValue =
    boundary === 'start'
      ? new Date(yearNumber, monthIndex, dayNumber, 0, 0, 0, 0)
      : new Date(yearNumber, monthIndex, dayNumber, 23, 59, 59, 999)

  if (
    dateValue.getFullYear() !== yearNumber ||
    dateValue.getMonth() !== monthIndex ||
    dateValue.getDate() !== dayNumber
  ) {
    return null
  }

  return Math.floor(dateValue.getTime() / 1000)
}

function normalizeActivityModalFilters(filters: TActivityModalFilters): TActivityModalFilters {
  if (filters.startDate && filters.endDate && filters.startDate > filters.endDate) {
    return {
      ...filters,
      startDate: filters.endDate,
      endDate: filters.startDate
    }
  }

  return filters
}

function getActivityDateFromInputValue(date: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  if (!match) {
    return null
  }

  const [, year, month, day] = match
  const yearNumber = Number(year)
  const monthIndex = Number(month) - 1
  const dayNumber = Number(day)
  const dateValue = new Date(yearNumber, monthIndex, dayNumber)

  if (
    dateValue.getFullYear() !== yearNumber ||
    dateValue.getMonth() !== monthIndex ||
    dateValue.getDate() !== dayNumber
  ) {
    return null
  }

  return dateValue
}

function getActivityMonthDate(date: string): Date {
  const parsedDate = getActivityDateFromInputValue(date) ?? new Date()

  return new Date(parsedDate.getFullYear(), parsedDate.getMonth(), 1)
}

function getActivityDateInputFromDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function getActivityMonthOffset(date: Date, offset: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + offset, 1)
}

function getActivityMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function getEarlierActivityDate(firstDate: string, secondDate: string): string {
  return firstDate < secondDate ? firstDate : secondDate
}

function getActivityEntryTitle(entry: TPortfolioActivityEntry): string {
  if (entry.displayType === 'reward_claim') {
    return 'Reward Claim'
  }

  if (entry.action === 'transfer' && entry.inputTokenAddress && entry.outputTokenAddress) {
    return 'Zap'
  }

  if (entry.action === 'transfer' && entry.transferDirection === 'in') {
    return 'Transfer in'
  }

  if (entry.action === 'transfer' && entry.transferDirection === 'out') {
    return 'Transfer out'
  }

  return ACTIVITY_ACTION_LABELS[entry.action]
}

function getActivityEntryKey(entry: TPortfolioActivityEntry, index: number): string {
  return [
    entry.chainId,
    entry.txHash,
    entry.vaultAddress,
    entry.familyVaultAddress,
    entry.action,
    entry.displayType ?? 'none',
    entry.transferDirection ?? 'none',
    entry.assetAmount,
    entry.inputTokenAddress ?? 'none',
    entry.inputTokenAmount ?? 'none',
    entry.outputTokenAddress ?? 'none',
    entry.outputTokenAmount ?? 'none',
    entry.shareAmount,
    entry.timestamp,
    index
  ].join(':')
}

function formatActivityMonthLabel(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

function ActivityActionIcon({
  action,
  displayType
}: {
  action: TPortfolioActivityEntry['action']
  displayType: TPortfolioActivityEntry['displayType']
}): ReactElement {
  const iconClassName = 'size-5'

  if (displayType === 'reward_claim') {
    return <IconHandCoins className={iconClassName} aria-hidden="true" />
  }

  if (action === 'deposit') {
    return <IconDeposit className={iconClassName} aria-hidden="true" />
  }

  if (action === 'withdraw') {
    return <IconWithdraw className={iconClassName} aria-hidden="true" />
  }

  if (action === 'stake') {
    return <IconStake className={iconClassName} aria-hidden="true" />
  }

  if (action === 'transfer' || action === 'swap') {
    return <IconGitCompare className={iconClassName} strokeWidth={1.5} aria-hidden="true" />
  }

  return <IconUnstake className={iconClassName} aria-hidden="true" />
}

function ActivityDetailItem({ label, value }: { label: string; value: ReactElement | string }): ReactElement {
  return (
    <div className="grid grid-cols-1 items-start gap-1 py-1 text-left md:grid-cols-[180px_minmax(0,1fr)] md:gap-3">
      <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-text-secondary">{label}</span>
      <div className="min-w-0 text-left text-sm text-text-primary">{value}</div>
    </div>
  )
}

function ActivityTransactionHash({
  explorerUrl,
  onOpen,
  txHash
}: {
  explorerUrl: string | null
  onOpen?: () => void
  txHash: string
}): ReactElement {
  const displayHash = truncateActivityHash(txHash, 6)

  return (
    <span className="inline-flex min-w-0 items-center gap-1">
      {explorerUrl ? (
        <Link
          href={explorerUrl}
          target={'_blank'}
          rel={'noopener noreferrer'}
          aria-label={`View transaction ${txHash} on explorer`}
          className={
            'inline-flex min-w-0 items-center gap-1 text-text-primary transition-colors hover:text-text-secondary'
          }
          onClick={onOpen}
        >
          <span className="truncate font-mono text-sm" title={txHash}>
            {displayHash}
          </span>
          <IconLinkOut className={'size-3 shrink-0'} />
        </Link>
      ) : (
        <span className="truncate font-mono text-sm text-text-secondary" title={txHash}>
          {displayHash}
        </span>
      )}
      <button
        type={'button'}
        onClick={(): void => copyToClipboard(txHash)}
        className={'text-text-secondary transition-colors hover:text-text-primary'}
        aria-label={'Copy transaction hash'}
      >
        <IconCopy className={'size-3'} />
      </button>
    </span>
  )
}

function ActivityDateChip({
  date,
  dateInputValue,
  dateTime,
  onOpenDateRange,
  time
}: {
  date: string
  dateInputValue: string
  dateTime: string
  time: string
  onOpenDateRange: (startDate: string, endDate: string) => void
}): ReactElement {
  return (
    <span className="relative z-30 inline-flex justify-end">
      <button
        type="button"
        aria-label={`Filter activity around ${dateTime}`}
        onClick={(event): void => {
          event.stopPropagation()
          onOpenDateRange(dateInputValue, dateInputValue)
        }}
        className={cl(
          'group/date inline-flex flex-row-reverse items-center overflow-hidden rounded-lg border border-border bg-surface-secondary px-1 py-0.5 text-xs font-medium text-text-primary/70 transition-colors',
          'hover:bg-surface-tertiary/80 hover:text-text-primary'
        )}
      >
        <span>{date}</span>
        <span
          className={
            'max-w-0 whitespace-nowrap opacity-0 transition-all duration-150 group-hover/date:mr-1 group-hover/date:max-w-24 group-hover/date:opacity-100'
          }
        >
          {time}
        </span>
      </button>
    </span>
  )
}

function ActivityTypeDropdown({
  selectedTypes,
  onChange
}: {
  selectedTypes: TPortfolioActivityEntry['action'][]
  onChange: (selectedTypes: TPortfolioActivityEntry['action'][]) => void
}): ReactElement {
  const selectedLabels = ACTIVITY_TYPE_FILTERS.filter(
    (filter): filter is { key: TPortfolioActivityEntry['action']; label: string } =>
      filter.key !== 'all' && selectedTypes.includes(filter.key)
  ).map((filter) => filter.label)
  const isActive = selectedTypes.length > 0
  const buttonLabel = selectedLabels.length > 0 ? selectedLabels.join(', ') : 'Transaction type'

  return (
    <Listbox value={selectedTypes} onChange={onChange} multiple>
      <div className="relative w-full md:w-auto md:shrink-0">
        <ListboxButton
          className={cl(
            'flex h-10 w-full items-center justify-between gap-2 rounded-lg border bg-surface px-2 text-xs font-medium transition-colors md:px-3 md:text-sm',
            isActive ? 'border-primary/50 text-primary' : 'border-border text-text-secondary hover:text-text-primary'
          )}
        >
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate">{buttonLabel}</span>
          </span>
          <span className="flex shrink-0 items-center gap-1">
            {isActive ? (
              <span className="relative size-5 rounded-full border border-primary/50 text-[11px] font-semibold leading-none">
                <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                  {selectedTypes.length}
                </span>
              </span>
            ) : null}
            <IconChevron className="size-4 text-text-secondary" />
          </span>
        </ListboxButton>
        <Transition
          as={Fragment}
          enter="transition ease-out duration-100"
          enterFrom="opacity-0 scale-95"
          enterTo="opacity-100 scale-100"
          leave="transition ease-in duration-75"
          leaveFrom="opacity-100 scale-100"
          leaveTo="opacity-0 scale-95"
        >
          <ListboxOptions className="absolute z-50 mt-1 max-h-72 w-56 overflow-auto rounded-lg border border-border bg-surface-secondary py-1 shadow-lg scrollbar-themed">
            {ACTIVITY_TYPE_FILTERS.filter(
              (filter): filter is { key: TPortfolioActivityEntry['action']; label: string } => filter.key !== 'all'
            ).map((filter) => (
              <ListboxOption
                key={filter.key}
                value={filter.key}
                className={({ active }) =>
                  cl(
                    'flex cursor-pointer items-center justify-between gap-3 px-3 py-2 text-sm text-text-primary',
                    active ? 'bg-surface' : ''
                  )
                }
              >
                {({ selected }) => (
                  <>
                    <span>{filter.label}</span>
                    <span
                      className={cl(
                        'inline-flex size-4 items-center justify-center rounded-full border bg-surface',
                        selected ? 'border-primary text-primary' : 'border-border text-transparent'
                      )}
                    >
                      <IconCheck className="size-3" />
                    </span>
                  </>
                )}
              </ListboxOption>
            ))}
          </ListboxOptions>
        </Transition>
      </div>
    </Listbox>
  )
}

function ActivityCalendarMonth({
  activeField,
  endDate,
  maxDate,
  minDate,
  onSelectDate,
  onShowNextMonth,
  onShowPreviousMonth,
  selectedDate,
  startDate,
  visibleMonth
}: {
  activeField: TActivityDateField
  endDate: string
  maxDate?: string
  minDate?: string
  onSelectDate: (date: string) => void
  onShowNextMonth?: () => void
  onShowPreviousMonth?: () => void
  selectedDate: string
  startDate: string
  visibleMonth: Date
}): ReactElement {
  const firstDayOffset = visibleMonth.getDay()
  const daysInMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 0).getDate()
  const selectedDateValue = selectedDate
  const emptyCalendarDays = Array.from(
    { length: firstDayOffset },
    (_, emptyDay) => `empty-${visibleMonth.getFullYear()}-${visibleMonth.getMonth()}-${emptyDay}`
  )
  const calendarDays = Array.from({ length: daysInMonth }, (_, dayIndex) => dayIndex + 1)

  return (
    <div className="rounded-lg border border-border bg-surface-secondary p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        {onShowPreviousMonth ? (
          <button
            type="button"
            className="inline-flex size-8 items-center justify-center rounded-full border border-border text-text-secondary hover:text-text-primary"
            onClick={onShowPreviousMonth}
            aria-label="Show previous month"
          >
            <IconChevron className="size-4 rotate-90" />
          </button>
        ) : (
          <span className="size-8" />
        )}
        <span className="text-sm font-semibold text-text-primary">{formatActivityMonthLabel(visibleMonth)}</span>
        {onShowNextMonth ? (
          <button
            type="button"
            className="inline-flex size-8 items-center justify-center rounded-full border border-border text-text-secondary hover:text-text-primary"
            onClick={onShowNextMonth}
            aria-label="Show next month"
          >
            <IconChevron className="size-4 -rotate-90" />
          </button>
        ) : (
          <span className="size-8" />
        )}
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase text-text-secondary">
        {ACTIVITY_CALENDAR_DAY_LABELS.map((day) => (
          <span key={day.key} className="py-1">
            {day.label}
          </span>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-y-1">
        {emptyCalendarDays.map((emptyDay) => (
          <span key={emptyDay} className="size-8" />
        ))}
        {calendarDays.map((day) => {
          const date = getActivityDateInputFromDate(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), day))
          const isSelected = date === selectedDateValue
          const isRangeStart = startDate !== '' && date === startDate
          const isRangeEnd = endDate !== '' && date === endDate
          const isInRange = startDate !== '' && endDate !== '' && date >= startDate && date <= endDate
          const isDisabled = Boolean((minDate && date < minDate) || (maxDate && date > maxDate))

          return (
            <span key={date} className="relative flex size-8 items-center justify-center">
              {isInRange ? (
                <span
                  className={cl(
                    'absolute inset-y-1 bg-primary/10',
                    isRangeStart ? 'left-1 right-0 rounded-l-full' : 'left-0 right-0',
                    isRangeEnd ? 'left-0 right-1 rounded-r-full' : '',
                    isRangeStart && isRangeEnd ? 'inset-x-1 rounded-full' : ''
                  )}
                />
              ) : null}
              <button
                type="button"
                disabled={isDisabled}
                className={cl(
                  'relative z-10 inline-flex size-8 items-center justify-center rounded-full text-sm transition-colors',
                  isSelected || isRangeStart || isRangeEnd
                    ? 'bg-neutral-900 font-semibold text-surface'
                    : 'text-text-primary hover:bg-surface',
                  activeField === 'startDate' && isRangeStart ? 'ring-2 ring-primary/40' : '',
                  activeField === 'endDate' && isRangeEnd ? 'ring-2 ring-primary/40' : '',
                  isDisabled ? 'cursor-not-allowed text-text-secondary/40 hover:bg-transparent' : ''
                )}
                onClick={() => onSelectDate(date)}
              >
                {day}
              </button>
            </span>
          )
        })}
      </div>
    </div>
  )
}

function ActivityDateRangeButton({
  endDate,
  onClick,
  startDate
}: {
  endDate: string
  onClick: () => void
  startDate: string
}): ReactElement {
  const isActive = startDate !== '' || endDate !== DEFAULT_ACTIVITY_MODAL_FILTERS.endDate

  return (
    <button
      type="button"
      className={cl(
        'flex h-10 w-full items-center justify-between gap-2 rounded-lg border bg-surface px-2 text-xs font-medium transition-colors md:w-auto md:shrink-0 md:px-3 md:text-sm',
        isActive ? 'border-primary/50 text-primary' : 'border-border text-text-secondary hover:text-text-primary'
      )}
      onClick={onClick}
    >
      <span className="flex min-w-0 items-center gap-2">
        <IconCalendarDays className="size-4 shrink-0" />
        <span className="min-w-0 truncate md:hidden">{'Date range'}</span>
        <span className="hidden min-w-0 truncate md:inline">{'Select date range'}</span>
      </span>
    </button>
  )
}

function ActivityDateRangeModal({
  filters,
  isOpen,
  onApply,
  onClose
}: {
  filters: TActivityModalFilters
  isOpen: boolean
  onApply: (filters: TActivityModalFilters) => void
  onClose: () => void
}): ReactElement {
  const [pendingFilters, setPendingFilters] = useState<TActivityModalFilters>(filters)
  const [activeDateField, setActiveDateField] = useState<TActivityDateField>('startDate')
  const [visibleStartMonth, setVisibleStartMonth] = useState(() =>
    getActivityMonthOffset(getActivityMonthDate(filters.endDate), -1)
  )

  useEffect(() => {
    if (isOpen) {
      setPendingFilters(filters)
      setActiveDateField(filters.startDate ? 'endDate' : 'startDate')
      setVisibleStartMonth(getActivityMonthOffset(getActivityMonthDate(filters.endDate), -1))
    }
  }, [filters, isOpen])

  const todayDate = DEFAULT_ACTIVITY_MODAL_FILTERS.endDate
  const visibleEndMonth = getActivityMonthOffset(visibleStartMonth, 1)
  const currentMonth = getActivityMonthDate(todayDate)
  const canShowNextMonth = getActivityMonthKey(visibleEndMonth) < getActivityMonthKey(currentMonth)
  const startDateMax = pendingFilters.endDate ? getEarlierActivityDate(pendingFilters.endDate, todayDate) : todayDate
  const selectedCalendarDate = activeDateField === 'startDate' ? pendingFilters.startDate : pendingFilters.endDate

  function handleDateSelect(date: string): void {
    if (activeDateField === 'startDate') {
      setPendingFilters((previous) => ({
        ...previous,
        startDate: date,
        endDate: previous.endDate && previous.endDate >= date ? previous.endDate : date
      }))
      setActiveDateField('endDate')
      return
    }

    setPendingFilters((previous) => ({
      ...previous,
      endDate: date,
      startDate: previous.startDate && previous.startDate <= date ? previous.startDate : date
    }))
  }

  function handleClear(): void {
    const clearedFilters = {
      ...pendingFilters,
      startDate: DEFAULT_ACTIVITY_MODAL_FILTERS.startDate,
      endDate: DEFAULT_ACTIVITY_MODAL_FILTERS.endDate
    }

    setPendingFilters(clearedFilters)
    onApply(clearedFilters)
    setActiveDateField('startDate')
    setVisibleStartMonth(getActivityMonthOffset(getActivityMonthDate(DEFAULT_ACTIVITY_MODAL_FILTERS.endDate), -1))
    onClose()
  }

  function handleSave(): void {
    onApply(normalizeActivityModalFilters(pendingFilters))
    onClose()
  }

  return (
    <Transition show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-70" onClose={onClose}>
        <TransitionChild
          as={Fragment}
          enter="duration-200 ease-out"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="duration-150 ease-in"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/40" />
        </TransitionChild>
        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <TransitionChild
              as={Fragment}
              enter="duration-200 ease-out"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="duration-150 ease-in"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-4xl rounded-3xl border border-border bg-surface p-6 text-text-primary shadow-lg">
                <div className="flex items-start justify-between gap-4">
                  <Dialog.Title className="text-lg font-semibold text-text-primary">{'Date range'}</Dialog.Title>
                  <button
                    type="button"
                    onClick={onClose}
                    className="inline-flex size-8 items-center justify-center rounded-full border border-transparent text-text-secondary hover:border-border hover:text-text-primary"
                    aria-label="Close date range"
                  >
                    <IconCross className="size-4" />
                  </button>
                </div>

                <div className="relative mt-4 grid gap-4 md:grid-cols-2">
                  <div className="flex min-w-0 flex-col gap-3">
                    <label className="flex min-w-0 flex-col gap-3">
                      <span className="text-sm font-medium text-text-secondary">{'Start date'}</span>
                      <input
                        type="date"
                        value={pendingFilters.startDate}
                        max={todayDate}
                        onFocus={() => setActiveDateField('startDate')}
                        onChange={(event) => {
                          const startDate = event.target.value
                          setPendingFilters((previous) => ({
                            ...previous,
                            startDate
                          }))
                        }}
                        className={cl(
                          'h-10 rounded-lg border bg-transparent px-3 text-sm text-text-primary outline-none',
                          activeDateField === 'startDate' ? 'border-primary/60' : 'border-border'
                        )}
                      />
                    </label>
                  </div>
                  <div className="flex min-w-0 flex-col gap-3">
                    <label className="flex min-w-0 flex-col gap-3">
                      <span className="text-sm font-medium text-text-secondary">{'End date'}</span>
                      <input
                        type="date"
                        value={pendingFilters.endDate}
                        max={todayDate}
                        onFocus={() => setActiveDateField('endDate')}
                        onChange={(event) => {
                          const endDate = event.target.value
                          setPendingFilters((previous) => ({
                            ...previous,
                            endDate
                          }))
                        }}
                        className={cl(
                          'h-10 rounded-lg border bg-transparent px-3 text-sm text-text-primary outline-none',
                          activeDateField === 'endDate' ? 'border-primary/60' : 'border-border'
                        )}
                      />
                    </label>
                  </div>
                </div>
                <div className="relative mt-4 grid gap-4 md:grid-cols-2">
                  <ActivityCalendarMonth
                    activeField={activeDateField}
                    selectedDate={selectedCalendarDate}
                    startDate={pendingFilters.startDate}
                    endDate={pendingFilters.endDate}
                    visibleMonth={visibleStartMonth}
                    minDate={activeDateField === 'endDate' ? pendingFilters.startDate || undefined : undefined}
                    maxDate={activeDateField === 'startDate' ? startDateMax : todayDate}
                    onShowPreviousMonth={() => setVisibleStartMonth((previous) => getActivityMonthOffset(previous, -1))}
                    onSelectDate={handleDateSelect}
                  />
                  <ActivityCalendarMonth
                    activeField={activeDateField}
                    selectedDate={selectedCalendarDate}
                    startDate={pendingFilters.startDate}
                    endDate={pendingFilters.endDate}
                    visibleMonth={visibleEndMonth}
                    minDate={activeDateField === 'endDate' ? pendingFilters.startDate || undefined : undefined}
                    maxDate={activeDateField === 'startDate' ? startDateMax : todayDate}
                    onShowNextMonth={
                      canShowNextMonth
                        ? () => setVisibleStartMonth((previous) => getActivityMonthOffset(previous, 1))
                        : undefined
                    }
                    onSelectDate={handleDateSelect}
                  />
                </div>

                <div className="mt-6 flex justify-end gap-3">
                  <button
                    type="button"
                    className="rounded-full border border-border px-4 py-2 text-sm font-medium text-text-primary hover:border-border-hover"
                    onClick={handleClear}
                  >
                    {'Clear'}
                  </button>
                  <button
                    type="button"
                    className="rounded-full bg-neutral-900 px-4 py-2 text-sm font-semibold text-surface transition-colors hover:bg-neutral-800"
                    onClick={handleSave}
                  >
                    {'Save'}
                  </button>
                </div>
              </Dialog.Panel>
            </TransitionChild>
          </div>
        </div>
      </Dialog>
    </Transition>
  )
}

function ActivityMobileChainDropdown({
  chainButtons,
  areAllChainsSelected,
  allChainsLabel,
  onSelectAllChains,
  onSelectChain
}: {
  chainButtons: TVaultsChainButton[]
  areAllChainsSelected: boolean
  allChainsLabel: string
  onSelectAllChains: () => void
  onSelectChain: (chainId: number) => void
}): ReactElement {
  const selectedChain = areAllChainsSelected ? null : (chainButtons.find((chain) => chain.isSelected) ?? null)

  function handleChange(chainId: number | null): void {
    if (chainId === null) {
      onSelectAllChains()
      return
    }

    onSelectChain(chainId)
  }

  return (
    <Listbox value={selectedChain?.id ?? null} onChange={handleChange}>
      <div className="relative">
        <ListboxButton className="flex h-10 w-full items-center justify-between gap-2 rounded-lg border border-border bg-surface px-3 text-sm font-medium text-text-primary transition-colors hover:border-hover">
          <div className="flex min-w-0 items-center gap-2">
            {selectedChain ? (
              <>
                {selectedChain.icon ? (
                  <span className="size-5 shrink-0 overflow-hidden rounded-full">{selectedChain.icon}</span>
                ) : null}
                <span className="truncate">{selectedChain.label}</span>
              </>
            ) : (
              <>
                <span className="size-5 shrink-0 overflow-hidden rounded-full">
                  <LogoYearn className="size-full" back="text-text-primary" front="text-surface" />
                </span>
                <span className="truncate">{allChainsLabel}</span>
              </>
            )}
          </div>
          <IconChevron className="size-4 shrink-0 text-text-secondary" />
        </ListboxButton>
        <Transition
          as={Fragment}
          enter="transition ease-out duration-100"
          enterFrom="opacity-0 scale-95"
          enterTo="opacity-100 scale-100"
          leave="transition ease-in duration-75"
          leaveFrom="opacity-100 scale-100"
          leaveTo="opacity-0 scale-95"
        >
          <ListboxOptions className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-border bg-surface-secondary py-1 shadow-lg scrollbar-themed">
            <ListboxOption
              value={null}
              className={({ active, selected }) =>
                cl(
                  'flex cursor-pointer items-center gap-2 px-3 py-2 text-sm',
                  active ? 'bg-surface' : '',
                  selected ? 'font-semibold text-text-primary' : 'text-text-secondary'
                )
              }
            >
              <span className="size-5 shrink-0 overflow-hidden rounded-full">
                <LogoYearn className="size-full" back="text-text-primary" front="text-surface" />
              </span>
              <span>{allChainsLabel}</span>
            </ListboxOption>
            {chainButtons.map((chain) => (
              <ListboxOption
                key={chain.id}
                value={chain.id}
                className={({ active, selected }) =>
                  cl(
                    'flex cursor-pointer items-center gap-2 px-3 py-2 text-sm',
                    active ? 'bg-surface' : '',
                    selected ? 'font-semibold text-text-primary' : 'text-text-secondary'
                  )
                }
              >
                {chain.icon ? <span className="size-5 shrink-0 overflow-hidden rounded-full">{chain.icon}</span> : null}
                <span>{chain.label}</span>
              </ListboxOption>
            ))}
          </ListboxOptions>
        </Transition>
      </div>
    </Listbox>
  )
}

function IndexedActivityRow({
  assetAddress,
  displayName,
  entry,
  isFirstRow,
  isLastRow,
  isChainFilterActive,
  isZapFilterActive,
  isVaultFilterActive,
  sourceShareSymbol,
  shareSymbol,
  onSelectChain,
  onOpenDateRange,
  onOpenTransaction,
  onOpenVault,
  onRowExpand,
  onSelectZap,
  onSelectVault
}: {
  assetAddress: string | null
  isFirstRow: boolean
  isLastRow: boolean
  isChainFilterActive: boolean
  isZapFilterActive: boolean
  isVaultFilterActive: boolean
  displayName: string
  entry: TPortfolioActivityEntry
  sourceShareSymbol: string | null
  shareSymbol: string | null
  onSelectChain: (chainId: number) => void
  onOpenDateRange: (startDate: string, endDate: string) => void
  onOpenTransaction: (entry: TPortfolioActivityEntry) => void
  onOpenVault: (entry: TPortfolioActivityEntry) => void
  onRowExpand: (entry: TPortfolioActivityEntry) => void
  onSelectZap: () => void
  onSelectVault: (vaultName: string) => void
}): ReactElement {
  const [isExpanded, setIsExpanded] = useState(false)
  const explorerUrl = getActivityExplorerUrl(entry.chainId, entry.txHash)
  const preferredVaultAddress =
    entry.familyVaultAddress && !isZeroAddress(entry.familyVaultAddress) ? entry.familyVaultAddress : entry.vaultAddress
  const normalizedAssetAddress = assetAddress && !isZeroAddress(assetAddress) ? toAddress(assetAddress) : null
  const normalizedInputTokenAddress =
    entry.inputTokenAddress && !isZeroAddress(entry.inputTokenAddress) ? toAddress(entry.inputTokenAddress) : null
  const normalizedOutputTokenAddress =
    entry.outputTokenAddress && !isZeroAddress(entry.outputTokenAddress) ? toAddress(entry.outputTokenAddress) : null
  const isTransferAction = entry.action === 'transfer'
  const isSwapAction = entry.action === 'swap'
  const isRewardClaim = entry.displayType === 'reward_claim'
  const vaultPageUrl = `/vaults/${entry.chainId}/${toAddress(preferredVaultAddress)}`
  const activityTitle = getActivityEntryTitle(entry)
  const isExitAction = entry.action === 'withdraw' || entry.action === 'unstake'
  const tokenAddress = normalizedAssetAddress ?? normalizedInputTokenAddress ?? normalizedOutputTokenAddress
  const chainName = getActivityChainName(entry.chainId)
  const formattedDate = formatIndexedActivityDate(entry.timestamp)
  const formattedDateTime = formatIndexedActivityDateTime(entry.timestamp)
  const formattedTime = formatIndexedActivityTime(entry.timestamp)
  const activityDateInputValue = formatActivityDateInputValue(entry.timestamp)
  const depositedTokenSymbol = isSwapAction
    ? (sourceShareSymbol ?? entry.inputTokenSymbol)
    : (entry.inputTokenSymbol ?? entry.assetSymbol)
  const depositedTokenAmount =
    entry.inputTokenAmountFormatted !== null ? entry.inputTokenAmountFormatted : entry.assetAmountFormatted
  const receivedTokenSymbol = isExitAction ? (entry.outputTokenSymbol ?? entry.assetSymbol) : shareSymbol
  const receivedTokenAmount =
    isExitAction && entry.outputTokenAmountFormatted !== null
      ? entry.outputTokenAmountFormatted
      : isExitAction
        ? entry.assetAmountFormatted
        : entry.shareAmountFormatted
  const isZap = Boolean(
    !isSwapAction &&
      ((entry.inputTokenAddress && entry.inputTokenAmount) || (entry.outputTokenAddress && entry.outputTokenAmount))
  )
  const isStakeZap = entry.action === 'stake' && Boolean(entry.inputTokenAddress && entry.inputTokenAmount)
  const zapTarget =
    entry.outputTokenSymbol ?? (entry.outputTokenAddress ? truncateHex(entry.outputTokenAddress, 5) : null)
  const summaryAssetSymbol = isTransferAction
    ? shareSymbol
    : isExitAction
      ? (receivedTokenSymbol ?? shareSymbol)
      : (depositedTokenSymbol ?? shareSymbol)
  const primaryAmount = isExitAction
    ? formatActivityDisplayAmount(entry.shareAmountFormatted, shareSymbol)
    : formatActivityDisplayAmount(depositedTokenAmount, depositedTokenSymbol)
  const secondaryAmount = isExitAction
    ? formatActivityDisplayAmount(receivedTokenAmount, receivedTokenSymbol)
    : formatActivityDisplayAmount(entry.shareAmountFormatted, shareSymbol)
  const collapsedPrimaryAmount = isExitAction
    ? formatActivityFixedValue(entry.shareAmountFormatted)
    : formatActivityFixedValue(depositedTokenAmount)
  const collapsedSecondaryAmount = isExitAction
    ? formatActivityFixedValue(receivedTokenAmount)
    : formatActivityFixedValue(entry.shareAmountFormatted)
  const outboundAmount = collapsedPrimaryAmount
  const inboundAmount = collapsedSecondaryAmount
  const outboundSymbol = isExitAction ? shareSymbol : depositedTokenSymbol
  const inboundSymbol = isExitAction ? receivedTokenSymbol : shareSymbol
  const transferSign = entry.transferDirection === 'out' ? '-' : '+'
  const transferAmount = formatActivityFixedValue(entry.shareAmountFormatted)
  const transferDetailLabel = isRewardClaim
    ? 'REWARD CLAIMED:'
    : entry.transferDirection === 'out'
      ? 'VAULT SHARES SENT:'
      : 'VAULT SHARES RECEIVED:'
  const primaryDetailLabel = isExitAction
    ? 'VAULT SHARES REDEEMED:'
    : isSwapAction
      ? 'VAULT SHARES SENT:'
      : entry.displayType === 'zap'
        ? 'TOKEN ZAPPED:'
        : 'TOKEN DEPOSITED:'
  const secondaryDetailLabel = isExitAction
    ? entry.outputTokenAddress
      ? 'TOKEN RECEIVED:'
      : 'ASSET RECEIVED:'
    : 'VAULT SHARES RECEIVED:'
  const metadataStatus = entry.status === 'ok' ? 'Indexed' : 'Limited metadata'
  const hoverRoundedClass =
    isFirstRow && isLastRow ? 'rounded-lg' : isFirstRow ? 'rounded-t-lg' : isLastRow ? 'rounded-b-lg' : ''
  const handleRowToggle = (): void => {
    if (!isExpanded) {
      onRowExpand(entry)
    }
    setIsExpanded((previous) => !previous)
  }

  return (
    <div className={cl('relative z-0 w-full overflow-visible bg-surface transition-colors', hoverRoundedClass)}>
      <button
        type="button"
        aria-label={isExpanded ? 'Collapse row' : 'Expand row'}
        aria-expanded={isExpanded}
        onClick={handleRowToggle}
        className={cl(
          'absolute right-5 top-6.5 z-20 hidden size-9 items-center justify-center rounded-full border border-white/30 bg-app text-text-secondary transition-colors duration-150 md:flex',
          'hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400'
        )}
      >
        <IconChevron className="size-4" direction={isExpanded ? 'up' : 'down'} />
      </button>

      <div
        onClick={handleRowToggle}
        aria-expanded={isExpanded}
        className={cl(
          'group relative grid w-full cursor-pointer grid-cols-1 gap-1.5 bg-surface p-3 pb-5 text-left md:grid-cols-24 md:gap-0 md:px-6 md:py-4 md:pr-20',
          hoverRoundedClass
        )}
      >
        <div
          className={cl(
            'pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-100 group-hover:opacity-20 group-focus-visible:opacity-20',
            hoverRoundedClass,
            'bg-[linear-gradient(80deg,#2C3DA6,#D21162)]'
          )}
        />
        {isExpanded ? (
          <div
            className={
              'pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,transparent,var(--color-surface))] opacity-0 transition-opacity duration-100 group-hover:opacity-100 group-focus-visible:opacity-100'
            }
          />
        ) : null}

        <div className="z-10 flex min-w-0 items-start justify-between gap-3 md:col-span-14 md:items-center md:justify-start md:gap-6">
          <div className="flex min-w-0 items-center gap-3 md:contents">
            <div className="relative flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-secondary text-neutral-700 md:size-10">
              <ActivityActionIcon action={entry.action} displayType={entry.displayType} />
              <div className="absolute -bottom-1 -left-1 flex size-4 items-center justify-center rounded-full border border-border bg-surface">
                <Image
                  src={getActivityChainLogoUrl(entry.chainId)}
                  alt={chainName}
                  className="size-3.5 rounded-full"
                  loading="lazy"
                  decoding="async"
                />
              </div>
            </div>
            <div className="min-w-0 flex-1 md:block">
              <div className="md:block md:min-w-0">
                <div className="flex min-w-0 flex-1 flex-col items-start gap-0 pt-0.5 md:block md:pt-0">
                  <p className="min-w-0 truncate text-lg font-bold leading-tight text-text-primary">{activityTitle}</p>
                  <div className="max-w-full md:hidden">
                    <VaultsListChip
                      label={displayName}
                      isActive={isVaultFilterActive}
                      onClick={() => onSelectVault(displayName)}
                    />
                  </div>
                </div>
              </div>
              <div className="mt-1 hidden w-full flex-wrap items-center justify-start gap-2 text-left text-xs text-text-primary/70 md:flex">
                <VaultsListChip
                  label={displayName}
                  isActive={isVaultFilterActive}
                  onClick={() => onSelectVault(displayName)}
                />
                <VaultsListChip
                  label={chainName}
                  isActive={isChainFilterActive}
                  onClick={() => onSelectChain(entry.chainId)}
                />
                <ActivityDateChip
                  date={formattedDate}
                  dateInputValue={activityDateInputValue}
                  dateTime={formattedDateTime}
                  onOpenDateRange={onOpenDateRange}
                  time={formattedTime}
                />
                {metadataStatus !== 'Indexed' ? <VaultsListChip label={metadataStatus} /> : null}
                {isZap ? (
                  <VaultsListChip
                    label="Zap"
                    isActive={isZapFilterActive}
                    icon={<span aria-hidden="true">⚡</span>}
                    onClick={onSelectZap}
                  />
                ) : null}
              </div>
            </div>
          </div>
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-border bg-app text-text-secondary md:hidden">
            <IconChevron className="size-4" direction={isExpanded ? 'up' : 'down'} />
          </span>
        </div>

        <div className="z-10 flex w-full flex-wrap items-center justify-start gap-1.5 pl-11 text-left text-xs text-text-primary/70 md:hidden">
          <VaultsListChip
            label={chainName}
            isActive={isChainFilterActive}
            onClick={() => onSelectChain(entry.chainId)}
          />
          <ActivityDateChip
            date={formattedDate}
            dateInputValue={activityDateInputValue}
            dateTime={formattedDateTime}
            onOpenDateRange={onOpenDateRange}
            time={formattedTime}
          />
          {metadataStatus !== 'Indexed' ? <VaultsListChip label={metadataStatus} /> : null}
          {isZap ? (
            <VaultsListChip
              label="Zap"
              isActive={isZapFilterActive}
              icon={<span aria-hidden="true">⚡</span>}
              onClick={onSelectZap}
            />
          ) : null}
        </div>

        <div className="z-10 mt-1 pl-11 md:hidden">
          <div className="flex min-w-0 items-center justify-between gap-3">
            {isStakeZap ? (
              <div className="flex min-w-0 flex-1 flex-col items-start">
                <span className="min-w-0 text-left text-sm font-semibold tabular-nums text-text-primary">
                  {`${collapsedPrimaryAmount} ${depositedTokenSymbol ?? ''}`.trim()}
                </span>
              </div>
            ) : isTransferAction ? (
              <div className="flex min-w-0 flex-1 flex-col items-start">
                <span className="min-w-0 text-left text-sm font-semibold tabular-nums text-text-primary">
                  {`${isRewardClaim ? `+${transferAmount}` : `${transferSign}${transferAmount}`} ${shareSymbol ?? ''}`.trim()}
                </span>
              </div>
            ) : (
              <div className="flex min-w-0 flex-1 flex-col items-start gap-1">
                <span className="min-w-0 text-left text-sm font-semibold tabular-nums text-neutral-600">
                  {`-${outboundAmount} ${outboundSymbol ?? ''}`.trim()}
                </span>
                <span className="min-w-0 text-left text-sm font-semibold tabular-nums text-text-primary">
                  {`+${inboundAmount} ${inboundSymbol ?? ''}`.trim()}
                </span>
              </div>
            )}
            {tokenAddress ? (
              <TokenLogo
                src={`${env.NEXT_PUBLIC_BASE_YEARN_ASSETS_URI}/tokens/${entry.chainId}/${tokenAddress.toLowerCase()}/logo-32.png`}
                altSrc={`${env.NEXT_PUBLIC_BASE_YEARN_ASSETS_URI}/tokens/${entry.chainId}/${tokenAddress.toLowerCase()}/logo-32.png`}
                tokenSymbol={summaryAssetSymbol ?? activityTitle}
                width={32}
                height={32}
                className="shrink-0 rounded-full"
                loading="lazy"
              />
            ) : null}
          </div>
        </div>

        <div className="z-10 hidden min-w-0 items-center justify-end gap-3 md:col-span-10 md:flex">
          <div className="grid min-w-0 shrink-0 grid-cols-[24px_160px] items-center gap-2.5 text-right">
            {tokenAddress ? (
              <TokenLogo
                src={`${env.NEXT_PUBLIC_BASE_YEARN_ASSETS_URI}/tokens/${entry.chainId}/${tokenAddress.toLowerCase()}/logo-32.png`}
                altSrc={`${env.NEXT_PUBLIC_BASE_YEARN_ASSETS_URI}/tokens/${entry.chainId}/${tokenAddress.toLowerCase()}/logo-32.png`}
                tokenSymbol={summaryAssetSymbol ?? activityTitle}
                width={24}
                height={24}
                className="rounded-full"
                loading="lazy"
              />
            ) : (
              <span className="size-6" />
            )}
            {isStakeZap ? (
              <div className="grid min-w-0 grid-cols-[60px_minmax(0,1fr)] gap-x-4">
                <span className="min-w-0 text-right text-sm font-semibold leading-tight tabular-nums text-text-primary md:text-base">
                  {collapsedPrimaryAmount}
                </span>
                <span className="min-w-0 truncate text-left text-sm font-medium leading-tight text-text-primary md:text-base">
                  {depositedTokenSymbol}
                </span>
              </div>
            ) : isTransferAction ? (
              <div className="grid min-w-0 grid-cols-[60px_minmax(0,1fr)] gap-x-4">
                <span
                  className={cl(
                    'min-w-0 text-right text-sm font-semibold leading-tight tabular-nums md:text-base',
                    entry.transferDirection === 'out' && !isRewardClaim ? 'text-neutral-600' : 'text-text-primary'
                  )}
                >
                  {isRewardClaim ? `+${transferAmount}` : `${transferSign}${transferAmount}`}
                </span>
                <span
                  className={cl(
                    'min-w-0 truncate text-left text-sm font-medium leading-tight md:text-base',
                    entry.transferDirection === 'out' && !isRewardClaim ? 'text-neutral-600' : 'text-text-primary'
                  )}
                >
                  {shareSymbol}
                </span>
              </div>
            ) : (
              <div className="grid min-w-0 grid-cols-[60px_minmax(0,1fr)] gap-x-4 gap-y-0.5">
                <span className="min-w-0 text-right text-sm font-semibold leading-tight tabular-nums text-neutral-600 md:text-base">
                  {`-${outboundAmount}`}
                </span>
                <span className="min-w-0 truncate text-left text-sm font-medium leading-tight text-neutral-600 md:text-base">
                  {outboundSymbol}
                </span>
                <span className="min-w-0 text-right text-sm font-semibold leading-tight tabular-nums text-text-primary md:text-base">
                  {`+${inboundAmount}`}
                </span>
                <span className="min-w-0 truncate text-left text-sm font-medium leading-tight text-text-primary md:text-base">
                  {inboundSymbol}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {isExpanded ? (
        <div className="bg-transparent px-3 pb-4 md:pt-1 md:pl-[88px] md:pr-6">
          <div className="flex flex-col pl-11 md:pl-0">
            {isStakeZap ? (
              <>
                <ActivityDetailItem label="TOKEN STAKED:" value={primaryAmount} />
                {zapTarget ? <ActivityDetailItem label="STAKED IN:" value={zapTarget} /> : null}
              </>
            ) : isTransferAction ? (
              <>
                {isZap ? <ActivityDetailItem label="TOKEN ZAPPED:" value={primaryAmount} /> : null}
                {zapTarget ? <ActivityDetailItem label="ZAPPED TO:" value={zapTarget} /> : null}
                {zapTarget ? null : <ActivityDetailItem label={transferDetailLabel} value={secondaryAmount} />}
              </>
            ) : (
              <>
                <ActivityDetailItem label={primaryDetailLabel} value={primaryAmount} />
                <ActivityDetailItem label={secondaryDetailLabel} value={secondaryAmount} />
              </>
            )}
            <ActivityDetailItem label="CONFIRMED ON:" value={formattedDateTime} />
            <ActivityDetailItem
              label="VAULT NAME:"
              value={
                vaultPageUrl ? (
                  <Link
                    href={vaultPageUrl}
                    aria-label={`Open vault ${preferredVaultAddress}`}
                    className={'underline hover:text-text-secondary'}
                    onClick={() => onOpenVault(entry)}
                  >
                    {displayName}
                  </Link>
                ) : (
                  displayName
                )
              }
            />
            <ActivityDetailItem
              label="CHAIN NAME:"
              value={
                <span className="inline-flex items-center gap-2">
                  <Image
                    src={getActivityChainLogoUrl(entry.chainId)}
                    alt={chainName}
                    className="size-4 rounded-full"
                    loading="lazy"
                    decoding="async"
                  />
                  <span>{chainName}</span>
                </span>
              }
            />
            <ActivityDetailItem
              label="TRANSACTION HASH:"
              value={
                <ActivityTransactionHash
                  explorerUrl={explorerUrl}
                  onOpen={() => onOpenTransaction(entry)}
                  txHash={entry.txHash}
                />
              }
            />
          </div>
        </div>
      ) : null}
    </div>
  )
}

function PortfolioPageLayout({ children }: { children: ReactElement }): ReactElement {
  return (
    <div className={'min-h-[calc(100vh-var(--header-height))] w-full bg-app pb-8'}>
      <div className={'mx-auto flex w-full max-w-[1232px] flex-col gap-4 px-4 pb-16'}>{children}</div>
    </div>
  )
}

function PortfolioHeaderSection({
  blendedMetrics,
  hasKatanaHoldings,
  isHoldingsLoading,
  isSearchingBalances,
  isProtocolReturnLoading,
  annualizedProtocolReturnPct,
  totalPortfolioValue
}: TPortfolioHeaderProps): ReactElement {
  const annualizedProtocolReturnTooltip = (
    <div className={metricTooltipContentClassName}>
      <p>{'All-time annualized protocol return while funds were actually held in your wallet.'}</p>

      <p>{'Time-weighted by baseline vault exposure. Price moves are excluded.'}</p>
    </div>
  )

  const katanaTooltipContent = (
    <div className={headingTooltipClassName}>
      <p>{'*One or more vaults are receiving extra incentives.'}</p>
      <p>{'*There may be conditions to earn this rate.'}</p>
    </div>
  )

  const metricSpinner = (
    <span className="inline-flex h-6 w-20 items-center justify-center">
      <IconSpinner className="size-4 text-text-secondary" />
    </span>
  )

  function renderApyValue(value: string, shouldShowAsterisk: boolean): ReactElement {
    if (!shouldShowAsterisk) {
      return <span>{value}</span>
    }
    return (
      <span className="relative inline-flex items-center">
        {value}
        <Tooltip
          className="ml-1 cursor-default !h-auto !w-auto !gap-0 !justify-start"
          openDelayMs={150}
          side="top"
          tooltip={katanaTooltipContent}
        >
          <span className="text-md text-text-secondary transition-colors hover:text-accent-500">{'*'}</span>
        </Tooltip>
      </span>
    )
  }

  function renderApyMetric(apyValue: number | null): ReactElement {
    if (isHoldingsLoading) return metricSpinner
    if (apyValue === null) return <span>{'—'}</span>
    return renderApyValue(formatPercent(apyValue, 2, 2), hasKatanaHoldings)
  }

  function renderCurrencyMetric(value: number | null): ReactElement {
    if (isHoldingsLoading) return metricSpinner
    if (value === null) return <span>{'—'}</span>
    return <span>{currencyFormatter.format(value)}</span>
  }

  function renderSignedPercentMetric(value: number | null | undefined): ReactElement {
    if (isProtocolReturnLoading) return metricSpinner
    if (value === null || value === undefined) return <span>{'—'}</span>

    const absoluteValue = formatPercent(Math.abs(value), 2, 2, 10_000)
    const signedValue = value > 0 ? `+${absoluteValue}` : value < 0 ? `-${absoluteValue}` : absoluteValue

    return <span className={'text-text-primary'}>{signedValue}</span>
  }

  const metrics: TMetricBlock[] = [
    {
      key: 'total-balance',
      header: <MetricHeader label="Total Balance" tooltip="Total USD value of all your vault deposits." />,
      value: (
        <span className={METRIC_VALUE_CLASS}>
          {isSearchingBalances || isHoldingsLoading ? metricSpinner : currencyFormatter.format(totalPortfolioValue)}
        </span>
      )
    },
    {
      key: 'est-annual',
      header: (
        <MetricHeader
          label="Est. Annual Return"
          tooltip="Projects potential returns based on your blended current APY."
        />
      ),
      value: <span className={METRIC_VALUE_CLASS}>{renderCurrencyMetric(blendedMetrics.estimatedAnnualReturn)}</span>
    },
    {
      key: 'current-apy',
      header: <MetricHeader label="Current APY" tooltip="Weighted by your total deposits across all Yearn vaults." />,
      value: <span className={METRIC_VALUE_CLASS}>{renderApyMetric(blendedMetrics.blendedCurrentAPY)}</span>
    },
    {
      key: '30-day-apy',
      header: <MetricHeader label="30-day APY" tooltip="Blended 30-day performance using your current positions." />,
      value: <span className={METRIC_VALUE_CLASS}>{renderApyMetric(blendedMetrics.blendedHistoricalAPY)}</span>
    },
    {
      key: 'annualized-protocol-return',
      header: (
        <MetricHeader
          label="All-Time Annualized Return"
          mobileLabel="All-Time Ann."
          tooltip={annualizedProtocolReturnTooltip}
        />
      ),
      value: <span className={METRIC_VALUE_CLASS}>{renderSignedPercentMetric(annualizedProtocolReturnPct)}</span>
    }
  ]
  const mobileMetrics = [metrics[0], metrics[2], metrics[1], metrics[4]]

  return (
    <section className="h-full bg-surface">
      <div className="grid grid-cols-2 gap-px bg-border md:hidden">
        {mobileMetrics.map((item) => (
          <div key={item.key} className={metricCardClassName}>
            <div className="flex items-center justify-between">{item.header}</div>
            <div className="pt-0.5">{item.value}</div>
            {item.secondaryLabel ? <div>{item.secondaryLabel}</div> : null}
            {item.footnote ? <div className="pt-1.5">{item.footnote}</div> : null}
          </div>
        ))}
      </div>
      <div className="hidden h-full grid-rows-5 gap-px bg-border md:grid">
        {metrics.map((item) => (
          <div key={item.key} className={metricCardClassName}>
            <div className="flex items-center justify-between">{item.header}</div>
            <div className="pt-0.5">{item.value}</div>
            {item.secondaryLabel ? <div>{item.secondaryLabel}</div> : null}
            {item.footnote ? <div className="pt-1.5">{item.footnote}</div> : null}
          </div>
        ))}
      </div>
    </section>
  )
}

function PortfolioTabSelector({
  activeTab,
  onSelectTab,
  mergeWithHeader
}: {
  activeTab: TPortfolioTabKey
  onSelectTab: (tab: TPortfolioTabKey) => void
  mergeWithHeader?: boolean
}): ReactElement {
  return (
    <div className={'flex gap-2 md:gap-3 w-full'}>
      <div
        className={cl(
          'flex h-10 w-full items-stretch justify-between overflow-hidden bg-surface-secondary text-sm text-text-primary divide-x divide-border',
          mergeWithHeader ? 'rounded-b-lg border-x border-b border-border' : 'rounded-lg border border-border'
        )}
      >
        {PORTFOLIO_TABS.map((tab) => (
          <button
            key={tab.key}
            type={'button'}
            onClick={() => onSelectTab(tab.key)}
            className={cl(
              'flex h-full flex-1 items-center justify-center px-2 font-medium transition-colors md:px-4',
              'focus-visible:outline-none focus-visible:ring-0',
              activeTab === tab.key
                ? 'bg-surface text-text-primary font-semibold'
                : 'bg-transparent text-text-secondary hover:bg-surface/30 hover:text-text-primary'
            )}
            aria-pressed={activeTab === tab.key}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function PortfolioActivitySection({ isActive, openLoginModal }: TPortfolioActivityProps): ReactElement {
  const trackEvent = usePlausible()
  const { allVaults } = useYearn()
  const { getToken } = useTokenList()
  const { cachedEntries, isLoading: notificationsLoading, error: notificationsError } = useNotifications()
  const [activityFilters, setActivityFilters] = useState<TActivityModalFilters>(DEFAULT_ACTIVITY_MODAL_FILTERS)
  const [activityDateRangeDraftFilters, setActivityDateRangeDraftFilters] =
    useState<TActivityModalFilters>(DEFAULT_ACTIVITY_MODAL_FILTERS)
  const [activityChainId, setActivityChainId] = useState<number | null>(null)
  const [lastKnownActivityChainIds, setLastKnownActivityChainIds] = useState<number[] | null>(null)
  const [isActivityZapFilterActive, setIsActivityZapFilterActive] = useState(false)
  const [activitySearch, setActivitySearch] = useState('')
  const [isActivityMobileSearchExpanded, setIsActivityMobileSearchExpanded] = useState(false)
  const [isActivityDateRangeOpen, setIsActivityDateRangeOpen] = useState(false)
  const activityStartTimestamp = useMemo(
    () => getActivityDateBoundaryTimestamp(activityFilters.startDate, 'start'),
    [activityFilters.startDate]
  )
  const isActivityEndDateActive = activityFilters.endDate !== DEFAULT_ACTIVITY_MODAL_FILTERS.endDate
  const activityEndTimestamp = useMemo(
    () => (isActivityEndDateActive ? getActivityDateBoundaryTimestamp(activityFilters.endDate, 'end') : null),
    [activityFilters.endDate, isActivityEndDateActive]
  )
  const apiActivityType: TPortfolioActivityTypeFilter =
    activityFilters.types.length === 1 ? activityFilters.types[0] : 'all'
  const {
    data: indexedEntries,
    isLoading: indexedLoading,
    isLoadingMore: indexedLoadingMore,
    error: indexedError,
    isEmpty: indexedEmpty,
    hasMore: indexedHasMore,
    availableChainIds: activityAvailableChainIds,
    loadMore: loadMoreIndexedActivity
  } = usePortfolioActivity(10, isActive, {
    type: apiActivityType,
    chainId: activityChainId,
    startTimestamp: activityStartTimestamp,
    endTimestamp: activityEndTimestamp
  })
  const selectedActivityChains = useMemo(() => (activityChainId === null ? null : [activityChainId]), [activityChainId])
  const activityChainOptions = useChainOptions(selectedActivityChains)
  useEffect(() => {
    if (activityAvailableChainIds !== null) {
      setLastKnownActivityChainIds(activityAvailableChainIds)
    }
  }, [activityAvailableChainIds])
  const displayedActivityNetworks = useMemo(() => {
    const availableChainIds = activityAvailableChainIds ?? lastKnownActivityChainIds

    if (availableChainIds === null) {
      return []
    }

    const availableChainIdSet = new Set(availableChainIds)
    return SUPPORTED_NETWORKS.filter((network) => availableChainIdSet.has(network.id))
  }, [activityAvailableChainIds, lastKnownActivityChainIds])

  useEffect(() => {
    if (
      activityChainId !== null &&
      activityAvailableChainIds !== null &&
      !activityAvailableChainIds.includes(activityChainId)
    ) {
      setActivityChainId(null)
    }
  }, [activityAvailableChainIds, activityChainId])
  const activityChainButtons = useMemo<TVaultsChainButton[]>(
    () =>
      displayedActivityNetworks.map((network) => {
        const chainOption = activityChainOptions.find((option) => option.value === network.id)

        return {
          id: network.id,
          label: network.name,
          icon: chainOption?.icon,
          isSelected: activityChainId === network.id
        }
      }),
    [activityChainId, activityChainOptions, displayedActivityNetworks]
  )
  const unresolvedLocalActivityEntries = useMemo(
    () =>
      cachedEntries
        .filter((entry) => entry.status !== 'success')
        .filter((entry) =>
          doesLocalActivityMatchFilters({
            chainId: activityChainId,
            endTimestamp: activityEndTimestamp,
            filters: activityFilters,
            notification: entry,
            startTimestamp: activityStartTimestamp
          })
        )
        .filter((entry) => !isActivityZapFilterActive || isZapNotification(entry))
        .map((entry) => toLocalActivityEntry(entry, { fallbackTimestamp: Math.floor(Date.now() / 1000) }))
        .filter((entry): entry is TPortfolioActivityEntry => Boolean(entry))
        .filter((entry) => doesActivityEntryMatchSearch(entry, activitySearch, allVaults)),
    [
      activityChainId,
      activityEndTimestamp,
      activityFilters,
      activitySearch,
      activityStartTimestamp,
      allVaults,
      cachedEntries,
      isActivityZapFilterActive
    ]
  )
  const indexedTxHashes = useMemo(
    () => new Set(indexedEntries.map((entry) => entry.txHash.toLowerCase())),
    [indexedEntries]
  )
  const recentLocalEntries = useMemo(
    () =>
      cachedEntries
        .filter((entry) => isRecentLocalActivityEntry(entry, indexedTxHashes))
        .filter((entry) =>
          doesLocalActivityMatchFilters({
            chainId: activityChainId,
            endTimestamp: activityEndTimestamp,
            filters: activityFilters,
            notification: entry,
            startTimestamp: activityStartTimestamp
          })
        )
        .filter((entry) => !isActivityZapFilterActive || isZapNotification(entry))
        .toSorted((a, b) => (b.timeFinished ?? 0) - (a.timeFinished ?? 0)),
    [
      activityChainId,
      activityEndTimestamp,
      activityFilters,
      activityStartTimestamp,
      cachedEntries,
      indexedTxHashes,
      isActivityZapFilterActive
    ]
  )
  const recentLocalActivityEntries = useMemo(
    () =>
      recentLocalEntries
        .map((entry) => toLocalActivityEntry(entry))
        .filter((entry): entry is TPortfolioActivityEntry => Boolean(entry))
        .filter((entry) => doesActivityEntryMatchSearch(entry, activitySearch, allVaults)),
    [activitySearch, allVaults, recentLocalEntries]
  )
  const hasLocalEntries = unresolvedLocalActivityEntries.length > 0 || recentLocalActivityEntries.length > 0
  const hasIndexedEntries = indexedEntries.length > 0
  const hasActiveIndexedFilters =
    activityChainId !== null ||
    isActivityZapFilterActive ||
    activityFilters.types.length > 0 ||
    activityFilters.startDate !== '' ||
    activityFilters.endDate !== DEFAULT_ACTIVITY_MODAL_FILTERS.endDate
  const visibleIndexedEntries = useMemo(() => {
    return indexedEntries.filter((entry) => {
      if (activityFilters.types.length > 0 && !activityFilters.types.includes(entry.action)) {
        return false
      }

      const hasZapToken =
        (entry.inputTokenAddress && entry.inputTokenAmount) || (entry.outputTokenAddress && entry.outputTokenAmount)

      if (isActivityZapFilterActive && !hasZapToken) {
        return false
      }

      return doesActivityEntryMatchSearch(entry, activitySearch, allVaults)
    })
  }, [activityFilters.types, activitySearch, allVaults, indexedEntries, isActivityZapFilterActive])
  const visibleActivityEntries = useMemo(
    () =>
      [...unresolvedLocalActivityEntries, ...recentLocalActivityEntries, ...visibleIndexedEntries].toSorted(
        (firstEntry, secondEntry) => secondEntry.timestamp - firstEntry.timestamp
      ),
    [recentLocalActivityEntries, unresolvedLocalActivityEntries, visibleIndexedEntries]
  )

  const trackActivityInteraction = useCallback(
    (action: string, props: Record<string, string> = {}) => {
      trackEvent(PLAUSIBLE_EVENTS.PORTFOLIO_ACTIVITY_INTERACT, {
        props: {
          action,
          ...props
        }
      })
    },
    [trackEvent]
  )

  function handleActivityChainSelect(chainId: number): void {
    const nextChainId = resolveNextSingleChainSelection(selectedActivityChains, chainId)?.[0] ?? null
    trackActivityInteraction('chain_filter', {
      chainID: String(chainId),
      state: nextChainId === null ? 'cleared' : 'selected'
    })
    setActivityChainId(nextChainId)
  }

  function handleActivityAllChainsSelect(): void {
    trackActivityInteraction('chain_filter', {
      state: 'all'
    })
    setActivityChainId(null)
  }

  function handleActivityTypesChange(types: TPortfolioActivityEntry['action'][]): void {
    trackActivityInteraction('type_filter', {
      filterCount: String(types.length),
      state: types.length > 0 ? 'selected' : 'cleared',
      type: types.length === 1 ? types[0] : types.length > 1 ? 'multiple' : 'none'
    })
    setActivityFilters((previous) => ({ ...previous, types }))
  }

  function handleActivitySearch(nextSearch: string): void {
    const wasActive = activitySearch.trim().length > 0
    const isNextActive = nextSearch.trim().length > 0
    if (!wasActive && isNextActive) {
      trackActivityInteraction('search_start')
    } else if (wasActive && !isNextActive) {
      trackActivityInteraction('search_clear')
    }
    setActivitySearch(nextSearch)
  }

  function handleActivityDateRangeOpen(): void {
    trackActivityInteraction('date_range_open', { source: 'toolbar' })
    setActivityDateRangeDraftFilters(activityFilters)
    setIsActivityDateRangeOpen(true)
  }

  function handleActivityDateChipOpen(startDate: string, endDate: string): void {
    trackActivityInteraction('date_range_open', { source: 'activity_row' })
    setActivityDateRangeDraftFilters((previous) => ({
      ...previous,
      ...activityFilters,
      startDate,
      endDate
    }))
    setIsActivityDateRangeOpen(true)
  }

  function handleActivityDateRangeModalApply(filters: TActivityModalFilters): void {
    const hasDateRange = filters.startDate !== '' || filters.endDate !== DEFAULT_ACTIVITY_MODAL_FILTERS.endDate
    trackActivityInteraction('date_range_apply', {
      state: hasDateRange ? 'selected' : 'cleared'
    })
    setActivityFilters(filters)
    setActivityDateRangeDraftFilters(filters)
  }

  function handleActivityVaultSelect(vaultName: string): void {
    const willSelectVault = activitySearch !== vaultName
    trackActivityInteraction('vault_filter', {
      source: 'activity_row',
      state: willSelectVault ? 'selected' : 'cleared'
    })
    setActivitySearch((previous) => (previous === vaultName ? '' : vaultName))
  }

  function handleActivityZapSelect(): void {
    trackActivityInteraction('zap_filter', {
      state: isActivityZapFilterActive ? 'cleared' : 'selected'
    })
    setIsActivityZapFilterActive((previous) => !previous)
  }

  const handleIndexedActivityEndReached = useCallback((): void => {
    if (!indexedHasMore || indexedLoadingMore) {
      return
    }

    trackActivityInteraction('load_more', { source: 'scroll' })
    void loadMoreIndexedActivity()
  }, [indexedHasMore, indexedLoadingMore, loadMoreIndexedActivity, trackActivityInteraction])

  function handleActivityLoadMoreClick(): void {
    trackActivityInteraction('load_more', { source: 'button' })
    void loadMoreIndexedActivity()
  }

  function handleActivityMobileSearchOpen(): void {
    trackActivityInteraction('search_open', { source: 'mobile' })
    setIsActivityMobileSearchExpanded(true)
  }

  function handleActivityMobileSearchClose(): void {
    trackActivityInteraction('search_close', { source: 'mobile' })
    setIsActivityMobileSearchExpanded(false)
  }

  function handleActivityRowExpand(entry: TPortfolioActivityEntry): void {
    trackActivityInteraction('row_expand', {
      activityType: entry.action,
      chainID: String(entry.chainId),
      displayType: entry.displayType ?? 'standard'
    })
  }

  function handleActivityTransactionOpen(entry: TPortfolioActivityEntry): void {
    trackActivityInteraction('transaction_open', {
      activityType: entry.action,
      chainID: String(entry.chainId),
      displayType: entry.displayType ?? 'standard'
    })
  }

  function handleActivityVaultOpen(entry: TPortfolioActivityEntry): void {
    trackActivityInteraction('vault_open', {
      activityType: entry.action,
      chainID: String(entry.chainId),
      displayType: entry.displayType ?? 'standard'
    })
  }

  function renderActivityFilters(): ReactElement {
    return (
      <>
        <div className="sticky top-[calc(var(--header-height)+var(--portfolio-breadcrumbs-height)+var(--portfolio-tabs-height))] z-20 flex w-full flex-wrap items-center gap-2 bg-app md:gap-3">
          <div className="w-full md:hidden">
            <ActivityMobileChainDropdown
              chainButtons={activityChainButtons}
              areAllChainsSelected={activityChainId === null}
              allChainsLabel="All Chains"
              onSelectAllChains={handleActivityAllChainsSelect}
              onSelectChain={handleActivityChainSelect}
            />
          </div>
          <div className="hidden w-fit max-w-full md:block">
            <VaultsChainSelector
              chainButtons={activityChainButtons}
              areAllChainsSelected={activityChainId === null}
              allChainsLabel="All Chains"
              showMoreChainsButton={false}
              enableResponsiveLayout={true}
              onSelectAllChains={handleActivityAllChainsSelect}
              onSelectChain={handleActivityChainSelect}
              onOpenChainModal={() => undefined}
            />
          </div>
          {isActivityMobileSearchExpanded ? (
            <div className="flex w-full items-center gap-1 md:hidden">
              <div className="flex-1">
                <SearchBar
                  className="w-full rounded-[4px] border-none bg-neutral-800/20 text-text-primary"
                  iconClassName="text-text-primary"
                  searchPlaceholder="Search activity"
                  searchValue={activitySearch}
                  onSearch={handleActivitySearch}
                  shouldDebounce={false}
                  highlightWhenActive={false}
                  autoFocus={true}
                  onKeyDown={(event): void => {
                    if (event.key === 'Escape') {
                      handleActivityMobileSearchClose()
                    }
                  }}
                />
              </div>
              <button
                type="button"
                className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-text-secondary transition-colors hover:border-hover hover:text-text-primary"
                onClick={handleActivityMobileSearchClose}
                aria-label="Close activity search"
              >
                <IconCross className="size-3" />
              </button>
            </div>
          ) : (
            <div className="grid w-full grid-cols-[minmax(0,1fr)_minmax(0,1fr)_40px] gap-1 md:contents md:gap-2">
              <ActivityTypeDropdown selectedTypes={activityFilters.types} onChange={handleActivityTypesChange} />
              <ActivityDateRangeButton
                startDate={activityFilters.startDate}
                endDate={activityFilters.endDate}
                onClick={handleActivityDateRangeOpen}
              />
              <button
                type="button"
                className={cl(
                  'flex size-10 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-text-secondary transition-colors hover:border-hover hover:text-text-primary md:hidden',
                  activitySearch ? 'text-text-primary' : ''
                )}
                onClick={handleActivityMobileSearchOpen}
                aria-label="Search activity"
              >
                <IconSearch className="size-4" />
              </button>
            </div>
          )}
          <div className="hidden min-w-[180px] flex-1 md:block">
            <SearchBar
              className="w-full rounded-lg border-border bg-surface text-text-primary transition-all"
              iconClassName="text-text-primary"
              searchPlaceholder="Search activity"
              searchValue={activitySearch}
              onSearch={handleActivitySearch}
              shouldDebounce={false}
              highlightWhenActive={true}
            />
          </div>
        </div>
        <ActivityDateRangeModal
          isOpen={isActivityDateRangeOpen}
          filters={activityDateRangeDraftFilters}
          onApply={handleActivityDateRangeModalApply}
          onClose={() => setIsActivityDateRangeOpen(false)}
        />
      </>
    )
  }

  function renderActivityRow(entry: TPortfolioActivityEntry, index: number): ReactElement {
    const familyVault = allVaults[toAddress(entry.familyVaultAddress)]
    const activityVault = allVaults[toAddress(entry.vaultAddress)]
    const sourceVault =
      entry.action === 'swap' && entry.inputTokenAddress ? allVaults[toAddress(entry.inputTokenAddress)] : null
    const assetToken = familyVault ? getVaultToken(familyVault) : activityVault ? getVaultToken(activityVault) : null
    const familyVaultSymbol = familyVault
      ? getVaultSymbol(familyVault)
      : activityVault
        ? getVaultSymbol(activityVault)
        : entry.assetSymbol
    const displayName = familyVault
      ? getVaultName(familyVault)
      : activityVault
        ? getVaultName(activityVault)
        : (entry.assetSymbol ?? truncateHex(entry.familyVaultAddress, 5))
    const stakingToken =
      entry.action === 'stake' || entry.action === 'unstake'
        ? getToken({ address: toAddress(entry.vaultAddress), chainID: entry.chainId })
        : null
    const stakingTokenSymbol =
      stakingToken && toAddress(stakingToken.address) === toAddress(entry.vaultAddress)
        ? stakingToken.symbol || null
        : null
    const shareSymbol =
      entry.action === 'stake' || entry.action === 'unstake'
        ? (stakingTokenSymbol ?? familyVaultSymbol)
        : familyVault
          ? getVaultSymbol(familyVault)
          : activityVault
            ? getVaultSymbol(activityVault)
            : entry.assetSymbol
    const fallbackLogoAddress =
      entry.familyVaultAddress && !isZeroAddress(entry.familyVaultAddress)
        ? entry.familyVaultAddress
        : entry.vaultAddress
    const assetAddress =
      assetToken && !isZeroAddress(assetToken.address)
        ? assetToken.address
        : fallbackLogoAddress && !isZeroAddress(fallbackLogoAddress)
          ? fallbackLogoAddress
          : null

    return (
      <IndexedActivityRow
        entry={entry}
        displayName={displayName}
        isFirstRow={index === 0}
        isLastRow={index === visibleActivityEntries.length - 1}
        isChainFilterActive={activityChainId === entry.chainId}
        isZapFilterActive={isActivityZapFilterActive}
        isVaultFilterActive={activitySearch === displayName}
        sourceShareSymbol={sourceVault ? getVaultSymbol(sourceVault) : null}
        shareSymbol={shareSymbol}
        assetAddress={assetAddress}
        onSelectChain={handleActivityChainSelect}
        onOpenDateRange={handleActivityDateChipOpen}
        onOpenTransaction={handleActivityTransactionOpen}
        onOpenVault={handleActivityVaultOpen}
        onRowExpand={handleActivityRowExpand}
        onSelectZap={handleActivityZapSelect}
        onSelectVault={handleActivityVaultSelect}
      />
    )
  }

  function renderActivityList(): ReactElement {
    if (indexedLoading && visibleActivityEntries.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center gap-2 py-6 text-sm text-text-secondary">
          <IconSpinner className="size-5 animate-spin text-text-secondary" />
          <span>{'Loading activity...'}</span>
        </div>
      )
    }

    if (indexedError && visibleActivityEntries.length === 0) {
      return (
        <div className="py-6 text-center">
          <p className="text-sm font-medium text-red-600">{'Error loading activity'}</p>
          <p className="mt-2 text-xs text-text-secondary">{indexedError.message}</p>
        </div>
      )
    }

    if (visibleActivityEntries.length === 0) {
      return (
        <div className="py-6 text-center text-sm text-text-secondary">
          {hasActiveIndexedFilters || activitySearch.trim()
            ? 'No activity matches these filters.'
            : 'No activity to show.'}
        </div>
      )
    }

    return (
      <VirtualizedVaultsList
        items={visibleActivityEntries}
        estimateSize={132}
        itemSpacingClassName="border-b-2 border-border md:border-b"
        getItemKey={getActivityEntryKey}
        onEndReached={indexedHasMore ? handleIndexedActivityEndReached : undefined}
        renderItem={renderActivityRow}
      />
    )
  }

  function renderActivityContent(): ReactElement {
    if (notificationsLoading && indexedLoading && !hasLocalEntries) {
      return (
        <div className="flex flex-col items-center justify-center gap-2 py-6 text-sm text-text-secondary">
          <IconSpinner className="size-5 animate-spin text-text-secondary" />
          <span>{'Loading activity...'}</span>
        </div>
      )
    }

    if (notificationsError && !hasLocalEntries && !hasIndexedEntries && indexedEmpty) {
      return (
        <div className="py-6 text-center">
          <p className="text-sm font-medium text-red-600">{'Error loading activity'}</p>
          <p className="mt-2 text-xs text-text-secondary">{notificationsError}</p>
        </div>
      )
    }

    if (!hasLocalEntries && !hasIndexedEntries && indexedEmpty && !hasActiveIndexedFilters) {
      return <div className="py-6 text-center text-sm text-text-secondary">{'No transactions to show.'}</div>
    }

    return (
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          {renderActivityFilters()}
          <div className="overflow-visible bg-surface md:rounded-lg md:border md:border-border">
            {renderActivityList()}
          </div>
          {indexedHasMore && (
            <div className="flex justify-center">
              <button
                type="button"
                onClick={handleActivityLoadMoreClick}
                disabled={indexedLoadingMore}
                className={cl(
                  'rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-text-primary transition-colors',
                  indexedLoadingMore ? 'cursor-wait opacity-60' : 'hover:bg-surface-secondary'
                )}
              >
                {indexedLoadingMore ? 'Loading more...' : 'Load more'}
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <section className={'flex flex-col'}>
      {!isActive ? (
        <EmptySectionCard
          title="Connect a wallet to view activity"
          description="Review your recent Yearn transactions."
          ctaLabel="Connect wallet"
          onClick={openLoginModal}
        />
      ) : (
        renderActivityContent()
      )}
    </section>
  )
}

type TChainRewardData = {
  chainId: number
  chainName: string
  rewardCount: number
  totalUsd: number
  isLoading: boolean
  stakingRewards: Array<{
    vault: TKongVault
    stakingAddress: `0x${string}`
    stakingSource: string
    rewards: TStakingReward[]
  }>
  merkleRewards: TGroupedMerkleReward[]
  refetchStaking: () => void
  refetchMerkle: () => void
}

function rewardsArrayEqual(a: TStakingReward[], b: TStakingReward[]): boolean {
  if (a.length !== b.length) return false
  return a.every((r, i) => r.tokenAddress === b[i]?.tokenAddress && r.amount === b[i]?.amount)
}

function ChainStakingRewardsFetcher({
  vault: originalVault,
  userAddress,
  isActive,
  onRewards
}: {
  vault: TKongVault
  userAddress?: `0x${string}`
  isActive: boolean
  onRewards: (
    vault: TKongVault,
    stakingAddress: `0x${string}`,
    stakingSource: string,
    rewards: TChainRewardData['stakingRewards'][number]['rewards'],
    refetch: () => void,
    isLoading: boolean
  ) => void
}): null {
  const { vault, staking, isLoading: isLoadingVault } = useVaultWithStakingRewards(originalVault, isActive)

  const stakingAddress = !isZeroAddress(staking.address) ? staking.address : undefined
  const rewardTokens = useMemo(
    () =>
      (staking.rewards ?? []).map((reward) => ({
        address: reward.address,
        symbol: reward.symbol,
        decimals: reward.decimals,
        price: reward.price,
        isFinished: reward.isFinished
      })),
    [staking.rewards]
  )

  const isEnabled = isActive && !!stakingAddress && rewardTokens.length > 0
  const {
    rewards,
    isLoading: isLoadingRewards,
    refetch
  } = useStakingRewards({
    stakingAddress,
    stakingSource: staking.source,
    rewardTokens,
    userAddress,
    chainId: getVaultChainID(vault),
    enabled: isEnabled
  })

  const isLoading = isLoadingVault || isLoadingRewards

  // Stable refs to avoid recreating the effect callback
  const latestRef = useRef({ onRewards, refetch, vault, rewards })
  latestRef.current = { onRewards, refetch, vault, rewards }

  // Primitive keys to detect actual data changes without object reference instability
  const rewardsKey = rewards.map((r) => `${r.tokenAddress}:${r.amount}`).join(',')

  useEffect(() => {
    if (!stakingAddress) return
    const { onRewards, refetch, vault, rewards } = latestRef.current
    onRewards(vault, stakingAddress, staking.source ?? '', rewards, refetch, isLoading)
  }, [vault, stakingAddress, rewardsKey, isLoading, staking.source])

  return null
}

function ChainMerkleRewardsFetcher({
  chainId,
  userAddress,
  isActive,
  onRewards,
  hiddenRewardKeys = []
}: {
  chainId: number
  userAddress?: `0x${string}`
  isActive: boolean
  onRewards: (chainId: number, rewards: TGroupedMerkleReward[], isLoading: boolean, refetch: () => void) => void
  hiddenRewardKeys?: string[]
}): null {
  const isEnabled = isActive && !!userAddress
  const { groupedRewards, isLoading, refetch } = useMerkleRewards({
    userAddress,
    chainId,
    enabled: isEnabled,
    hiddenRewardKeys
  })

  // Stable refs to avoid recreating the effect callback
  const latestRef = useRef({ onRewards, refetch, groupedRewards })
  latestRef.current = { onRewards, refetch, groupedRewards }

  // Primitive key to detect actual data changes without object reference instability
  const rewardsKey = groupedRewards.map((r) => `${r.token.address}:${r.totalUnclaimed}`).join(',')

  useEffect(() => {
    const { onRewards, refetch, groupedRewards } = latestRef.current
    onRewards(chainId, groupedRewards, isLoading, refetch)
  }, [chainId, rewardsKey, isLoading])

  return null
}

function PortfolioClaimRewardsSection({ isActive, openLoginModal }: TPortfolioClaimRewardsProps): ReactElement {
  const { address: userAddress } = useWeb3()
  const { vaults } = useYearn()
  const trackEvent = usePlausible()
  const stakingVaults = useMemo(
    () => Object.values(vaults).filter((vault) => !isZeroAddress(getVaultStaking(vault).address)),
    [vaults]
  )
  const [selectedChainId, setSelectedChainId] = useState<number | null>(null)
  const [isOverlayOpen, setIsOverlayOpen] = useState(false)
  const [activeStep, setActiveStep] = useState<TransactionStep | undefined>()
  const currentChainId = useChainId()
  const { switchChainAsync, isPending: isSwitchingChain } = useSwitchChain()

  const chainIds = useMemo(() => SUPPORTED_NETWORKS.map((network) => network.id), [])

  const [chainStakingData, setChainStakingData] = useState<
    Record<
      number,
      {
        rewards: TChainRewardData['stakingRewards']
        isLoading: boolean
        refetch: () => void
      }
    >
  >({})

  const [chainMerkleData, setChainMerkleData] = useState<
    Record<
      number,
      {
        rewards: TGroupedMerkleReward[]
        isLoading: boolean
        refetch: () => void
      }
    >
  >({})
  const [hiddenMerkleRewardKeys, setHiddenMerkleRewardKeys] = useState<Record<number, string[]>>({})
  const [activeMerkleClaim, setActiveMerkleClaim] = useState<{ chainId: number; keys: string[] } | undefined>()

  const handleStakingRewards = useCallback(
    (
      vault: TKongVault,
      stakingAddress: `0x${string}`,
      stakingSource: string,
      rewards: TChainRewardData['stakingRewards'][number]['rewards'],
      refetch: () => void,
      isLoading: boolean
    ) => {
      const chainId = getVaultChainID(vault)
      setChainStakingData((prev) => {
        const existing = prev[chainId]
        const existingVaultData = existing?.rewards.find((r) => getVaultAddress(r.vault) === getVaultAddress(vault))

        // Bail out if nothing changed
        if (existing?.isLoading === isLoading) {
          if (existingVaultData && rewardsArrayEqual(existingVaultData.rewards, rewards)) return prev
          if (!existingVaultData && rewards.length === 0) return prev
        }

        const filteredRewards = (existing?.rewards ?? []).filter(
          (r) => getVaultAddress(r.vault) !== getVaultAddress(vault)
        )
        const newRewards =
          rewards.length > 0 ? [...filteredRewards, { vault, stakingAddress, stakingSource, rewards }] : filteredRewards

        return {
          ...prev,
          [chainId]: { rewards: newRewards, isLoading, refetch }
        }
      })
    },
    []
  )

  const handleMerkleRewards = useCallback(
    (chainId: number, rewards: TGroupedMerkleReward[], isLoading: boolean, refetch: () => void) => {
      setChainMerkleData((prev) => mergeChainMerkleData(prev, chainId, rewards, isLoading, refetch))
    },
    []
  )

  const chainRewardsData = useMemo((): TChainRewardData[] => {
    return chainIds.map((chainId) => {
      const network = SUPPORTED_NETWORKS.find((n) => n.id === chainId)
      const chainName = network?.name ?? `Chain ${chainId}`
      const merkle = chainMerkleData[chainId]
      const staking = chainStakingData[chainId]

      const stakingRewardCount = staking?.rewards.reduce((sum, r) => sum + r.rewards.length, 0) ?? 0
      const merkleRewardCount = merkle?.rewards.length ?? 0
      const stakingUsd =
        staking?.rewards.reduce((sum, r) => sum + r.rewards.reduce((s, rw) => s + rw.usdValue, 0), 0) ?? 0
      const merkleUsd = merkle?.rewards.reduce((sum, r) => sum + r.totalUsdValue, 0) ?? 0

      const hasStakingVaultsOnChain = stakingVaults.some((v) => getVaultChainID(v) === chainId)
      const stakingIsLoading = hasStakingVaultsOnChain ? (staking?.isLoading ?? false) : false
      const merkleIsLoading = merkle?.isLoading ?? false

      return {
        chainId,
        chainName,
        rewardCount: stakingRewardCount + merkleRewardCount,
        totalUsd: stakingUsd + merkleUsd,
        isLoading: stakingIsLoading || merkleIsLoading,
        stakingRewards: staking?.rewards ?? [],
        merkleRewards: merkle?.rewards ?? [],
        refetchStaking: staking?.refetch ?? (() => {}),
        refetchMerkle: merkle?.refetch ?? (() => {})
      }
    })
  }, [chainIds, chainMerkleData, chainStakingData, stakingVaults])

  const totalRewardCount = useMemo(
    () => chainRewardsData.reduce((sum, c) => sum + c.rewardCount, 0),
    [chainRewardsData]
  )
  const totalUsd = useMemo(() => chainRewardsData.reduce((sum, c) => sum + c.totalUsd, 0), [chainRewardsData])
  const isLoading = chainRewardsData.some((c) => c.isLoading)

  const selectedChainData = useMemo(() => {
    if (selectedChainId === null) return null
    return chainRewardsData.find((c) => c.chainId === selectedChainId) ?? null
  }, [selectedChainId, chainRewardsData])

  const displayedRewards = useMemo(() => {
    if (selectedChainId === null) {
      return chainRewardsData.filter((c) => c.rewardCount > 0)
    }
    return selectedChainData && selectedChainData.rewardCount > 0 ? [selectedChainData] : []
  }, [selectedChainId, chainRewardsData, selectedChainData])

  const handleStartClaim = useCallback((step: TransactionStep, merkleRewardKeys: string[] = [], chainId?: number) => {
    setActiveStep(step)
    setActiveMerkleClaim(
      chainId !== undefined && merkleRewardKeys.length > 0 ? { chainId, keys: merkleRewardKeys } : undefined
    )
    setIsOverlayOpen(true)
  }, [])

  const handleBeforeSuccess = useCallback(async () => {
    if (activeMerkleClaim) {
      setHiddenMerkleRewardKeys((prev) => ({
        ...prev,
        [activeMerkleClaim.chainId]: [
          ...new Set([...(prev[activeMerkleClaim.chainId] ?? []), ...activeMerkleClaim.keys])
        ]
      }))
    }

    await Promise.all(
      chainRewardsData.flatMap((chainRewardData) => [chainRewardData.refetchStaking(), chainRewardData.refetchMerkle()])
    )
  }, [activeMerkleClaim, chainRewardsData])

  const handleClaimComplete = useCallback(() => {
    trackEvent(PLAUSIBLE_EVENTS.CLAIM, {
      props: {
        chainID: String(selectedChainId ?? 0),
        valueUsd: String(selectedChainId === null ? totalUsd : (selectedChainData?.totalUsd ?? 0)),
        source: 'portfolio'
      }
    })
    setIsOverlayOpen(false)
    setActiveStep(undefined)
    setActiveMerkleClaim(undefined)
  }, [trackEvent, selectedChainId, totalUsd, selectedChainData?.totalUsd])

  const handleOverlayClose = useCallback(() => {
    setIsOverlayOpen(false)
    setActiveStep(undefined)
    setActiveMerkleClaim(undefined)
  }, [])

  useEffect(() => {
    setHiddenMerkleRewardKeys({})
    setActiveMerkleClaim(undefined)
    setActiveStep(undefined)
    setIsOverlayOpen(false)
  }, [userAddress])

  function getChainLogoUrl(chainId: number): string {
    return `${env.NEXT_PUBLIC_BASE_YEARN_ASSETS_URI}/chains/${chainId}/logo.svg`
  }

  function renderRewardsContent(): ReactElement {
    if (isLoading && totalRewardCount === 0) {
      return (
        <div className="flex flex-col items-center justify-center gap-2 py-8 text-text-secondary">
          <IconSpinner className="size-5 animate-spin" />
          <span className="text-sm">Loading rewards...</span>
        </div>
      )
    }
    if (displayedRewards.length === 0) {
      return <p className="py-8 text-center text-sm text-text-secondary">No rewards found!</p>
    }
    const isAllChainsView = selectedChainId === null
    const showChainHeader = isAllChainsView && displayedRewards.length > 1
    const needsSwitchChain = (chainData: TChainRewardData): boolean =>
      !isAllChainsView && currentChainId !== chainData.chainId && chainData.rewardCount > 0

    return (
      <div className="flex flex-col gap-4">
        {displayedRewards.map((chainData) => (
          <div key={chainData.chainId}>
            {showChainHeader && (
              <div className="mb-2 flex items-center gap-2">
                <Image
                  src={getChainLogoUrl(chainData.chainId)}
                  alt={chainData.chainName}
                  className="size-5 rounded-full"
                />
                <span className="text-sm font-semibold text-text-primary">{chainData.chainName}</span>
              </div>
            )}
            {chainData.stakingRewards.flatMap((sr, srIdx) =>
              sr.rewards.map((reward, rewardIdx) => (
                <StakingRewardRow
                  key={`${getVaultAddress(sr.vault)}-${reward.tokenAddress}`}
                  reward={reward}
                  stakingAddress={sr.stakingAddress}
                  stakingSource={sr.stakingSource}
                  chainId={chainData.chainId}
                  onStartClaim={(step, merkleRewardRoots) =>
                    handleStartClaim(step, merkleRewardRoots, chainData.chainId)
                  }
                  isFirst={srIdx === 0 && rewardIdx === 0}
                  isAllChainsView={isAllChainsView}
                  onSwitchChain={() => switchChainAsync({ chainId: chainData.chainId })}
                />
              ))
            )}
            {chainData.merkleRewards.map((groupedReward, idx) => (
              <MerkleRewardRow
                key={groupedReward.token.address}
                groupedReward={groupedReward}
                userAddress={userAddress!}
                chainId={chainData.chainId}
                onStartClaim={(step, merkleRewardRoots) => handleStartClaim(step, merkleRewardRoots, chainData.chainId)}
                isFirst={idx === 0 && chainData.stakingRewards.length === 0}
                isAllChainsView={isAllChainsView}
                onSwitchChain={() => switchChainAsync({ chainId: chainData.chainId })}
              />
            ))}
            {needsSwitchChain(chainData) && (
              <SwitchChainPrompt
                chainId={chainData.chainId}
                onSwitchChain={() => switchChainAsync({ chainId: chainData.chainId })}
                isSwitching={isSwitchingChain}
              />
            )}
          </div>
        ))}
      </div>
    )
  }

  if (!isActive) {
    return (
      <section className="flex flex-col gap-2">
        <div>
          <h2 className="text-xl font-semibold text-text-primary sm:text-2xl">Claim rewards</h2>
          <p className="text-xs text-text-secondary sm:text-sm">
            Claim all of your staking and Merkle rewards across Yearn.
          </p>
        </div>
        <EmptySectionCard
          title="Connect a wallet to claim rewards"
          description="We will surface any claimable rewards once connected."
          ctaLabel="Connect wallet"
          onClick={openLoginModal}
        />
      </section>
    )
  }

  return (
    <section className="relative flex flex-col gap-2 sm:gap-2">
      {stakingVaults.map((vault) => (
        <ChainStakingRewardsFetcher
          key={getVaultKey(vault)}
          vault={vault}
          userAddress={userAddress}
          isActive={isActive}
          onRewards={handleStakingRewards}
        />
      ))}
      {chainIds.map((chainId) => (
        <ChainMerkleRewardsFetcher
          key={`merkle-${chainId}`}
          chainId={chainId}
          userAddress={userAddress}
          isActive={isActive}
          onRewards={handleMerkleRewards}
          hiddenRewardKeys={hiddenMerkleRewardKeys[chainId] ?? []}
        />
      ))}

      <div className="overflow-hidden rounded-lg border border-border bg-surface">
        <div className="flex flex-col md:flex-row">
          {/* Left sidebar - Chain selector (hidden on mobile, defaults to All Chains view) */}
          <div className="hidden bg-surface-secondary md:block md:w-64 md:shrink-0 md:border-r md:border-border">
            {/* All chains option */}
            <div className="border-b border-border">
              <button
                type="button"
                onClick={() => setSelectedChainId(null)}
                className={cl(
                  'flex w-full items-center justify-between px-4 py-4 transition-colors',
                  selectedChainId === null
                    ? 'bg-surface text-text-primary'
                    : 'text-text-secondary hover:bg-surface/50 hover:text-text-primary'
                )}
              >
                <div className="flex items-center gap-3">
                  <div className="flex size-8 items-center justify-center rounded-full bg-surface-secondary">
                    <span className="text-sm font-bold text-text-primary">All</span>
                  </div>
                  <span className="font-medium">All Chains</span>
                  {selectedChainId === null && <span className="size-2 rounded-full bg-green-500" />}
                </div>
                <span className="text-sm font-medium">{totalRewardCount || '-'}</span>
              </button>
            </div>

            {/* Chain list */}
            {[...chainRewardsData]
              .sort((a, b) => b.rewardCount - a.rewardCount)
              .map((chainData, index) => {
                const chainId = chainData.chainId
                const isSelected = selectedChainId === chainId
                return (
                  <button
                    key={chainId}
                    type="button"
                    onClick={() => setSelectedChainId(chainId)}
                    className={cl(
                      'flex w-full items-center justify-between px-4 py-3 transition-colors',
                      index > 0 ? 'border-t border-border' : '',
                      isSelected
                        ? 'bg-surface text-text-primary'
                        : 'text-text-secondary hover:bg-surface/50 hover:text-text-primary'
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <Image src={getChainLogoUrl(chainId)} alt={chainData.chainName} className="size-8 rounded-full" />
                      <span className="font-medium">{chainData.chainName}</span>
                      {isSelected && <span className="size-2 rounded-full bg-green-500" />}
                    </div>
                    <span className="text-sm font-medium">{chainData.rewardCount || '-'}</span>
                  </button>
                )
              })}
          </div>

          {/* Right content - Rewards panel */}
          <div className="flex-1">
            {/* Header - stacked on mobile for prominent total display */}
            <div className="flex min-h-[64px] flex-col items-center justify-center gap-1 border-b border-border px-6 py-4 md:flex-row md:justify-between md:gap-0 md:py-0">
              <h3 className="text-lg font-semibold text-text-primary">Claimable Rewards</h3>
              <span className="text-2xl font-bold text-text-primary md:text-xl">
                {formatUSD(selectedChainId === null ? totalUsd : (selectedChainData?.totalUsd ?? 0), 2, 2)}
              </span>
            </div>

            {/* Content */}
            <div className="px-6 pb-6 pt-2">{renderRewardsContent()}</div>
          </div>
        </div>
      </div>

      {isOverlayOpen && (
        <TransactionOverlay
          isOpen={isOverlayOpen}
          onClose={handleOverlayClose}
          step={activeStep}
          isLastStep={true}
          onBeforeSuccess={handleBeforeSuccess}
          onAllComplete={handleClaimComplete}
          topOffset="0"
          contentAlign="center"
        />
      )}
    </section>
  )
}

function PortfolioHoldingsSection({
  hasHoldings,
  holdingsRows,
  isActive,
  isHoldingsLoading,
  openLoginModal,
  sortBy,
  sortDirection,
  setSortBy,
  setSortDirection,
  vaultFlags
}: TPortfolioHoldingsProps): ReactElement {
  function handleSort(newSortBy: string, newDirection: TSortDirection): void {
    setSortBy(newSortBy as TPossibleSortBy)
    setSortDirection(newDirection)
  }

  function renderHoldingsContent(): ReactElement {
    if (isHoldingsLoading) {
      return (
        <div className="flex flex-col items-center justify-center gap-3 px-4 py-12 text-sm text-text-secondary sm:px-6 sm:py-16">
          <YearnLogoSpinner className="size-12" logoClassName="size-8" />
          <span>{'Searching for portfolio balances...'}</span>
        </div>
      )
    }
    if (!hasHoldings) {
      return (
        <EmptySectionCard
          title="No portfolio positions yet"
          description="Deposit into a Yearn vault or stake YFI to see it here."
          ctaLabel="Explore Vaults"
          ctaClassName="yearn--button--nextgen min-h-[44px] px-6"
          href="/vaults"
        />
      )
    }
    return (
      <div className="flex flex-col gap-px bg-border">
        {holdingsRows.map((row) =>
          row.type === 'vault' ? (
            <VaultsListRow
              key={row.key}
              currentVault={row.vault}
              flags={vaultFlags[row.key]}
              hrefOverride={row.hrefOverride}
              showBoostDetails={false}
              activeProductType="all"
              showStrategies
              showAllocatorChip={false}
              showProductTypeChipOverride={true}
              showHoldingsChipOverride={false}
              mobileSecondaryMetric="holdings"
              expandedChartVariant="portfolio-user-tvl-overlay"
              clickEventName={PLAUSIBLE_EVENTS.VAULT_CLICK_PORTFOLIO_LIST_ROW}
            />
          ) : (
            <GovernancePositionRow key={row.key} position={row.position} />
          )
        )}
      </div>
    )
  }

  return (
    <section className="flex flex-col gap-2">
      {!isActive ? (
        <div className="flex flex-col gap-2">
          <EmptySectionCard
            title="Connect a wallet to view your portfolio."
            ctaLabel="Connect wallet"
            onClick={openLoginModal}
            secondaryCtaLabel="Explore Vaults"
            secondaryCtaHref="/vaults"
          />
        </div>
      ) : (
        <div className="rounded-lg">
          <div className="flex flex-col">
            <div
              className="relative md:sticky md:z-30"
              style={{
                top: 'calc(var(--header-height) + var(--portfolio-breadcrumbs-height) + var(--portfolio-tabs-height))'
              }}
            >
              <div aria-hidden={true} className="pointer-events-none absolute inset-0 z-0 bg-app" />
              <VaultsListHead
                sortBy={sortBy}
                sortDirection={sortDirection}
                onSort={handleSort}
                wrapperClassName="relative z-10 rounded-t-lg border border-border bg-surface-secondary"
                containerClassName="relative z-10 rounded-t-lg bg-surface-secondary"
                items={[
                  {
                    type: 'sort',
                    label: 'Vault Name',
                    value: 'vault',
                    sortable: false,
                    className: 'col-span-12'
                  },
                  {
                    type: 'sort',
                    label: 'Est. APY',
                    value: 'estAPY',
                    sortable: true,
                    className: 'col-span-4'
                  },
                  {
                    type: 'sort',
                    label: 'TVL',
                    value: 'tvl',
                    sortable: true,
                    className: 'col-span-4'
                  },
                  {
                    type: 'sort',
                    label: 'Your Holdings',
                    value: 'deposited',
                    sortable: true,
                    className: 'col-span-4 justify-end'
                  }
                ]}
              />
            </div>
            <div className="overflow-hidden rounded-lg md:rounded-t-none border-x border-b border-border">
              {renderHoldingsContent()}
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

function PortfolioPositionsLoadingState(): ReactElement {
  return (
    <section className="flex min-h-[420px] flex-col items-center justify-center gap-3 rounded-lg border border-border bg-surface px-4 py-12 text-sm text-text-secondary sm:px-6 sm:py-16">
      <YearnLogoSpinner className="size-12" logoClassName="size-8" />
      <span>{'Searching for Yearn balances...'}</span>
    </section>
  )
}

function PortfolioSuggestedSection({
  hasHoldings,
  isActive,
  suggestedRows
}: TPortfolioSuggestedProps): ReactElement | null {
  if (!isActive || suggestedRows.length === 0) {
    return null
  }

  const hasPersonalized = suggestedRows.some((r) => r.type === 'personalized' || r.type === 'external')
  const tooltipText = hasPersonalized
    ? 'Suggestions based on tokens in your wallet and vault performance.'
    : 'Vaults picked for you based on performance and popularity.'

  return (
    <section className="flex flex-col gap-2">
      <Tooltip
        className="h-auto justify-start gap-0"
        openDelayMs={150}
        side="top"
        tooltip={<div className={headingTooltipClassName}>{tooltipText}</div>}
      >
        <h2 className="text-xl font-semibold text-text-primary sm:text-2xl">
          {hasHoldings ? 'Other vaults you might like:' : 'Vaults you might like:'}
        </h2>
      </Tooltip>
      <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 sm:gap-4 xl:grid-cols-4">
        {suggestedRows.map((row) => {
          if (row.type === 'external') {
            const matchedChainName =
              row.matchedChainID === getVaultChainID(row.vault) ? getNetwork(row.matchedChainID).name : undefined
            return (
              <SuggestedVaultCard
                key={row.key}
                vault={row.vault}
                matchedSymbol={row.underlyingSymbol}
                externalProtocol={row.externalProtocol}
                matchedChainName={matchedChainName}
                clickEventName={PLAUSIBLE_EVENTS.VAULT_CLICK_PORTFOLIO_SUGGESTED}
              />
            )
          }
          if (row.type === 'personalized') {
            const matchedChainName =
              row.matchedChainID === getVaultChainID(row.vault) ? getNetwork(row.matchedChainID).name : undefined
            return (
              <SuggestedVaultCard
                key={row.key}
                vault={row.vault}
                matchedSymbol={row.matchedSymbol}
                matchedChainName={matchedChainName}
                clickEventName={PLAUSIBLE_EVENTS.VAULT_CLICK_PORTFOLIO_SUGGESTED}
              />
            )
          }
          return (
            <SuggestedVaultCard
              key={row.key}
              vault={row.vault}
              clickEventName={PLAUSIBLE_EVENTS.VAULT_CLICK_PORTFOLIO_SUGGESTED}
            />
          )
        })}
      </div>
    </section>
  )
}

function PortfolioPage(): ReactElement {
  const model = usePortfolioModel()
  const trackEvent = usePlausible()
  const [historyDenomination, setHistoryDenomination] = useState<TPortfolioHistoryDenomination>('usd')
  const [historyTimeframe, setHistoryTimeframe] = useState<TPortfolioHistoryChartTimeframe>('1y')
  const [historyChartTab, setHistoryChartTab] = useState<TPortfolioHistoryChartTab>('balance')
  const [historyGrowthDisplayModeOverride, setHistoryGrowthDisplayModeOverride] = useState<TGrowthDisplayMode | null>(
    null
  )
  const [historyVaultGrowthMode, setHistoryVaultGrowthMode] = useState<TPortfolioVaultGrowthChartMode>('position')
  const searchParams = useSearchParams()
  const pathname = usePathname() || '/portfolio'
  const router = useRouter()
  const varsRef = useRef<HTMLDivElement>(null)
  const breadcrumbsRef = useRef<HTMLDivElement>(null)
  const tabsRef = useRef<HTMLDivElement>(null)
  const historyFetchTimeframe: TPortfolioHistoryTimeframe = historyTimeframe === 'all' ? 'all' : '1y'
  const { onRefresh } = useWalletActions()

  usePortfolioEntryRefresh({ isActive: model.isActive, onRefresh })

  const replaceSearchParams = useCallback(
    (nextParams: URLSearchParams): void => {
      const query = nextParams.toString()
      router.replace(`${pathname}${query ? `?${query}` : ''}`, { scroll: false })
    },
    [pathname, router]
  )

  const activeTab = useMemo((): TPortfolioTabKey => {
    const tabParam = searchParams.get('tab')
    if (tabParam === 'activity' || tabParam === 'claim-rewards' || tabParam === 'positions') {
      return tabParam
    }
    return 'positions'
  }, [searchParams])
  const shouldLoadPositionsHistory = activeTab === 'positions' && model.isActive && !model.isHoldingsLoading
  const {
    data: historyData,
    denomination: resolvedHistoryDenomination,
    isLoading: historyLoading,
    progress: historyProgress,
    error: historyError,
    isEmpty: historyEmpty
  } = usePortfolioHistory(
    historyDenomination,
    historyFetchTimeframe,
    shouldLoadPositionsHistory,
    model.liveBalanceSnapshot
  )
  const {
    data: protocolReturnHistoryData,
    summary: protocolReturnHistorySummary,
    familySeries: protocolReturnHistoryFamilySeries,
    isLoading: protocolReturnHistoryLoading,
    progress: protocolReturnHistoryProgress,
    error: protocolReturnHistoryError,
    isEmpty: protocolReturnHistoryEmpty
  } = usePortfolioProtocolReturnHistory(historyFetchTimeframe, shouldLoadPositionsHistory)
  const annualizedProtocolReturnPct = protocolReturnHistoryData?.at(-1)?.annualizedProtocolReturnPct
  const resolvedGrowthDisplayMode = resolvePortfolioGrowthDisplayMode(
    historyGrowthDisplayModeOverride ?? protocolReturnHistorySummary?.recommendedGrowthDisplay ?? 'index',
    protocolReturnHistoryData
  )
  const isEthGrowthAvailable = Boolean(protocolReturnHistoryData?.some((point) => point.growthWeightEth !== null))
  const historyChartProgress = historyChartTab === 'balance' ? historyProgress : protocolReturnHistoryProgress
  const historyChartElement = (
    <PortfolioHistoryChart
      balanceData={historyData}
      protocolReturnData={protocolReturnHistoryData}
      protocolReturnSummary={protocolReturnHistorySummary}
      protocolReturnFamilySeries={protocolReturnHistoryFamilySeries}
      denomination={resolvedHistoryDenomination}
      timeframe={historyTimeframe}
      activeTab={historyChartTab}
      growthDisplayModeOverride={historyGrowthDisplayModeOverride}
      onGrowthDisplayModeOverrideChange={setHistoryGrowthDisplayModeOverride}
      vaultGrowthMode={historyVaultGrowthMode}
      onVaultGrowthModeChange={setHistoryVaultGrowthMode}
      balanceIsLoading={model.isHoldingsLoading || historyLoading}
      balanceIsEmpty={historyEmpty}
      balanceError={historyError}
      protocolReturnIsLoading={model.isHoldingsLoading || protocolReturnHistoryLoading}
      protocolReturnIsEmpty={protocolReturnHistoryEmpty}
      protocolReturnError={protocolReturnHistoryError}
      embedded
      loadingProgress={historyChartProgress}
      className="min-h-0 flex-1"
    />
  )

  const handleTabSelect = useCallback(
    (tab: TPortfolioTabKey) => {
      if (tab !== activeTab) {
        trackEvent(PLAUSIBLE_EVENTS.PORTFOLIO_TAB_SELECT, {
          props: {
            fromTab: activeTab,
            hasHoldings: String(model.hasHoldings),
            isWalletConnected: String(model.isActive),
            tab
          }
        })
      }
      const nextParams = new URLSearchParams(searchParams.toString())
      if (tab === 'positions') {
        nextParams.delete('tab')
      } else {
        nextParams.set('tab', tab)
      }
      replaceSearchParams(nextParams)
    },
    [activeTab, model.hasHoldings, model.isActive, replaceSearchParams, searchParams, trackEvent]
  )

  useEffect(() => {
    const root = varsRef.current
    const breadcrumbsNode = breadcrumbsRef.current
    const tabsNode = tabsRef.current

    if (!root || !breadcrumbsNode || !tabsNode) {
      return
    }

    let frame = 0
    const update = (): void => {
      frame = 0
      const height = breadcrumbsNode.getBoundingClientRect().height
      root.style.setProperty('--portfolio-breadcrumbs-height', `${height}px`)
      const tabsHeight = tabsNode.getBoundingClientRect().height
      root.style.setProperty('--portfolio-tabs-height', `${tabsHeight}px`)
    }

    const schedule = (): void => {
      if (frame) {
        cancelAnimationFrame(frame)
      }
      frame = requestAnimationFrame(update)
    }

    schedule()

    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(schedule)
    observer?.observe(breadcrumbsNode)
    observer?.observe(tabsNode)
    window.addEventListener('resize', schedule)

    return () => {
      if (frame) {
        cancelAnimationFrame(frame)
      }
      observer?.disconnect()
      window.removeEventListener('resize', schedule)
    }
  }, [])

  const overviewHeading = (
    <Tooltip
      className="h-auto justify-start gap-0"
      openDelayMs={150}
      side="top"
      tooltip={
        <div className={headingTooltipClassName}>{'Monitor your balances, returns, and discover new vaults.'}</div>
      }
    >
      <h1 className="text-lg font-black text-text-primary md:text-3xl md:leading-10">{'Portfolio'}</h1>
    </Tooltip>
  )

  function renderTabContent(): ReactElement | null {
    switch (activeTab) {
      case 'positions':
        if (model.isActive && model.isHoldingsLoading) {
          return <PortfolioPositionsLoadingState />
        }

        return (
          <div className="flex flex-col gap-6 sm:gap-4">
            {model.isActive ? (
              <div className="flex flex-col overflow-hidden rounded-lg border border-border bg-surface shadow-[0_1px_0_rgba(15,23,42,0.02)]">
                <div className="grid items-stretch min-[920px]:grid-cols-[minmax(640px,1fr)_minmax(200px,340px)]">
                  <PortfolioHistoryChartControls
                    activeTab={historyChartTab}
                    onActiveTabChange={setHistoryChartTab}
                    denomination={resolvedHistoryDenomination}
                    onDenominationChange={setHistoryDenomination}
                    timeframe={historyTimeframe}
                    onTimeframeChange={setHistoryTimeframe}
                    resolvedGrowthDisplayMode={resolvedGrowthDisplayMode}
                    onGrowthDisplayModeOverrideChange={setHistoryGrowthDisplayModeOverride}
                    vaultGrowthMode={historyVaultGrowthMode}
                    onVaultGrowthModeChange={setHistoryVaultGrowthMode}
                    isEthGrowthAvailable={isEthGrowthAvailable}
                    className="h-full bg-linear-to-b from-surface to-surface-secondary/20"
                  >
                    {historyChartElement}
                  </PortfolioHistoryChartControls>
                  <div className="border-t border-border bg-linear-to-b from-surface to-surface-secondary/25 min-[920px]:border-t-0 min-[920px]:border-l">
                    <PortfolioHeaderSection
                      blendedMetrics={model.blendedMetrics}
                      isHoldingsLoading={model.isHoldingsLoading}
                      isSearchingBalances={model.isSearchingBalances}
                      hasKatanaHoldings={model.hasKatanaHoldings}
                      isProtocolReturnLoading={model.isHoldingsLoading || protocolReturnHistoryLoading}
                      annualizedProtocolReturnPct={annualizedProtocolReturnPct}
                      totalPortfolioValue={model.totalPortfolioValue}
                    />
                  </div>
                </div>
              </div>
            ) : null}
            <PortfolioHoldingsSection
              hasHoldings={model.hasHoldings}
              holdingsRows={model.holdingsRows}
              isActive={model.isActive}
              isHoldingsLoading={model.isHoldingsLoading}
              openLoginModal={model.openLoginModal}
              sortBy={model.sortBy}
              sortDirection={model.sortDirection}
              setSortBy={model.setSortBy}
              setSortDirection={model.setSortDirection}
              vaultFlags={model.vaultFlags}
            />
            <PortfolioSuggestedSection
              hasHoldings={model.hasHoldings}
              isActive={model.isActive}
              suggestedRows={model.suggestedRows}
            />
          </div>
        )
      case 'activity':
        return <PortfolioActivitySection isActive={model.isActive} openLoginModal={model.openLoginModal} />
      case 'claim-rewards':
        return <PortfolioClaimRewardsSection isActive={model.isActive} openLoginModal={model.openLoginModal} />
      default:
        return null
    }
  }

  return (
    <PortfolioPageLayout>
      <div
        ref={varsRef}
        className="flex flex-col"
        style={{ '--portfolio-breadcrumbs-height': '0px', '--portfolio-tabs-height': '0px' } as CSSProperties}
      >
        <div ref={breadcrumbsRef} className="sticky z-40 bg-app pb-2" style={{ top: 'var(--header-height)' }}>
          <Breadcrumbs
            className="px-1"
            items={[
              { label: 'Home', href: '/' },
              { label: 'Vaults', href: '/vaults' },
              { label: 'Portfolio', isCurrent: true }
            ]}
          />
        </div>
        <div className="hidden flex-col gap-3 md:flex">
          <div className="px-1">{overviewHeading}</div>
        </div>
        <div
          ref={tabsRef}
          className="sticky z-30 bg-app pb-2"
          style={{ top: 'calc(var(--header-height) + var(--portfolio-breadcrumbs-height))' }}
        >
          <PortfolioTabSelector activeTab={activeTab} onSelectTab={handleTabSelect} />
        </div>
        <div className={'pt-4'} key={activeTab}>
          {renderTabContent()}
        </div>
      </div>
    </PortfolioPageLayout>
  )
}

export default PortfolioPage
