import type { DepositEvent, TimelineEvent, TransferEvent, WithdrawEvent } from '../types'

export function buildPositionTimeline(
  deposits: DepositEvent[],
  withdrawals: WithdrawEvent[],
  transfersIn: TransferEvent[],
  transfersOut: TransferEvent[]
): TimelineEvent[] {
  const events: TimelineEvent[] = []

  for (const deposit of deposits) {
    events.push({
      vaultAddress: deposit.vaultAddress.toLowerCase(),
      chainId: deposit.chainId,
      blockNumber: deposit.blockNumber,
      blockTimestamp: deposit.blockTimestamp,
      sharesChange: BigInt(deposit.shares)
    })
  }

  for (const withdrawal of withdrawals) {
    events.push({
      vaultAddress: withdrawal.vaultAddress.toLowerCase(),
      chainId: withdrawal.chainId,
      blockNumber: withdrawal.blockNumber,
      blockTimestamp: withdrawal.blockTimestamp,
      sharesChange: -BigInt(withdrawal.shares)
    })
  }

  for (const transfer of transfersIn) {
    events.push({
      vaultAddress: transfer.vaultAddress.toLowerCase(),
      chainId: transfer.chainId,
      blockNumber: transfer.blockNumber,
      blockTimestamp: transfer.blockTimestamp,
      sharesChange: BigInt(transfer.value)
    })
  }

  for (const transfer of transfersOut) {
    events.push({
      vaultAddress: transfer.vaultAddress.toLowerCase(),
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

export function generateDailyTimestamps(days: number): number[] {
  const timestamps: number[] = []
  const now = new Date()
  now.setUTCHours(0, 0, 0, 0)

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now)
    date.setUTCDate(date.getUTCDate() - i)
    timestamps.push(Math.floor(date.getTime() / 1000))
  }

  return timestamps
}

export function timestampToDateString(timestamp: number): string {
  const date = new Date(timestamp * 1000)
  return date.toISOString().split('T')[0]
}
