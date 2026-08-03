import { getVaultName, type TKongVault } from '@pages/vaults/domain/kongVaultSelectors'
import { YBOLD_STAKING_ADDRESS, YBOLD_VAULT_ADDRESS } from '@pages/vaults/domain/normalizeVault'
import { BOLD_ADDRESS } from '@pages/vaults/utils/yBold'
import type { TNotification } from '@shared/types/notifications'
import { SUPPORTED_NETWORKS, toAddress, truncateHex } from '@shared/utils'
import type { TPortfolioActivityEntry } from './types/api'

const ACTIVITY_ACTION_LABELS: Record<TPortfolioActivityEntry['action'], string> = {
  deposit: 'Deposit',
  withdraw: 'Withdraw',
  stake: 'Stake',
  unstake: 'Unstake',
  transfer: 'Transfer',
  swap: 'Swap'
}
const RECENT_LOCAL_ACTIVITY_RETENTION_SECONDS = 24 * 60 * 60
const ZERO_ACTIVITY_ADDRESS = '0x0000000000000000000000000000000000000000'

export type TActivityModalFilters = {
  types: TPortfolioActivityEntry['action'][]
  startDate: string
  endDate: string
}

export function getActivityChainName(chainId: number): string {
  return SUPPORTED_NETWORKS.find((item) => item.id === chainId)?.name ?? `Chain ${chainId}`
}

export function formatIndexedActivityDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

export function getActivityEntryTitle(entry: TPortfolioActivityEntry): string {
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

export function getNotificationActivityAction(notification: TNotification): TPortfolioActivityEntry['action'] | null {
  switch (notification.type) {
    case 'deposit':
    case 'deposit and stake':
    case 'zap':
    case 'crosschain zap':
      return 'deposit'
    case 'withdraw':
    case 'withdraw zap':
    case 'crosschain withdraw zap':
    case 'unstake and withdraw':
      return 'withdraw'
    case 'stake':
      return 'stake'
    case 'unstake':
    case 'claim and exit':
      return 'unstake'
    case 'migrate':
      return 'transfer'
    default:
      return null
  }
}

export function isRecentLocalActivityEntry(notification: TNotification, indexedTxHashes: ReadonlySet<string>): boolean {
  if (notification.status !== 'success' || !notification.txHash || !notification.timeFinished) {
    return false
  }

  if (!getNotificationActivityAction(notification)) {
    return false
  }

  const isAlreadyIndexed = indexedTxHashes.has(notification.txHash.toLowerCase())
  const currentTimestamp = Math.floor(Date.now() / 1000)
  const isRecent = currentTimestamp - notification.timeFinished <= RECENT_LOCAL_ACTIVITY_RETENTION_SECONDS

  return !isAlreadyIndexed && isRecent
}

function parseLocalActivityAmount(amount: string | undefined): number | null {
  if (!amount) {
    return null
  }

  const parsedAmount = Number(amount.replaceAll(',', ''))

  return Number.isFinite(parsedAmount) ? parsedAmount : null
}

export function isZapNotification(notification: TNotification): boolean {
  return (
    notification.type === 'zap' ||
    notification.type === 'crosschain zap' ||
    notification.type === 'withdraw zap' ||
    notification.type === 'crosschain withdraw zap'
  )
}

function getLocalActivityShareAmount(
  notification: TNotification,
  action: TPortfolioActivityEntry['action'],
  isExitAction: boolean
): string {
  if (isExitAction) {
    return notification.amount
  }

  if (action === 'deposit') {
    if (notification.toAmount) {
      return notification.toAmount
    }

    const isYBoldDeposit =
      notification.fromAddress &&
      notification.toAddress &&
      toAddress(notification.fromAddress) === toAddress(BOLD_ADDRESS) &&
      [YBOLD_VAULT_ADDRESS, YBOLD_STAKING_ADDRESS].some(
        (address) => toAddress(notification.toAddress) === toAddress(address)
      )

    return isYBoldDeposit ? (notification.fromAmount ?? notification.amount) : ''
  }

  return notification.toAmount ?? notification.amount
}

export function toLocalActivityEntry(
  notification: TNotification,
  options: { fallbackTimestamp?: number } = {}
): TPortfolioActivityEntry | null {
  const action = getNotificationActivityAction(notification)
  const timestamp = notification.timeFinished ?? options.fallbackTimestamp

  if (!action || !notification.txHash || timestamp === undefined) {
    return null
  }

  const isExitAction = action === 'withdraw' || action === 'unstake'
  const isZap = isZapNotification(notification)
  const vaultAddress = isExitAction
    ? (notification.fromAddress ?? notification.toAddress ?? ZERO_ACTIVITY_ADDRESS)
    : (notification.toAddress ?? notification.fromAddress ?? ZERO_ACTIVITY_ADDRESS)
  const assetAddress = isExitAction
    ? (notification.toAddress ?? notification.fromAddress ?? ZERO_ACTIVITY_ADDRESS)
    : (notification.fromAddress ?? notification.toAddress ?? ZERO_ACTIVITY_ADDRESS)
  const assetSymbol = isExitAction
    ? (notification.toTokenName ?? notification.fromTokenName ?? null)
    : (notification.fromTokenName ?? notification.toTokenName ?? null)
  const assetAmount = isExitAction
    ? (notification.toAmount ?? notification.amount)
    : (notification.fromAmount ?? notification.amount)
  const assetAmountFormatted = parseLocalActivityAmount(assetAmount)
  const shareAmount = getLocalActivityShareAmount(notification, action, isExitAction)
  const shareAmountFormatted = parseLocalActivityAmount(shareAmount)

  return {
    chainId: notification.chainId,
    txHash: notification.txHash,
    timestamp,
    action,
    displayType: isZap ? 'zap' : null,
    transferDirection: action === 'transfer' ? 'out' : null,
    vaultAddress,
    familyVaultAddress: vaultAddress,
    assetSymbol,
    assetAmount,
    assetAmountFormatted,
    inputTokenAddress: isZap && !isExitAction ? assetAddress : null,
    inputTokenSymbol: isZap && !isExitAction ? assetSymbol : null,
    inputTokenAmount: isZap && !isExitAction ? assetAmount : null,
    inputTokenAmountFormatted: isZap && !isExitAction ? assetAmountFormatted : null,
    outputTokenAddress: isZap && isExitAction ? assetAddress : null,
    outputTokenSymbol: isZap && isExitAction ? assetSymbol : null,
    outputTokenAmount: isZap && isExitAction ? assetAmount : null,
    outputTokenAmountFormatted: isZap && isExitAction ? assetAmountFormatted : null,
    shareAmount,
    shareAmountFormatted,
    status: 'ok',
    ...(notification.status === 'error' ? { transactionStatus: 'failed' as const } : {})
  }
}

function getActivityVaultDisplayName(
  entry: TPortfolioActivityEntry,
  allVaults: Record<string, TKongVault | undefined>
): string {
  const familyVault = allVaults[toAddress(entry.familyVaultAddress)]
  const activityVault = allVaults[toAddress(entry.vaultAddress)]

  return familyVault
    ? getVaultName(familyVault)
    : activityVault
      ? getVaultName(activityVault)
      : truncateHex(entry.familyVaultAddress, 5)
}

export function doesActivityEntryMatchSearch(
  entry: TPortfolioActivityEntry,
  search: string,
  allVaults: Record<string, TKongVault | undefined>
): boolean {
  const normalizedSearch = search.trim().toLowerCase()
  if (!normalizedSearch) {
    return true
  }

  const displayName = getActivityVaultDisplayName(entry, allVaults)
  const chainName = getActivityChainName(entry.chainId)
  const actionLabel = getActivityEntryTitle(entry)
  const formattedDate = formatIndexedActivityDate(entry.timestamp)
  const symbols = [entry.assetSymbol, entry.inputTokenSymbol, entry.outputTokenSymbol].filter(Boolean).join(' ')
  const amounts = [
    entry.assetAmount,
    entry.shareAmount,
    entry.inputTokenAmount,
    entry.outputTokenAmount,
    entry.assetAmountFormatted,
    entry.shareAmountFormatted,
    entry.inputTokenAmountFormatted,
    entry.outputTokenAmountFormatted
  ]
    .filter((value) => value !== null && value !== undefined && value !== '')
    .join(' ')

  return [displayName, chainName, actionLabel, formattedDate, symbols, amounts, entry.txHash]
    .join(' ')
    .toLowerCase()
    .includes(normalizedSearch)
}

export function doesLocalActivityMatchFilters({
  chainId,
  endTimestamp,
  filters,
  notification,
  startTimestamp
}: {
  chainId: number | null
  endTimestamp: number | null
  filters: TActivityModalFilters
  notification: TNotification
  startTimestamp: number | null
}): boolean {
  const action = getNotificationActivityAction(notification)
  if (!action) {
    return false
  }

  if (filters.types.length > 0 && !filters.types.includes(action)) {
    return false
  }

  if (chainId !== null && notification.chainId !== chainId) {
    return false
  }

  if (startTimestamp !== null && (!notification.timeFinished || notification.timeFinished < startTimestamp)) {
    return false
  }

  if (endTimestamp !== null && (!notification.timeFinished || notification.timeFinished > endTimestamp)) {
    return false
  }

  return true
}
