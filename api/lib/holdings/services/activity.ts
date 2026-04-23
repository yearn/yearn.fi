import type { DepositEvent, WithdrawEvent } from '../types'
import type { VaultVersion } from './graphql'
import { fetchRecentAddressScopedActivityEvents } from './graphql'
import { formatAmount, lowerCaseAddress, toVaultKey } from './pnlShared'
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

type TActivityEvent =
  | {
      kind: 'deposit'
      id: string
      chainId: number
      vaultAddress: string
      blockNumber: number
      blockTimestamp: number
      logIndex: number
      transactionHash: string
      assets: bigint
      shares: bigint
    }
  | {
      kind: 'withdrawal'
      id: string
      chainId: number
      vaultAddress: string
      blockNumber: number
      blockTimestamp: number
      logIndex: number
      transactionHash: string
      assets: bigint
      shares: bigint
    }

type TAggregatedActivityEvent = {
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

function normalizeDepositEvent(event: DepositEvent): TActivityEvent {
  return {
    kind: 'deposit',
    id: event.id,
    chainId: event.chainId,
    vaultAddress: lowerCaseAddress(event.vaultAddress),
    blockNumber: event.blockNumber,
    blockTimestamp: event.blockTimestamp,
    logIndex: event.logIndex,
    transactionHash: lowerCaseAddress(event.transactionHash),
    assets: BigInt(event.assets),
    shares: BigInt(event.shares)
  }
}

function normalizeWithdrawalEvent(event: WithdrawEvent): TActivityEvent {
  return {
    kind: 'withdrawal',
    id: event.id,
    chainId: event.chainId,
    vaultAddress: lowerCaseAddress(event.vaultAddress),
    blockNumber: event.blockNumber,
    blockTimestamp: event.blockTimestamp,
    logIndex: event.logIndex,
    transactionHash: lowerCaseAddress(event.transactionHash),
    assets: BigInt(event.assets),
    shares: BigInt(event.shares)
  }
}

function sortEventsDesc(events: TActivityEvent[]): TActivityEvent[] {
  return [...events].sort(compareActivityEventsDesc)
}

function toTxKey(event: TActivityEvent): string {
  return `${event.chainId}:${event.transactionHash}`
}

function classifyAction(event: TActivityEvent): HoldingsActivityAction {
  const stakingEvent = isStakingVault(event.chainId, event.vaultAddress)

  if (event.kind === 'deposit') {
    return stakingEvent ? 'stake' : 'deposit'
  }

  return stakingEvent ? 'unstake' : 'withdraw'
}

function getFamilyVaultAddressForEvent(event: TActivityEvent): string {
  return getFamilyVaultAddress(event.chainId, event.vaultAddress)
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

function aggregateEvents(events: TActivityEvent[]): TAggregatedActivityEvent[] {
  return Array.from(
    events
      .reduce<Map<string, TAggregatedActivityEvent>>((aggregated, event) => {
        const action = classifyAction(event)
        const familyVaultAddress = getFamilyVaultAddressForEvent(event)
        const key = `${toTxKey(event)}:${event.vaultAddress}:${action}`
        const existing = aggregated.get(key)

        if (!existing) {
          aggregated.set(key, {
            chainId: event.chainId,
            txHash: event.transactionHash,
            timestamp: event.blockTimestamp,
            blockNumber: event.blockNumber,
            logIndex: event.logIndex,
            vaultAddress: event.vaultAddress,
            familyVaultAddress,
            action,
            assets: event.assets,
            shares: event.shares
          })

          return aggregated
        }

        aggregated.set(key, {
          ...existing,
          assets: existing.assets + event.assets,
          shares: existing.shares + event.shares
        })

        return aggregated
      }, new Map<string, TAggregatedActivityEvent>())
      .values()
  ).sort((a, b) => b.timestamp - a.timestamp || b.blockNumber - a.blockNumber || b.logIndex - a.logIndex)
}

async function loadRecentActivityWindow(
  userAddress: string,
  version: VaultVersion,
  targetTransactionCount: number
): Promise<TRecentActivityWindow> {
  let limitPerSource = Math.max(targetTransactionCount * 4, 20)
  let candidateEvents: TActivityEvent[] = []
  let hasPotentialMore = false

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const recentEvents = await fetchRecentAddressScopedActivityEvents(userAddress, version, limitPerSource)
    candidateEvents = sortEventsDesc([
      ...recentEvents.deposits.map(normalizeDepositEvent),
      ...recentEvents.withdrawals.map(normalizeWithdrawalEvent)
    ])
    hasPotentialMore = recentEvents.hasMoreDeposits || recentEvents.hasMoreWithdrawals

    if (
      getSelectedTransactionKeys(candidateEvents, targetTransactionCount).length >= targetTransactionCount ||
      !hasPotentialMore
    ) {
      break
    }

    limitPerSource = Math.min(limitPerSource * 2, 1000)
  }

  return {
    candidateEvents,
    hasPotentialMore
  }
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
  const selectedEvents = candidateEvents.filter((event) => selectedTransactionKeySet.has(toTxKey(event)))
  const aggregatedEvents = aggregateEvents(selectedEvents)
  const vaultIdentifiers = aggregatedEvents.reduce<Array<{ chainId: number; vaultAddress: string }>>(
    (identifiers, event) => {
      const alreadyIncluded = identifiers.some(
        (identifier) => identifier.chainId === event.chainId && identifier.vaultAddress === event.vaultAddress
      )

      if (alreadyIncluded) {
        return identifiers
      }

      identifiers.push({ chainId: event.chainId, vaultAddress: event.vaultAddress })
      return identifiers
    },
    []
  )
  const metadata = vaultIdentifiers.length > 0 ? await fetchMultipleVaultsMetadata(vaultIdentifiers) : new Map()
  const entries = aggregatedEvents.flatMap<HoldingsActivityEntry>((event) => {
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
