export interface TLedgerOrderedRecord {
  readonly blockTimestamp: number
  readonly blockNumber: number
  readonly logIndex: number
  readonly id: string
}

export function compareLedgerStrings(left: string, right: string): number {
  return left === right ? 0 : left < right ? -1 : 1
}

export function compareLedgerOrder(left: TLedgerOrderedRecord, right: TLedgerOrderedRecord): number {
  return (
    left.blockTimestamp - right.blockTimestamp ||
    left.blockNumber - right.blockNumber ||
    left.logIndex - right.logIndex ||
    compareLedgerStrings(left.id, right.id)
  )
}
