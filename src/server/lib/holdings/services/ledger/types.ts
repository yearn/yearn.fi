export const LEDGER_SCHEMA_VERSION = 1 as const
export const LEDGER_CODEC_NAME = 'brotli-q4-base64' as const

export const LEDGER_MAX_CHUNK_RECORDS = 1_000
export const LEDGER_MAX_ENCODED_CHUNK_BYTES = 256 * 1024
export const LEDGER_MAX_ENCODED_INDEX_SHARD_BYTES = 256 * 1024
export const LEDGER_MAX_DECODED_CHUNK_BYTES = 4 * 1024 * 1024
export const LEDGER_MAX_DECODED_INDEX_SHARD_BYTES = 4 * 1024 * 1024
export const LEDGER_MAX_HEAD_BYTES = 16 * 1024
export const LEDGER_MAX_MANIFEST_BYTES = 256 * 1024
export const LEDGER_MAX_SNAPSHOT_PIN_BYTES = 32 * 1024
export const LEDGER_MAX_ACTIVE_REVISION_BYTES = 4 * 1024 * 1024
export const LEDGER_MAX_ACTIVE_REVISION_DECODED_BYTES = 32 * 1024 * 1024
export const LEDGER_INDEX_SHARD_COUNT = 64
export const LEDGER_SNAPSHOT_PIN_VERSION = 1 as const
export const LEDGER_SNAPSHOT_TTL_SECONDS = 30 * 60

export const LEDGER_STREAMS = [
  'v3Deposits',
  'v3Withdrawals',
  'v2Deposits',
  'v2Withdrawals',
  'transfersIn',
  'transfersOut'
] as const

export const LEDGER_DIRTY_REASON_CODES = [
  'bootstrap',
  'tail_append',
  'event_replaced',
  'event_deleted',
  'classification_changed',
  'reconcile',
  'forced_reset',
  'source_generation',
  'schema_generation',
  'address_invalidation',
  'vault_invalidation',
  'global_invalidation',
  'metadata_changed'
] as const

export const LEDGER_EVENT_FAMILIES = ['v3-deposit', 'v3-withdrawal', 'v2-deposit', 'v2-withdrawal', 'transfer'] as const

export const LEDGER_EVENT_FAMILY_CODES = {
  'v3-deposit': 0,
  'v3-withdrawal': 1,
  'v2-deposit': 2,
  'v2-withdrawal': 3,
  transfer: 4
} as const

export const LEDGER_TRANSFER_DIRECTIONS = {
  none: 0,
  in: 1,
  out: 2,
  both: 3
} as const

export type TLedgerStream = (typeof LEDGER_STREAMS)[number]
export type TLedgerEventFamily = (typeof LEDGER_EVENT_FAMILIES)[number]
export type TLedgerEventFamilyCode = (typeof LEDGER_EVENT_FAMILY_CODES)[TLedgerEventFamily]
export type TLedgerNonTransferFamilyCode = Exclude<TLedgerEventFamilyCode, 4>
export type TLedgerTransferDirection = 1 | 2 | 3

export type TLedgerJsonPrimitive = string | number | boolean | null
export type TLedgerJsonValue = TLedgerJsonPrimitive | TLedgerJsonObject | readonly TLedgerJsonValue[]
export type TLedgerJsonObject = Readonly<{ [field: string]: TLedgerJsonValue }>

export type TLedgerBaseSourceEvent = Readonly<
  {
    id: string
    vaultAddress: string
    chainId: number
    blockNumber: number
    blockTimestamp: number
    logIndex: number
    transactionHash: string
    transactionFrom: string
  } & { [field: string]: TLedgerJsonValue }
>

export type TLedgerV3DepositSourceEvent = TLedgerBaseSourceEvent &
  Readonly<{ owner: string; sender: string; assets: string; shares: string }>
export type TLedgerV3WithdrawalSourceEvent = TLedgerBaseSourceEvent &
  Readonly<{ owner: string; assets: string; shares: string }>
export type TLedgerV2DepositSourceEvent = TLedgerBaseSourceEvent &
  Readonly<{ recipient: string; amount: string; shares: string }>
export type TLedgerV2WithdrawalSourceEvent = TLedgerBaseSourceEvent &
  Readonly<{ recipient: string; amount: string; shares: string }>
export type TLedgerTransferSourceEvent = TLedgerBaseSourceEvent &
  Readonly<{ sender: string; receiver: string; value: string }>

export type TLedgerSourceEvent =
  | TLedgerV3DepositSourceEvent
  | TLedgerV3WithdrawalSourceEvent
  | TLedgerV2DepositSourceEvent
  | TLedgerV2WithdrawalSourceEvent
  | TLedgerTransferSourceEvent

export interface TLedgerSixStreams {
  readonly v3Deposits: readonly TLedgerV3DepositSourceEvent[]
  readonly v3Withdrawals: readonly TLedgerV3WithdrawalSourceEvent[]
  readonly v2Deposits: readonly TLedgerV2DepositSourceEvent[]
  readonly v2Withdrawals: readonly TLedgerV2WithdrawalSourceEvent[]
  readonly transfersIn: readonly TLedgerTransferSourceEvent[]
  readonly transfersOut: readonly TLedgerTransferSourceEvent[]
}

export type TLedgerOrderKey = readonly [blockTimestamp: number, blockNumber: number, logIndex: number, id: string]

export type TLedgerCanonicalNonTransferTupleV1 = readonly [
  schemaVersion: typeof LEDGER_SCHEMA_VERSION,
  familyCode: TLedgerNonTransferFamilyCode,
  direction: typeof LEDGER_TRANSFER_DIRECTIONS.none,
  id: string,
  vaultAddress: string,
  chainId: number,
  blockNumber: number,
  blockTimestamp: number,
  logIndex: number,
  transactionHash: string,
  source: TLedgerJsonObject
]

export type TLedgerCanonicalTransferTupleV1 = readonly [
  schemaVersion: typeof LEDGER_SCHEMA_VERSION,
  familyCode: typeof LEDGER_EVENT_FAMILY_CODES.transfer,
  direction: TLedgerTransferDirection,
  id: string,
  vaultAddress: string,
  chainId: number,
  blockNumber: number,
  blockTimestamp: number,
  logIndex: number,
  transactionHash: string,
  source: TLedgerJsonObject
]

export type TLedgerCanonicalTupleV1 = TLedgerCanonicalNonTransferTupleV1 | TLedgerCanonicalTransferTupleV1

export type TLedgerChunkPayloadV1 = readonly [
  schemaVersion: typeof LEDGER_SCHEMA_VERSION,
  family: TLedgerEventFamily,
  chainId: number,
  month: string,
  records: readonly TLedgerCanonicalTupleV1[]
]

export interface TLedgerChunkDescriptorV1 {
  readonly schemaVersion: typeof LEDGER_SCHEMA_VERSION
  readonly codec: typeof LEDGER_CODEC_NAME
  readonly family: TLedgerEventFamily
  readonly chainId: number
  readonly month: string
  readonly part: number
  readonly recordCount: number
  readonly encodedBytes: number
  readonly decodedBytes: number
  readonly checksum: string
  readonly firstOrder: TLedgerOrderKey
  readonly lastOrder: TLedgerOrderKey
}

export interface TEncodedLedgerChunkV1 {
  readonly descriptor: TLedgerChunkDescriptorV1
  readonly data: string
}

export interface TStoredLedgerChunkV1 extends TEncodedLedgerChunkV1 {
  readonly key: string
}

export interface TLedgerChunkRefV1 extends TLedgerChunkDescriptorV1 {
  readonly key: string
}

export type TLedgerChunkManifestInputV1 = TEncodedLedgerChunkV1 | TLedgerChunkRefV1

export type TLedgerIndexEntryV1 = readonly [identity: string, chunkChecksum: string]

export type TLedgerIndexShardPayloadV1 = readonly [
  schemaVersion: typeof LEDGER_SCHEMA_VERSION,
  shard: number,
  entries: readonly TLedgerIndexEntryV1[]
]

export interface TLedgerIndexShardDescriptorV1 {
  readonly schemaVersion: typeof LEDGER_SCHEMA_VERSION
  readonly codec: typeof LEDGER_CODEC_NAME
  readonly shard: number
  readonly entryCount: number
  readonly encodedBytes: number
  readonly decodedBytes: number
  readonly checksum: string
  readonly firstIdentity: string | null
  readonly lastIdentity: string | null
}

export interface TEncodedLedgerIndexShardV1 {
  readonly descriptor: TLedgerIndexShardDescriptorV1
  readonly data: string
}

export interface TStoredLedgerIndexShardV1 extends TEncodedLedgerIndexShardV1 {
  readonly key: string
}

export interface TLedgerIndexShardRefV1 extends TLedgerIndexShardDescriptorV1 {
  readonly key: string
}

export type TLedgerIndexShardManifestInputV1 = TEncodedLedgerIndexShardV1 | TLedgerIndexShardRefV1

export type TLedgerCoverageStatus = 'complete' | 'valid_empty'
export type TLedgerCheckpointState = 'pinned' | 'observed' | 'unpinned'

export interface TLedgerCursorV1 {
  readonly blockTimestamp: number
  readonly blockNumber: number
  readonly logIndex: number
  readonly id: string
}

export interface TLedgerStreamCoverageV1 {
  readonly stream: TLedgerStream
  readonly chainId: number
  readonly status: TLedgerCoverageStatus
  readonly coverageStartTimestamp: number
  readonly completeThroughTimestamp: number
  readonly coverageStartBlock: number
  readonly completeThroughBlock: number
  readonly cursor: TLedgerCursorV1 | null
  readonly checkpoint: string | null
  readonly checkpointState: TLedgerCheckpointState
  readonly count: number
  readonly checksum: string
}

export type TLedgerDependencyKind = 'vault' | 'nested-vault'

export interface TLedgerDependencyV1 {
  readonly kind: TLedgerDependencyKind
  readonly chainId: number
  readonly address: string
  readonly metadataRevision: string | null
  readonly firstEventTimestamp: number
}

export interface TLedgerInvalidationEpochsV1 {
  readonly global: number
  readonly source: number
  readonly address: number
  readonly vault: number
  readonly schema: number
  readonly metadata: number
}

export type TLedgerDirtyReasonCode = (typeof LEDGER_DIRTY_REASON_CODES)[number]

export interface TLedgerRevisionManifestV1 {
  readonly schemaVersion: typeof LEDGER_SCHEMA_VERSION
  readonly codec: typeof LEDGER_CODEC_NAME
  readonly calculationVersion: string
  readonly walletHash: string
  readonly sourceFingerprint: string
  readonly sourceGeneration: number
  readonly revision: string
  readonly parentRevision: string | null
  readonly chainScope: readonly number[]
  readonly coverage: readonly TLedgerStreamCoverageV1[]
  readonly chunks: readonly TLedgerChunkRefV1[]
  readonly indexes: readonly TLedgerIndexShardRefV1[]
  readonly dependencies: readonly TLedgerDependencyV1[]
  readonly invalidationEpochs: TLedgerInvalidationEpochsV1
  readonly dirtyFromTimestamp: number | null
  readonly dirtyFromDate: string | null
  readonly dirtyReasons: readonly TLedgerDirtyReasonCode[]
  readonly createdAtMs: number
  readonly updatedAtMs: number
  readonly reconciledAtMs: number
  readonly recordCount: number
  readonly activeEncodedBytes: number
  readonly chunksChecksum: string
  readonly indexesChecksum: string
}

export interface TLedgerHeadV1 {
  readonly schemaVersion: typeof LEDGER_SCHEMA_VERSION
  readonly codec: typeof LEDGER_CODEC_NAME
  readonly calculationVersion: string
  readonly walletHash: string
  readonly sourceFingerprint: string
  readonly sourceGeneration: number
  readonly revision: string
  readonly parentRevision: string | null
  readonly manifestKey: string
  readonly invalidationEpochs: TLedgerInvalidationEpochsV1
  readonly dirtyFromTimestamp: number | null
  readonly dirtyFromDate: string | null
  readonly dirtyReasons: readonly TLedgerDirtyReasonCode[]
  readonly manifestChecksum: string
  readonly createdAtMs: number
  readonly updatedAtMs: number
  readonly reconciledAtMs: number
}

export interface TLedgerSnapshotPinV1 {
  readonly snapshotVersion: typeof LEDGER_SNAPSHOT_PIN_VERSION
  readonly snapshotId: string
  readonly headSource: 'active' | 'previous'
  readonly head: TLedgerHeadV1
  readonly latestSettledDayTimestamp: number
  readonly eventUpperTimestamp: number
  readonly createdAtMs: number
  readonly expiresAtMs: number
}

export type TLedgerSyncReasonCode =
  | 'lock_busy'
  | 'upstream_failed'
  | 'storage_failed'
  | 'decode_failed'
  | 'cas_rejected'
  | 'stale_fence'

interface TLedgerSyncStatusBaseV1 {
  readonly schemaVersion: typeof LEDGER_SCHEMA_VERSION
  readonly sourceGeneration: number
  readonly updatedAtMs: number
}

export type TLedgerSyncStatusV1 =
  | (TLedgerSyncStatusBaseV1 & { readonly state: 'idle'; readonly revision: string | null; readonly reasonCode: null })
  | (TLedgerSyncStatusBaseV1 & {
      readonly state: 'syncing'
      readonly revision: string | null
      readonly reasonCode: null
    })
  | (TLedgerSyncStatusBaseV1 & { readonly state: 'complete'; readonly revision: string; readonly reasonCode: null })
  | (TLedgerSyncStatusBaseV1 & {
      readonly state: 'failed'
      readonly revision: string | null
      readonly reasonCode: TLedgerSyncReasonCode
    })

export interface TCreateLedgerRevisionManifestInputV1 {
  readonly calculationVersion: string
  readonly walletHash: string
  readonly sourceFingerprint: string
  readonly sourceGeneration: number
  readonly revision: string
  readonly parentRevision: string | null
  readonly chainScope: readonly number[]
  readonly coverage: readonly TLedgerStreamCoverageV1[]
  readonly chunks: readonly TLedgerChunkManifestInputV1[]
  readonly indexes: readonly TLedgerIndexShardManifestInputV1[]
  readonly dependencies: readonly TLedgerDependencyV1[]
  readonly invalidationEpochs: TLedgerInvalidationEpochsV1
  readonly dirtyFromTimestamp: number | null
  readonly dirtyFromDate: string | null
  readonly dirtyReasons: readonly TLedgerDirtyReasonCode[]
  readonly createdAtMs: number
  readonly updatedAtMs: number
  readonly reconciledAtMs: number
}

export interface TLedgerManifestValidation {
  readonly manifestBytes: number
  readonly activeRevisionBytes: number
  readonly activeRevisionDecodedBytes: number
}
