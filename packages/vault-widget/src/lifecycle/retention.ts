import {
  hasSuccessfulSourceReceipt,
  selectTransaction,
  type TTransactionRecord
} from '@yearn/vault-widget/lifecycle/model'

export const TRANSACTION_RETENTION_MS = 7 * 24 * 60 * 60 * 1000

function resolvedAt(record: TTransactionRecord): number | undefined {
  const outcome = selectTransaction(record).outcome
  if (
    !['success', 'error'].includes(outcome) ||
    record.refresh === 'pending' ||
    Object.values(record.milestoneRefresh ?? {}).some((value) => value?.status === 'pending')
  )
    return undefined
  if (
    record.settlement !== 'same-chain' &&
    hasSuccessfulSourceReceipt(record) &&
    outcome === 'error' &&
    record.destination?.funds !== 'refunded'
  )
    return undefined
  const timestamps = [
    record.source?.observedAt,
    record.destination?.observedAt,
    record.safe?.execution?.observedAt
  ].filter((value): value is number => value !== undefined)
  return timestamps.length && timestamps.every((value) => Number.isFinite(value) && value > 0)
    ? Math.max(...timestamps)
    : undefined
}

/** Delete whole completed flows; a successful prerequisite alone is not a completed flow. */
export function expiredTransactionIds(records: readonly TTransactionRecord[], now: number): Set<string> {
  const groups = new Map<string, TTransactionRecord[]>()
  records.forEach((record) => {
    const key = `${record.owner.toLowerCase()}:${record.flowId}`
    groups.set(key, [...(groups.get(key) ?? []), record])
  })
  return new Set(
    [...groups.values()].flatMap((group) => {
      const last = group.toSorted((a, b) => (b.sequence?.index ?? 0) - (a.sequence?.index ?? 0))[0]
      if (last.sequence && last.sequence.index < last.sequence.count - 1 && selectTransaction(last).outcome !== 'error')
        return []
      const times = group.map(resolvedAt)
      if (times.some((time) => time === undefined) || Math.max(...(times as number[])) > now - TRANSACTION_RETENTION_MS)
        return []
      return group.map((record) => record.id)
    })
  )
}
