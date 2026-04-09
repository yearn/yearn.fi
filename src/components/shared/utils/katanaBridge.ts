import type { Hash } from 'viem'

export const KATANA_BRIDGE_TRACKING_URL = 'https://bridge.katana.network/transactions'

export type TKatanaBridgeDirection = 'to-katana' | 'to-ethereum'

export type TKatanaBridgeLifecycleStatus =
  | 'SOURCE_CONFIRMED'
  | 'BRIDGE_PENDING'
  | 'READY_TO_CLAIM'
  | 'COMPLETED'
  | 'FAILED'

export type TKatanaBridgeTransaction = {
  sourceTxHash: Hash
  claimTxHash?: Hash
  status: TKatanaBridgeLifecycleStatus
  rawStatus?: string
  receiver?: string
  fromChainId?: number
  toChainId?: number
  tokenAddress?: string
  tokenSymbol?: string
  amount?: string
  depositCount?: string
  timestamp?: number
}

export type TKatanaBridgeTransactionsResponse = {
  transactions: TKatanaBridgeTransaction[]
}

export function hasKatanaBridgeBalanceDeltaArrived({
  baselineBalance,
  currentBalance,
  requiredAmount
}: {
  baselineBalance: bigint
  currentBalance: bigint
  requiredAmount: bigint
}): boolean {
  if (requiredAmount <= 0n || currentBalance <= baselineBalance) {
    return false
  }

  return currentBalance - baselineBalance >= requiredAmount
}

export function getKatanaBridgeDurationLabel(direction: TKatanaBridgeDirection): string {
  return direction === 'to-ethereum' ? '~3 hrs' : '~5 min'
}

type TRecord = Record<string, unknown>

function asRecord(value: unknown): TRecord | undefined {
  return typeof value === 'object' && value !== null ? (value as TRecord) : undefined
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

function asHash(value: unknown): Hash | undefined {
  const maybeHash = asString(value)
  return maybeHash && /^0x[a-fA-F0-9]{64}$/.test(maybeHash) ? (maybeHash as Hash) : undefined
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : undefined
  }

  return undefined
}

function readValue(record: TRecord | undefined, path: string[]): unknown {
  return path.reduce<unknown>((currentValue, pathPart) => {
    const currentRecord = asRecord(currentValue)
    return currentRecord?.[pathPart]
  }, record)
}

function readFirstString(record: TRecord | undefined, paths: string[][]): string | undefined {
  return paths.map((path) => asString(readValue(record, path))).find(Boolean)
}

function readFirstHash(record: TRecord | undefined, paths: string[][]): Hash | undefined {
  return paths.map((path) => asHash(readValue(record, path))).find(Boolean)
}

function readFirstNumber(record: TRecord | undefined, paths: string[][]): number | undefined {
  return paths.map((path) => asNumber(readValue(record, path))).find((value) => value !== undefined)
}

function readFirstAmount(record: TRecord | undefined, paths: string[][]): string | undefined {
  return paths
    .map((path) => readValue(record, path))
    .map((value) => {
      if (typeof value === 'bigint') {
        return value.toString()
      }
      return asString(value)
    })
    .find(Boolean)
}

function resolveTransactionEntries(payload: unknown): unknown[] {
  if (Array.isArray(payload)) {
    return payload
  }

  const payloadRecord = asRecord(payload)
  if (!payloadRecord) {
    return []
  }

  return (
    [
      payloadRecord.transactions,
      payloadRecord.result,
      asRecord(payloadRecord.result)?.transactions,
      payloadRecord.data,
      asRecord(payloadRecord.data)?.transactions
    ].find(Array.isArray) || []
  )
}

export function normalizeKatanaBridgeLifecycleStatus(
  rawStatus?: string,
  claimTxHash?: Hash
): TKatanaBridgeLifecycleStatus {
  const normalizedStatus = rawStatus?.toUpperCase()

  if (normalizedStatus === 'FAILED' || normalizedStatus === 'ERROR') {
    return 'FAILED'
  }

  if (normalizedStatus === 'READY_TO_CLAIM' || normalizedStatus === 'READY_TO_EXIT') {
    return 'READY_TO_CLAIM'
  }

  if (normalizedStatus === 'CLAIMED' || normalizedStatus === 'COMPLETED' || normalizedStatus === 'EXITED') {
    return 'COMPLETED'
  }

  if (claimTxHash && normalizedStatus !== 'FAILED') {
    return 'BRIDGE_PENDING'
  }

  return 'BRIDGE_PENDING'
}

export function normalizeKatanaBridgeTransactionsResponse(payload: unknown): TKatanaBridgeTransactionsResponse {
  const transactions = resolveTransactionEntries(payload)
    .map((transaction): TKatanaBridgeTransaction | undefined => {
      const record = asRecord(transaction)
      const sourceTxHash = readFirstHash(record, [['transactionHash'], ['sourceTransactionHash'], ['txHash']])

      if (!sourceTxHash) {
        return undefined
      }

      const claimTxHash = readFirstHash(record, [['claimTransactionHash'], ['claimTxHash']])
      const rawStatus = readFirstString(record, [['status']])
      const timestamp = readFirstNumber(record, [['timestamp'], ['time'], ['createdAt']])

      return {
        sourceTxHash,
        claimTxHash,
        status: normalizeKatanaBridgeLifecycleStatus(rawStatus, claimTxHash),
        rawStatus,
        receiver: readFirstString(record, [['receiver'], ['destinationAddress']]),
        fromChainId: readFirstNumber(record, [['sourceChainId'], ['sourceChain', 'id'], ['sourceNetwork']]),
        toChainId: readFirstNumber(record, [['destinationChainId'], ['destChain', 'id'], ['destinationNetwork']]),
        tokenAddress: readFirstString(record, [
          ['tokenAddress'],
          ['originTokenAddress'],
          ['token', 'address'],
          ['tokenForTxn', 'tokenAddress'],
          ['tokenForTxn', 'originTokenAddress'],
          ['tokenForTxn', 'token', 'address'],
          ['tokenForTxn', 'wrappedTokenAddress']
        ]),
        tokenSymbol: readFirstString(record, [
          ['tokenSymbol'],
          ['token', 'symbol'],
          ['tokenForTxn', 'symbol'],
          ['tokenForTxn', 'tokenSymbol'],
          ['tokenForTxn', 'token', 'symbol']
        ]),
        amount: readFirstAmount(record, [['amount'], ['tokenForTxn', 'amount'], ['value']]),
        depositCount: readFirstString(record, [['depositCount'], ['bridgeDepositCount']]),
        timestamp: timestamp ? (timestamp > 1_000_000_000_000 ? Math.floor(timestamp / 1000) : timestamp) : undefined
      }
    })
    .filter((transaction): transaction is TKatanaBridgeTransaction => Boolean(transaction))

  return { transactions }
}
