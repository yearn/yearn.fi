import type { DepositEvent, TimelineEvent, TransferEvent, WithdrawEvent } from '../types'
import { getFamilyVaultAddress } from './staking'

type TMutablePositionTimelineIndexEntry = {
  timestamps: number[]
  balances: bigint[]
  balance: bigint
}

export type TPositionTimelineIndexEntry = Readonly<{
  timestamps: readonly number[]
  balances: readonly bigint[]
}>

export type TPositionTimelineIndex = ReadonlyMap<string, TPositionTimelineIndexEntry>

function getPositionTimelineVaultKey(chainId: number, vaultAddress: string): string {
  return `${chainId}:${vaultAddress.toLowerCase()}`
}

export function buildPositionTimeline(
  deposits: DepositEvent[],
  withdrawals: WithdrawEvent[],
  transfersIn: TransferEvent[],
  transfersOut: TransferEvent[]
): TimelineEvent[] {
  const events: TimelineEvent[] = []

  for (const deposit of deposits) {
    events.push({
      vaultAddress: getFamilyVaultAddress(deposit.chainId, deposit.vaultAddress),
      chainId: deposit.chainId,
      blockNumber: deposit.blockNumber,
      blockTimestamp: deposit.blockTimestamp,
      sharesChange: BigInt(deposit.shares)
    })
  }

  for (const withdrawal of withdrawals) {
    events.push({
      vaultAddress: getFamilyVaultAddress(withdrawal.chainId, withdrawal.vaultAddress),
      chainId: withdrawal.chainId,
      blockNumber: withdrawal.blockNumber,
      blockTimestamp: withdrawal.blockTimestamp,
      sharesChange: -BigInt(withdrawal.shares)
    })
  }

  for (const transfer of transfersIn) {
    events.push({
      vaultAddress: getFamilyVaultAddress(transfer.chainId, transfer.vaultAddress),
      chainId: transfer.chainId,
      blockNumber: transfer.blockNumber,
      blockTimestamp: transfer.blockTimestamp,
      sharesChange: BigInt(transfer.value)
    })
  }

  for (const transfer of transfersOut) {
    events.push({
      vaultAddress: getFamilyVaultAddress(transfer.chainId, transfer.vaultAddress),
      chainId: transfer.chainId,
      blockNumber: transfer.blockNumber,
      blockTimestamp: transfer.blockTimestamp,
      sharesChange: -BigInt(transfer.value)
    })
  }

  events.sort((a, b) => {
    if (a.blockTimestamp !== b.blockTimestamp) {
      return a.blockTimestamp - b.blockTimestamp
    }
    return a.blockNumber - b.blockNumber
  })

  return events
}

export function getShareBalanceAtTimestamp(
  timeline: TimelineEvent[],
  vaultAddress: string,
  chainId: number,
  timestamp: number
): bigint {
  let balance = BigInt(0)
  const vaultLower = vaultAddress.toLowerCase()

  for (const event of timeline) {
    if (event.blockTimestamp > timestamp) {
      break
    }
    if (event.vaultAddress === vaultLower && event.chainId === chainId) {
      balance += event.sharesChange
    }
  }

  return balance < BigInt(0) ? BigInt(0) : balance
}

export function buildPositionTimelineIndex(timeline: readonly TimelineEvent[]): TPositionTimelineIndex {
  const mutableIndex = timeline.reduce<Map<string, TMutablePositionTimelineIndexEntry>>((index, event) => {
    const key = getPositionTimelineVaultKey(event.chainId, event.vaultAddress)
    const entry = index.get(key) ?? { timestamps: [], balances: [], balance: BigInt(0) }
    const nextBalance = entry.balance + event.sharesChange
    const lastIndex = entry.timestamps.length - 1

    if (lastIndex >= 0 && entry.timestamps[lastIndex] === event.blockTimestamp) {
      entry.balances[lastIndex] = nextBalance
    } else {
      entry.timestamps.push(event.blockTimestamp)
      entry.balances.push(nextBalance)
    }

    entry.balance = nextBalance
    index.set(key, entry)
    return index
  }, new Map())

  return new Map(
    Array.from(mutableIndex.entries()).map(([key, entry]) => [
      key,
      { timestamps: entry.timestamps, balances: entry.balances }
    ])
  )
}

function findLastTimestampIndex(
  timestamps: readonly number[],
  timestamp: number,
  left = 0,
  right = timestamps.length - 1
): number {
  if (left > right) {
    return right
  }

  const midpoint = Math.floor((left + right) / 2)
  return timestamps[midpoint]! <= timestamp
    ? findLastTimestampIndex(timestamps, timestamp, midpoint + 1, right)
    : findLastTimestampIndex(timestamps, timestamp, left, midpoint - 1)
}

export function getIndexedShareBalanceAtTimestamp(
  index: TPositionTimelineIndex,
  vaultAddress: string,
  chainId: number,
  timestamp: number
): bigint {
  const entry = index.get(getPositionTimelineVaultKey(chainId, vaultAddress))
  if (!entry) {
    return BigInt(0)
  }

  const balanceIndex = findLastTimestampIndex(entry.timestamps, timestamp)
  const balance = balanceIndex >= 0 ? (entry.balances[balanceIndex] ?? BigInt(0)) : BigInt(0)
  return balance < BigInt(0) ? BigInt(0) : balance
}

export function getUniqueVaults(timeline: TimelineEvent[]): Array<{ vaultAddress: string; chainId: number }> {
  const seen = new Set<string>()
  const vaults: Array<{ vaultAddress: string; chainId: number }> = []

  for (const event of timeline) {
    const key = `${event.chainId}:${event.vaultAddress}`
    if (!seen.has(key)) {
      seen.add(key)
      vaults.push({
        vaultAddress: event.vaultAddress,
        chainId: event.chainId
      })
    }
  }

  return vaults
}

export function generateDailyTimestamps(days: number, endOffsetDays = 0): number[] {
  const timestamps: number[] = []
  const now = new Date()
  now.setUTCHours(0, 0, 0, 0)
  now.setUTCDate(now.getUTCDate() - endOffsetDays)

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now)
    date.setUTCDate(date.getUTCDate() - i)
    timestamps.push(Math.floor(date.getTime() / 1000))
  }

  return timestamps
}

export function generateDailyTimestampsFromRange(startTimestamp: number, endTimestamp: number): number[] {
  if (!Number.isFinite(startTimestamp) || !Number.isFinite(endTimestamp)) {
    return []
  }

  const startDate = new Date(startTimestamp * 1000)
  startDate.setUTCHours(0, 0, 0, 0)

  const endDate = new Date(endTimestamp * 1000)
  endDate.setUTCHours(0, 0, 0, 0)

  if (startDate.getTime() > endDate.getTime()) {
    return []
  }

  const timestamps: number[] = []
  const cursor = new Date(startDate)

  while (cursor.getTime() <= endDate.getTime()) {
    timestamps.push(Math.floor(cursor.getTime() / 1000))
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }

  return timestamps
}

export function toSettledDayTimestamp(timestamp: number): number {
  const date = new Date(timestamp * 1000)
  date.setUTCHours(23, 59, 59, 0)
  return Math.floor(date.getTime() / 1000)
}

export function timestampToDateString(timestamp: number): string {
  const date = new Date(timestamp * 1000)
  return date.toISOString().split('T')[0]
}
