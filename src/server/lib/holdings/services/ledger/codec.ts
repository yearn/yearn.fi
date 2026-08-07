import { createHash } from 'node:crypto'
import { brotliCompressSync, brotliDecompressSync, constants as zlibConstants } from 'node:zlib'
import {
  getLedgerChunkKey,
  getLedgerIndexShardKey,
  getLedgerRevisionManifestKey
} from '@/server/lib/holdings/services/ledger/keys'
import { compareLedgerOrder } from '@/server/lib/holdings/services/ledger/order'
import {
  LEDGER_CODEC_NAME,
  LEDGER_DIRTY_REASON_CODES,
  LEDGER_EVENT_FAMILIES,
  LEDGER_EVENT_FAMILY_CODES,
  LEDGER_INDEX_SHARD_COUNT,
  LEDGER_MAX_ACTIVE_REVISION_BYTES,
  LEDGER_MAX_ACTIVE_REVISION_DECODED_BYTES,
  LEDGER_MAX_CHUNK_RECORDS,
  LEDGER_MAX_DECODED_CHUNK_BYTES,
  LEDGER_MAX_DECODED_INDEX_SHARD_BYTES,
  LEDGER_MAX_ENCODED_CHUNK_BYTES,
  LEDGER_MAX_ENCODED_INDEX_SHARD_BYTES,
  LEDGER_MAX_HEAD_BYTES,
  LEDGER_MAX_MANIFEST_BYTES,
  LEDGER_MAX_SNAPSHOT_PIN_BYTES,
  LEDGER_SCHEMA_VERSION,
  LEDGER_SNAPSHOT_PIN_VERSION,
  LEDGER_SNAPSHOT_TTL_SECONDS,
  LEDGER_STREAMS,
  LEDGER_TRANSFER_DIRECTIONS,
  type TCreateLedgerRevisionManifestInputV1,
  type TEncodedLedgerChunkV1,
  type TEncodedLedgerIndexShardV1,
  type TLedgerCanonicalNonTransferTupleV1,
  type TLedgerCanonicalTransferTupleV1,
  type TLedgerCanonicalTupleV1,
  type TLedgerChunkDescriptorV1,
  type TLedgerChunkPayloadV1,
  type TLedgerChunkRefV1,
  type TLedgerEventFamily,
  type TLedgerHeadV1,
  type TLedgerIndexEntryV1,
  type TLedgerIndexShardDescriptorV1,
  type TLedgerIndexShardPayloadV1,
  type TLedgerIndexShardRefV1,
  type TLedgerInvalidationEpochsV1,
  type TLedgerJsonObject,
  type TLedgerJsonValue,
  type TLedgerManifestValidation,
  type TLedgerNonTransferFamilyCode,
  type TLedgerOrderKey,
  type TLedgerRevisionManifestV1,
  type TLedgerSixStreams,
  type TLedgerSnapshotPinV1,
  type TLedgerSourceEvent,
  type TLedgerStream,
  type TLedgerStreamCoverageV1,
  type TLedgerSyncReasonCode,
  type TLedgerSyncStatusV1,
  type TLedgerTransferDirection,
  type TStoredLedgerChunkV1,
  type TStoredLedgerIndexShardV1
} from '@/server/lib/holdings/services/ledger/types'

const SHA256_PATTERN = /^[a-f0-9]{64}$/
const EVM_ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/
const EVM_TRANSACTION_HASH_PATTERN = /^0x[a-fA-F0-9]{64}$/
const REVISION_PATTERN = /^[A-Za-z0-9_-]{1,96}$/
const SNAPSHOT_ID_PATTERN = /^snapshot_[a-f0-9]{32}$/
const UTC_MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/
const UTC_DATE_PATTERN = /^\d{4}-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/
const LEDGER_SYNC_REASON_CODES = [
  'lock_busy',
  'upstream_failed',
  'storage_failed',
  'decode_failed',
  'cas_rejected',
  'stale_fence'
] as const satisfies readonly TLedgerSyncReasonCode[]

const NON_TRANSFER_STREAMS = [
  { stream: 'v3Deposits', family: 'v3-deposit', familyCode: 0 },
  { stream: 'v3Withdrawals', family: 'v3-withdrawal', familyCode: 1 },
  { stream: 'v2Deposits', family: 'v2-deposit', familyCode: 2 },
  { stream: 'v2Withdrawals', family: 'v2-withdrawal', familyCode: 3 }
] as const satisfies ReadonlyArray<{
  stream: TLedgerStream
  family: TLedgerEventFamily
  familyCode: TLedgerNonTransferFamilyCode
}>

const STREAM_SOURCE_FIELDS = {
  v3Deposits: {
    required: ['transactionFrom', 'owner', 'sender', 'assets', 'shares'],
    addresses: ['vaultAddress', 'transactionFrom', 'owner', 'sender']
  },
  v3Withdrawals: {
    required: ['transactionFrom', 'owner', 'assets', 'shares'],
    addresses: ['vaultAddress', 'transactionFrom', 'owner']
  },
  v2Deposits: {
    required: ['transactionFrom', 'recipient', 'amount', 'shares'],
    addresses: ['vaultAddress', 'transactionFrom', 'recipient']
  },
  v2Withdrawals: {
    required: ['transactionFrom', 'recipient', 'amount', 'shares'],
    addresses: ['vaultAddress', 'transactionFrom', 'recipient']
  },
  transfersIn: {
    required: ['transactionFrom', 'sender', 'receiver', 'value'],
    addresses: ['vaultAddress', 'transactionFrom', 'sender', 'receiver']
  },
  transfersOut: {
    required: ['transactionFrom', 'sender', 'receiver', 'value'],
    addresses: ['vaultAddress', 'transactionFrom', 'sender', 'receiver']
  }
} as const satisfies Record<
  TLedgerStream,
  { readonly required: readonly string[]; readonly addresses: readonly string[] }
>

type TNormalizedSourceEvent = {
  readonly id: string
  readonly vaultAddress: string
  readonly chainId: number
  readonly blockNumber: number
  readonly blockTimestamp: number
  readonly logIndex: number
  readonly transactionHash: string
  readonly source: TLedgerJsonObject
  readonly sourceJson: string
}

type TTransferAccumulator = TNormalizedSourceEvent & {
  readonly direction: TLedgerTransferDirection
}

type TLedgerTupleGroup = {
  readonly family: TLedgerEventFamily
  readonly chainId: number
  readonly month: string
  readonly records: TLedgerCanonicalTupleV1[]
}

type TEncodedCanonicalBlob = {
  readonly data: string
  readonly encodedBytes: number
  readonly decodedBytes: number
  readonly checksum: string
  readonly json: string
}

type TPreparedChunk = TEncodedCanonicalBlob & {
  readonly records: readonly TLedgerCanonicalTupleV1[]
}

declare const VERIFIED_LEDGER_REVISION: unique symbol
const verifiedLedgerRevisions = new WeakSet<object>()

export interface TLedgerVerifiedRevisionV1 {
  readonly manifest: TLedgerRevisionManifestV1
  readonly head: TLedgerHeadV1
  readonly streams: TLedgerSixStreams
  readonly manifestValue: string
  readonly headValue: string
  readonly [VERIFIED_LEDGER_REVISION]: true
}

const CHUNK_DESCRIPTOR_FIELDS = [
  'schemaVersion',
  'codec',
  'family',
  'chainId',
  'month',
  'part',
  'recordCount',
  'encodedBytes',
  'decodedBytes',
  'checksum',
  'firstOrder',
  'lastOrder'
] as const
const INDEX_DESCRIPTOR_FIELDS = [
  'schemaVersion',
  'codec',
  'shard',
  'entryCount',
  'encodedBytes',
  'decodedBytes',
  'checksum',
  'firstIdentity',
  'lastIdentity'
] as const
const COVERAGE_FIELDS = [
  'stream',
  'chainId',
  'status',
  'coverageStartTimestamp',
  'completeThroughTimestamp',
  'coverageStartBlock',
  'completeThroughBlock',
  'cursor',
  'checkpoint',
  'checkpointState',
  'count',
  'checksum'
] as const
const CURSOR_FIELDS = ['blockTimestamp', 'blockNumber', 'logIndex', 'id'] as const
const DEPENDENCY_FIELDS = ['kind', 'chainId', 'address', 'metadataRevision', 'firstEventTimestamp'] as const
const INVALIDATION_EPOCH_FIELDS = ['global', 'source', 'address', 'vault', 'schema', 'metadata'] as const
const MANIFEST_FIELDS = [
  'schemaVersion',
  'codec',
  'calculationVersion',
  'walletHash',
  'sourceFingerprint',
  'sourceGeneration',
  'revision',
  'parentRevision',
  'chainScope',
  'coverage',
  'chunks',
  'indexes',
  'dependencies',
  'invalidationEpochs',
  'dirtyFromTimestamp',
  'dirtyFromDate',
  'dirtyReasons',
  'createdAtMs',
  'updatedAtMs',
  'reconciledAtMs',
  'recordCount',
  'activeEncodedBytes',
  'chunksChecksum',
  'indexesChecksum'
] as const
const HEAD_FIELDS = [
  'schemaVersion',
  'codec',
  'calculationVersion',
  'walletHash',
  'sourceFingerprint',
  'sourceGeneration',
  'revision',
  'parentRevision',
  'manifestKey',
  'invalidationEpochs',
  'dirtyFromTimestamp',
  'dirtyFromDate',
  'dirtyReasons',
  'manifestChecksum',
  'createdAtMs',
  'updatedAtMs',
  'reconciledAtMs'
] as const
const SYNC_STATUS_FIELDS = [
  'schemaVersion',
  'state',
  'sourceGeneration',
  'revision',
  'reasonCode',
  'updatedAtMs'
] as const
const SNAPSHOT_PIN_FIELDS = [
  'snapshotVersion',
  'snapshotId',
  'headSource',
  'head',
  'latestSettledDayTimestamp',
  'eventUpperTimestamp',
  'createdAtMs',
  'expiresAtMs'
] as const

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function assertExactObjectKeys(value: unknown, expectedFields: readonly string[], label: string): void {
  if (!isPlainObject(value)) {
    throw new Error(`${label} must be a plain object`)
  }
  const actualFields = Object.keys(value).toSorted()
  const sortedExpectedFields = [...expectedFields].toSorted()
  if (
    actualFields.length !== sortedExpectedFields.length ||
    actualFields.some((field, index) => field !== sortedExpectedFields[index])
  ) {
    throw new Error(`${label} contains unsupported or missing fields`)
  }
}

function canonicalizeJsonValue(value: unknown, ancestors: readonly object[]): TLedgerJsonValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') {
    return value
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new Error('Ledger JSON numbers must be finite')
    }
    return value
  }
  if (Array.isArray(value)) {
    if (ancestors.includes(value)) {
      throw new Error('Ledger JSON values cannot contain cycles')
    }
    return value.map((item) => canonicalizeJsonValue(item, [...ancestors, value]))
  }
  if (isPlainObject(value)) {
    if (ancestors.includes(value)) {
      throw new Error('Ledger JSON values cannot contain cycles')
    }
    return Object.fromEntries(
      Object.keys(value)
        .toSorted()
        .map((key) => [key, canonicalizeJsonValue(value[key], [...ancestors, value])])
    )
  }
  throw new Error(`Ledger JSON value has unsupported type ${typeof value}`)
}

function stringifyCanonicalValue(value: TLedgerJsonValue): string {
  if (value === null) {
    return 'null'
  }
  if (typeof value === 'string' || typeof value === 'boolean') {
    return JSON.stringify(value)
  }
  if (typeof value === 'number') {
    return Object.is(value, -0) ? '-0' : JSON.stringify(value)
  }
  if (Array.isArray(value)) {
    return `[${value.map(stringifyCanonicalValue).join(',')}]`
  }
  const objectValue = value as TLedgerJsonObject
  return `{${Object.keys(objectValue)
    .toSorted()
    .map((key) => `${JSON.stringify(key)}:${stringifyCanonicalValue(objectValue[key] as TLedgerJsonValue)}`)
    .join(',')}}`
}

export function canonicalizeLedgerJsonValue(value: unknown): TLedgerJsonValue {
  return canonicalizeJsonValue(value, [])
}

export function stringifyCanonicalLedgerValue(value: unknown): string {
  return stringifyCanonicalValue(canonicalizeLedgerJsonValue(value))
}

export function getLedgerSha256(value: string | Uint8Array): string {
  return createHash('sha256').update(value).digest('hex')
}

function compareStrings(left: string, right: string): number {
  return left === right ? 0 : left < right ? -1 : 1
}

function compareNumbers(left: number, right: number): number {
  return left === right ? 0 : left < right ? -1 : 1
}

function assertNonEmptyString(value: unknown, label: string): asserts value is string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${label} must be a non-empty string`)
  }
}

function assertSafeInteger(value: unknown, label: string, minimum = 0): asserts value is number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < minimum) {
    throw new Error(`${label} must be a safe integer greater than or equal to ${minimum}`)
  }
}

function assertSha256(value: unknown, label: string): asserts value is string {
  if (typeof value !== 'string' || !SHA256_PATTERN.test(value)) {
    throw new Error(`${label} must be a lowercase SHA-256 digest`)
  }
}

function assertEvmAddress(value: unknown, label: string): asserts value is string {
  if (typeof value !== 'string' || !EVM_ADDRESS_PATTERN.test(value)) {
    throw new Error(`${label} must be a 0x-prefixed EVM address`)
  }
}

function assertStreamSourceFields(stream: TLedgerStream, source: TLedgerJsonObject): void {
  const configuration = STREAM_SOURCE_FIELDS[stream]
  configuration.required.map((field) => assertNonEmptyString(source[field], `Ledger ${stream} ${field}`))
  configuration.addresses.map((field) => assertEvmAddress(source[field], `Ledger ${stream} ${field}`))
}

function canonicalizeSourceEvent(event: TLedgerSourceEvent, stream: TLedgerStream): TNormalizedSourceEvent {
  const source = canonicalizeLedgerJsonValue(event)
  if (!isPlainObject(source)) {
    throw new Error('Ledger source event must be a JSON object')
  }
  assertNonEmptyString(source.id, 'Ledger event id')
  assertNonEmptyString(source.vaultAddress, 'Ledger vault address')
  assertSafeInteger(source.chainId, 'Ledger chain id', 1)
  assertSafeInteger(source.blockNumber, 'Ledger block number')
  assertSafeInteger(source.blockTimestamp, 'Ledger block timestamp')
  assertSafeInteger(source.logIndex, 'Ledger log index')
  if (typeof source.transactionHash !== 'string' || !EVM_TRANSACTION_HASH_PATTERN.test(source.transactionHash)) {
    throw new Error('Ledger transaction hash must be a 0x-prefixed 32-byte hash')
  }
  assertStreamSourceFields(stream, source)
  return {
    id: source.id,
    vaultAddress: source.vaultAddress,
    chainId: source.chainId,
    blockNumber: source.blockNumber,
    blockTimestamp: source.blockTimestamp,
    logIndex: source.logIndex,
    transactionHash: source.transactionHash,
    source,
    sourceJson: stringifyCanonicalValue(source)
  }
}

function getFamilyFromCode(familyCode: number): TLedgerEventFamily {
  const family = LEDGER_EVENT_FAMILIES[familyCode]
  if (!family) {
    throw new Error(`Ledger family code ${familyCode} is unsupported`)
  }
  return family
}

export function getLedgerSourceIdentity(family: TLedgerEventFamily, chainId: number, id: string): string {
  assertSafeInteger(chainId, 'Ledger identity chain id', 1)
  assertNonEmptyString(id, 'Ledger identity event id')
  return stringifyCanonicalLedgerValue([family, chainId, id])
}

export function getCanonicalLedgerTupleIdentity(tuple: TLedgerCanonicalTupleV1): string {
  return getLedgerSourceIdentity(getFamilyFromCode(tuple[1]), tuple[5], tuple[3])
}

function parseLedgerSourceIdentity(identity: string): readonly [TLedgerEventFamily, number, string] {
  assertNonEmptyString(identity, 'Ledger source identity')
  const parsed = (() => {
    try {
      return JSON.parse(identity) as unknown
    } catch {
      throw new Error('Ledger source identity must be canonical JSON')
    }
  })()
  if (
    !Array.isArray(parsed) ||
    parsed.length !== 3 ||
    typeof parsed[0] !== 'string' ||
    !LEDGER_EVENT_FAMILIES.includes(parsed[0] as TLedgerEventFamily)
  ) {
    throw new Error('Ledger source identity has an unsupported shape')
  }
  assertSafeInteger(parsed[1], 'Ledger source identity chain id', 1)
  assertNonEmptyString(parsed[2], 'Ledger source identity event id')
  if (stringifyCanonicalLedgerValue(parsed) !== identity) {
    throw new Error('Ledger source identity must be canonical JSON')
  }
  return parsed as [TLedgerEventFamily, number, string]
}

export function getCanonicalLedgerTupleOrder(tuple: TLedgerCanonicalTupleV1): TLedgerOrderKey {
  return [tuple[7], tuple[6], tuple[8], tuple[3]]
}

function compareLedgerOrderKeys(left: TLedgerOrderKey, right: TLedgerOrderKey): number {
  return (
    compareNumbers(left[0], right[0]) ||
    compareNumbers(left[1], right[1]) ||
    compareNumbers(left[2], right[2]) ||
    compareStrings(left[3], right[3])
  )
}

export function compareCanonicalLedgerTuples(left: TLedgerCanonicalTupleV1, right: TLedgerCanonicalTupleV1): number {
  return (
    compareLedgerOrderKeys(getCanonicalLedgerTupleOrder(left), getCanonicalLedgerTupleOrder(right)) ||
    compareNumbers(left[1], right[1]) ||
    compareNumbers(left[5], right[5]) ||
    compareNumbers(left[2], right[2]) ||
    compareStrings(stringifyCanonicalValue(left), stringifyCanonicalValue(right))
  )
}

function getSourcePosition(source: TNormalizedSourceEvent): string {
  return stringifyCanonicalLedgerValue([
    source.id,
    source.vaultAddress,
    source.chainId,
    source.blockNumber,
    source.blockTimestamp,
    source.logIndex,
    source.transactionHash
  ])
}

function buildNonTransferTuples(
  stream: TLedgerStream,
  family: TLedgerEventFamily,
  familyCode: TLedgerNonTransferFamilyCode,
  events: readonly TLedgerSourceEvent[]
): TLedgerCanonicalNonTransferTupleV1[] {
  const byIdentity = events.reduce<Map<string, TNormalizedSourceEvent>>((records, event) => {
    const source = canonicalizeSourceEvent(event, stream)
    const identity = getLedgerSourceIdentity(family, source.chainId, source.id)
    const existing = records.get(identity)
    if (existing && existing.sourceJson !== source.sourceJson) {
      throw new Error(`Ledger source contains conflicting records at identity ${identity}`)
    }
    records.set(identity, existing ?? source)
    return records
  }, new Map())

  return Array.from(byIdentity.values()).map(
    (source): TLedgerCanonicalNonTransferTupleV1 => [
      LEDGER_SCHEMA_VERSION,
      familyCode,
      LEDGER_TRANSFER_DIRECTIONS.none,
      source.id,
      source.vaultAddress,
      source.chainId,
      source.blockNumber,
      source.blockTimestamp,
      source.logIndex,
      source.transactionHash,
      source.source
    ]
  )
}

function mergeTransferDirection(
  records: Map<string, TTransferAccumulator>,
  event: TLedgerSourceEvent,
  direction: 'in' | 'out'
): Map<string, TTransferAccumulator> {
  const stream = direction === 'in' ? 'transfersIn' : 'transfersOut'
  const source = canonicalizeSourceEvent(event, stream)
  const identity = getLedgerSourceIdentity('transfer', source.chainId, source.id)
  const existing = records.get(identity)
  if (
    existing &&
    (getSourcePosition(existing) !== getSourcePosition(source) || existing.sourceJson !== source.sourceJson)
  ) {
    throw new Error(`Ledger transfer directions contain conflicting payloads at identity ${identity}`)
  }
  const directionBit = direction === 'in' ? LEDGER_TRANSFER_DIRECTIONS.in : LEDGER_TRANSFER_DIRECTIONS.out
  records.set(identity, {
    ...(existing ?? source),
    direction: ((existing?.direction ?? 0) | directionBit) as TLedgerTransferDirection
  })
  return records
}

function buildTransferTuples(streams: TLedgerSixStreams): TLedgerCanonicalTransferTupleV1[] {
  const withIncoming = streams.transfersIn.reduce(
    (records, event) => mergeTransferDirection(records, event, 'in'),
    new Map<string, TTransferAccumulator>()
  )
  const merged = streams.transfersOut.reduce(
    (records, event) => mergeTransferDirection(records, event, 'out'),
    withIncoming
  )

  return Array.from(merged.values()).map((source): TLedgerCanonicalTransferTupleV1 => {
    return [
      LEDGER_SCHEMA_VERSION,
      LEDGER_EVENT_FAMILY_CODES.transfer,
      source.direction,
      source.id,
      source.vaultAddress,
      source.chainId,
      source.blockNumber,
      source.blockTimestamp,
      source.logIndex,
      source.transactionHash,
      source.source
    ]
  })
}

function assertUniqueTupleIdentities(tuples: readonly TLedgerCanonicalTupleV1[]): void {
  tuples.reduce((identities, tuple) => {
    const identity = getCanonicalLedgerTupleIdentity(tuple)
    if (identities.has(identity)) {
      throw new Error(`Ledger tuples contain duplicate identity ${identity}`)
    }
    identities.add(identity)
    return identities
  }, new Set<string>())
}

export function canonicalizeLedgerStreams(streams: TLedgerSixStreams): TLedgerCanonicalTupleV1[] {
  const nonTransfers = NON_TRANSFER_STREAMS.flatMap((configuration) =>
    buildNonTransferTuples(
      configuration.stream,
      configuration.family,
      configuration.familyCode,
      streams[configuration.stream]
    )
  )
  const tuples = [...nonTransfers, ...buildTransferTuples(streams)].toSorted(compareCanonicalLedgerTuples)
  assertUniqueTupleIdentities(tuples)
  return tuples
}

function assertSourceMatchesTuple<TStream extends TLedgerStream>(
  source: TLedgerJsonObject,
  tuple: TLedgerCanonicalTupleV1,
  stream: TStream
): TLedgerSixStreams[TStream][number] {
  const normalized = canonicalizeSourceEvent(source as TLedgerSourceEvent, stream)
  if (
    normalized.id !== tuple[3] ||
    normalized.vaultAddress !== tuple[4] ||
    normalized.chainId !== tuple[5] ||
    normalized.blockNumber !== tuple[6] ||
    normalized.blockTimestamp !== tuple[7] ||
    normalized.logIndex !== tuple[8] ||
    normalized.transactionHash !== tuple[9]
  ) {
    throw new Error(
      `Ledger tuple fields disagree with source payload at identity ${getCanonicalLedgerTupleIdentity(tuple)}`
    )
  }
  return normalized.source as TLedgerSixStreams[TStream][number]
}

export function decodeCanonicalLedgerTuples(tuples: readonly TLedgerCanonicalTupleV1[]): TLedgerSixStreams {
  const sorted = [...tuples].toSorted(compareCanonicalLedgerTuples)
  assertUniqueTupleIdentities(sorted)
  return {
    v3Deposits: sorted
      .filter((tuple) => tuple[1] === LEDGER_EVENT_FAMILY_CODES['v3-deposit'])
      .map((tuple) => assertSourceMatchesTuple(tuple[10] as TLedgerJsonObject, tuple, 'v3Deposits')),
    v3Withdrawals: sorted
      .filter((tuple) => tuple[1] === LEDGER_EVENT_FAMILY_CODES['v3-withdrawal'])
      .map((tuple) => assertSourceMatchesTuple(tuple[10] as TLedgerJsonObject, tuple, 'v3Withdrawals')),
    v2Deposits: sorted
      .filter((tuple) => tuple[1] === LEDGER_EVENT_FAMILY_CODES['v2-deposit'])
      .map((tuple) => assertSourceMatchesTuple(tuple[10] as TLedgerJsonObject, tuple, 'v2Deposits')),
    v2Withdrawals: sorted
      .filter((tuple) => tuple[1] === LEDGER_EVENT_FAMILY_CODES['v2-withdrawal'])
      .map((tuple) => assertSourceMatchesTuple(tuple[10] as TLedgerJsonObject, tuple, 'v2Withdrawals')),
    transfersIn: sorted.flatMap((tuple) => {
      if (tuple[1] !== LEDGER_EVENT_FAMILY_CODES.transfer || !(tuple[2] & LEDGER_TRANSFER_DIRECTIONS.in)) {
        return []
      }
      return [assertSourceMatchesTuple(tuple[10], tuple, 'transfersIn')]
    }),
    transfersOut: sorted.flatMap((tuple) => {
      if (tuple[1] !== LEDGER_EVENT_FAMILY_CODES.transfer || !(tuple[2] & LEDGER_TRANSFER_DIRECTIONS.out)) {
        return []
      }
      return [assertSourceMatchesTuple(tuple[10], tuple, 'transfersOut')]
    })
  }
}

export function getLedgerUtcMonth(blockTimestamp: number): string {
  return getLedgerUtcDate(blockTimestamp).slice(0, 7)
}

function getLedgerUtcDate(blockTimestamp: number): string {
  assertSafeInteger(blockTimestamp, 'Ledger block timestamp')
  const date = new Date(blockTimestamp * 1000)
  if (!Number.isFinite(date.getTime())) {
    throw new Error('Ledger block timestamp is outside the supported date range')
  }
  return date.toISOString().slice(0, 10)
}

function encodeCanonicalBlob(value: unknown): TEncodedCanonicalBlob {
  const json = stringifyCanonicalLedgerValue(value)
  const decoded = Buffer.from(json, 'utf8')
  const compressed = brotliCompressSync(decoded, {
    params: {
      [zlibConstants.BROTLI_PARAM_QUALITY]: 4
    }
  })
  const data = compressed.toString('base64')
  return {
    data,
    encodedBytes: Buffer.byteLength(data, 'utf8'),
    decodedBytes: decoded.length,
    checksum: getLedgerSha256(decoded),
    json
  }
}

function decodeCanonicalBlob(
  data: string,
  maximumEncodedBytes: number,
  maximumDecodedBytes: number,
  label: string
): TEncodedCanonicalBlob {
  if (typeof data !== 'string') {
    throw new Error(`${label} must be an encoded string`)
  }
  const encodedBytes = Buffer.byteLength(data, 'utf8')
  if (encodedBytes > maximumEncodedBytes) {
    throw new Error(`${label} exceeds the encoded byte limit`)
  }
  const compressed = Buffer.from(data, 'base64')
  if (compressed.toString('base64') !== data) {
    throw new Error(`${label} is not canonical base64`)
  }
  const decoded = (() => {
    try {
      return brotliDecompressSync(compressed, { maxOutputLength: maximumDecodedBytes })
    } catch {
      throw new Error(`${label} is not valid Brotli data`)
    }
  })()
  const json = decoded.toString('utf8')
  const parsed = (() => {
    try {
      return JSON.parse(json) as unknown
    } catch {
      throw new Error(`${label} does not contain valid JSON`)
    }
  })()
  if (stringifyCanonicalLedgerValue(parsed) !== json) {
    throw new Error(`${label} JSON is not canonical`)
  }
  return {
    data,
    encodedBytes,
    decodedBytes: decoded.length,
    checksum: getLedgerSha256(decoded),
    json
  }
}

function buildTupleGroups(tuples: readonly TLedgerCanonicalTupleV1[]): TLedgerTupleGroup[] {
  const groups = tuples.reduce<Map<string, TLedgerTupleGroup>>((result, tuple) => {
    const family = getFamilyFromCode(tuple[1])
    const month = getLedgerUtcMonth(tuple[7])
    const key = stringifyCanonicalLedgerValue([family, tuple[5], month])
    const existing = result.get(key)
    if (existing) {
      existing.records.push(tuple)
    } else {
      result.set(key, { family, chainId: tuple[5], month, records: [tuple] })
    }
    return result
  }, new Map())

  return Array.from(groups.values())
    .map((group) => ({ ...group, records: group.records.toSorted(compareCanonicalLedgerTuples) }))
    .toSorted(
      (left, right) =>
        compareNumbers(LEDGER_EVENT_FAMILIES.indexOf(left.family), LEDGER_EVENT_FAMILIES.indexOf(right.family)) ||
        compareNumbers(left.chainId, right.chainId) ||
        compareStrings(left.month, right.month)
    )
}

function prepareChunk(
  family: TLedgerEventFamily,
  chainId: number,
  month: string,
  records: readonly TLedgerCanonicalTupleV1[]
): TPreparedChunk {
  const payload: TLedgerChunkPayloadV1 = [LEDGER_SCHEMA_VERSION, family, chainId, month, records]
  return { ...encodeCanonicalBlob(payload), records }
}

function findLargestFittingChunk(
  family: TLedgerEventFamily,
  chainId: number,
  month: string,
  records: readonly TLedgerCanonicalTupleV1[],
  minimum: number,
  maximum: number,
  best: TPreparedChunk | null
): TPreparedChunk | null {
  if (minimum > maximum) {
    return best
  }
  const midpoint = Math.floor((minimum + maximum) / 2)
  const candidate = prepareChunk(family, chainId, month, records.slice(0, midpoint))
  return candidate.encodedBytes <= LEDGER_MAX_ENCODED_CHUNK_BYTES &&
    candidate.decodedBytes <= LEDGER_MAX_DECODED_CHUNK_BYTES
    ? findLargestFittingChunk(family, chainId, month, records, midpoint + 1, maximum, candidate)
    : findLargestFittingChunk(family, chainId, month, records, minimum, midpoint - 1, best)
}

function encodeChunkGroup(
  group: TLedgerTupleGroup,
  remaining: readonly TLedgerCanonicalTupleV1[] = group.records,
  part = 0,
  encoded: readonly TEncodedLedgerChunkV1[] = []
): TEncodedLedgerChunkV1[] {
  if (remaining.length === 0) {
    return [...encoded]
  }
  const candidateRecords = remaining.slice(0, LEDGER_MAX_CHUNK_RECORDS)
  const prepared = findLargestFittingChunk(
    group.family,
    group.chainId,
    group.month,
    candidateRecords,
    1,
    candidateRecords.length,
    null
  )
  if (!prepared) {
    throw new Error(`Ledger record exceeds the ${LEDGER_MAX_ENCODED_CHUNK_BYTES}-byte encoded chunk limit`)
  }
  const first = prepared.records[0]
  const last = prepared.records.at(-1)
  if (!first || !last) {
    throw new Error('Ledger chunks cannot be empty')
  }
  const descriptor: TLedgerChunkDescriptorV1 = {
    schemaVersion: LEDGER_SCHEMA_VERSION,
    codec: LEDGER_CODEC_NAME,
    family: group.family,
    chainId: group.chainId,
    month: group.month,
    part,
    recordCount: prepared.records.length,
    encodedBytes: prepared.encodedBytes,
    decodedBytes: prepared.decodedBytes,
    checksum: prepared.checksum,
    firstOrder: getCanonicalLedgerTupleOrder(first),
    lastOrder: getCanonicalLedgerTupleOrder(last)
  }
  return encodeChunkGroup(group, remaining.slice(prepared.records.length), part + 1, [
    ...encoded,
    { descriptor, data: prepared.data }
  ])
}

function sumEncodedChunkBytes(chunks: readonly TEncodedLedgerChunkV1[]): number {
  return chunks.reduce((total, chunk) => total + chunk.descriptor.encodedBytes, 0)
}

function sumDecodedChunkBytes(chunks: readonly TEncodedLedgerChunkV1[]): number {
  return chunks.reduce((total, chunk) => total + chunk.descriptor.decodedBytes, 0)
}

export function encodeCanonicalLedgerChunks(tuples: readonly TLedgerCanonicalTupleV1[]): TEncodedLedgerChunkV1[] {
  const sorted = [...tuples].toSorted(compareCanonicalLedgerTuples)
  assertUniqueTupleIdentities(sorted)
  const chunks = buildTupleGroups(sorted).flatMap((group) => encodeChunkGroup(group))
  if (sumEncodedChunkBytes(chunks) > LEDGER_MAX_ACTIVE_REVISION_BYTES) {
    throw new Error('Ledger chunks exceed the active revision byte limit')
  }
  if (sumDecodedChunkBytes(chunks) > LEDGER_MAX_ACTIVE_REVISION_DECODED_BYTES) {
    throw new Error('Ledger chunks exceed the active revision decoded byte limit')
  }
  return chunks
}

export function encodeLedgerChunks(streams: TLedgerSixStreams): TEncodedLedgerChunkV1[] {
  return encodeCanonicalLedgerChunks(canonicalizeLedgerStreams(streams))
}

function assertOrderKey(value: unknown, label: string): asserts value is TLedgerOrderKey {
  if (!Array.isArray(value) || value.length !== 4) {
    throw new Error(`${label} must contain timestamp, block, log index, and id`)
  }
  assertSafeInteger(value[0], `${label} timestamp`)
  assertSafeInteger(value[1], `${label} block number`)
  assertSafeInteger(value[2], `${label} log index`)
  assertNonEmptyString(value[3], `${label} id`)
}

function parseCanonicalTuple(value: unknown): TLedgerCanonicalTupleV1 {
  if (!Array.isArray(value) || value.length !== 11) {
    throw new Error('Ledger canonical tuple must have eleven fields')
  }
  if (value[0] !== LEDGER_SCHEMA_VERSION) {
    throw new Error('Ledger canonical tuple schema version is unsupported')
  }
  assertSafeInteger(value[1], 'Ledger tuple family code')
  assertSafeInteger(value[2], 'Ledger tuple direction')
  assertNonEmptyString(value[3], 'Ledger tuple id')
  assertNonEmptyString(value[4], 'Ledger tuple vault address')
  assertSafeInteger(value[5], 'Ledger tuple chain id', 1)
  assertSafeInteger(value[6], 'Ledger tuple block number')
  assertSafeInteger(value[7], 'Ledger tuple block timestamp')
  assertSafeInteger(value[8], 'Ledger tuple log index')
  assertNonEmptyString(value[9], 'Ledger tuple transaction hash')
  if (value[1] >= 0 && value[1] <= 3) {
    if (value[2] !== LEDGER_TRANSFER_DIRECTIONS.none || !isPlainObject(value[10])) {
      throw new Error('Ledger non-transfer tuple has invalid direction or source payload')
    }
    const tuple = value as unknown as TLedgerCanonicalNonTransferTupleV1
    const stream = NON_TRANSFER_STREAMS.find((configuration) => configuration.familyCode === value[1])?.stream
    if (!stream) {
      throw new Error('Ledger non-transfer tuple family is unsupported')
    }
    assertSourceMatchesTuple(value[10] as TLedgerJsonObject, tuple, stream)
    return tuple
  }
  if (value[1] !== LEDGER_EVENT_FAMILY_CODES.transfer || ![1, 2, 3].includes(value[2])) {
    throw new Error('Ledger transfer tuple has invalid family or direction')
  }
  if (!isPlainObject(value[10])) {
    throw new Error('Ledger transfer tuple must contain one canonical source payload')
  }
  const tuple = value as unknown as TLedgerCanonicalTransferTupleV1
  assertSourceMatchesTuple(value[10] as TLedgerJsonObject, tuple, 'transfersIn')
  return tuple
}

function assertChunkDescriptor(descriptor: TLedgerChunkDescriptorV1, isReference = false): void {
  assertExactObjectKeys(
    descriptor,
    isReference ? [...CHUNK_DESCRIPTOR_FIELDS, 'key'] : CHUNK_DESCRIPTOR_FIELDS,
    'Ledger chunk descriptor'
  )
  if (descriptor.schemaVersion !== LEDGER_SCHEMA_VERSION || descriptor.codec !== LEDGER_CODEC_NAME) {
    throw new Error('Ledger chunk descriptor version or codec is unsupported')
  }
  if (!LEDGER_EVENT_FAMILIES.includes(descriptor.family) || !UTC_MONTH_PATTERN.test(descriptor.month)) {
    throw new Error('Ledger chunk descriptor family or UTC month is invalid')
  }
  assertSafeInteger(descriptor.chainId, 'Ledger chunk descriptor chain id', 1)
  assertSafeInteger(descriptor.part, 'Ledger chunk descriptor part')
  assertSafeInteger(descriptor.recordCount, 'Ledger chunk descriptor record count', 1)
  assertSafeInteger(descriptor.encodedBytes, 'Ledger chunk descriptor encoded bytes', 1)
  assertSafeInteger(descriptor.decodedBytes, 'Ledger chunk descriptor decoded bytes', 1)
  assertSha256(descriptor.checksum, 'Ledger chunk descriptor checksum')
  assertOrderKey(descriptor.firstOrder, 'Ledger chunk first order')
  assertOrderKey(descriptor.lastOrder, 'Ledger chunk last order')
  if (compareLedgerOrderKeys(descriptor.firstOrder, descriptor.lastOrder) > 0) {
    throw new Error('Ledger chunk descriptor order bounds are inconsistent')
  }
  if (descriptor.recordCount > LEDGER_MAX_CHUNK_RECORDS || descriptor.encodedBytes > LEDGER_MAX_ENCODED_CHUNK_BYTES) {
    throw new Error('Ledger chunk descriptor exceeds record or encoded byte limits')
  }
  if (descriptor.decodedBytes > LEDGER_MAX_DECODED_CHUNK_BYTES) {
    throw new Error('Ledger chunk descriptor exceeds the decoded byte limit')
  }
}

export function decodeLedgerChunk(chunk: TEncodedLedgerChunkV1): TLedgerCanonicalTupleV1[] {
  assertExactObjectKeys(chunk, ['descriptor', 'data'], 'Encoded ledger chunk')
  assertChunkDescriptor(chunk.descriptor)
  const decoded = decodeCanonicalBlob(
    chunk.data,
    LEDGER_MAX_ENCODED_CHUNK_BYTES,
    LEDGER_MAX_DECODED_CHUNK_BYTES,
    'Ledger chunk'
  )
  if (
    decoded.encodedBytes !== chunk.descriptor.encodedBytes ||
    decoded.decodedBytes !== chunk.descriptor.decodedBytes ||
    decoded.checksum !== chunk.descriptor.checksum
  ) {
    throw new Error('Ledger chunk content does not match its descriptor')
  }
  const payload = JSON.parse(decoded.json) as unknown
  if (!Array.isArray(payload) || payload.length !== 5 || !Array.isArray(payload[4])) {
    throw new Error('Ledger chunk payload shape is invalid')
  }
  if (
    payload[0] !== LEDGER_SCHEMA_VERSION ||
    payload[1] !== chunk.descriptor.family ||
    payload[2] !== chunk.descriptor.chainId ||
    payload[3] !== chunk.descriptor.month
  ) {
    throw new Error('Ledger chunk payload grouping does not match its descriptor')
  }
  const records = payload[4].map(parseCanonicalTuple).toSorted(compareCanonicalLedgerTuples)
  if (
    records.length !== chunk.descriptor.recordCount ||
    records.some(
      (record) =>
        getFamilyFromCode(record[1]) !== chunk.descriptor.family ||
        record[5] !== chunk.descriptor.chainId ||
        getLedgerUtcMonth(record[7]) !== chunk.descriptor.month
    )
  ) {
    throw new Error('Ledger chunk records do not match their descriptor grouping')
  }
  const first = records[0]
  const last = records.at(-1)
  if (
    !first ||
    !last ||
    compareLedgerOrderKeys(getCanonicalLedgerTupleOrder(first), chunk.descriptor.firstOrder) !== 0 ||
    compareLedgerOrderKeys(getCanonicalLedgerTupleOrder(last), chunk.descriptor.lastOrder) !== 0
  ) {
    throw new Error('Ledger chunk order bounds do not match its descriptor')
  }
  if (stringifyCanonicalLedgerValue(payload[4]) !== stringifyCanonicalLedgerValue(records)) {
    throw new Error('Ledger chunk records are not in canonical order')
  }
  return records
}

export function decodeLedgerChunks(chunks: readonly TEncodedLedgerChunkV1[]): TLedgerSixStreams {
  if (sumDecodedChunkBytes(chunks) > LEDGER_MAX_ACTIVE_REVISION_DECODED_BYTES) {
    throw new Error('Ledger chunks exceed the active revision decoded byte limit')
  }
  const tuples = chunks.toSorted(compareEncodedChunks).flatMap(decodeLedgerChunk).toSorted(compareCanonicalLedgerTuples)
  return decodeCanonicalLedgerTuples(tuples)
}

function isEncodedLedgerChunk(
  chunk: TCreateLedgerRevisionManifestInputV1['chunks'][number]
): chunk is TEncodedLedgerChunkV1 {
  return 'descriptor' in chunk && 'data' in chunk
}

function isEncodedLedgerIndexShard(
  index: TCreateLedgerRevisionManifestInputV1['indexes'][number]
): index is TEncodedLedgerIndexShardV1 {
  return 'descriptor' in index && 'data' in index
}

function compareChunkDescriptors(left: TLedgerChunkDescriptorV1, right: TLedgerChunkDescriptorV1): number {
  return (
    compareNumbers(LEDGER_EVENT_FAMILIES.indexOf(left.family), LEDGER_EVENT_FAMILIES.indexOf(right.family)) ||
    compareNumbers(left.chainId, right.chainId) ||
    compareStrings(left.month, right.month) ||
    compareNumbers(left.part, right.part) ||
    compareStrings(left.checksum, right.checksum)
  )
}

function compareEncodedChunks(left: TEncodedLedgerChunkV1, right: TEncodedLedgerChunkV1): number {
  return compareChunkDescriptors(left.descriptor, right.descriptor)
}

export function getLedgerIndexShard(identity: string): number {
  parseLedgerSourceIdentity(identity)
  return Number.parseInt(getLedgerSha256(identity).slice(0, 2), 16) % LEDGER_INDEX_SHARD_COUNT
}

function createLedgerIndexEntries(chunks: readonly TEncodedLedgerChunkV1[]): TLedgerIndexEntryV1[] {
  const entries = chunks.flatMap((chunk) =>
    decodeLedgerChunk(chunk).map(
      (tuple): TLedgerIndexEntryV1 => [getCanonicalLedgerTupleIdentity(tuple), chunk.descriptor.checksum]
    )
  )
  entries.reduce((identities, entry) => {
    if (identities.has(entry[0])) {
      throw new Error(`Ledger index contains duplicate identity ${entry[0]}`)
    }
    identities.add(entry[0])
    return identities
  }, new Set<string>())
  return entries
}

function encodeIndexShard(shard: number, entries: readonly TLedgerIndexEntryV1[]): TEncodedLedgerIndexShardV1 {
  const sortedEntries = [...entries].toSorted((left, right) => compareStrings(left[0], right[0]))
  const payload: TLedgerIndexShardPayloadV1 = [LEDGER_SCHEMA_VERSION, shard, sortedEntries]
  const encoded = encodeCanonicalBlob(payload)
  if (encoded.encodedBytes > LEDGER_MAX_ENCODED_INDEX_SHARD_BYTES) {
    throw new Error(`Ledger index shard ${shard} exceeds the encoded byte limit`)
  }
  if (encoded.decodedBytes > LEDGER_MAX_DECODED_INDEX_SHARD_BYTES) {
    throw new Error(`Ledger index shard ${shard} exceeds the decoded byte limit`)
  }
  const descriptor: TLedgerIndexShardDescriptorV1 = {
    schemaVersion: LEDGER_SCHEMA_VERSION,
    codec: LEDGER_CODEC_NAME,
    shard,
    entryCount: sortedEntries.length,
    encodedBytes: encoded.encodedBytes,
    decodedBytes: encoded.decodedBytes,
    checksum: encoded.checksum,
    firstIdentity: sortedEntries[0]?.[0] ?? null,
    lastIdentity: sortedEntries.at(-1)?.[0] ?? null
  }
  return { descriptor, data: encoded.data }
}

export function encodeLedgerIndexShards(chunks: readonly TEncodedLedgerChunkV1[]): TEncodedLedgerIndexShardV1[] {
  const shards = Array.from({ length: LEDGER_INDEX_SHARD_COUNT }, () => [] as TLedgerIndexEntryV1[])
  const grouped = createLedgerIndexEntries(chunks).reduce((result, entry) => {
    result[getLedgerIndexShard(entry[0])]?.push(entry)
    return result
  }, shards)
  const encoded = grouped.map((entries, shard) => encodeIndexShard(shard, entries))
  const encodedBytes = encoded.reduce((total, shard) => total + shard.descriptor.encodedBytes, 0)
  if (encodedBytes > LEDGER_MAX_ACTIVE_REVISION_BYTES) {
    throw new Error('Ledger index shards exceed the active revision byte limit')
  }
  return encoded
}

function assertIndexShardDescriptor(descriptor: TLedgerIndexShardDescriptorV1, isReference = false): void {
  assertExactObjectKeys(
    descriptor,
    isReference ? [...INDEX_DESCRIPTOR_FIELDS, 'key'] : INDEX_DESCRIPTOR_FIELDS,
    'Ledger index descriptor'
  )
  if (descriptor.schemaVersion !== LEDGER_SCHEMA_VERSION || descriptor.codec !== LEDGER_CODEC_NAME) {
    throw new Error('Ledger index descriptor version or codec is unsupported')
  }
  assertSafeInteger(descriptor.shard, 'Ledger index shard')
  assertSafeInteger(descriptor.entryCount, 'Ledger index entry count')
  assertSafeInteger(descriptor.encodedBytes, 'Ledger index encoded bytes', 1)
  assertSafeInteger(descriptor.decodedBytes, 'Ledger index decoded bytes', 1)
  assertSha256(descriptor.checksum, 'Ledger index checksum')
  if (descriptor.shard >= LEDGER_INDEX_SHARD_COUNT) {
    throw new Error('Ledger index shard is outside the supported range')
  }
  if (descriptor.encodedBytes > LEDGER_MAX_ENCODED_INDEX_SHARD_BYTES) {
    throw new Error('Ledger index descriptor exceeds the encoded byte limit')
  }
  if (descriptor.decodedBytes > LEDGER_MAX_DECODED_INDEX_SHARD_BYTES) {
    throw new Error('Ledger index descriptor exceeds the decoded byte limit')
  }
  if (
    (descriptor.entryCount === 0 && (descriptor.firstIdentity !== null || descriptor.lastIdentity !== null)) ||
    (descriptor.entryCount > 0 && (!descriptor.firstIdentity || !descriptor.lastIdentity))
  ) {
    throw new Error('Ledger index descriptor identity bounds are invalid')
  }
}

function parseIndexEntry(value: unknown): TLedgerIndexEntryV1 {
  if (!Array.isArray(value) || value.length !== 2) {
    throw new Error('Ledger index entry must have two fields')
  }
  assertNonEmptyString(value[0], 'Ledger index entry identity')
  parseLedgerSourceIdentity(value[0])
  assertSha256(value[1], 'Ledger index chunk checksum')
  return value as unknown as TLedgerIndexEntryV1
}

export function decodeLedgerIndexShard(shard: TEncodedLedgerIndexShardV1): TLedgerIndexEntryV1[] {
  assertExactObjectKeys(shard, ['descriptor', 'data'], 'Encoded ledger index shard')
  assertIndexShardDescriptor(shard.descriptor)
  const decoded = decodeCanonicalBlob(
    shard.data,
    LEDGER_MAX_ENCODED_INDEX_SHARD_BYTES,
    LEDGER_MAX_DECODED_INDEX_SHARD_BYTES,
    'Ledger index shard'
  )
  if (
    decoded.encodedBytes !== shard.descriptor.encodedBytes ||
    decoded.decodedBytes !== shard.descriptor.decodedBytes ||
    decoded.checksum !== shard.descriptor.checksum
  ) {
    throw new Error('Ledger index content does not match its descriptor')
  }
  const payload = JSON.parse(decoded.json) as unknown
  if (
    !Array.isArray(payload) ||
    payload.length !== 3 ||
    payload[0] !== LEDGER_SCHEMA_VERSION ||
    payload[1] !== shard.descriptor.shard ||
    !Array.isArray(payload[2])
  ) {
    throw new Error('Ledger index shard payload shape is invalid')
  }
  const entries = payload[2].map(parseIndexEntry)
  const sorted = entries.toSorted((left, right) => compareStrings(left[0], right[0]))
  if (
    entries.length !== shard.descriptor.entryCount ||
    stringifyCanonicalLedgerValue(entries) !== stringifyCanonicalLedgerValue(sorted) ||
    entries.some((entry) => getLedgerIndexShard(entry[0]) !== shard.descriptor.shard) ||
    (entries[0]?.[0] ?? null) !== shard.descriptor.firstIdentity ||
    (entries.at(-1)?.[0] ?? null) !== shard.descriptor.lastIdentity ||
    new Set(entries.map((entry) => entry[0])).size !== entries.length
  ) {
    throw new Error('Ledger index shard entries do not match their descriptor')
  }
  return entries
}

function compareCoverage(left: TLedgerStreamCoverageV1, right: TLedgerStreamCoverageV1): number {
  return (
    compareNumbers(LEDGER_STREAMS.indexOf(left.stream), LEDGER_STREAMS.indexOf(right.stream)) ||
    compareNumbers(left.chainId, right.chainId)
  )
}

function normalizeCoverage(coverage: readonly TLedgerStreamCoverageV1[]): TLedgerStreamCoverageV1[] {
  if (!Array.isArray(coverage)) {
    throw new Error('Ledger coverage must be an array')
  }
  const sorted = [...coverage].toSorted(compareCoverage)
  sorted.reduce((identities, entry) => {
    const identity = stringifyCanonicalLedgerValue([entry.stream, entry.chainId])
    if (identities.has(identity)) {
      throw new Error(`Ledger coverage contains duplicate stream and chain ${identity}`)
    }
    identities.add(identity)
    return identities
  }, new Set<string>())
  return sorted
}

function normalizeChainScope(chainScope: readonly number[]): number[] {
  if (!Array.isArray(chainScope)) {
    throw new Error('Ledger chain scope must be an array')
  }
  if (chainScope.length === 0) {
    throw new Error('Ledger chain scope must contain at least one chain')
  }
  const normalized = chainScope.map((chainId) => {
    assertSafeInteger(chainId, 'Ledger chain scope id', 1)
    return chainId
  })
  if (new Set(normalized).size !== normalized.length) {
    throw new Error('Ledger chain scope must contain unique chain ids')
  }
  return normalized.toSorted(compareNumbers)
}

function normalizeDependencies(
  dependencies: TCreateLedgerRevisionManifestInputV1['dependencies']
): TCreateLedgerRevisionManifestInputV1['dependencies'] {
  if (!Array.isArray(dependencies)) {
    throw new Error('Ledger dependencies must be an array')
  }
  const typedDependencies = dependencies as TCreateLedgerRevisionManifestInputV1['dependencies']
  const normalized = typedDependencies.map((dependency) => {
    assertExactObjectKeys(dependency, DEPENDENCY_FIELDS, 'Ledger dependency')
    assertNonEmptyString(dependency.address, 'Ledger dependency address')
    return {
      ...dependency,
      address: dependency.address.trim().toLowerCase()
    }
  })
  const unique = normalized.reduce((records, dependency) => {
    const identity = stringifyCanonicalLedgerValue([dependency.kind, dependency.chainId, dependency.address])
    const existing = records.get(identity)
    if (existing && stringifyCanonicalLedgerValue(existing) !== stringifyCanonicalLedgerValue(dependency)) {
      throw new Error('Ledger dependencies contain conflicting metadata for the same vault')
    }
    records.set(identity, existing ?? dependency)
    return records
  }, new Map<string, (typeof normalized)[number]>())
  return Array.from(unique.values()).toSorted(
    (left, right) =>
      compareStrings(left.kind, right.kind) ||
      compareNumbers(left.chainId, right.chainId) ||
      compareStrings(left.address, right.address) ||
      compareStrings(left.metadataRevision ?? '', right.metadataRevision ?? '') ||
      compareNumbers(left.firstEventTimestamp, right.firstEventTimestamp)
  )
}

function assertEpochs(epochs: TLedgerInvalidationEpochsV1): void {
  assertExactObjectKeys(epochs, INVALIDATION_EPOCH_FIELDS, 'Ledger invalidation epochs')
  assertSafeInteger(epochs.global, 'Ledger global invalidation epoch')
  assertSafeInteger(epochs.source, 'Ledger source invalidation epoch')
  assertSafeInteger(epochs.address, 'Ledger address invalidation epoch')
  assertSafeInteger(epochs.vault, 'Ledger vault invalidation epoch')
  assertSafeInteger(epochs.schema, 'Ledger schema invalidation epoch')
  assertSafeInteger(epochs.metadata, 'Ledger metadata invalidation epoch')
}

function assertCoverage(coverage: readonly TLedgerStreamCoverageV1[], chainScope: readonly number[]): void {
  if (coverage.length === 0) {
    throw new Error('Ledger coverage must describe all six streams for at least one chain scope')
  }
  const streamsByChain = coverage.reduce(
    (state, entry) => {
      assertExactObjectKeys(entry, COVERAGE_FIELDS, 'Ledger stream coverage')
      if (!LEDGER_STREAMS.includes(entry.stream) || !['complete', 'valid_empty'].includes(entry.status)) {
        throw new Error('Ledger coverage stream or status is unsupported')
      }
      assertSafeInteger(entry.chainId, 'Ledger coverage chain id', 1)
      assertSafeInteger(entry.coverageStartTimestamp, 'Ledger coverage start timestamp')
      assertSafeInteger(entry.completeThroughTimestamp, 'Ledger coverage complete-through timestamp')
      assertSafeInteger(entry.coverageStartBlock, 'Ledger coverage start block')
      assertSafeInteger(entry.completeThroughBlock, 'Ledger coverage complete-through block')
      assertSafeInteger(entry.count, 'Ledger coverage count')
      assertSha256(entry.checksum, 'Ledger coverage checksum')
      if (entry.coverageStartTimestamp > entry.completeThroughTimestamp) {
        throw new Error('Ledger coverage start cannot be after its complete-through timestamp')
      }
      if (entry.coverageStartBlock > entry.completeThroughBlock) {
        throw new Error('Ledger coverage start cannot be after its complete-through block')
      }
      if (!['pinned', 'observed', 'unpinned'].includes(entry.checkpointState)) {
        throw new Error('Ledger coverage checkpoint state is unsupported')
      }
      if (
        (entry.checkpointState === 'unpinned' && entry.checkpoint !== null) ||
        (entry.checkpointState !== 'unpinned' && (typeof entry.checkpoint !== 'string' || !entry.checkpoint))
      ) {
        throw new Error('Ledger coverage checkpoint does not match its checkpoint state')
      }
      if (entry.status === 'valid_empty' && (entry.count !== 0 || entry.cursor !== null)) {
        throw new Error('Ledger valid-empty coverage must have zero count and no cursor')
      }
      if (entry.status === 'complete' && (entry.count === 0 || entry.cursor === null)) {
        throw new Error('Ledger complete coverage must contain at least one record and a cursor')
      }
      if (entry.cursor) {
        assertExactObjectKeys(entry.cursor, CURSOR_FIELDS, 'Ledger coverage cursor')
        assertSafeInteger(entry.cursor.blockTimestamp, 'Ledger coverage cursor timestamp')
        assertSafeInteger(entry.cursor.blockNumber, 'Ledger coverage cursor block number')
        assertSafeInteger(entry.cursor.logIndex, 'Ledger coverage cursor log index')
        assertNonEmptyString(entry.cursor.id, 'Ledger coverage cursor id')
        if (
          entry.cursor.blockTimestamp < entry.coverageStartTimestamp ||
          entry.cursor.blockTimestamp > entry.completeThroughTimestamp
        ) {
          throw new Error('Ledger coverage cursor timestamp must be inside its coverage bounds')
        }
        if (
          entry.cursor.blockNumber < entry.coverageStartBlock ||
          entry.cursor.blockNumber > entry.completeThroughBlock
        ) {
          throw new Error('Ledger coverage cursor block number must be inside its coverage bounds')
        }
      }
      const identity = stringifyCanonicalLedgerValue([entry.stream, entry.chainId])
      if (state.identities.has(identity)) {
        throw new Error('Ledger coverage stream and chain pairs must be unique')
      }
      state.identities.add(identity)
      const chainStreams = state.streamsByChain.get(entry.chainId) ?? new Set<TLedgerStream>()
      chainStreams.add(entry.stream)
      state.streamsByChain.set(entry.chainId, chainStreams)
      return state
    },
    { identities: new Set<string>(), streamsByChain: new Map<number, Set<TLedgerStream>>() }
  ).streamsByChain
  Array.from(streamsByChain.entries()).map(([chainId, streams]) => {
    if (streams.size !== LEDGER_STREAMS.length || LEDGER_STREAMS.some((stream) => !streams.has(stream))) {
      throw new Error(`Ledger coverage for chain scope ${chainId} must contain all six streams`)
    }
    return chainId
  })
  if (
    streamsByChain.size !== chainScope.length ||
    chainScope.some((chainId) => !streamsByChain.has(chainId)) ||
    Array.from(streamsByChain.keys()).some((chainId) => !chainScope.includes(chainId))
  ) {
    throw new Error('Ledger coverage chain scopes must exactly match the manifest chain scope')
  }
}

function assertCoverageMatchesLedger(
  coverage: readonly TLedgerStreamCoverageV1[],
  chainScope: readonly number[],
  streams: TLedgerSixStreams
): void {
  const eventsOutsideScope = LEDGER_STREAMS.some((stream) =>
    streams[stream].some((event) => !chainScope.includes(event.chainId))
  )
  if (eventsOutsideScope) {
    throw new Error('Ledger events must belong to the manifest chain scope')
  }
  coverage.map((entry) => {
    const events = streams[entry.stream].filter((event) => event.chainId === entry.chainId).toSorted(compareLedgerOrder)
    const last = events.at(-1)
    const expectedCursor = last
      ? {
          blockTimestamp: last.blockTimestamp,
          blockNumber: last.blockNumber,
          logIndex: last.logIndex,
          id: last.id
        }
      : null
    const expectedChecksum = getLedgerSha256(stringifyCanonicalLedgerValue([entry.stream, entry.chainId, events]))
    if (
      entry.count !== events.length ||
      entry.status !== (last ? 'complete' : 'valid_empty') ||
      entry.checksum !== expectedChecksum ||
      stringifyCanonicalLedgerValue(entry.cursor) !== stringifyCanonicalLedgerValue(expectedCursor)
    ) {
      throw new Error('Ledger coverage count, status, checksum, or cursor does not match the canonical streams')
    }
    if (
      events.some(
        (event) =>
          event.blockTimestamp < entry.coverageStartTimestamp || event.blockTimestamp > entry.completeThroughTimestamp
      )
    ) {
      throw new Error('Ledger event timestamps must be inside their declared coverage bounds')
    }
    if (
      events.some(
        (event) => event.blockNumber < entry.coverageStartBlock || event.blockNumber > entry.completeThroughBlock
      )
    ) {
      throw new Error('Ledger event block numbers must be inside their declared coverage bounds')
    }
    return entry
  })
}

function assertChunkRefs(walletHash: string, chunks: readonly TLedgerChunkRefV1[]): void {
  if (!Array.isArray(chunks)) {
    throw new Error('Ledger chunk refs must be an array')
  }
  const identities = new Set<string>()
  chunks.reduce((groups, chunk) => {
    assertChunkDescriptor(chunk, true)
    if (chunk.key !== getLedgerChunkKey(walletHash, chunk.checksum)) {
      throw new Error('Ledger chunk ref key is not content-addressed by its checksum')
    }
    if (identities.has(chunk.key) || identities.has(chunk.checksum)) {
      throw new Error('Ledger chunk refs must have unique keys and checksums')
    }
    identities.add(chunk.key)
    identities.add(chunk.checksum)
    const group = stringifyCanonicalLedgerValue([chunk.family, chunk.chainId, chunk.month])
    const state = groups.get(group) ?? { nextPart: 0, lastOrder: null }
    if (chunk.part !== state.nextPart) {
      throw new Error('Ledger chunk parts must be contiguous within each family, chain, and month')
    }
    if (state.lastOrder && compareLedgerOrderKeys(state.lastOrder, chunk.firstOrder) >= 0) {
      throw new Error('Ledger chunk parts must have strictly increasing non-overlapping order bounds')
    }
    groups.set(group, { nextPart: state.nextPart + 1, lastOrder: chunk.lastOrder })
    return groups
  }, new Map<string, { readonly nextPart: number; readonly lastOrder: TLedgerOrderKey | null }>())
}

function assertIndexRefs(walletHash: string, indexes: readonly TLedgerIndexShardRefV1[]): void {
  if (!Array.isArray(indexes)) {
    throw new Error('Ledger index refs must be an array')
  }
  if (indexes.length !== LEDGER_INDEX_SHARD_COUNT) {
    throw new Error(`Ledger manifest must reference exactly ${LEDGER_INDEX_SHARD_COUNT} index shards`)
  }
  const identities = new Set<string>()
  indexes.reduce((expectedShard, index) => {
    assertIndexShardDescriptor(index, true)
    if (index.shard !== expectedShard) {
      throw new Error('Ledger index shard refs must be contiguous and sorted')
    }
    if (index.key !== getLedgerIndexShardKey(walletHash, index.shard, index.checksum)) {
      throw new Error('Ledger index shard ref key is not content-addressed by its checksum')
    }
    if (identities.has(index.key) || identities.has(index.checksum)) {
      throw new Error('Ledger index shard refs must have unique keys and checksums')
    }
    identities.add(index.key)
    identities.add(index.checksum)
    return expectedShard + 1
  }, 0)
}

function assertDirtyMetadata(
  dirtyFromTimestamp: number | null,
  dirtyFromDate: string | null,
  dirtyReasons: TLedgerRevisionManifestV1['dirtyReasons']
): void {
  if (!Array.isArray(dirtyReasons)) {
    throw new Error('Ledger dirty reasons must be an array')
  }
  if (dirtyFromTimestamp !== null) {
    assertSafeInteger(dirtyFromTimestamp, 'Ledger dirty-from timestamp')
  }
  if (
    (dirtyFromTimestamp === null && dirtyFromDate !== null) ||
    (dirtyFromTimestamp !== null &&
      (typeof dirtyFromDate !== 'string' ||
        !UTC_DATE_PATTERN.test(dirtyFromDate) ||
        getLedgerUtcDate(dirtyFromTimestamp) !== dirtyFromDate))
  ) {
    throw new Error('Ledger dirty-from timestamp and date are inconsistent')
  }
  if (
    new Set(dirtyReasons).size !== dirtyReasons.length ||
    dirtyReasons.some((reason) => !LEDGER_DIRTY_REASON_CODES.includes(reason)) ||
    stringifyCanonicalLedgerValue(dirtyReasons) !== stringifyCanonicalLedgerValue([...dirtyReasons].toSorted())
  ) {
    throw new Error('Ledger dirty reasons must be supported, unique, and sorted')
  }
  if (
    (dirtyFromTimestamp === null && dirtyReasons.length !== 0) ||
    (dirtyFromTimestamp !== null && dirtyReasons.length === 0)
  ) {
    throw new Error('Ledger dirty reasons must be present exactly when a dirty timestamp is present')
  }
}

function assertRevisionTimestamps(createdAtMs: number, updatedAtMs: number, reconciledAtMs: number): void {
  assertSafeInteger(createdAtMs, 'Ledger created timestamp in milliseconds')
  assertSafeInteger(updatedAtMs, 'Ledger updated timestamp in milliseconds')
  assertSafeInteger(reconciledAtMs, 'Ledger reconciled timestamp in milliseconds')
  if (updatedAtMs < createdAtMs || reconciledAtMs < createdAtMs || reconciledAtMs > updatedAtMs) {
    throw new Error('Ledger revision timestamps are inconsistent')
  }
}

export function validateLedgerRevisionManifest(manifest: TLedgerRevisionManifestV1): TLedgerManifestValidation {
  assertExactObjectKeys(manifest, MANIFEST_FIELDS, 'Ledger revision manifest')
  if (manifest.schemaVersion !== LEDGER_SCHEMA_VERSION || manifest.codec !== LEDGER_CODEC_NAME) {
    throw new Error('Ledger revision manifest version or codec is unsupported')
  }
  assertNonEmptyString(manifest.calculationVersion, 'Ledger calculation version')
  assertSha256(manifest.walletHash, 'Ledger wallet hash')
  assertSha256(manifest.sourceFingerprint, 'Ledger source fingerprint')
  assertSafeInteger(manifest.sourceGeneration, 'Ledger source generation')
  if (
    typeof manifest.revision !== 'string' ||
    !REVISION_PATTERN.test(manifest.revision) ||
    (manifest.parentRevision !== null &&
      (typeof manifest.parentRevision !== 'string' || !REVISION_PATTERN.test(manifest.parentRevision))) ||
    manifest.parentRevision === manifest.revision
  ) {
    throw new Error('Ledger revision or parent revision is invalid')
  }
  const normalizedChainScope = normalizeChainScope(manifest.chainScope)
  if (stringifyCanonicalLedgerValue(manifest.chainScope) !== stringifyCanonicalLedgerValue(normalizedChainScope)) {
    throw new Error('Ledger chain scope must be in canonical order')
  }
  if (
    stringifyCanonicalLedgerValue(manifest.coverage) !==
    stringifyCanonicalLedgerValue(normalizeCoverage(manifest.coverage))
  ) {
    throw new Error('Ledger coverage must be in canonical order')
  }
  assertCoverage(manifest.coverage, manifest.chainScope)
  if (
    stringifyCanonicalLedgerValue(manifest.chunks) !==
    stringifyCanonicalLedgerValue([...manifest.chunks].toSorted(compareChunkDescriptors))
  ) {
    throw new Error('Ledger chunk refs must be in canonical order')
  }
  assertChunkRefs(manifest.walletHash, manifest.chunks)
  if (manifest.chunks.some((chunk) => !manifest.chainScope.includes(chunk.chainId))) {
    throw new Error('Ledger chunks must belong to the manifest chain scope')
  }
  assertIndexRefs(manifest.walletHash, manifest.indexes)
  assertEpochs(manifest.invalidationEpochs)
  if (!Array.isArray(manifest.dependencies)) {
    throw new Error('Ledger dependencies must be an array')
  }
  manifest.dependencies.reduce((identities, dependency) => {
    assertExactObjectKeys(dependency, DEPENDENCY_FIELDS, 'Ledger dependency')
    if (!['vault', 'nested-vault'].includes(dependency.kind)) {
      throw new Error('Ledger dependency kind is unsupported')
    }
    assertSafeInteger(dependency.chainId, 'Ledger dependency chain id', 1)
    if (!manifest.chainScope.includes(dependency.chainId)) {
      throw new Error('Ledger dependencies must belong to the manifest chain scope')
    }
    assertEvmAddress(dependency.address, 'Ledger dependency address')
    if (dependency.address !== dependency.address.toLowerCase()) {
      throw new Error('Ledger dependency addresses must be lowercase')
    }
    if (dependency.metadataRevision !== null) {
      assertNonEmptyString(dependency.metadataRevision, 'Ledger dependency metadata revision')
    }
    assertSafeInteger(dependency.firstEventTimestamp, 'Ledger dependency first-event timestamp')
    const identity = stringifyCanonicalLedgerValue([dependency.kind, dependency.chainId, dependency.address])
    if (identities.has(identity)) {
      throw new Error('Ledger dependencies must be unique')
    }
    identities.add(identity)
    return identities
  }, new Set<string>())
  if (
    stringifyCanonicalLedgerValue(manifest.dependencies) !==
    stringifyCanonicalLedgerValue(normalizeDependencies(manifest.dependencies))
  ) {
    throw new Error('Ledger dependencies must be in canonical order')
  }
  assertDirtyMetadata(manifest.dirtyFromTimestamp, manifest.dirtyFromDate, manifest.dirtyReasons)
  assertRevisionTimestamps(manifest.createdAtMs, manifest.updatedAtMs, manifest.reconciledAtMs)
  const recordCount = manifest.chunks.reduce((total, chunk) => total + chunk.recordCount, 0)
  const manifestBytes = Buffer.byteLength(stringifyCanonicalLedgerValue(manifest), 'utf8')
  const activeRevisionBytes =
    manifest.chunks.reduce((total, chunk) => total + chunk.encodedBytes, 0) +
    manifest.indexes.reduce((total, index) => total + index.encodedBytes, 0) +
    manifestBytes
  const activeRevisionDecodedBytes =
    manifest.chunks.reduce((total, chunk) => total + chunk.decodedBytes, 0) +
    manifest.indexes.reduce((total, index) => total + index.decodedBytes, 0) +
    manifestBytes
  if (manifest.recordCount !== recordCount || manifest.activeEncodedBytes !== activeRevisionBytes) {
    throw new Error('Ledger manifest aggregate counts or bytes are inconsistent')
  }
  if (activeRevisionBytes > LEDGER_MAX_ACTIVE_REVISION_BYTES) {
    throw new Error('Ledger manifest active revision exceeds the encoded byte limit')
  }
  if (activeRevisionDecodedBytes > LEDGER_MAX_ACTIVE_REVISION_DECODED_BYTES) {
    throw new Error('Ledger manifest active revision exceeds the decoded byte limit')
  }
  if (
    manifest.chunksChecksum !== getLedgerSha256(stringifyCanonicalLedgerValue(manifest.chunks)) ||
    manifest.indexesChecksum !== getLedgerSha256(stringifyCanonicalLedgerValue(manifest.indexes))
  ) {
    throw new Error('Ledger manifest ref checksums are inconsistent')
  }
  if (manifestBytes > LEDGER_MAX_MANIFEST_BYTES) {
    throw new Error('Ledger revision manifest exceeds the encoded byte limit')
  }
  return { manifestBytes, activeRevisionBytes, activeRevisionDecodedBytes }
}

function resolveActiveRevisionBytes(
  manifest: TLedgerRevisionManifestV1,
  attemptsRemaining = 8
): TLedgerRevisionManifestV1 {
  const manifestBytes = Buffer.byteLength(stringifyCanonicalLedgerValue(manifest), 'utf8')
  const activeEncodedBytes =
    manifest.chunks.reduce((total, chunk) => total + chunk.encodedBytes, 0) +
    manifest.indexes.reduce((total, index) => total + index.encodedBytes, 0) +
    manifestBytes
  if (activeEncodedBytes === manifest.activeEncodedBytes) {
    return manifest
  }
  if (attemptsRemaining === 0) {
    throw new Error('Ledger manifest active byte count did not converge')
  }
  return resolveActiveRevisionBytes({ ...manifest, activeEncodedBytes }, attemptsRemaining - 1)
}

export function createLedgerRevisionManifest(input: TCreateLedgerRevisionManifestInputV1): TLedgerRevisionManifestV1 {
  const chainScope = normalizeChainScope(input.chainScope)
  const coverage = normalizeCoverage(input.coverage)
  const encodedChunks = input.chunks.filter(isEncodedLedgerChunk)
  encodedChunks.map(decodeLedgerChunk)
  const chunks = input.chunks
    .map((chunk): TLedgerChunkRefV1 => {
      if (isEncodedLedgerChunk(chunk)) {
        return {
          ...chunk.descriptor,
          key: getLedgerChunkKey(input.walletHash, chunk.descriptor.checksum)
        }
      }
      assertChunkDescriptor(chunk, true)
      if (chunk.key !== getLedgerChunkKey(input.walletHash, chunk.checksum)) {
        throw new Error('Ledger reused chunk ref is outside the wallet namespace')
      }
      return chunk
    })
    .toSorted(compareChunkDescriptors)
  const indexes = input.indexes
    .map((index): { readonly ref: TLedgerIndexShardRefV1; readonly data: string | null } => {
      if (isEncodedLedgerIndexShard(index)) {
        decodeLedgerIndexShard(index)
        return {
          ref: {
            ...index.descriptor,
            key: getLedgerIndexShardKey(input.walletHash, index.descriptor.shard, index.descriptor.checksum)
          },
          data: index.data
        }
      }
      assertIndexShardDescriptor(index, true)
      if (index.key !== getLedgerIndexShardKey(input.walletHash, index.shard, index.checksum)) {
        throw new Error('Ledger reused index ref is outside the wallet namespace')
      }
      return { ref: index, data: null }
    })
    .toSorted((left, right) => left.ref.shard - right.ref.shard)
  if (encodedChunks.length === input.chunks.length) {
    const expectedIndexes = encodeLedgerIndexShards(encodedChunks)
    if (
      indexes.length !== expectedIndexes.length ||
      indexes.some((index, position) => {
        const expected = expectedIndexes[position]
        return (
          !expected ||
          stringifyCanonicalLedgerValue(index.ref) !==
            stringifyCanonicalLedgerValue({
              ...expected.descriptor,
              key: getLedgerIndexShardKey(input.walletHash, expected.descriptor.shard, expected.descriptor.checksum)
            }) ||
          (index.data !== null && index.data !== expected.data)
        )
      })
    ) {
      throw new Error('Ledger index shards do not match the active chunk contents')
    }
    assertCoverageMatchesLedger(coverage, chainScope, decodeLedgerChunks(encodedChunks))
  }
  const indexRefs = indexes.map((index) => index.ref)
  const unresolvedManifest: TLedgerRevisionManifestV1 = {
    schemaVersion: LEDGER_SCHEMA_VERSION,
    codec: LEDGER_CODEC_NAME,
    calculationVersion: input.calculationVersion,
    walletHash: input.walletHash,
    sourceFingerprint: input.sourceFingerprint,
    sourceGeneration: input.sourceGeneration,
    revision: input.revision,
    parentRevision: input.parentRevision,
    chainScope,
    coverage,
    chunks,
    indexes: indexRefs,
    dependencies: normalizeDependencies(input.dependencies),
    invalidationEpochs: input.invalidationEpochs,
    dirtyFromTimestamp: input.dirtyFromTimestamp,
    dirtyFromDate: input.dirtyFromDate,
    dirtyReasons: Array.from(new Set(input.dirtyReasons)).toSorted(),
    createdAtMs: input.createdAtMs,
    updatedAtMs: input.updatedAtMs,
    reconciledAtMs: input.reconciledAtMs,
    recordCount: chunks.reduce((total, chunk) => total + chunk.recordCount, 0),
    activeEncodedBytes: 0,
    chunksChecksum: getLedgerSha256(stringifyCanonicalLedgerValue(chunks)),
    indexesChecksum: getLedgerSha256(stringifyCanonicalLedgerValue(indexRefs))
  }
  const manifest = resolveActiveRevisionBytes(unresolvedManifest)
  validateLedgerRevisionManifest(manifest)
  getLedgerRevisionManifestKey(manifest.walletHash, manifest.sourceGeneration, manifest.revision)
  return manifest
}

function indexStoredLedgerBlobs<TBlob extends { readonly key: string }>(
  blobs: readonly TBlob[],
  expectedCount: number,
  label: string
): Map<string, TBlob> {
  if (blobs.length !== expectedCount) {
    throw new Error(`${label} count does not match the revision manifest`)
  }
  return blobs.reduce((byKey, blob) => {
    assertExactObjectKeys(blob, ['key', 'descriptor', 'data'], label)
    if (byKey.has(blob.key)) {
      throw new Error(`${label} keys must be unique`)
    }
    byKey.set(blob.key, blob)
    return byKey
  }, new Map<string, TBlob>())
}

export function decodeLedgerRevision(
  manifest: TLedgerRevisionManifestV1,
  storedChunks: readonly TStoredLedgerChunkV1[],
  storedIndexes: readonly TStoredLedgerIndexShardV1[]
): TLedgerSixStreams {
  validateLedgerRevisionManifest(manifest)
  const chunksByKey = indexStoredLedgerBlobs(storedChunks, manifest.chunks.length, 'Stored ledger chunks')
  const chunks = manifest.chunks.map((reference): TEncodedLedgerChunkV1 => {
    const stored = chunksByKey.get(reference.key)
    if (!stored) {
      throw new Error('Stored ledger chunks are incomplete')
    }
    const expectedReference: TLedgerChunkRefV1 = { ...stored.descriptor, key: stored.key }
    if (stringifyCanonicalLedgerValue(expectedReference) !== stringifyCanonicalLedgerValue(reference)) {
      throw new Error('Stored ledger chunk does not match its manifest reference')
    }
    const chunk = { descriptor: stored.descriptor, data: stored.data }
    decodeLedgerChunk(chunk)
    return chunk
  })
  const indexesByKey = indexStoredLedgerBlobs(storedIndexes, manifest.indexes.length, 'Stored ledger indexes')
  const indexes = manifest.indexes.map((reference): TEncodedLedgerIndexShardV1 => {
    const stored = indexesByKey.get(reference.key)
    if (!stored) {
      throw new Error('Stored ledger indexes are incomplete')
    }
    const expectedReference: TLedgerIndexShardRefV1 = { ...stored.descriptor, key: stored.key }
    if (stringifyCanonicalLedgerValue(expectedReference) !== stringifyCanonicalLedgerValue(reference)) {
      throw new Error('Stored ledger index does not match its manifest reference')
    }
    const index = { descriptor: stored.descriptor, data: stored.data }
    decodeLedgerIndexShard(index)
    return index
  })
  const expectedIndexes = encodeLedgerIndexShards(chunks)
  if (
    indexes.length !== expectedIndexes.length ||
    indexes.some(
      (index, position) =>
        stringifyCanonicalLedgerValue(index.descriptor) !==
          stringifyCanonicalLedgerValue(expectedIndexes[position]?.descriptor) ||
        index.data !== expectedIndexes[position]?.data
    )
  ) {
    throw new Error('Stored ledger indexes do not describe the complete active chunk set')
  }
  const streams = decodeLedgerChunks(chunks)
  assertCoverageMatchesLedger(manifest.coverage, manifest.chainScope, streams)
  return streams
}

export function verifyLedgerRevision(
  manifest: TLedgerRevisionManifestV1,
  storedChunks: readonly TStoredLedgerChunkV1[],
  storedIndexes: readonly TStoredLedgerIndexShardV1[]
): TLedgerVerifiedRevisionV1 {
  const streams = decodeLedgerRevision(manifest, storedChunks, storedIndexes)
  const head = createLedgerHead(manifest)
  const revision = Object.freeze({
    manifest,
    head,
    streams,
    manifestValue: stringifyCanonicalLedgerValue(manifest),
    headValue: stringifyCanonicalLedgerValue(head)
  }) as TLedgerVerifiedRevisionV1
  verifiedLedgerRevisions.add(revision)
  return revision
}

export function getVerifiedLedgerRevisionValues(revision: TLedgerVerifiedRevisionV1): {
  readonly manifest: TLedgerRevisionManifestV1
  readonly head: TLedgerHeadV1
  readonly manifestValue: string
  readonly headValue: string
} {
  if (revision === null || typeof revision !== 'object' || !verifiedLedgerRevisions.has(revision)) {
    throw new Error('Ledger revision must pass complete manifest-bound verification before commit')
  }
  validateLedgerHeadAgainstManifest(revision.head, revision.manifest)
  if (
    stringifyCanonicalLedgerValue(revision.manifest) !== revision.manifestValue ||
    stringifyCanonicalLedgerValue(revision.head) !== revision.headValue
  ) {
    throw new Error('Verified ledger revision values changed after manifest-bound verification')
  }
  return {
    manifest: revision.manifest,
    head: revision.head,
    manifestValue: revision.manifestValue,
    headValue: revision.headValue
  }
}

export function createLedgerHead(manifest: TLedgerRevisionManifestV1): TLedgerHeadV1 {
  validateLedgerRevisionManifest(manifest)
  const head: TLedgerHeadV1 = {
    schemaVersion: manifest.schemaVersion,
    codec: manifest.codec,
    calculationVersion: manifest.calculationVersion,
    walletHash: manifest.walletHash,
    sourceFingerprint: manifest.sourceFingerprint,
    sourceGeneration: manifest.sourceGeneration,
    revision: manifest.revision,
    parentRevision: manifest.parentRevision,
    manifestKey: getLedgerRevisionManifestKey(manifest.walletHash, manifest.sourceGeneration, manifest.revision),
    invalidationEpochs: manifest.invalidationEpochs,
    dirtyFromTimestamp: manifest.dirtyFromTimestamp,
    dirtyFromDate: manifest.dirtyFromDate,
    dirtyReasons: manifest.dirtyReasons,
    manifestChecksum: getLedgerSha256(stringifyCanonicalLedgerValue(manifest)),
    createdAtMs: manifest.createdAtMs,
    updatedAtMs: manifest.updatedAtMs,
    reconciledAtMs: manifest.reconciledAtMs
  }
  validateLedgerHead(head)
  return head
}

export function validateLedgerHead(head: TLedgerHeadV1): void {
  assertExactObjectKeys(head, HEAD_FIELDS, 'Ledger head')
  if (head.schemaVersion !== LEDGER_SCHEMA_VERSION || head.codec !== LEDGER_CODEC_NAME) {
    throw new Error('Ledger head version or codec is unsupported')
  }
  assertNonEmptyString(head.calculationVersion, 'Ledger head calculation version')
  assertSha256(head.walletHash, 'Ledger head wallet hash')
  assertSha256(head.sourceFingerprint, 'Ledger head source fingerprint')
  assertSafeInteger(head.sourceGeneration, 'Ledger head source generation')
  if (
    typeof head.revision !== 'string' ||
    !REVISION_PATTERN.test(head.revision) ||
    (head.parentRevision !== null &&
      (typeof head.parentRevision !== 'string' || !REVISION_PATTERN.test(head.parentRevision))) ||
    head.parentRevision === head.revision
  ) {
    throw new Error('Ledger head revision or parent revision is invalid')
  }
  if (head.manifestKey !== getLedgerRevisionManifestKey(head.walletHash, head.sourceGeneration, head.revision)) {
    throw new Error('Ledger head manifest key is outside its wallet and source-generation namespace')
  }
  assertEpochs(head.invalidationEpochs)
  assertDirtyMetadata(head.dirtyFromTimestamp, head.dirtyFromDate, head.dirtyReasons)
  assertSha256(head.manifestChecksum, 'Ledger head manifest checksum')
  assertRevisionTimestamps(head.createdAtMs, head.updatedAtMs, head.reconciledAtMs)
  if (Buffer.byteLength(stringifyCanonicalLedgerValue(head), 'utf8') > LEDGER_MAX_HEAD_BYTES) {
    throw new Error('Ledger head exceeds the encoded byte limit')
  }
}

export function isLedgerSnapshotId(value: unknown): value is string {
  return typeof value === 'string' && SNAPSHOT_ID_PATTERN.test(value)
}

export function validateLedgerSnapshotPin(pin: TLedgerSnapshotPinV1): void {
  assertExactObjectKeys(pin, SNAPSHOT_PIN_FIELDS, 'Ledger snapshot pin')
  if (pin.snapshotVersion !== LEDGER_SNAPSHOT_PIN_VERSION) {
    throw new Error('Ledger snapshot pin version is unsupported')
  }
  if (!isLedgerSnapshotId(pin.snapshotId)) {
    throw new Error('Ledger snapshot id is invalid')
  }
  if (pin.headSource !== 'active' && pin.headSource !== 'previous') {
    throw new Error('Ledger snapshot head source is unsupported')
  }
  validateLedgerHead(pin.head)
  assertSafeInteger(pin.latestSettledDayTimestamp, 'Ledger snapshot latest settled day timestamp')
  assertSafeInteger(pin.eventUpperTimestamp, 'Ledger snapshot event upper timestamp')
  assertSafeInteger(pin.createdAtMs, 'Ledger snapshot created timestamp in milliseconds')
  assertSafeInteger(pin.expiresAtMs, 'Ledger snapshot expiry timestamp in milliseconds')
  if (pin.latestSettledDayTimestamp % (24 * 60 * 60) !== 0) {
    throw new Error('Ledger snapshot latest settled day timestamp must be UTC-day aligned')
  }
  if (pin.eventUpperTimestamp < pin.latestSettledDayTimestamp) {
    throw new Error('Ledger snapshot event upper timestamp precedes its latest settled day')
  }
  if (pin.eventUpperTimestamp > Math.floor(pin.createdAtMs / 1000)) {
    throw new Error('Ledger snapshot event upper timestamp exceeds its creation time')
  }
  if (pin.expiresAtMs !== pin.createdAtMs + LEDGER_SNAPSHOT_TTL_SECONDS * 1000) {
    throw new Error('Ledger snapshot expiry does not match the configured TTL')
  }
  if (Buffer.byteLength(stringifyCanonicalLedgerValue(pin), 'utf8') > LEDGER_MAX_SNAPSHOT_PIN_BYTES) {
    throw new Error('Ledger snapshot pin exceeds the encoded byte limit')
  }
}

export function validateLedgerSyncStatus(status: TLedgerSyncStatusV1): void {
  assertExactObjectKeys(status, SYNC_STATUS_FIELDS, 'Ledger sync status')
  if (status.schemaVersion !== LEDGER_SCHEMA_VERSION) {
    throw new Error('Ledger sync status version is unsupported')
  }
  if (!['idle', 'syncing', 'complete', 'failed'].includes(status.state)) {
    throw new Error('Ledger sync status state is unsupported')
  }
  assertSafeInteger(status.sourceGeneration, 'Ledger sync status source generation')
  assertSafeInteger(status.updatedAtMs, 'Ledger sync status updated timestamp in milliseconds')
  if (status.revision !== null && (typeof status.revision !== 'string' || !REVISION_PATTERN.test(status.revision))) {
    throw new Error('Ledger sync status revision is invalid')
  }
  if (status.state === 'complete' && (typeof status.revision !== 'string' || !REVISION_PATTERN.test(status.revision))) {
    throw new Error('Ledger complete sync status requires a valid revision')
  }
  if (status.state === 'failed') {
    if (!LEDGER_SYNC_REASON_CODES.includes(status.reasonCode)) {
      throw new Error('Ledger failed sync status reason code is unsupported')
    }
  } else if (status.reasonCode !== null) {
    throw new Error('Ledger non-failed sync status cannot contain a reason code')
  }
  if (Buffer.byteLength(stringifyCanonicalLedgerValue(status), 'utf8') > LEDGER_MAX_HEAD_BYTES) {
    throw new Error('Ledger sync status exceeds the encoded byte limit')
  }
}

export function validateLedgerHeadAgainstManifest(head: TLedgerHeadV1, manifest: TLedgerRevisionManifestV1): void {
  validateLedgerHead(head)
  validateLedgerRevisionManifest(manifest)
  if (stringifyCanonicalLedgerValue(head) !== stringifyCanonicalLedgerValue(createLedgerHead(manifest))) {
    throw new Error('Ledger head does not match its revision manifest')
  }
}

function parseCanonicalLedgerObject(serialized: string, maximumBytes: number, label: string): Record<string, unknown> {
  if (typeof serialized !== 'string') {
    throw new Error(`${label} must be a string`)
  }
  if (Buffer.byteLength(serialized, 'utf8') > maximumBytes) {
    throw new Error(`${label} exceeds the encoded byte limit`)
  }
  const parsed = (() => {
    try {
      return JSON.parse(serialized) as unknown
    } catch {
      throw new Error(`${label} is not valid JSON`)
    }
  })()
  if (!isPlainObject(parsed) || stringifyCanonicalLedgerValue(parsed) !== serialized) {
    throw new Error(`${label} must be a canonical JSON object`)
  }
  return parsed
}

export function parseLedgerRevisionManifest(serialized: string): TLedgerRevisionManifestV1 {
  const manifest = parseCanonicalLedgerObject(
    serialized,
    LEDGER_MAX_MANIFEST_BYTES,
    'Ledger revision manifest'
  ) as unknown as TLedgerRevisionManifestV1
  validateLedgerRevisionManifest(manifest)
  return manifest
}

export function parseLedgerHead(serialized: string): TLedgerHeadV1 {
  const head = parseCanonicalLedgerObject(serialized, LEDGER_MAX_HEAD_BYTES, 'Ledger head') as unknown as TLedgerHeadV1
  validateLedgerHead(head)
  return head
}

export function parseLedgerSyncStatus(serialized: string): TLedgerSyncStatusV1 {
  const status = parseCanonicalLedgerObject(
    serialized,
    LEDGER_MAX_HEAD_BYTES,
    'Ledger sync status'
  ) as unknown as TLedgerSyncStatusV1
  validateLedgerSyncStatus(status)
  return status
}

export function parseLedgerSnapshotPin(serialized: string): TLedgerSnapshotPinV1 {
  const pin = parseCanonicalLedgerObject(
    serialized,
    LEDGER_MAX_SNAPSHOT_PIN_BYTES,
    'Ledger snapshot pin'
  ) as unknown as TLedgerSnapshotPinV1
  validateLedgerSnapshotPin(pin)
  return pin
}
