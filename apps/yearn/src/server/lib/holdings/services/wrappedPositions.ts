import type { TWrapped } from '@yearn/wrapped-contract'
import type { TPositionTimelineIndex } from '@/server/lib/holdings/services/holdings'
import type { VaultMetadata } from '@/server/lib/holdings/types'

export function summarizeWrappedPositions(
  timeline: TPositionTimelineIndex,
  metadata: Map<string, VaultMetadata>,
  start: number,
  end: number
): TWrapped['vaults'] {
  return Array.from(timeline.entries())
    .flatMap(([key, entry]) => {
      const [chain, address] = key.split(':')
      const before = entry.timestamps.findLastIndex((ts) => ts < start)
      const opening = before < 0 ? 0n : entry.balances[before]!
      const changes = entry.timestamps.flatMap((ts, index) =>
        ts >= start && ts <= end ? [{ ts, balance: entry.balances[index]! }] : []
      )
      const boundaries = [{ ts: start, balance: opening }, ...changes, { ts: end + 1, balance: 0n }]
      const summary = boundaries.reduce(
        (state, point, index) => {
          const previous = boundaries[index - 1]
          const duration = previous && previous.balance > 0n ? point.ts - previous.ts : 0
          const current = state.current + duration
          return {
            held: state.held + duration,
            longest: Math.max(state.longest, current),
            current: point.balance > 0n ? current : 0,
            complete: state.complete && point.balance >= 0n
          }
        },
        {
          held: 0,
          longest: 0,
          current: 0,
          complete:
            opening >= 0n && entry.balances.every((balance, index) => entry.timestamps[index]! > end || balance >= 0n)
        }
      )
      if (summary.held === 0 && !changes.some((point) => point.balance > 0n)) return []
      const meta = metadata.get(key)
      return [
        {
          chainId: Number(chain),
          address: address!,
          label: meta?.token.symbol ?? `${address!.slice(0, 6)}…${address!.slice(-4)}`,
          heldDays: summary.held / 86400,
          longestStreakDays: summary.longest / 86400,
          stillHolding: (changes.at(-1)?.balance ?? opening) > 0n,
          isComplete: summary.complete && Boolean(meta)
        }
      ]
    })
    .sort((a, b) => b.heldDays - a.heldDays || a.chainId - b.chainId || a.address.localeCompare(b.address))
}
