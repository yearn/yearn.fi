import type { DepositEvent, TransferEvent, VaultMetadata, WithdrawEvent } from '../types'
import { fetchRouterInputAssetForActivity, type TActivityInputAsset } from './activityReceiptEnrichment'
import type { TransactionActivityEvents, VaultVersion } from './graphql'
import { fetchActivityEventsByTransactionHashes, fetchRecentAddressScopedActivityEvents } from './graphql'
import { formatAmount, lowerCaseAddress, minBigInt, toVaultKey, ZERO } from './pnlShared'
import { getFamilyVaultAddress, isStakingVault } from './staking'
import { fetchMultipleVaultsMetadata } from './vaults'

export type HoldingsActivityAction = 'deposit' | 'withdraw' | 'stake' | 'unstake'
export type HoldingsActivityTypeFilter = HoldingsActivityAction | 'all'

export interface HoldingsActivityFilters {
  type?: HoldingsActivityTypeFilter
  chainId?: number | null
  startTimestamp?: number | null
  endTimestamp?: number | null
}

export interface HoldingsActivityEntry {
  chainId: number
  txHash: string
  timestamp: number
  action: HoldingsActivityAction
  vaultAddress: string
  familyVaultAddress: string
  assetSymbol: string | null
  assetAmount: string
  assetAmountFormatted: number | null
  inputTokenAddress: string | null
  inputTokenSymbol: string | null
  inputTokenAmount: string | null
  inputTokenAmountFormatted: number | null
  shareAmount: string
  shareAmountFormatted: number | null
  status: 'ok' | 'missing_metadata'
}

export interface HoldingsActivityResponse {
  address: string
  version: VaultVersion
  limit: number
  offset: number
  pageInfo: {
    hasMore: boolean
    nextOffset: number | null
  }
  entries: HoldingsActivityEntry[]
}

type TActivityScopes = {
  address: boolean
  tx: boolean
}

type TActivityEvent =
  | {
      kind: 'deposit'
      id: string
      chainId: number
      vaultAddress: string
      familyVaultAddress: string
      isStakingVault: boolean
      blockNumber: number
      blockTimestamp: number
      logIndex: number
      transactionHash: string
      owner: string
      sender: string
      assets: bigint
      shares: bigint
      scopes: TActivityScopes
    }
  | {
      kind: 'withdrawal'
      id: string
      chainId: number
      vaultAddress: string
      familyVaultAddress: string
      isStakingVault: boolean
      blockNumber: number
      blockTimestamp: number
      logIndex: number
      transactionHash: string
      assets: bigint
      shares: bigint
      scopes: TActivityScopes
    }
  | {
      kind: 'transfer'
      id: string
      chainId: number
      vaultAddress: string
      familyVaultAddress: string
      isStakingVault: boolean
      blockNumber: number
      blockTimestamp: number
      logIndex: number
      transactionHash: string
      sender: string
      receiver: string
      shares: bigint
      scopes: TActivityScopes
    }

type TResolvedActivityEvent = {
  chainId: number
  txHash: string
  timestamp: number
  blockNumber: number
  logIndex: number
  vaultAddress: string
  familyVaultAddress: string
  action: HoldingsActivityAction
  assets: bigint
  shares: bigint
  owner: string | null
  sender: string | null
  inputAsset: TActivityInputAsset | null
}

type TRecentActivityWindow = {
  candidateEvents: TActivityEvent[]
  hasPotentialMore: boolean
}

type TDepositWithdrawalSums = {
  assets: bigint
  shares: bigint
  latestEvent: Extract<TActivityEvent, { kind: 'deposit' | 'withdrawal' }> | null
}

type TNormalizedActivityFilters = {
  type: HoldingsActivityTypeFilter
  chainId: number | null
  startTimestamp: number | null
  endTimestamp: number | null
}

const MAX_FILTERED_ACTIVITY_TRANSACTIONS = 500
const MAX_FILTERED_ACTIVITY_ATTEMPTS = 5
const DEFAULT_ACTIVITY_FILTERS: TNormalizedActivityFilters = {
  type: 'all',
  chainId: null,
  startTimestamp: null,
  endTimestamp: null
}

function compareStringDesc(a: string, b: string): number {
  if (a === b) {
    return 0
  }

  return a > b ? -1 : 1
}

function compareActivityEventsDesc(a: TActivityEvent, b: TActivityEvent): number {
  return (
    b.blockTimestamp - a.blockTimestamp ||
    b.blockNumber - a.blockNumber ||
    b.logIndex - a.logIndex ||
    b.chainId - a.chainId ||
    compareStringDesc(a.transactionHash, b.transactionHash) ||
    compareStringDesc(a.id, b.id)
  )
}

function createScopes(scope: 'address' | 'tx'): TActivityScopes {
  return {
    address: scope === 'address',
    tx: scope === 'tx'
  }
}

function normalizeDepositEvent(event: DepositEvent, scope: 'address' | 'tx'): TActivityEvent {
  return {
    kind: 'deposit',
    id: event.id,
    chainId: event.chainId,
    vaultAddress: lowerCaseAddress(event.vaultAddress),
    familyVaultAddress: getFamilyVaultAddress(event.chainId, event.vaultAddress),
    isStakingVault: isStakingVault(event.chainId, event.vaultAddress),
    blockNumber: event.blockNumber,
    blockTimestamp: event.blockTimestamp,
    logIndex: event.logIndex,
    transactionHash: lowerCaseAddress(event.transactionHash),
    owner: lowerCaseAddress(event.owner),
    sender: lowerCaseAddress(event.sender),
    assets: BigInt(event.assets),
    shares: BigInt(event.shares),
    scopes: createScopes(scope)
  }
}

function normalizeWithdrawalEvent(event: WithdrawEvent, scope: 'address' | 'tx'): TActivityEvent {
  return {
    kind: 'withdrawal',
    id: event.id,
    chainId: event.chainId,
    vaultAddress: lowerCaseAddress(event.vaultAddress),
    familyVaultAddress: getFamilyVaultAddress(event.chainId, event.vaultAddress),
    isStakingVault: isStakingVault(event.chainId, event.vaultAddress),
    blockNumber: event.blockNumber,
    blockTimestamp: event.blockTimestamp,
    logIndex: event.logIndex,
    transactionHash: lowerCaseAddress(event.transactionHash),
    assets: BigInt(event.assets),
    shares: BigInt(event.shares),
    scopes: createScopes(scope)
  }
}

function normalizeTransferEvent(event: TransferEvent, scope: 'address' | 'tx'): TActivityEvent {
  return {
    kind: 'transfer',
    id: event.id,
    chainId: event.chainId,
    vaultAddress: lowerCaseAddress(event.vaultAddress),
    familyVaultAddress: getFamilyVaultAddress(event.chainId, event.vaultAddress),
    isStakingVault: isStakingVault(event.chainId, event.vaultAddress),
    blockNumber: event.blockNumber,
    blockTimestamp: event.blockTimestamp,
    logIndex: event.logIndex,
    transactionHash: lowerCaseAddress(event.transactionHash),
    sender: lowerCaseAddress(event.sender),
    receiver: lowerCaseAddress(event.receiver),
    shares: BigInt(event.value),
    scopes: createScopes(scope)
  }
}

function sortEventsDesc(events: TActivityEvent[]): TActivityEvent[] {
  return [...events].sort(compareActivityEventsDesc)
}

function toTxKey(event: TActivityEvent): string {
  return `${event.chainId}:${event.transactionHash}`
}

function getSelectedTransactionKeys(events: TActivityEvent[], limit: number): string[] {
  return events.reduce<string[]>((keys, event) => {
    const txKey = toTxKey(event)

    if (keys.length >= limit || keys.includes(txKey)) {
      return keys
    }

    keys.push(txKey)
    return keys
  }, [])
}

function buildTransactionHashesByChain(transactionKeys: string[]): Map<number, string[]> {
  return transactionKeys.reduce<Map<number, string[]>>((grouped, key) => {
    const [chainIdRaw, txHash] = key.split(':')
    const chainId = Number(chainIdRaw)

    if (!Number.isFinite(chainId) || !txHash) {
      return grouped
    }

    const existing = grouped.get(chainId) ?? []

    return existing.includes(txHash) ? grouped : new Map(grouped).set(chainId, [...existing, txHash])
  }, new Map<number, string[]>())
}

function emptyTransactionActivityEvents(): TransactionActivityEvents {
  return {
    deposits: [],
    withdrawals: [],
    transfers: []
  }
}

function normalizeActivityTimestamp(timestamp: number | null | undefined): number | null {
  return typeof timestamp === 'number' && Number.isInteger(timestamp) && timestamp >= 0 ? timestamp : null
}

function normalizeActivityFilters(filters: HoldingsActivityFilters): TNormalizedActivityFilters {
  const chainId =
    typeof filters.chainId === 'number' && Number.isInteger(filters.chainId) && filters.chainId > 0
      ? filters.chainId
      : null
  const startTimestamp = normalizeActivityTimestamp(filters.startTimestamp)
  const endTimestamp = normalizeActivityTimestamp(filters.endTimestamp)
  const hasInvertedRange = startTimestamp !== null && endTimestamp !== null && startTimestamp > endTimestamp

  return {
    type: filters.type ?? DEFAULT_ACTIVITY_FILTERS.type,
    chainId,
    startTimestamp: hasInvertedRange ? endTimestamp : startTimestamp,
    endTimestamp: hasInvertedRange ? startTimestamp : endTimestamp
  }
}

function hasActiveActivityFilters(filters: TNormalizedActivityFilters): boolean {
  return (
    filters.type !== 'all' ||
    filters.chainId !== null ||
    filters.startTimestamp !== null ||
    filters.endTimestamp !== null
  )
}

function mergeActivityEvents(events: TActivityEvent[]): TActivityEvent[] {
  return Array.from(
    events
      .reduce<Map<string, TActivityEvent>>((merged, event) => {
        const key = `${event.kind}:${event.id}`
        const existing = merged.get(key)

        if (!existing) {
          return new Map(merged).set(key, event)
        }

        return new Map(merged).set(key, {
          ...existing,
          scopes: {
            address: existing.scopes.address || event.scopes.address,
            tx: existing.scopes.tx || event.scopes.tx
          }
        })
      }, new Map<string, TActivityEvent>())
      .values()
  )
}

function scaleAmountByMatchedShares(totalAmount: bigint, totalShares: bigint, matchedShares: bigint): bigint {
  if (totalAmount <= ZERO || totalShares <= ZERO || matchedShares <= ZERO) {
    return ZERO
  }

  return (totalAmount * matchedShares) / totalShares
}

function getDepositWithdrawalSums(
  events: TActivityEvent[],
  predicate: (event: Extract<TActivityEvent, { kind: 'deposit' | 'withdrawal' }>) => boolean
): TDepositWithdrawalSums {
  return events.reduce<TDepositWithdrawalSums>(
    (totals, event) => {
      if ((event.kind !== 'deposit' && event.kind !== 'withdrawal') || !predicate(event)) {
        return totals
      }

      return {
        assets: totals.assets + event.assets,
        shares: totals.shares + event.shares,
        latestEvent:
          totals.latestEvent === null || compareActivityEventsDesc(event, totals.latestEvent) < 0
            ? event
            : totals.latestEvent
      }
    },
    {
      assets: ZERO,
      shares: ZERO,
      latestEvent: null
    }
  )
}

function getTransferShareSum(
  events: TActivityEvent[],
  predicate: (event: Extract<TActivityEvent, { kind: 'transfer' }>) => boolean
): bigint {
  return events.reduce((total, event) => {
    if (event.kind !== 'transfer' || !predicate(event)) {
      return total
    }

    return total + event.shares
  }, ZERO)
}

function createResolvedActivityEvent(args: {
  action: HoldingsActivityAction
  event: TActivityEvent
  assetAmount: bigint
  shareAmount: bigint
}): TResolvedActivityEvent {
  return {
    chainId: args.event.chainId,
    txHash: args.event.transactionHash,
    timestamp: args.event.blockTimestamp,
    blockNumber: args.event.blockNumber,
    logIndex: args.event.logIndex,
    vaultAddress: args.event.vaultAddress,
    familyVaultAddress: args.event.familyVaultAddress,
    action: args.action,
    assets: args.assetAmount,
    shares: args.shareAmount,
    owner: args.event.kind === 'deposit' ? args.event.owner : null,
    sender: args.event.kind === 'deposit' ? args.event.sender : null,
    inputAsset: null
  }
}

function classifyTxFamilyEvents(events: TActivityEvent[], userAddress: string): TResolvedActivityEvent[] {
  const normalizedUserAddress = lowerCaseAddress(userAddress)
  const directDeposits = getDepositWithdrawalSums(
    events,
    (event) => event.kind === 'deposit' && !event.isStakingVault && event.scopes.address
  )
  const directWithdrawals = getDepositWithdrawalSums(
    events,
    (event) => event.kind === 'withdrawal' && !event.isStakingVault && event.scopes.address
  )
  const directStakes = getDepositWithdrawalSums(
    events,
    (event) => event.kind === 'deposit' && event.isStakingVault && event.scopes.address
  )
  const directUnstakes = getDepositWithdrawalSums(
    events,
    (event) => event.kind === 'withdrawal' && event.isStakingVault && event.scopes.address
  )
  const txDeposits = getDepositWithdrawalSums(
    events,
    (event) => event.kind === 'deposit' && !event.isStakingVault && event.scopes.tx
  )
  const txWithdrawals = getDepositWithdrawalSums(
    events,
    (event) => event.kind === 'withdrawal' && !event.isStakingVault && event.scopes.tx
  )
  const txStakes = getDepositWithdrawalSums(
    events,
    (event) => event.kind === 'deposit' && event.isStakingVault && event.scopes.tx
  )
  const txUnstakes = getDepositWithdrawalSums(
    events,
    (event) => event.kind === 'withdrawal' && event.isStakingVault && event.scopes.tx
  )
  const addressTransferInUnderlyingShares = getTransferShareSum(
    events,
    (event) => !event.isStakingVault && event.scopes.address && event.receiver === normalizedUserAddress
  )
  const addressTransferOutUnderlyingShares = getTransferShareSum(
    events,
    (event) => !event.isStakingVault && event.scopes.address && event.sender === normalizedUserAddress
  )

  return [
    directDeposits.latestEvent && directDeposits.shares > ZERO
      ? createResolvedActivityEvent({
          action: 'deposit',
          event: directDeposits.latestEvent,
          assetAmount: directDeposits.assets,
          shareAmount: directDeposits.shares
        })
      : txDeposits.latestEvent && txDeposits.shares > ZERO && addressTransferInUnderlyingShares > ZERO
        ? (() => {
            const matchedDepositShares = minBigInt(txDeposits.shares, addressTransferInUnderlyingShares)

            return matchedDepositShares > ZERO
              ? createResolvedActivityEvent({
                  action: 'deposit',
                  event: txDeposits.latestEvent,
                  assetAmount: scaleAmountByMatchedShares(txDeposits.assets, txDeposits.shares, matchedDepositShares),
                  shareAmount: matchedDepositShares
                })
              : null
          })()
        : null,
    directWithdrawals.latestEvent && directWithdrawals.shares > ZERO
      ? createResolvedActivityEvent({
          action: 'withdraw',
          event: directWithdrawals.latestEvent,
          assetAmount: directWithdrawals.assets,
          shareAmount: directWithdrawals.shares
        })
      : txWithdrawals.latestEvent && txWithdrawals.shares > ZERO && addressTransferOutUnderlyingShares > ZERO
        ? (() => {
            const matchedWithdrawalShares = minBigInt(txWithdrawals.shares, addressTransferOutUnderlyingShares)

            return matchedWithdrawalShares > ZERO
              ? createResolvedActivityEvent({
                  action: 'withdraw',
                  event: txWithdrawals.latestEvent,
                  assetAmount: scaleAmountByMatchedShares(
                    txWithdrawals.assets,
                    txWithdrawals.shares,
                    matchedWithdrawalShares
                  ),
                  shareAmount: matchedWithdrawalShares
                })
              : null
          })()
        : null,
    directStakes.latestEvent && directStakes.assets > ZERO
      ? createResolvedActivityEvent({
          action: 'stake',
          event: directStakes.latestEvent,
          assetAmount: directStakes.assets,
          shareAmount: directStakes.shares
        })
      : txStakes.latestEvent && txStakes.assets > ZERO && addressTransferOutUnderlyingShares > ZERO
        ? (() => {
            const matchedStakeAssets = minBigInt(txStakes.assets, addressTransferOutUnderlyingShares)

            return matchedStakeAssets > ZERO
              ? createResolvedActivityEvent({
                  action: 'stake',
                  event: txStakes.latestEvent,
                  assetAmount: matchedStakeAssets,
                  shareAmount: scaleAmountByMatchedShares(txStakes.shares, txStakes.assets, matchedStakeAssets)
                })
              : null
          })()
        : null,
    directUnstakes.latestEvent && directUnstakes.assets > ZERO
      ? createResolvedActivityEvent({
          action: 'unstake',
          event: directUnstakes.latestEvent,
          assetAmount: directUnstakes.assets,
          shareAmount: directUnstakes.shares
        })
      : txUnstakes.latestEvent && txUnstakes.assets > ZERO && addressTransferInUnderlyingShares > ZERO
        ? (() => {
            const matchedUnstakeAssets = minBigInt(txUnstakes.assets, addressTransferInUnderlyingShares)

            return matchedUnstakeAssets > ZERO
              ? createResolvedActivityEvent({
                  action: 'unstake',
                  event: txUnstakes.latestEvent,
                  assetAmount: matchedUnstakeAssets,
                  shareAmount: scaleAmountByMatchedShares(txUnstakes.shares, txUnstakes.assets, matchedUnstakeAssets)
                })
              : null
          })()
        : null
  ].filter((event): event is TResolvedActivityEvent => event !== null)
}

function classifyActivityEvents(events: TActivityEvent[], userAddress: string): TResolvedActivityEvent[] {
  return Array.from(
    events.reduce<Map<string, TActivityEvent[]>>((grouped, event) => {
      const key = `${toTxKey(event)}:${event.familyVaultAddress}`
      const existing = grouped.get(key) ?? []
      return new Map(grouped).set(key, [...existing, event])
    }, new Map<string, TActivityEvent[]>())
  )
    .flatMap(([, txFamilyEvents]) => classifyTxFamilyEvents(txFamilyEvents, userAddress))
    .sort((a, b) => b.timestamp - a.timestamp || b.blockNumber - a.blockNumber || b.logIndex - a.logIndex)
}

async function loadRecentActivityWindowAttempt(
  userAddress: string,
  version: VaultVersion,
  targetTransactionCount: number,
  limitPerSource: number,
  attempt: number
): Promise<TRecentActivityWindow> {
  const recentEvents = await fetchRecentAddressScopedActivityEvents(userAddress, version, limitPerSource)
  const candidateEvents = sortEventsDesc([
    ...recentEvents.deposits.map((event) => normalizeDepositEvent(event, 'address')),
    ...recentEvents.withdrawals.map((event) => normalizeWithdrawalEvent(event, 'address')),
    ...recentEvents.transfersIn.map((event) => normalizeTransferEvent(event, 'address')),
    ...recentEvents.transfersOut.map((event) => normalizeTransferEvent(event, 'address'))
  ])
  const hasPotentialMore =
    recentEvents.hasMoreDeposits ||
    recentEvents.hasMoreWithdrawals ||
    recentEvents.hasMoreTransfersIn ||
    recentEvents.hasMoreTransfersOut

  return getSelectedTransactionKeys(candidateEvents, targetTransactionCount).length >= targetTransactionCount ||
    !hasPotentialMore ||
    attempt >= 5
    ? {
        candidateEvents,
        hasPotentialMore
      }
    : loadRecentActivityWindowAttempt(
        userAddress,
        version,
        targetTransactionCount,
        Math.min(limitPerSource * 2, 1000),
        attempt + 1
      )
}

async function loadRecentActivityWindow(
  userAddress: string,
  version: VaultVersion,
  targetTransactionCount: number
): Promise<TRecentActivityWindow> {
  return loadRecentActivityWindowAttempt(
    userAddress,
    version,
    targetTransactionCount,
    Math.max(targetTransactionCount * 4, 20),
    0
  )
}

function normalizeTransactionActivityEvents(transactionEvents: TransactionActivityEvents): TActivityEvent[] {
  return [
    ...transactionEvents.deposits.map((event) => normalizeDepositEvent(event, 'tx')),
    ...transactionEvents.withdrawals.map((event) => normalizeWithdrawalEvent(event, 'tx')),
    ...transactionEvents.transfers.map((event) => normalizeTransferEvent(event, 'tx'))
  ]
}

function shouldFetchInputAsset(event: TResolvedActivityEvent, userAddress: string): boolean {
  const normalizedUserAddress = lowerCaseAddress(userAddress)

  return (
    event.action === 'deposit' &&
    event.owner === normalizedUserAddress &&
    event.sender !== null &&
    event.sender !== event.owner
  )
}

async function enrichActivityInputAssets(
  events: TResolvedActivityEvent[],
  userAddress: string,
  metadata: Map<string, VaultMetadata>
): Promise<TResolvedActivityEvent[]> {
  return Promise.all(
    events.map(async (event) => {
      if (!shouldFetchInputAsset(event, userAddress)) {
        return event
      }

      const eventMetadata = metadata.get(toVaultKey(event.chainId, event.vaultAddress)) ?? null
      const inputAsset = await fetchRouterInputAssetForActivity({
        chainId: event.chainId,
        transactionHash: event.txHash,
        userAddress,
        excludedTokenAddresses: [
          event.vaultAddress,
          event.familyVaultAddress,
          ...(eventMetadata ? [eventMetadata.token.address] : [])
        ]
      })

      return inputAsset ? { ...event, inputAsset } : event
    })
  )
}

function matchesActivityFilters(event: TResolvedActivityEvent, filters: TNormalizedActivityFilters): boolean {
  if (filters.type !== 'all' && event.action !== filters.type) {
    return false
  }

  if (filters.chainId !== null && event.chainId !== filters.chainId) {
    return false
  }

  if (filters.startTimestamp !== null && event.timestamp < filters.startTimestamp) {
    return false
  }

  if (filters.endTimestamp !== null && event.timestamp > filters.endTimestamp) {
    return false
  }

  return true
}

async function classifyActivityForTransactionKeys(
  userAddress: string,
  version: VaultVersion,
  candidateEvents: TActivityEvent[],
  transactionKeys: string[]
): Promise<TResolvedActivityEvent[]> {
  const selectedTransactionKeySet = new Set(transactionKeys)
  const selectedAddressEvents = candidateEvents.filter((event) => selectedTransactionKeySet.has(toTxKey(event)))
  const transactionEvents =
    transactionKeys.length > 0
      ? await fetchActivityEventsByTransactionHashes(buildTransactionHashesByChain(transactionKeys), version)
      : emptyTransactionActivityEvents()
  const selectedEvents = mergeActivityEvents([
    ...selectedAddressEvents,
    ...normalizeTransactionActivityEvents(transactionEvents)
  ])

  return classifyActivityEvents(selectedEvents, userAddress)
}

function getVaultIdentifiers(events: TResolvedActivityEvent[]): Array<{ chainId: number; vaultAddress: string }> {
  return events.reduce<Array<{ chainId: number; vaultAddress: string }>>((identifiers, event) => {
    const alreadyIncluded = identifiers.some(
      (identifier) => identifier.chainId === event.chainId && identifier.vaultAddress === event.vaultAddress
    )

    if (!alreadyIncluded) {
      identifiers.push({ chainId: event.chainId, vaultAddress: event.vaultAddress })
    }

    return identifiers
  }, [])
}

function filterVisibleActivityEvents(
  events: TResolvedActivityEvent[],
  metadata: Map<string, VaultMetadata>
): TResolvedActivityEvent[] {
  return events.filter((event) => !metadata.get(toVaultKey(event.chainId, event.vaultAddress))?.isHidden)
}

function toHoldingsActivityEntry(
  event: TResolvedActivityEvent,
  metadata: Map<string, VaultMetadata>
): HoldingsActivityEntry {
  const eventMetadata = metadata.get(toVaultKey(event.chainId, event.vaultAddress)) ?? null

  return {
    chainId: event.chainId,
    txHash: event.txHash,
    timestamp: event.timestamp,
    action: event.action,
    vaultAddress: event.vaultAddress,
    familyVaultAddress: event.familyVaultAddress,
    assetSymbol: eventMetadata?.token.symbol ?? null,
    assetAmount: event.assets.toString(),
    assetAmountFormatted: eventMetadata ? formatAmount(event.assets, eventMetadata.token.decimals) : null,
    inputTokenAddress: event.inputAsset?.tokenAddress ?? null,
    inputTokenSymbol: event.inputAsset?.tokenSymbol ?? null,
    inputTokenAmount: event.inputAsset?.amount ?? null,
    inputTokenAmountFormatted: event.inputAsset?.amountFormatted ?? null,
    shareAmount: event.shares.toString(),
    shareAmountFormatted: eventMetadata ? formatAmount(event.shares, eventMetadata.decimals) : null,
    status: eventMetadata ? 'ok' : 'missing_metadata'
  }
}

async function buildActivityEntries(
  userAddress: string,
  events: TResolvedActivityEvent[]
): Promise<{ entries: HoldingsActivityEntry[]; metadata: Map<string, VaultMetadata> }> {
  const vaultIdentifiers = getVaultIdentifiers(events)
  const metadata = vaultIdentifiers.length > 0 ? await fetchMultipleVaultsMetadata(vaultIdentifiers) : new Map()
  const visibleEvents = filterVisibleActivityEvents(events, metadata)
  const enrichedEvents = await enrichActivityInputAssets(visibleEvents, userAddress, metadata)

  return {
    entries: enrichedEvents.map((event) => toHoldingsActivityEntry(event, metadata)),
    metadata
  }
}

async function getUnfilteredHoldingsActivity(
  userAddress: string,
  version: VaultVersion,
  boundedLimit: number,
  boundedOffset: number
): Promise<Pick<HoldingsActivityResponse, 'entries' | 'pageInfo'>> {
  const targetTransactionCount = boundedOffset + boundedLimit + 1
  const { candidateEvents, hasPotentialMore } = await loadRecentActivityWindow(
    userAddress,
    version,
    targetTransactionCount
  )
  const selectedTransactionKeys = getSelectedTransactionKeys(candidateEvents, targetTransactionCount)
  const pageTransactionKeys = selectedTransactionKeys.slice(boundedOffset, boundedOffset + boundedLimit)
  const classifiedEvents = await classifyActivityForTransactionKeys(
    userAddress,
    version,
    candidateEvents,
    pageTransactionKeys
  )
  const { entries } = await buildActivityEntries(userAddress, classifiedEvents)
  const hasMore =
    selectedTransactionKeys.length > boundedOffset + boundedLimit ||
    (pageTransactionKeys.length === boundedLimit &&
      selectedTransactionKeys.length < targetTransactionCount &&
      hasPotentialMore)

  return {
    entries,
    pageInfo: {
      hasMore,
      nextOffset: hasMore ? boundedOffset + boundedLimit : null
    }
  }
}

async function getFilteredHoldingsActivity(
  userAddress: string,
  version: VaultVersion,
  boundedLimit: number,
  boundedOffset: number,
  filters: TNormalizedActivityFilters
): Promise<Pick<HoldingsActivityResponse, 'entries' | 'pageInfo'>> {
  const requestedEntryCount = boundedOffset + boundedLimit + 1
  let targetTransactionCount = Math.min(Math.max(requestedEntryCount * 4, 20), MAX_FILTERED_ACTIVITY_TRANSACTIONS)
  let attempt = 0
  let filteredEvents: TResolvedActivityEvent[] = []
  let metadata = new Map<string, VaultMetadata>()
  let hasUnscannedTransactions = false

  while (attempt < MAX_FILTERED_ACTIVITY_ATTEMPTS) {
    const { candidateEvents, hasPotentialMore } = await loadRecentActivityWindow(
      userAddress,
      version,
      targetTransactionCount
    )
    const selectedTransactionKeys = getSelectedTransactionKeys(candidateEvents, targetTransactionCount)
    const classifiedEvents = await classifyActivityForTransactionKeys(
      userAddress,
      version,
      candidateEvents,
      selectedTransactionKeys
    )
    const matchingEvents = classifiedEvents.filter((event) => matchesActivityFilters(event, filters))
    const vaultIdentifiers = getVaultIdentifiers(matchingEvents)
    metadata = vaultIdentifiers.length > 0 ? await fetchMultipleVaultsMetadata(vaultIdentifiers) : new Map()
    filteredEvents = filterVisibleActivityEvents(matchingEvents, metadata)
    hasUnscannedTransactions = hasPotentialMore && selectedTransactionKeys.length >= targetTransactionCount

    if (
      filteredEvents.length >= requestedEntryCount ||
      !hasUnscannedTransactions ||
      targetTransactionCount >= MAX_FILTERED_ACTIVITY_TRANSACTIONS
    ) {
      break
    }

    targetTransactionCount = Math.min(targetTransactionCount * 2, MAX_FILTERED_ACTIVITY_TRANSACTIONS)
    attempt += 1
  }

  const pageEvents = filteredEvents.slice(boundedOffset, boundedOffset + boundedLimit)
  const enrichedEvents = await enrichActivityInputAssets(pageEvents, userAddress, metadata)
  const entries = enrichedEvents.map((event) => toHoldingsActivityEntry(event, metadata))
  const hasMore =
    filteredEvents.length > boundedOffset + boundedLimit ||
    (pageEvents.length === boundedLimit && hasUnscannedTransactions)

  return {
    entries,
    pageInfo: {
      hasMore,
      nextOffset: hasMore ? boundedOffset + boundedLimit : null
    }
  }
}

export async function getHoldingsActivity(
  userAddress: string,
  version: VaultVersion = 'all',
  limit = 10,
  offset = 0,
  filters: HoldingsActivityFilters = DEFAULT_ACTIVITY_FILTERS
): Promise<HoldingsActivityResponse> {
  const boundedLimit = Math.max(1, limit)
  const boundedOffset = Math.max(0, offset)
  const normalizedFilters = normalizeActivityFilters(filters)
  const activityPage = !hasActiveActivityFilters(normalizedFilters)
    ? await getUnfilteredHoldingsActivity(userAddress, version, boundedLimit, boundedOffset)
    : await getFilteredHoldingsActivity(userAddress, version, boundedLimit, boundedOffset, normalizedFilters)

  return {
    address: lowerCaseAddress(userAddress),
    version,
    limit: boundedLimit,
    offset: boundedOffset,
    pageInfo: activityPage.pageInfo,
    entries: activityPage.entries
  }
}
