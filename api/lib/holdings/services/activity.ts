import type { DepositEvent, TransferEvent, WithdrawEvent } from '../types'
import type { TransactionActivityEvents, VaultVersion } from './graphql'
import { fetchActivityEventsByTransactionHashes, fetchRecentAddressScopedActivityEvents } from './graphql'
import { formatAmount, lowerCaseAddress, minBigInt, toVaultKey, ZERO } from './pnlShared'
import { getFamilyVaultAddress, isStakingVault } from './staking'
import { fetchMultipleVaultsMetadata } from './vaults'

export type HoldingsActivityAction = 'deposit' | 'withdraw' | 'stake' | 'unstake'

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
    shares: args.shareAmount
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

export async function getHoldingsActivity(
  userAddress: string,
  version: VaultVersion = 'all',
  limit = 10,
  offset = 0
): Promise<HoldingsActivityResponse> {
  const boundedLimit = Math.max(1, limit)
  const boundedOffset = Math.max(0, offset)
  const targetTransactionCount = boundedOffset + boundedLimit + 1
  const { candidateEvents, hasPotentialMore } = await loadRecentActivityWindow(
    userAddress,
    version,
    targetTransactionCount
  )
  const selectedTransactionKeys = getSelectedTransactionKeys(candidateEvents, targetTransactionCount)
  const pageTransactionKeys = selectedTransactionKeys.slice(boundedOffset, boundedOffset + boundedLimit)
  const selectedTransactionKeySet = new Set(pageTransactionKeys)
  const selectedAddressEvents = candidateEvents.filter((event) => selectedTransactionKeySet.has(toTxKey(event)))
  const transactionEvents =
    pageTransactionKeys.length > 0
      ? await fetchActivityEventsByTransactionHashes(buildTransactionHashesByChain(pageTransactionKeys), version)
      : {
          deposits: [],
          withdrawals: [],
          transfers: []
        }
  const selectedEvents = mergeActivityEvents([
    ...selectedAddressEvents,
    ...normalizeTransactionActivityEvents(transactionEvents)
  ])
  const classifiedEvents = classifyActivityEvents(selectedEvents, userAddress)
  const vaultIdentifiers = classifiedEvents.reduce<Array<{ chainId: number; vaultAddress: string }>>(
    (identifiers, event) => {
      const alreadyIncluded = identifiers.some(
        (identifier) => identifier.chainId === event.chainId && identifier.vaultAddress === event.vaultAddress
      )

      if (!alreadyIncluded) {
        identifiers.push({ chainId: event.chainId, vaultAddress: event.vaultAddress })
      }

      return identifiers
    },
    []
  )
  const metadata = vaultIdentifiers.length > 0 ? await fetchMultipleVaultsMetadata(vaultIdentifiers) : new Map()
  const entries = classifiedEvents.flatMap<HoldingsActivityEntry>((event) => {
    const eventMetadata = metadata.get(toVaultKey(event.chainId, event.vaultAddress)) ?? null

    if (eventMetadata?.isHidden) {
      return []
    }

    return [
      {
        chainId: event.chainId,
        txHash: event.txHash,
        timestamp: event.timestamp,
        action: event.action,
        vaultAddress: event.vaultAddress,
        familyVaultAddress: event.familyVaultAddress,
        assetSymbol: eventMetadata?.token.symbol ?? null,
        assetAmount: event.assets.toString(),
        assetAmountFormatted: eventMetadata ? formatAmount(event.assets, eventMetadata.token.decimals) : null,
        shareAmount: event.shares.toString(),
        shareAmountFormatted: eventMetadata ? formatAmount(event.shares, eventMetadata.decimals) : null,
        status: eventMetadata ? 'ok' : 'missing_metadata'
      }
    ]
  })
  const hasMore =
    selectedTransactionKeys.length > boundedOffset + boundedLimit ||
    (pageTransactionKeys.length === boundedLimit &&
      selectedTransactionKeys.length < targetTransactionCount &&
      hasPotentialMore)

  return {
    address: lowerCaseAddress(userAddress),
    version,
    limit: boundedLimit,
    offset: boundedOffset,
    pageInfo: {
      hasMore,
      nextOffset: hasMore ? boundedOffset + boundedLimit : null
    },
    entries
  }
}
