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
import { usePortfolioEntryRefresh } from '@pages/portfolio/hooks/usePortfolioEntryRefresh'
import { type TPortfolioModel, usePortfolioModel } from '@pages/portfolio/hooks/usePortfolioModel'
import { useVaultWithStakingRewards } from '@pages/portfolio/hooks/useVaultWithStakingRewards'
import { type TVaultsChainButton, VaultsChainSelector } from '@pages/vaults/components/filters/VaultsChainSelector'
import { VaultsFiltersButton } from '@pages/vaults/components/filters/VaultsFiltersButton'
import { VaultsListChip } from '@pages/vaults/components/list/VaultsListChip'
import { VaultsListHead } from '@pages/vaults/components/list/VaultsListHead'
import { VaultsListRow } from '@pages/vaults/components/list/VaultsListRow'
import { VirtualizedVaultsList } from '@pages/vaults/components/list/VirtualizedVaultsList'
import { Notification } from '@pages/vaults/components/notifications/Notification'
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
import { useNotifications } from '@shared/contexts/useNotifications'
import { useWallet } from '@shared/contexts/useWallet'
import { useWeb3 } from '@shared/contexts/useWeb3'
import { useYearn } from '@shared/contexts/useYearn'
import { useTokenList } from '@shared/contexts/WithTokenList'
import { useChainId, useSwitchChain } from '@shared/hooks/useAppWagmi'
import { useChainOptions } from '@shared/hooks/useChains'
import { getVaultKey } from '@shared/hooks/useVaultFilterUtils'
import { IconChevron } from '@shared/icons/IconChevron'
import { IconCopy } from '@shared/icons/IconCopy'
import { IconCross } from '@shared/icons/IconCross'
import { IconLinkOut } from '@shared/icons/IconLinkOut'
import { IconSpinner } from '@shared/icons/IconSpinner'
import { LogoYearn } from '@shared/icons/LogoYearn'
import type { TSortDirection } from '@shared/types'
import { cl, formatPercent, isZeroAddress, SUPPORTED_NETWORKS, toAddress, truncateHex } from '@shared/utils'
import { formatUSD } from '@shared/utils/format'
import { copyToClipboard } from '@shared/utils/helpers'
import { PLAUSIBLE_EVENTS } from '@shared/utils/plausible'
import type { CSSProperties, ReactElement } from 'react'
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'
import Link from '/src/components/Link'
import type { TPortfolioHistoryChartTimeframe } from './components/PortfolioHistoryChart'
import { PortfolioHistoryChart } from './components/PortfolioHistoryChart'
import { usePortfolioActivity } from './hooks/usePortfolioActivity'
import { usePortfolioHistory } from './hooks/usePortfolioHistory'
import { usePortfolioProtocolReturn } from './hooks/usePortfolioProtocolReturn'
import { usePortfolioProtocolReturnHistory } from './hooks/usePortfolioProtocolReturnHistory'
import type {
  TPortfolioActivityEntry,
  TPortfolioActivityTypeFilter,
  TPortfolioHistoryDenomination,
  TPortfolioHistoryTimeframe,
  TPortfolioProtocolReturnSummary
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
  { key: 'positions', label: 'Your Vaults' },
  { key: 'activity', label: 'Your Activity' },
  { key: 'claim-rewards', label: 'Claim Rewards' }
] as const

type TPortfolioTabKey = (typeof PORTFOLIO_TABS)[number]['key']

type TPortfolioHeaderProps = Pick<
  TPortfolioModel,
  'blendedMetrics' | 'hasKatanaHoldings' | 'isHoldingsLoading' | 'isSearchingBalances' | 'totalPortfolioValue'
> & {
  isProtocolReturnLoading: boolean
  protocolReturnSummary: TPortfolioProtocolReturnSummary | null
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

type TPortfolioSuggestedProps = Pick<TPortfolioModel, 'suggestedRows'>

type TPortfolioActivityProps = Pick<TPortfolioModel, 'isActive' | 'openLoginModal'>

type TPortfolioClaimRewardsProps = Pick<TPortfolioModel, 'isActive' | 'openLoginModal'>

const ACTIVITY_ACTION_LABELS: Record<TPortfolioActivityEntry['action'], string> = {
  deposit: 'Deposit',
  withdraw: 'Withdraw',
  stake: 'Stake',
  unstake: 'Unstake'
}
const ACTIVITY_TYPE_FILTERS: Array<{ key: TPortfolioActivityTypeFilter; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'deposit', label: 'Deposit' },
  { key: 'withdraw', label: 'Withdraw' },
  { key: 'stake', label: 'Stake' },
  { key: 'unstake', label: 'Unstake' }
]

type TActivityModalFilters = {
  types: TPortfolioActivityEntry['action'][]
  startDate: string
  endDate: string
}

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
  return `${import.meta.env.VITE_BASE_YEARN_ASSETS_URI}/chains/${chainId}/logo.svg`
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

function ActivityActionIcon({ action }: { action: TPortfolioActivityEntry['action'] }): ReactElement {
  const isInboundAction = action === 'deposit' || action === 'stake'

  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      style={{ transform: isInboundAction ? 'rotate(180deg)' : 'rotate(0deg)' }}
    >
      <path d="M9 3.5V10.75" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
      <path
        d="M5.75 8.5L9 11.75L12.25 8.5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M4.75 14.5H13.25" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  )
}

function ActivityDetailItem({ label, value }: { label: string; value: ReactElement | string }): ReactElement {
  return (
    <div className="grid grid-cols-[180px_minmax(0,1fr)] items-start gap-3 py-1 text-left">
      <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-text-secondary">{label}</span>
      <div className="min-w-0 text-left text-sm text-text-primary">{value}</div>
    </div>
  )
}

function ActivityTransactionHash({
  explorerUrl,
  txHash
}: {
  explorerUrl: string | null
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
  onPickerOpenChange,
  time,
  onApplyDateRange
}: {
  date: string
  dateInputValue: string
  dateTime: string
  onPickerOpenChange: (isOpen: boolean) => void
  time: string
  onApplyDateRange: (startDate: string, endDate: string) => void
}): ReactElement {
  const [isPickerOpen, setIsPickerOpen] = useState(false)
  const [pendingStartDate, setPendingStartDate] = useState(dateInputValue)
  const [pendingEndDate, setPendingEndDate] = useState(dateInputValue)

  useEffect(() => {
    if (isPickerOpen) {
      setPendingStartDate(dateInputValue)
      setPendingEndDate(dateInputValue)
    }

    onPickerOpenChange(isPickerOpen)
  }, [dateInputValue, isPickerOpen, onPickerOpenChange])

  function handleApply(): void {
    const normalizedFilters = normalizeActivityModalFilters({
      types: [],
      startDate: pendingStartDate,
      endDate: pendingEndDate
    })

    onApplyDateRange(normalizedFilters.startDate, normalizedFilters.endDate)
    setIsPickerOpen(false)
  }

  return (
    <span className={cl('relative inline-flex justify-end', isPickerOpen ? 'z-100' : 'z-30')}>
      <button
        type="button"
        aria-label={`Filter activity around ${dateTime}`}
        onClick={(event): void => {
          event.stopPropagation()
          setIsPickerOpen((previous) => !previous)
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

      {isPickerOpen ? (
        <div
          className="absolute bottom-full right-0 z-70 mb-2 w-64 rounded-lg border border-border bg-surface p-3 text-left shadow-lg"
          onClick={(event): void => event.stopPropagation()}
        >
          <div className="grid gap-2">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-text-secondary">{'Start date'}</span>
              <input
                type="date"
                value={pendingStartDate}
                max={pendingEndDate || undefined}
                onChange={(event) => setPendingStartDate(event.target.value)}
                className="rounded-md border border-border bg-transparent px-2 py-1 text-sm text-text-primary outline-none"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-text-secondary">{'End date'}</span>
              <input
                type="date"
                value={pendingEndDate}
                min={pendingStartDate || undefined}
                onChange={(event) => setPendingEndDate(event.target.value)}
                className="rounded-md border border-border bg-transparent px-2 py-1 text-sm text-text-primary outline-none"
              />
            </label>
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              className="rounded-full border border-border px-3 py-1 text-xs font-medium text-text-primary hover:border-border-hover"
              onClick={(event): void => {
                event.stopPropagation()
                setIsPickerOpen(false)
              }}
            >
              {'Cancel'}
            </button>
            <button
              type="button"
              className="rounded-full bg-neutral-900 px-3 py-1 text-xs font-semibold text-surface hover:bg-neutral-800"
              onClick={(event): void => {
                event.stopPropagation()
                handleApply()
              }}
            >
              {'Apply'}
            </button>
          </div>
        </div>
      ) : null}
    </span>
  )
}

function ActivityFilterCheckbox<T extends string>({
  checked,
  description,
  label,
  onChange,
  value
}: {
  checked: boolean
  description?: string
  label: string
  onChange: (value: T, checked: boolean) => void
  value: T
}): ReactElement {
  return (
    <label
      className={cl(
        'flex cursor-pointer items-center justify-between gap-3 rounded-lg border px-3 py-2 transition-colors',
        checked ? 'border-border bg-surface-tertiary/80' : 'border-border hover:bg-surface-tertiary/40'
      )}
    >
      <span className="min-w-0">
        <span className="block text-sm font-medium text-text-primary">{label}</span>
        {description ? <span className="block text-xs text-text-secondary">{description}</span> : null}
      </span>
      <input
        type="checkbox"
        className="accent-blue-500"
        checked={checked}
        onChange={(event) => onChange(value, event.target.checked)}
      />
    </label>
  )
}

function ActivityFiltersModal({
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

  useEffect(() => {
    if (isOpen) {
      setPendingFilters(filters)
    }
  }, [filters, isOpen])

  function handleClear(): void {
    setPendingFilters(DEFAULT_ACTIVITY_MODAL_FILTERS)
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
              <Dialog.Panel className="w-full max-w-3xl rounded-3xl border border-border bg-surface p-6 text-text-primary shadow-lg">
                <div className="flex items-start justify-between gap-4">
                  <Dialog.Title className="text-lg font-semibold text-text-primary">{'Filters'}</Dialog.Title>
                  <button
                    type="button"
                    onClick={onClose}
                    className="inline-flex size-8 items-center justify-center rounded-full border border-transparent text-text-secondary hover:border-border hover:text-text-primary"
                    aria-label="Close filters"
                  >
                    <IconCross className="size-4" />
                  </button>
                </div>

                <div className="relative mt-4 grid gap-6 md:grid-cols-2">
                  <div>
                    <p className="mb-2 text-sm text-text-secondary">{'Type'}</p>
                    <div className="space-y-2">
                      {ACTIVITY_TYPE_FILTERS.filter(
                        (filter): filter is { key: TPortfolioActivityEntry['action']; label: string } =>
                          filter.key !== 'all'
                      ).map((filter) => (
                        <ActivityFilterCheckbox
                          key={filter.key}
                          label={filter.label}
                          value={filter.key}
                          checked={pendingFilters.types.includes(filter.key)}
                          onChange={(type, checked) =>
                            setPendingFilters((previous) => ({
                              ...previous,
                              types: checked
                                ? [...previous.types, type]
                                : previous.types.filter((selectedType) => selectedType !== type)
                            }))
                          }
                        />
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="mb-2 text-sm text-text-secondary">{'Date range'}</p>
                    <div className="grid gap-3">
                      <label className="flex flex-col gap-1 rounded-lg border border-border px-3 py-2">
                        <span className="text-sm font-medium text-text-primary">{'Start date'}</span>
                        <input
                          type="date"
                          value={pendingFilters.startDate}
                          max={pendingFilters.endDate || undefined}
                          onChange={(event) =>
                            setPendingFilters((previous) => ({ ...previous, startDate: event.target.value }))
                          }
                          className="w-full bg-transparent text-sm text-text-primary outline-none"
                        />
                      </label>
                      <label className="flex flex-col gap-1 rounded-lg border border-border px-3 py-2">
                        <span className="text-sm font-medium text-text-primary">{'End date'}</span>
                        <input
                          type="date"
                          value={pendingFilters.endDate}
                          min={pendingFilters.startDate || undefined}
                          onChange={(event) =>
                            setPendingFilters((previous) => ({ ...previous, endDate: event.target.value }))
                          }
                          className="w-full bg-transparent text-sm text-text-primary outline-none"
                        />
                      </label>
                      <p className="text-xs leading-relaxed text-text-secondary">
                        {'Dates are inclusive and use your browser timezone.'}
                      </p>
                    </div>
                  </div>
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
  isChainFilterActive,
  isVaultFilterActive,
  shareSymbol,
  onSelectChain,
  onApplyDateRange,
  onSelectVault
}: {
  assetAddress: string | null
  isChainFilterActive: boolean
  isVaultFilterActive: boolean
  displayName: string
  entry: TPortfolioActivityEntry
  shareSymbol: string | null
  onSelectChain: (chainId: number) => void
  onApplyDateRange: (startDate: string, endDate: string) => void
  onSelectVault: (vaultName: string) => void
}): ReactElement {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false)
  const explorerUrl = getActivityExplorerUrl(entry.chainId, entry.txHash)
  const preferredVaultAddress =
    entry.familyVaultAddress && !isZeroAddress(entry.familyVaultAddress) ? entry.familyVaultAddress : entry.vaultAddress
  const normalizedAssetAddress = assetAddress && !isZeroAddress(assetAddress) ? toAddress(assetAddress) : null
  const normalizedInputTokenAddress =
    entry.inputTokenAddress && !isZeroAddress(entry.inputTokenAddress) ? toAddress(entry.inputTokenAddress) : null
  const tokenAddress = normalizedInputTokenAddress ?? normalizedAssetAddress
  const vaultPageUrl = `/vaults/${entry.chainId}/${toAddress(preferredVaultAddress)}`
  const activityTitle = ACTIVITY_ACTION_LABELS[entry.action]
  const isExitAction = entry.action === 'withdraw' || entry.action === 'unstake'
  const chainName = getActivityChainName(entry.chainId)
  const formattedDate = formatIndexedActivityDate(entry.timestamp)
  const formattedDateTime = formatIndexedActivityDateTime(entry.timestamp)
  const formattedTime = formatIndexedActivityTime(entry.timestamp)
  const activityDateInputValue = formatActivityDateInputValue(entry.timestamp)
  const primaryTokenSymbol = entry.inputTokenSymbol ?? entry.assetSymbol
  const primaryTokenAmount =
    entry.inputTokenAmountFormatted !== null ? entry.inputTokenAmountFormatted : entry.assetAmountFormatted
  const isZap = Boolean(entry.inputTokenAddress && entry.inputTokenAmount)
  const summaryAssetSymbol = primaryTokenSymbol ?? shareSymbol
  const primaryAmount = isExitAction
    ? formatActivityDisplayAmount(entry.shareAmountFormatted, shareSymbol)
    : formatActivityDisplayAmount(primaryTokenAmount, primaryTokenSymbol)
  const secondaryAmount = isExitAction
    ? formatActivityDisplayAmount(entry.assetAmountFormatted, entry.assetSymbol)
    : formatActivityDisplayAmount(entry.shareAmountFormatted, shareSymbol)
  const collapsedPrimaryAmount = isExitAction
    ? formatActivityFixedValue(entry.shareAmountFormatted)
    : formatActivityFixedValue(primaryTokenAmount)
  const collapsedSecondaryAmount = isExitAction
    ? formatActivityFixedValue(entry.assetAmountFormatted)
    : formatActivityFixedValue(entry.shareAmountFormatted)
  const outboundAmount = collapsedPrimaryAmount
  const inboundAmount = collapsedSecondaryAmount
  const outboundSymbol = isExitAction ? shareSymbol : primaryTokenSymbol
  const inboundSymbol = isExitAction ? entry.assetSymbol : shareSymbol
  const primaryDetailLabel = isExitAction ? 'VAULT SHARES REDEEMED:' : 'TOKEN DEPOSITED:'
  const secondaryDetailLabel = isExitAction ? 'ASSET RECEIVED:' : 'VAULT SHARES RECEIVED:'
  const metadataStatus = entry.status === 'ok' ? 'Indexed' : 'Limited metadata'

  return (
    <div
      className={cl(
        'relative w-full overflow-visible bg-surface transition-colors',
        isDatePickerOpen ? 'z-[80]' : 'z-0'
      )}
    >
      <button
        type="button"
        aria-label={isExpanded ? 'Collapse row' : 'Expand row'}
        aria-expanded={isExpanded}
        onClick={() => setIsExpanded((previous) => !previous)}
        className={cl(
          'absolute right-5 top-6.5 z-20 hidden size-9 items-center justify-center rounded-full border border-white/30 bg-app text-text-secondary transition-colors duration-150 md:flex',
          'hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400'
        )}
      >
        <IconChevron className="size-4" direction={isExpanded ? 'up' : 'down'} />
      </button>

      <div
        onClick={() => setIsExpanded((previous) => !previous)}
        aria-expanded={isExpanded}
        className="group relative grid w-full cursor-pointer grid-cols-1 bg-surface p-4 text-left md:grid-cols-24 md:px-6 md:py-4 md:pr-20"
      >
        <div
          className={cl(
            'pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-100 group-hover:opacity-20 group-focus-visible:opacity-20',
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

        <div className="z-10 flex min-w-0 items-center gap-6 md:col-span-14">
          <div className="flex size-10 shrink-0 items-center justify-center bg-transparent text-neutral-700">
            <ActivityActionIcon action={entry.action} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-2">
                <p className="truncate text-lg font-bold leading-tight text-text-primary">{activityTitle}</p>
                {isZap ? (
                  <span
                    aria-label="Zap transaction"
                    className="inline-flex shrink-0 items-center gap-1 rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-primary"
                  >
                    <span aria-hidden="true">⚡</span>
                    <span>Zap</span>
                  </span>
                ) : null}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-text-primary/70">
                <VaultsListChip
                  label={displayName}
                  isActive={isVaultFilterActive}
                  onClick={() => onSelectVault(displayName)}
                />
                <VaultsListChip
                  label={chainName}
                  isActive={isChainFilterActive}
                  icon={
                    <img
                      src={getActivityChainLogoUrl(entry.chainId)}
                      alt=""
                      className="size-3.5 rounded-full"
                      loading="lazy"
                      decoding="async"
                    />
                  }
                  onClick={() => onSelectChain(entry.chainId)}
                />
                <ActivityDateChip
                  date={formattedDate}
                  dateInputValue={activityDateInputValue}
                  dateTime={formattedDateTime}
                  onPickerOpenChange={setIsDatePickerOpen}
                  time={formattedTime}
                  onApplyDateRange={onApplyDateRange}
                />
                {metadataStatus !== 'Indexed' ? <VaultsListChip label={metadataStatus} /> : null}
              </div>
            </div>
          </div>
        </div>

        <div className="z-10 mt-4 flex min-w-0 items-center justify-between gap-3 md:col-span-10 md:mt-0 md:justify-end">
          <div className="flex min-w-0 shrink-0 items-center gap-2.5 text-right">
            {tokenAddress ? (
              <TokenLogo
                src={`${import.meta.env.VITE_BASE_YEARN_ASSETS_URI}/tokens/${entry.chainId}/${tokenAddress.toLowerCase()}/logo-32.png`}
                altSrc={`${import.meta.env.VITE_BASE_YEARN_ASSETS_URI}/tokens/${entry.chainId}/${tokenAddress.toLowerCase()}/logo-32.png`}
                tokenSymbol={summaryAssetSymbol ?? activityTitle}
                width={24}
                height={24}
                className="rounded-full"
                loading="lazy"
              />
            ) : null}
            <div className="grid min-w-0 grid-cols-[max-content_100px] gap-x-4 gap-y-0.5">
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
          </div>
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full border border-white/30 bg-app text-text-secondary md:hidden">
            <IconChevron className="size-4" direction={isExpanded ? 'up' : 'down'} />
          </div>
        </div>
      </div>

      {isExpanded ? (
        <div className="bg-surface pb-4 pl-20 pr-4 pt-1 md:pl-[88px] md:pr-6">
          <div className="flex flex-col">
            <ActivityDetailItem label={primaryDetailLabel} value={primaryAmount} />
            <ActivityDetailItem label={secondaryDetailLabel} value={secondaryAmount} />
            <ActivityDetailItem label="CONFIRMED ON:" value={formattedDateTime} />
            <ActivityDetailItem
              label="VAULT NAME:"
              value={
                vaultPageUrl ? (
                  <Link
                    href={vaultPageUrl}
                    aria-label={`Open vault ${preferredVaultAddress}`}
                    className={'underline hover:text-text-secondary'}
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
                  <img
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
              value={<ActivityTransactionHash explorerUrl={explorerUrl} txHash={entry.txHash} />}
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
  protocolReturnSummary,
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
          {isSearchingBalances ? metricSpinner : currencyFormatter.format(totalPortfolioValue)}
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
      value: (
        <span className={METRIC_VALUE_CLASS}>
          {renderSignedPercentMetric(protocolReturnSummary?.annualizedProtocolReturnPct)}
        </span>
      )
    }
  ]

  return (
    <section className="h-full bg-surface">
      <div className="grid gap-px bg-border">
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
          'flex w-full justify-between gap-1 bg-surface-secondary p-1',
          mergeWithHeader ? 'rounded-b-lg border-x border-b border-border' : 'rounded-lg border border-border'
        )}
      >
        {PORTFOLIO_TABS.map((tab) => (
          <button
            key={tab.key}
            type={'button'}
            onClick={() => onSelectTab(tab.key)}
            className={cl(
              'flex-1 rounded-md px-2 py-2 text-xs font-semibold transition-all md:px-4 md:py-2.5',
              'border border-transparent focus-visible:outline-none focus-visible:ring-0',
              'min-h-[36px] active:scale-[0.98]',
              activeTab === tab.key
                ? 'bg-surface text-text-primary !border-border'
                : 'bg-transparent text-text-secondary hover:text-text-primary'
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
  const { allVaults } = useYearn()
  const { getToken } = useTokenList()
  const { cachedEntries, isLoading: notificationsLoading, error: notificationsError } = useNotifications()
  const [activityFilters, setActivityFilters] = useState<TActivityModalFilters>(DEFAULT_ACTIVITY_MODAL_FILTERS)
  const [activityChainId, setActivityChainId] = useState<number | null>(null)
  const [activitySearch, setActivitySearch] = useState('')
  const [isActivityFiltersOpen, setIsActivityFiltersOpen] = useState(false)
  const activityStartTimestamp = useMemo(
    () => getActivityDateBoundaryTimestamp(activityFilters.startDate, 'start'),
    [activityFilters.startDate]
  )
  const activityEndTimestamp = useMemo(
    () => getActivityDateBoundaryTimestamp(activityFilters.endDate, 'end'),
    [activityFilters.endDate]
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
  const displayedActivityNetworks = useMemo(() => {
    if (activityAvailableChainIds === null) {
      return SUPPORTED_NETWORKS
    }

    const availableChainIdSet = new Set(activityAvailableChainIds)
    return SUPPORTED_NETWORKS.filter((network) => availableChainIdSet.has(network.id))
  }, [activityAvailableChainIds])

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
  const unresolvedLocalEntries = useMemo(
    () =>
      cachedEntries
        .filter((entry) => entry.status !== 'success')
        .toSorted((a, b) => (b.timeFinished ?? 0) - (a.timeFinished ?? 0)),
    [cachedEntries]
  )
  const hasUnresolvedLocalEntries = unresolvedLocalEntries.length > 0
  const hasIndexedEntries = indexedEntries.length > 0
  const hasActiveIndexedFilters =
    activityChainId !== null ||
    activityFilters.types.length > 0 ||
    activityFilters.startDate !== '' ||
    activityFilters.endDate !== DEFAULT_ACTIVITY_MODAL_FILTERS.endDate
  const activityFiltersCount =
    activityFilters.types.length +
    Number(activityFilters.startDate !== '' || activityFilters.endDate !== DEFAULT_ACTIVITY_MODAL_FILTERS.endDate)

  const visibleIndexedEntries = useMemo(() => {
    const normalizedSearch = activitySearch.trim().toLowerCase()

    return indexedEntries.filter((entry) => {
      if (activityFilters.types.length > 0 && !activityFilters.types.includes(entry.action)) {
        return false
      }

      if (!normalizedSearch) {
        return true
      }

      const familyVault = allVaults[toAddress(entry.familyVaultAddress)]
      const activityVault = allVaults[toAddress(entry.vaultAddress)]
      const displayName = familyVault
        ? getVaultName(familyVault)
        : activityVault
          ? getVaultName(activityVault)
          : truncateHex(entry.familyVaultAddress, 5)
      const chainName = getActivityChainName(entry.chainId)
      const actionLabel = ACTIVITY_ACTION_LABELS[entry.action]
      const formattedDate = formatIndexedActivityDate(entry.timestamp)
      const symbols = [entry.assetSymbol, entry.inputTokenSymbol].filter(Boolean).join(' ')

      return [displayName, chainName, actionLabel, formattedDate, symbols, entry.txHash]
        .join(' ')
        .toLowerCase()
        .includes(normalizedSearch)
    })
  }, [activityFilters.types, activitySearch, allVaults, indexedEntries])

  function handleActivityChainSelect(chainId: number): void {
    setActivityChainId(resolveNextSingleChainSelection(selectedActivityChains, chainId)?.[0] ?? null)
  }

  function handleActivityDateRangeApply(startDate: string, endDate: string): void {
    setActivityFilters((previous) => ({ ...previous, startDate, endDate }))
  }

  function handleActivityVaultSelect(vaultName: string): void {
    setActivitySearch((previous) => (previous === vaultName ? '' : vaultName))
  }

  const handleIndexedActivityEndReached = useCallback((): void => {
    if (!indexedHasMore || indexedLoadingMore) {
      return
    }

    void loadMoreIndexedActivity()
  }, [indexedHasMore, indexedLoadingMore, loadMoreIndexedActivity])

  function renderActivityFilters(): ReactElement {
    return (
      <>
        <div className="sticky top-[calc(var(--header-height)+var(--portfolio-breadcrumbs-height)+var(--portfolio-tabs-height))] z-20 flex w-full flex-wrap items-center gap-2 bg-app md:gap-3">
          <div className="min-w-0 flex-1 md:hidden">
            <ActivityMobileChainDropdown
              chainButtons={activityChainButtons}
              areAllChainsSelected={activityChainId === null}
              allChainsLabel="All Chains"
              onSelectAllChains={() => setActivityChainId(null)}
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
              onSelectAllChains={() => setActivityChainId(null)}
              onSelectChain={handleActivityChainSelect}
              onOpenChainModal={() => undefined}
            />
          </div>
          <VaultsFiltersButton filtersCount={activityFiltersCount} onClick={() => setIsActivityFiltersOpen(true)} />
          <div className="min-w-[180px] flex-1">
            <SearchBar
              className="w-full rounded-lg border-border bg-surface text-text-primary transition-all"
              iconClassName="text-text-primary"
              searchPlaceholder="Search activity"
              searchValue={activitySearch}
              onSearch={setActivitySearch}
              shouldDebounce={false}
              highlightWhenActive={true}
            />
          </div>
        </div>
        <ActivityFiltersModal
          isOpen={isActivityFiltersOpen}
          filters={activityFilters}
          onApply={setActivityFilters}
          onClose={() => setIsActivityFiltersOpen(false)}
        />
      </>
    )
  }

  function renderIndexedActivity(): ReactElement {
    if (indexedLoading) {
      return (
        <div className="flex flex-col items-center justify-center gap-2 py-6 text-sm text-text-secondary">
          <IconSpinner className="size-5 animate-spin text-text-secondary" />
          <span>{'Loading activity...'}</span>
        </div>
      )
    }

    if (indexedError) {
      return (
        <div className="py-6 text-center">
          <p className="text-sm font-medium text-red-600">{'Error loading activity'}</p>
          <p className="mt-2 text-xs text-text-secondary">{indexedError.message}</p>
        </div>
      )
    }

    if (indexedEmpty || visibleIndexedEntries.length === 0) {
      return (
        <div className="py-6 text-center text-sm text-text-secondary">
          {hasActiveIndexedFilters || activitySearch.trim()
            ? 'No indexed activity matches these filters.'
            : 'No indexed activity to show.'}
        </div>
      )
    }

    return (
      <VirtualizedVaultsList
        items={visibleIndexedEntries}
        estimateSize={81}
        itemSpacingClassName="border-b border-border"
        getItemKey={(entry): string => `${entry.txHash}:${entry.vaultAddress}:${entry.action}`}
        onEndReached={indexedHasMore ? handleIndexedActivityEndReached : undefined}
        renderItem={(entry) => {
          const familyVault = allVaults[toAddress(entry.familyVaultAddress)]
          const activityVault = allVaults[toAddress(entry.vaultAddress)]
          const assetToken = familyVault
            ? getVaultToken(familyVault)
            : activityVault
              ? getVaultToken(activityVault)
              : null
          const familyVaultSymbol = familyVault
            ? getVaultSymbol(familyVault)
            : activityVault
              ? getVaultSymbol(activityVault)
              : entry.assetSymbol
          const displayName = familyVault
            ? getVaultName(familyVault)
            : activityVault
              ? getVaultName(activityVault)
              : truncateHex(entry.familyVaultAddress, 5)
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
            (entry.action === 'deposit' || entry.action === 'withdraw') &&
            assetToken &&
            !isZeroAddress(assetToken.address)
              ? assetToken.address
              : fallbackLogoAddress && !isZeroAddress(fallbackLogoAddress)
                ? fallbackLogoAddress
                : null

          return (
            <IndexedActivityRow
              entry={entry}
              displayName={displayName}
              isChainFilterActive={activityChainId === entry.chainId}
              isVaultFilterActive={activitySearch === displayName}
              shareSymbol={shareSymbol}
              assetAddress={assetAddress}
              onSelectChain={handleActivityChainSelect}
              onApplyDateRange={handleActivityDateRangeApply}
              onSelectVault={handleActivityVaultSelect}
            />
          )
        }}
      />
    )
  }

  function renderActivityContent(): ReactElement {
    if (notificationsLoading && indexedLoading && !hasUnresolvedLocalEntries) {
      return (
        <div className="flex flex-col items-center justify-center gap-2 py-6 text-sm text-text-secondary">
          <IconSpinner className="size-5 animate-spin text-text-secondary" />
          <span>{'Loading activity...'}</span>
        </div>
      )
    }

    if (notificationsError && !hasUnresolvedLocalEntries && !hasIndexedEntries && indexedEmpty) {
      return (
        <div className="py-6 text-center">
          <p className="text-sm font-medium text-red-600">{'Error loading activity'}</p>
          <p className="mt-2 text-xs text-text-secondary">{notificationsError}</p>
        </div>
      )
    }

    if (!hasUnresolvedLocalEntries && !hasIndexedEntries && indexedEmpty && !hasActiveIndexedFilters) {
      return <div className="py-6 text-center text-sm text-text-secondary">{'No transactions to show.'}</div>
    }

    return (
      <div className="flex flex-col gap-6">
        {hasUnresolvedLocalEntries && (
          <div className="flex flex-col gap-3">
            <div>
              <h3 className="text-sm font-semibold text-text-primary">{'Pending local transactions'}</h3>
              <p className="text-xs text-text-secondary">
                {'These entries come from this browser and may appear before the indexer catches up.'}
              </p>
            </div>
            <div className="flex flex-col">
              {unresolvedLocalEntries.map((entry) => (
                <Notification key={`notification-${entry.id}`} notification={entry} variant="v3" />
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-2">
          {renderActivityFilters()}
          <div className="overflow-hidden rounded-lg border border-border bg-surface">{renderIndexedActivity()}</div>
          {indexedHasMore && (
            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => void loadMoreIndexedActivity()}
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
    return `${import.meta.env.VITE_BASE_YEARN_ASSETS_URI}/chains/${chainId}/logo.svg`
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
                <img
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
                      <img src={getChainLogoUrl(chainId)} alt={chainData.chainName} className="size-8 rounded-full" />
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
          <IconSpinner className="size-5 text-text-secondary sm:size-6" />
          <span>{'Searching for Yearn balances...'}</span>
        </div>
      )
    }
    if (!hasHoldings) {
      return (
        <EmptySectionCard
          title="No vault positions yet"
          description="Deposit into a Yearn vault to see it here."
          ctaLabel="Browse vaults"
          href="/vaults"
        />
      )
    }
    return (
      <div className="flex flex-col gap-px bg-border">
        {holdingsRows.map((row) => (
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
          />
        ))}
      </div>
    )
  }

  return (
    <section className="flex flex-col gap-2">
      <div>
        <h2 className="text-xl font-semibold text-text-primary sm:text-2xl">{'Your Vaults'}</h2>
        <p className="text-xs text-text-secondary sm:text-sm">{'Track every Yearn position you currently hold.'}</p>
      </div>
      {!isActive ? (
        <EmptySectionCard
          title="Connect a wallet to view your vaults"
          description="See all your Yearn deposits in one place."
          ctaLabel="Connect wallet"
          onClick={openLoginModal}
        />
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
            <div className="overflow-hidden rounded-b-lg border-x border-b border-border">
              {renderHoldingsContent()}
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

function PortfolioSuggestedSection({ suggestedRows }: TPortfolioSuggestedProps): ReactElement | null {
  if (suggestedRows.length === 0) {
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
        <h2 className="text-xl font-semibold text-text-primary sm:text-2xl">{'You might like'}</h2>
      </Tooltip>
      <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 sm:gap-4 xl:grid-cols-4">
        {suggestedRows.map((row) => {
          if (row.type === 'external') {
            return (
              <SuggestedVaultCard
                key={row.key}
                vault={row.vault}
                matchedSymbol={row.underlyingSymbol}
                externalProtocol={row.externalProtocol}
              />
            )
          }
          if (row.type === 'personalized') {
            return <SuggestedVaultCard key={row.key} vault={row.vault} matchedSymbol={row.matchedSymbol} />
          }
          return <SuggestedVaultCard key={row.key} vault={row.vault} />
        })}
      </div>
    </section>
  )
}

function PortfolioPage(): ReactElement {
  const model = usePortfolioModel()
  const [historyDenomination, setHistoryDenomination] = useState<TPortfolioHistoryDenomination>('usd')
  const [historyTimeframe, setHistoryTimeframe] = useState<TPortfolioHistoryChartTimeframe>('1y')
  const [searchParams, setSearchParams] = useSearchParams()
  const varsRef = useRef<HTMLDivElement>(null)
  const breadcrumbsRef = useRef<HTMLDivElement>(null)
  const tabsRef = useRef<HTMLDivElement>(null)
  const historyFetchTimeframe: TPortfolioHistoryTimeframe = historyTimeframe === 'all' ? 'all' : '1y'
  const { onRefresh } = useWallet()

  usePortfolioEntryRefresh({ isActive: model.isActive, onRefresh })

  const activeTab = useMemo((): TPortfolioTabKey => {
    const tabParam = searchParams.get('tab')
    if (tabParam === 'activity' || tabParam === 'claim-rewards' || tabParam === 'positions') {
      return tabParam
    }
    return 'positions'
  }, [searchParams])
  const shouldLoadPositionsHistory = activeTab === 'positions' && model.isActive
  const {
    data: historyData,
    denomination: resolvedHistoryDenomination,
    isLoading: historyLoading,
    error: historyError,
    isEmpty: historyEmpty
  } = usePortfolioHistory(historyDenomination, historyFetchTimeframe, shouldLoadPositionsHistory)
  const {
    data: protocolReturnHistoryData,
    summary: protocolReturnHistorySummary,
    familySeries: protocolReturnHistoryFamilySeries,
    isLoading: protocolReturnHistoryLoading,
    error: protocolReturnHistoryError,
    isEmpty: protocolReturnHistoryEmpty
  } = usePortfolioProtocolReturnHistory(historyFetchTimeframe, shouldLoadPositionsHistory)
  const { data: protocolReturnSummary, isLoading: protocolReturnLoading } =
    usePortfolioProtocolReturn(shouldLoadPositionsHistory)

  const handleTabSelect = useCallback(
    (tab: TPortfolioTabKey) => {
      const nextParams = new URLSearchParams(searchParams)
      if (tab === 'positions') {
        nextParams.delete('tab')
      } else {
        nextParams.set('tab', tab)
      }
      setSearchParams(nextParams, { replace: true })
    },
    [searchParams, setSearchParams]
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
      <h1 className="text-lg font-black text-text-primary md:text-3xl md:leading-10">{'Account Overview'}</h1>
    </Tooltip>
  )

  function renderTabContent(): ReactElement | null {
    switch (activeTab) {
      case 'positions':
        return (
          <div className="flex flex-col gap-6 sm:gap-8">
            {model.isActive ? (
              <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-[0_1px_0_rgba(15,23,42,0.02)]">
                <div className="grid items-stretch xl:grid-cols-[minmax(0,1fr)_340px]">
                  <PortfolioHistoryChart
                    balanceData={historyData}
                    protocolReturnData={protocolReturnHistoryData}
                    protocolReturnSummary={protocolReturnHistorySummary}
                    protocolReturnFamilySeries={protocolReturnHistoryFamilySeries}
                    denomination={resolvedHistoryDenomination}
                    onDenominationChange={setHistoryDenomination}
                    timeframe={historyTimeframe}
                    onTimeframeChange={setHistoryTimeframe}
                    balanceIsLoading={historyLoading}
                    balanceIsEmpty={historyEmpty}
                    balanceError={historyError}
                    protocolReturnIsLoading={protocolReturnHistoryLoading}
                    protocolReturnIsEmpty={protocolReturnHistoryEmpty}
                    protocolReturnError={protocolReturnHistoryError}
                    embedded
                    className="h-full bg-linear-to-b from-surface to-surface-secondary/20"
                  />
                  <div className="border-t border-border bg-linear-to-b from-surface to-surface-secondary/25 xl:border-t-0 xl:border-l">
                    <PortfolioHeaderSection
                      blendedMetrics={model.blendedMetrics}
                      isHoldingsLoading={model.isHoldingsLoading}
                      isSearchingBalances={model.isSearchingBalances}
                      hasKatanaHoldings={model.hasKatanaHoldings}
                      isProtocolReturnLoading={protocolReturnLoading}
                      protocolReturnSummary={protocolReturnSummary}
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
            <PortfolioSuggestedSection suggestedRows={model.suggestedRows} />
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
        <div className="flex flex-col gap-3">
          <div className="px-1">{overviewHeading}</div>
        </div>
        <div
          ref={tabsRef}
          className="sticky z-30 bg-app pb-2"
          style={{ top: 'calc(var(--header-height) + var(--portfolio-breadcrumbs-height))' }}
        >
          <PortfolioTabSelector activeTab={activeTab} onSelectTab={handleTabSelect} />
        </div>
        <div className={'pt-2'} key={activeTab}>
          {renderTabContent()}
        </div>
      </div>
    </PortfolioPageLayout>
  )
}

export default PortfolioPage
