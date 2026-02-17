import type { DepositEvent, TimelineEvent, TransferEvent, WithdrawEvent } from '../types'

export function buildPositionTimeline(
  deposits: DepositEvent[],
  withdrawals: WithdrawEvent[],
  transfersIn: TransferEvent[],
  transfersOut: TransferEvent[]
): TimelineEvent[] {
  const events: TimelineEvent[] = [
    ...deposits.map((deposit) => ({
      vaultAddress: deposit.vaultAddress.toLowerCase(),
      chainId: deposit.chainId,
      blockNumber: deposit.blockNumber,
      blockTimestamp: deposit.blockTimestamp,
      sharesChange: BigInt(deposit.shares)
    })),
    ...withdrawals.map((withdrawal) => ({
      vaultAddress: withdrawal.vaultAddress.toLowerCase(),
      chainId: withdrawal.chainId,
      blockNumber: withdrawal.blockNumber,
      blockTimestamp: withdrawal.blockTimestamp,
      sharesChange: -BigInt(withdrawal.shares)
    })),
    ...transfersIn.map((transfer) => ({
      vaultAddress: transfer.vaultAddress.toLowerCase(),
      chainId: transfer.chainId,
      blockNumber: transfer.blockNumber,
      blockTimestamp: transfer.blockTimestamp,
      sharesChange: BigInt(transfer.value)
    })),
    ...transfersOut.map((transfer) => ({
      vaultAddress: transfer.vaultAddress.toLowerCase(),
      chainId: transfer.chainId,
      blockNumber: transfer.blockNumber,
      blockTimestamp: transfer.blockTimestamp,
      sharesChange: -BigInt(transfer.value)
    }))
  ]

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
  const vaultLower = vaultAddress.toLowerCase()
  const balance = timeline
    .filter(
      (event) => event.blockTimestamp <= timestamp && event.vaultAddress === vaultLower && event.chainId === chainId
    )
    .reduce((acc, event) => acc + event.sharesChange, BigInt(0))

  return balance < BigInt(0) ? BigInt(0) : balance
}

export function getUniqueVaults(timeline: TimelineEvent[]): Array<{ vaultAddress: string; chainId: number }> {
  const seen = new Set<string>()
  return timeline
    .filter((event) => {
      const key = `${event.chainId}:${event.vaultAddress}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .map((event) => ({
      vaultAddress: event.vaultAddress,
      chainId: event.chainId
    }))
}

export function generateDailyTimestamps(days: number): number[] {
  const now = new Date()
  now.setUTCHours(0, 0, 0, 0)
  return Array.from({ length: days }, (_, idx) => {
    const date = new Date(now)
    date.setUTCDate(date.getUTCDate() - (days - 1 - idx))
    return Math.floor(date.getTime() / 1000)
  })
}

export function timestampToDateString(timestamp: number): string {
  const date = new Date(timestamp * 1000)
  return date.toISOString().split('T')[0]
}
