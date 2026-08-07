import { Buffer } from 'node:buffer'
import { createHash, randomUUID } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import type { Redis } from '@upstash/redis'
import { handleHoldingsBreakdownRequest } from '@/server/holdings/breakdown'
import { handleHoldingsHistoryRequest } from '@/server/holdings/history'
import { handleHoldingsProtocolReturnHistoryRequest } from '@/server/holdings/protocol-return/history'
import { holdingsConfig } from '@/server/lib/holdings/config'
import { fetchUserLedgerSourceEvents } from '@/server/lib/holdings/services/graphql'
import {
  createLedgerRevisionManifest,
  encodeLedgerChunks,
  encodeLedgerIndexShards,
  parseLedgerRevisionManifest,
  parseLedgerSnapshotPin,
  stringifyCanonicalLedgerValue,
  verifyLedgerRevision
} from '@/server/lib/holdings/services/ledger/codec'
import { fetchEnvioLedgerMetadata, type TEnvioLedgerMetadata } from '@/server/lib/holdings/services/ledger/envio'
import {
  getLedgerChunkKey,
  getLedgerFenceKey,
  getLedgerHeadKey,
  getLedgerIndexShardKey,
  getLedgerLockKey,
  getLedgerPreviousHeadKey,
  hashLedgerWalletAddress
} from '@/server/lib/holdings/services/ledger/keys'
import { acquireLedgerLock, releaseLedgerLock } from '@/server/lib/holdings/services/ledger/lock'
import { compareLedgerOrder } from '@/server/lib/holdings/services/ledger/order'
import { readVerifiedLedgerRevision } from '@/server/lib/holdings/services/ledger/revision'
import { createLedgerCoverage, createLedgerDependencies } from '@/server/lib/holdings/services/ledger/state'
import {
  commitVerifiedLedgerRevision,
  readLedgerValue,
  writeImmutableLedgerBlobs
} from '@/server/lib/holdings/services/ledger/store'
import {
  LEDGER_MAX_ACTIVE_REVISION_BYTES,
  LEDGER_SCHEMA_VERSION,
  LEDGER_STREAMS,
  type TLedgerRevisionManifestV1,
  type TLedgerSixStreams,
  type TLedgerSnapshotPinV1,
  type TLedgerStreamCoverageV1
} from '@/server/lib/holdings/services/ledger/types'
import {
  getHoldingsLedgerRedisClient,
  getHoldingsLedgerRuntimeFingerprint
} from '@/server/lib/holdings/storage/ledgerRedis'
import { SUPPORTED_CHAINS } from '@/server/lib/holdings/types'

type TJsonPrimitive = string | number | boolean | null
type TJsonValue = TJsonPrimitive | TJsonValue[] | { readonly [key: string]: TJsonValue }

interface TBenchmarkArgs {
  readonly baseUrl: string
  readonly wallets: readonly string[]
  readonly runs: number
  readonly staleDays: number
  readonly reportPath: string
  readonly confirmedDevRedis: boolean
  readonly renderExistingPath: string | null
}

interface THttpMeasurement {
  readonly status: number
  readonly durationMs: number
  readonly bytes: number
  readonly body: TJsonValue
  readonly headers: Readonly<Record<string, string | null>>
}

interface TPortfolioFlowMeasurement {
  readonly durationMs: number
  readonly bytes: number
  readonly historyStatus: number
  readonly protocolReturnStatus: number
  readonly historySnapshot: string | null
  readonly protocolReturnSnapshot: string | null
}

interface TRevisionParityMeasurement {
  readonly status: 'match' | 'mismatch'
  readonly durationMs: number
  readonly revision: string
}

interface TTimingSummary {
  readonly runs: number
  readonly medianMs: number
  readonly minimumMs: number
  readonly maximumMs: number
  readonly statuses: readonly number[]
  readonly medianBytes: number
}

interface TStorageClass {
  readonly keys: number
  readonly keyBytes: number
  readonly valueBytes: number
}

interface TStorageMeasurement {
  readonly keys: number
  readonly keyBytes: number
  readonly valueBytes: number
  readonly activeReachableBytes: number
  readonly retainedReachableBytes: number
  readonly orphanDataBytes: number
  readonly activeLogicalBytes: number
  readonly activeRecords: number
  readonly activeChunks: number
  readonly activeIndexes: number
  readonly activeRevision: string | null
  readonly byClass: Readonly<Record<string, TStorageClass>>
}

interface TComparisonResult {
  readonly match: boolean
  readonly leftStatus: number
  readonly rightStatus: number
  readonly leftHash: string
  readonly rightHash: string
  readonly maximumAbsoluteDelta: number
  readonly maximumRelativeDelta: number
  readonly mismatches: readonly string[]
}

interface TStaleFixtureResult {
  readonly cutoffTimestamp: number
  readonly cutoffBlocks: Readonly<Record<number, number>>
  readonly originalRecords: number
  readonly staleRecords: number
  readonly removedRecords: number
  readonly fixtureChunks: number
  readonly fixtureIndexes: number
  readonly fixtureEncodedBytes: number
}

interface TDerivedBenchmark {
  readonly timeframe: '1y' | 'all'
  readonly snapshot: THttpMeasurement
  readonly history: {
    readonly ledger: readonly THttpMeasurement[]
    readonly legacyBypass: THttpMeasurement
    readonly comparison: TComparisonResult
  }
  readonly protocolReturn: {
    readonly ledger: readonly THttpMeasurement[]
    readonly legacyBypass: THttpMeasurement
    readonly comparison: TComparisonResult
  }
  readonly breakdown: {
    readonly ledger: THttpMeasurement
    readonly legacyBypass: THttpMeasurement
    readonly comparison: TComparisonResult
  }
  readonly portfolioFlow: readonly TPortfolioFlowMeasurement[]
}

interface TWalletBenchmark {
  readonly address: string
  readonly walletHash: string
  readonly coldSync: THttpMeasurement
  readonly coldStorage: TStorageMeasurement
  readonly hotSyncs: readonly THttpMeasurement[]
  readonly hotStorage: TStorageMeasurement
  readonly rawParitySync: THttpMeasurement
  readonly staleFixture: TStaleFixtureResult
  readonly staleStorage: TStorageMeasurement
  readonly tailRepairSync: THttpMeasurement
  readonly repairedStorage: TStorageMeasurement
  readonly postRepairParity: TRevisionParityMeasurement
  readonly derived: readonly TDerivedBenchmark[]
  readonly finalStorage: TStorageMeasurement
}

const EVM_ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/
const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000
const OPAQUE_VALUE_PREFIX_BYTES = Buffer.byteLength('holdings-ledger:opaque:v1:', 'utf8')
const NUMERIC_ABSOLUTE_TOLERANCE = 1e-6
const NUMERIC_RELATIVE_TOLERANCE = 1e-8

function printUsage(): void {
  console.log(`Usage:
  bun scripts/benchmark-holdings-ledger.ts \\
    --base-url http://127.0.0.1:3010 \\
    --wallet 0x... --wallet 0x... \\
    --runs 3 \\
    --stale-days 7 \\
    --report docs/performance/holdings-ledger-benchmark.md \\
    --confirm-dev-redis

Render and compact an existing raw artifact without network or Redis access:
  bun scripts/benchmark-holdings-ledger.ts \\
    --render-existing docs/performance/holdings-ledger-benchmark.json \\
    --report docs/performance/holdings-ledger-benchmark.md

Required safety conditions:
  - base URL must be loopback
  - HOLDINGS_LEDGER_KEY_NAMESPACE must start with benchmark_
  - --confirm-dev-redis must be present
  - the isolated namespace is deleted and rescanned empty before reports are written`)
}

function getFlagValues(args: readonly string[], flag: string): string[] {
  return args.flatMap((value, index) => (value === flag && args[index + 1] ? [args[index + 1] as string] : []))
}

function getSingleFlag(args: readonly string[], flag: string, fallback: string): string {
  return getFlagValues(args, flag).at(-1) ?? fallback
}

function parsePositiveInteger(value: string, label: string): number {
  const parsed = /^\d+$/.test(value) ? Number(value) : Number.NaN
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`${label} must be a positive integer`)
  }
  return parsed
}

function parseArgs(args: readonly string[]): TBenchmarkArgs {
  if (args.includes('--help')) {
    printUsage()
    process.exit(0)
  }
  const wallets = getFlagValues(args, '--wallet')
  const renderExisting = getFlagValues(args, '--render-existing').at(-1)
  return {
    baseUrl: getSingleFlag(args, '--base-url', 'http://127.0.0.1:3010').replace(/\/$/, ''),
    wallets,
    runs: parsePositiveInteger(getSingleFlag(args, '--runs', '3'), 'runs'),
    staleDays: parsePositiveInteger(getSingleFlag(args, '--stale-days', '7'), 'stale-days'),
    reportPath: resolve(getSingleFlag(args, '--report', 'docs/performance/holdings-ledger-benchmark.md')),
    confirmedDevRedis: args.includes('--confirm-dev-redis'),
    renderExistingPath: renderExisting ? resolve(renderExisting) : null
  }
}

function assertSafeBenchmark(args: TBenchmarkArgs): void {
  const hostname = new URL(args.baseUrl).hostname
  const namespace = process.env.HOLDINGS_LEDGER_KEY_NAMESPACE ?? ''
  const reconcileSeconds = Number(process.env.HOLDINGS_LEDGER_RECONCILE_INTERVAL_SECONDS ?? '')
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(hostname)) {
    throw new Error('Benchmark base URL must use a loopback hostname')
  }
  if (!args.confirmedDevRedis) {
    throw new Error('Refusing Redis mutation without --confirm-dev-redis')
  }
  if (!/^benchmark_[A-Za-z0-9_-]{1,54}$/.test(namespace)) {
    throw new Error('HOLDINGS_LEDGER_KEY_NAMESPACE must be a unique benchmark_ namespace')
  }
  if (args.wallets.length === 0 || args.wallets.some((wallet) => !EVM_ADDRESS_PATTERN.test(wallet))) {
    throw new Error('At least one valid --wallet address is required')
  }
  if (!Number.isFinite(reconcileSeconds) || reconcileSeconds <= args.staleDays * 24 * 60 * 60) {
    throw new Error('Benchmark reconciliation interval must be longer than the synthetic stale period')
  }
  if (holdingsConfig.ledgerMode === 'off') {
    throw new Error('Holdings ledger mode must be enabled')
  }
}

async function mapSeries<TValue, TResult>(
  values: readonly TValue[],
  mapper: (value: TValue, index: number) => Promise<TResult>
): Promise<TResult[]> {
  return values.reduce<Promise<TResult[]>>(async (pending, value, index) => {
    const resolved = await pending
    return [...resolved, await mapper(value, index)]
  }, Promise.resolve([]))
}

function round(value: number, digits = 2): number {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

function median(values: readonly number[]): number {
  const sorted = [...values].toSorted((left, right) => left - right)
  const middle = Math.floor(sorted.length / 2)
  const value =
    sorted.length % 2 === 0 ? ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2 : (sorted[middle] ?? 0)
  return round(value)
}

function summarizeTimings(samples: readonly THttpMeasurement[]): TTimingSummary {
  const durations = samples.map(({ durationMs }) => durationMs)
  return {
    runs: samples.length,
    medianMs: median(durations),
    minimumMs: round(Math.min(...durations)),
    maximumMs: round(Math.max(...durations)),
    statuses: samples.map(({ status }) => status),
    medianBytes: median(samples.map(({ bytes }) => bytes))
  }
}

function parseJson(text: string): TJsonValue {
  try {
    return JSON.parse(text) as TJsonValue
  } catch {
    return { raw: text } as TJsonValue
  }
}

async function requestJson(args: TBenchmarkArgs, path: string, init: RequestInit = {}): Promise<THttpMeasurement> {
  const startedAt = performance.now()
  const headers = new Headers(init.headers)
  headers.set('Accept', 'application/json')
  if (process.env.ADMIN_SECRET) {
    headers.set('x-admin-secret', process.env.ADMIN_SECRET)
  }
  const response = await fetch(`${args.baseUrl}${path}`, {
    ...init,
    headers,
    signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS)
  })
  const text = await response.text()
  return {
    status: response.status,
    durationMs: round(performance.now() - startedAt),
    bytes: Buffer.byteLength(text, 'utf8'),
    body: parseJson(text),
    headers: {
      snapshot: response.headers.get('x-holdings-ledger-snapshot'),
      revision: response.headers.get('x-holdings-ledger-revision'),
      sourceGeneration: response.headers.get('x-holdings-ledger-source-generation'),
      runtimeFingerprint: response.headers.get('x-holdings-ledger-runtime-fingerprint')
    }
  }
}

function postJson(
  args: TBenchmarkArgs,
  path: string,
  body: Readonly<Record<string, unknown>>
): Promise<THttpMeasurement> {
  return requestJson(args, path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
}

function requireSuccessfulMeasurement(measurement: THttpMeasurement, label: string): void {
  if (measurement.status < 200 || measurement.status >= 300) {
    throw new Error(`${label} failed with HTTP ${measurement.status}: ${JSON.stringify(measurement.body)}`)
  }
}

function requireSyncMeasurement(
  measurement: THttpMeasurement,
  label: string,
  expectedSyncType: 'bootstrap' | 'warm'
): void {
  if (measurement.status !== 200) {
    throw new Error(`${label} did not complete with HTTP 200: ${JSON.stringify(measurement.body)}`)
  }
  const body = getBodyRecord(measurement)
  if (body.status !== 'updated' && body.status !== 'unchanged') {
    throw new Error(`${label} did not return a completed sync status`)
  }
  if (body.syncType !== expectedSyncType) {
    throw new Error(`${label} returned syncType ${String(body.syncType)} instead of ${expectedSyncType}`)
  }
  if (typeof body.revision !== 'string') {
    throw new Error(`${label} did not return a revision`)
  }
}

function getBodyRecord(measurement: THttpMeasurement): Readonly<Record<string, TJsonValue>> {
  if (measurement.body === null || Array.isArray(measurement.body) || typeof measurement.body !== 'object') {
    throw new Error('Expected a JSON response object')
  }
  return measurement.body
}

async function assertServerRuntimeScope(args: TBenchmarkArgs): Promise<void> {
  const address = args.wallets[0]
  if (!address) {
    throw new Error('Runtime preflight requires a benchmark wallet')
  }
  const measurement = await requestJson(args, createQueryPath('/api/holdings/ledger/status', { address }))
  if (measurement.status !== 200) {
    throw new Error(`Ledger runtime preflight failed with HTTP ${measurement.status}`)
  }
  const expected = getHoldingsLedgerRuntimeFingerprint()
  if (measurement.headers.runtimeFingerprint !== expected) {
    throw new Error('Local server and benchmark process do not share the same ledger runtime scope')
  }
}

async function scanKeys(redis: Redis, pattern: string, cursor = '0', collected: string[] = []): Promise<string[]> {
  const [nextCursor, keys] = await redis.scan(cursor, { match: pattern, count: 500 })
  const next = [...collected, ...keys]
  return nextCursor === '0' ? next.toSorted() : scanKeys(redis, pattern, nextCursor, next)
}

function getWalletPrefix(walletHash: string): string {
  return getLedgerHeadKey(walletHash).slice(0, -':head'.length)
}

async function deleteKeys(redis: Redis, keys: readonly string[]): Promise<void> {
  const batches = Array.from({ length: Math.ceil(keys.length / 100) }, (_, index) =>
    keys.slice(index * 100, index * 100 + 100)
  )
  await mapSeries(batches, async (batch) => {
    if (batch.length > 0) {
      await redis.del(...batch)
    }
  })
}

async function cleanupWalletNamespace(redis: Redis, walletHash: string): Promise<number> {
  const keys = await scanKeys(redis, `${getWalletPrefix(walletHash)}:*`)
  await deleteKeys(redis, keys)
  const remaining = await scanKeys(redis, `${getWalletPrefix(walletHash)}:*`)
  if (remaining.length > 0) {
    throw new Error('Benchmark Redis namespace cleanup verification failed')
  }
  return keys.length
}

function classifyKey(key: string): string {
  if (key.includes(':manifest:')) return 'manifest'
  if (key.includes(':chunk:')) return 'chunk'
  if (key.includes(':index:')) return 'index'
  if (key.includes(':snapshot:')) return 'snapshot'
  if (key.endsWith(':head:previous')) return 'previous-head'
  if (key.endsWith(':head')) return 'head'
  if (key.endsWith(':sync-status')) return 'sync-status'
  if (key.endsWith(':fence')) return 'fence'
  if (key.endsWith(':lock')) return 'lock'
  return 'other'
}

async function readPinnedManifestKeys(redis: Redis, pinKey: string): Promise<string[]> {
  const pinResult = await readLedgerValue<TLedgerSnapshotPinV1>({ redis, key: pinKey, parse: parseLedgerSnapshotPin })
  if (pinResult.status !== 'ok') {
    return [pinKey]
  }
  const manifestResult = await readLedgerValue<TLedgerRevisionManifestV1>({
    redis,
    key: pinResult.value.head.manifestKey,
    parse: parseLedgerRevisionManifest
  })
  return manifestResult.status === 'ok'
    ? [
        pinKey,
        pinResult.value.head.manifestKey,
        ...manifestResult.value.chunks.map(({ key }) => key),
        ...manifestResult.value.indexes.map(({ key }) => key)
      ]
    : [pinKey]
}

function sumKeySizes(keys: ReadonlySet<string>, sizes: ReadonlyMap<string, number>): number {
  return Array.from(keys).reduce((total, key) => total + (sizes.get(key) ?? 0), 0)
}

async function measureStorage(redis: Redis, walletHash: string): Promise<TStorageMeasurement> {
  const prefix = getWalletPrefix(walletHash)
  const keys = await scanKeys(redis, `${prefix}:*`)
  const sizePipeline = redis.pipeline()
  keys.forEach((key) => {
    sizePipeline.strlen(key)
  })
  const sizeValues = keys.length > 0 ? await sizePipeline.exec<number[]>() : []
  const sizes = new Map(keys.map((key, index) => [key, Number(sizeValues[index] ?? 0)]))
  const active = await readVerifiedLedgerRevision({ redis, walletHash, retryIncomplete: false })
  const previous = await readVerifiedLedgerRevision({
    redis,
    walletHash,
    usePreviousHead: true,
    retryIncomplete: false
  })
  const activeKeys = new Set<string>(
    active.status === 'ready'
      ? [
          getLedgerHeadKey(walletHash),
          active.head.manifestKey,
          ...active.manifest.chunks.map(({ key }) => key),
          ...active.manifest.indexes.map(({ key }) => key)
        ]
      : []
  )
  const previousKeys = new Set<string>(
    previous.status === 'ready'
      ? [
          getLedgerPreviousHeadKey(walletHash),
          previous.head.manifestKey,
          ...previous.manifest.chunks.map(({ key }) => key),
          ...previous.manifest.indexes.map(({ key }) => key)
        ]
      : []
  )
  const pinKeys = keys.filter((key) => key.includes(':snapshot:'))
  const pinnedKeys = new Set((await mapSeries(pinKeys, (key) => readPinnedManifestKeys(redis, key))).flat())
  const retainedKeys = new Set([...activeKeys, ...previousKeys, ...pinnedKeys])
  const immutableKeys = keys.filter((key) => ['manifest', 'chunk', 'index'].includes(classifyKey(key)))
  const orphanKeys = new Set(immutableKeys.filter((key) => !retainedKeys.has(key)))
  const byClass = Object.fromEntries(
    Array.from(new Set(keys.map(classifyKey))).map((keyClass) => {
      const classKeys = keys.filter((key) => classifyKey(key) === keyClass)
      return [
        keyClass,
        {
          keys: classKeys.length,
          keyBytes: classKeys.reduce((total, key) => total + Buffer.byteLength(key, 'utf8'), 0),
          valueBytes: classKeys.reduce((total, key) => total + (sizes.get(key) ?? 0), 0)
        }
      ]
    })
  )
  return {
    keys: keys.length,
    keyBytes: keys.reduce((total, key) => total + Buffer.byteLength(key, 'utf8'), 0),
    valueBytes: keys.reduce((total, key) => total + (sizes.get(key) ?? 0), 0),
    activeReachableBytes: sumKeySizes(activeKeys, sizes),
    retainedReachableBytes: sumKeySizes(retainedKeys, sizes),
    orphanDataBytes: sumKeySizes(orphanKeys, sizes),
    activeLogicalBytes: active.status === 'ready' ? active.manifest.activeEncodedBytes : 0,
    activeRecords: active.status === 'ready' ? active.manifest.recordCount : 0,
    activeChunks: active.status === 'ready' ? active.manifest.chunks.length : 0,
    activeIndexes: active.status === 'ready' ? active.manifest.indexes.length : 0,
    activeRevision: active.status === 'ready' ? active.manifest.revision : null,
    byClass
  }
}

async function resolveCutoffBlock(chainId: number, cutoffTimestamp: number): Promise<number> {
  const chain = SUPPORTED_CHAINS.find(({ id }) => id === chainId)
  if (!chain) {
    throw new Error(`No DefiLlama chain mapping for ${chainId}`)
  }
  const response = await fetch(`https://coins.llama.fi/block/${chain.defillamaPrefix}/${cutoffTimestamp}`, {
    signal: AbortSignal.timeout(30_000)
  })
  const payload = (await response.json()) as { readonly height?: unknown }
  if (!response.ok || !Number.isSafeInteger(payload.height) || Number(payload.height) < 0) {
    throw new Error(`Could not resolve stale cutoff block for chain ${chainId}`)
  }
  return Number(payload.height)
}

function createStoredChunks(walletHash: string, chunks: ReturnType<typeof encodeLedgerChunks>) {
  return chunks.map((chunk) => ({ ...chunk, key: getLedgerChunkKey(walletHash, chunk.descriptor.checksum) }))
}

function createStoredIndexes(walletHash: string, indexes: ReturnType<typeof encodeLedgerIndexShards>) {
  return indexes.map((index) => ({
    ...index,
    key: getLedgerIndexShardKey(walletHash, index.descriptor.shard, index.descriptor.checksum)
  }))
}

async function installStaleFixture(redis: Redis, walletHash: string, staleDays: number): Promise<TStaleFixtureResult> {
  const current = await readVerifiedLedgerRevision({ redis, walletHash, retryIncomplete: false })
  if (current.status !== 'ready') {
    throw new Error('Cannot create stale fixture without a verified current revision')
  }
  const cutoffTimestamp = Math.floor(Date.now() / 1000) - staleDays * 24 * 60 * 60
  const metadataByChain = new Map((await fetchEnvioLedgerMetadata()).map((entry) => [entry.chainId, entry]))
  const cutoffEntries = await Promise.all(
    current.manifest.chainScope.map(async (chainId) => {
      const metadata = metadataByChain.get(chainId)
      if (!metadata) {
        throw new Error(`Envio metadata is missing chain ${chainId}`)
      }
      const resolved = await resolveCutoffBlock(chainId, cutoffTimestamp)
      return [chainId, Math.min(resolved, metadata.progressBlock)] as const
    })
  )
  const cutoffBlocks = Object.fromEntries(cutoffEntries) as Readonly<Record<number, number>>
  const streams = Object.fromEntries(
    LEDGER_STREAMS.map((stream) => [
      stream,
      current.verified.streams[stream].filter(
        (event) => event.blockTimestamp <= cutoffTimestamp && event.blockNumber <= (cutoffBlocks[event.chainId] ?? -1)
      )
    ])
  ) as unknown as TLedgerSixStreams
  const metadata = current.manifest.chainScope.map((chainId): TEnvioLedgerMetadata => {
    const source = metadataByChain.get(chainId)
    if (!source) {
      throw new Error(`Envio metadata is missing chain ${chainId}`)
    }
    const progressBlock = cutoffBlocks[chainId] ?? source.startBlock
    return {
      ...source,
      progressBlock,
      eventsProcessed: LEDGER_STREAMS.reduce(
        (total, stream) => total + streams[stream].filter((event) => event.chainId === chainId).length,
        0
      ),
      bufferBlock: progressBlock,
      sourceBlock: progressBlock,
      readyAt: new Date(cutoffTimestamp * 1000).toISOString(),
      isReady: true
    }
  })
  const chunks = encodeLedgerChunks(streams)
  const indexes = encodeLedgerIndexShards(chunks)
  const coverage = createLedgerCoverage(streams, metadata).map(
    (entry): TLedgerStreamCoverageV1 => ({ ...entry, checkpoint: null, checkpointState: 'unpinned' })
  )
  const nowMs = cutoffTimestamp * 1000
  const revision = `benchmark_${nowMs.toString(36)}_${randomUUID().replaceAll('-', '')}`
  const manifest = createLedgerRevisionManifest({
    calculationVersion: current.manifest.calculationVersion,
    walletHash,
    sourceFingerprint: current.manifest.sourceFingerprint,
    sourceGeneration: current.manifest.sourceGeneration,
    revision,
    parentRevision: current.manifest.revision,
    chainScope: current.manifest.chainScope,
    coverage,
    chunks,
    indexes,
    dependencies: createLedgerDependencies(streams),
    invalidationEpochs: current.manifest.invalidationEpochs,
    dirtyFromTimestamp: null,
    dirtyFromDate: null,
    dirtyReasons: [],
    createdAtMs: Math.min(current.manifest.createdAtMs, nowMs),
    updatedAtMs: nowMs,
    reconciledAtMs: nowMs
  })
  const storedChunks = createStoredChunks(walletHash, chunks)
  const storedIndexes = createStoredIndexes(walletHash, indexes)
  const verified = verifyLedgerRevision(manifest, storedChunks, storedIndexes)
  const blobResults = await writeImmutableLedgerBlobs({
    redis,
    items: [
      ...chunks.map((chunk) => ({
        kind: 'chunk' as const,
        key: getLedgerChunkKey(walletHash, chunk.descriptor.checksum),
        checksum: chunk.descriptor.checksum,
        value: chunk.data
      })),
      ...indexes.map((index) => ({
        kind: 'index' as const,
        key: getLedgerIndexShardKey(walletHash, index.descriptor.shard, index.descriptor.checksum),
        checksum: index.descriptor.checksum,
        shard: index.descriptor.shard,
        value: index.data
      }))
    ]
  })
  if (blobResults.some(({ status }) => status !== 'written' && status !== 'exists')) {
    throw new Error('Could not publish stale fixture blobs')
  }
  const lockResult = await acquireLedgerLock({
    redis,
    lockKey: getLedgerLockKey(walletHash),
    fenceKey: getLedgerFenceKey(walletHash),
    owner: `benchmark-${randomUUID()}`,
    ttlMs: 5 * 60 * 1000
  })
  if (lockResult.status !== 'acquired') {
    throw new Error('Could not acquire ledger lock for stale fixture')
  }
  try {
    const commit = await commitVerifiedLedgerRevision({
      redis,
      lock: lockResult.lock,
      expectedHead: current.head,
      revision: verified,
      syncStatus: {
        schemaVersion: LEDGER_SCHEMA_VERSION,
        state: 'complete',
        sourceGeneration: manifest.sourceGeneration,
        revision: manifest.revision,
        reasonCode: null,
        updatedAtMs: nowMs
      }
    })
    if (commit.status !== 'committed') {
      throw new Error(`Could not activate stale fixture: ${commit.status}`)
    }
  } finally {
    await releaseLedgerLock({ redis, lockKey: getLedgerLockKey(walletHash), lock: lockResult.lock })
  }
  return {
    cutoffTimestamp,
    cutoffBlocks,
    originalRecords: current.manifest.recordCount,
    staleRecords: manifest.recordCount,
    removedRecords: current.manifest.recordCount - manifest.recordCount,
    fixtureChunks: manifest.chunks.length,
    fixtureIndexes: manifest.indexes.length,
    fixtureEncodedBytes: manifest.activeEncodedBytes
  }
}

function bindStreamsToManifestCoverage(
  streams: TLedgerSixStreams,
  manifest: TLedgerRevisionManifestV1
): TLedgerSixStreams {
  const completeThroughBlocks = new Map(
    manifest.coverage.map(({ stream, chainId, completeThroughBlock }) => [`${stream}:${chainId}`, completeThroughBlock])
  )
  return Object.fromEntries(
    LEDGER_STREAMS.map((stream) => [
      stream,
      streams[stream]
        .filter((event) => {
          const completeThroughBlock = completeThroughBlocks.get(`${stream}:${event.chainId}`)
          return completeThroughBlock !== undefined && event.blockNumber <= completeThroughBlock
        })
        .toSorted(compareLedgerOrder)
    ])
  ) as unknown as TLedgerSixStreams
}

async function compareActiveRevisionToLegacy(args: {
  readonly redis: Redis
  readonly walletHash: string
  readonly address: string
  readonly expectedRevision: string
}): Promise<TRevisionParityMeasurement> {
  const startedAt = performance.now()
  const active = await readVerifiedLedgerRevision({
    redis: args.redis,
    walletHash: args.walletHash,
    retryIncomplete: false
  })
  if (active.status !== 'ready' || active.manifest.revision !== args.expectedRevision) {
    throw new Error('Tail-repair parity could not load the exact timed revision')
  }
  const legacy = await fetchUserLedgerSourceEvents(args.address)
  const expected = stringifyCanonicalLedgerValue(
    bindStreamsToManifestCoverage(active.verified.streams, active.manifest)
  )
  const actual = stringifyCanonicalLedgerValue(bindStreamsToManifestCoverage(legacy, active.manifest))
  return {
    status: expected === actual ? 'match' : 'mismatch',
    durationMs: round(performance.now() - startedAt),
    revision: active.manifest.revision
  }
}

function getSortKey(parentKey: string, value: TJsonValue): string | null {
  if (typeof value === 'string' && parentKey.toLowerCase().includes('issue')) return value
  if (value === null || Array.isArray(value) || typeof value !== 'object') return null
  const record = value as Readonly<Record<string, TJsonValue>>
  if (parentKey === 'dataPoints') return String(record.timestamp ?? record.date ?? '')
  if (parentKey === 'familySeries' || parentKey === 'vaults') {
    return `${String(record.chainId ?? '')}:${String(record.vaultAddress ?? '')}`
  }
  return null
}

function normalizeJson(value: TJsonValue, parentKey = ''): TJsonValue {
  if (typeof value === 'string') {
    return EVM_ADDRESS_PATTERN.test(value) ? value.toLowerCase() : value
  }
  if (value === null || typeof value !== 'object') {
    return value
  }
  if (Array.isArray(value)) {
    const normalized = value.map((entry) => normalizeJson(entry, parentKey))
    return normalized.every((entry) => getSortKey(parentKey, entry) !== null)
      ? normalized.toSorted((left, right) =>
          String(getSortKey(parentKey, left)).localeCompare(String(getSortKey(parentKey, right)))
        )
      : normalized
  }
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => key !== 'generatedAt')
      .toSorted(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, normalizeJson(entry, key)])
  ) as TJsonValue
}

function hashJson(value: TJsonValue): string {
  return createHash('sha256')
    .update(JSON.stringify(normalizeJson(value)))
    .digest('hex')
}

function truncateEvidence(value: string, maximumCharacters = 800): string {
  return value.length <= maximumCharacters || value.includes('… [truncated ')
    ? value
    : `${value.slice(0, maximumCharacters)}… [truncated ${value.length - maximumCharacters} characters]`
}

function compactHttpMeasurement(measurement: THttpMeasurement): THttpMeasurement {
  if (
    measurement.body !== null &&
    !Array.isArray(measurement.body) &&
    typeof measurement.body === 'object' &&
    measurement.body.omitted === true
  ) {
    return measurement
  }
  return {
    ...measurement,
    body: {
      omitted: true,
      normalizedSha256: hashJson(measurement.body)
    }
  }
}

function compactComparison(comparison: TComparisonResult): TComparisonResult {
  return {
    ...comparison,
    mismatches: comparison.mismatches.map((mismatch) => truncateEvidence(mismatch))
  }
}

function compactWalletArtifact(wallet: TWalletBenchmark): TWalletBenchmark {
  return {
    ...wallet,
    derived: wallet.derived.map((derived) => ({
      ...derived,
      history: {
        ledger: derived.history.ledger.map(compactHttpMeasurement),
        legacyBypass: compactHttpMeasurement(derived.history.legacyBypass),
        comparison: compactComparison(derived.history.comparison)
      },
      protocolReturn: {
        ledger: derived.protocolReturn.ledger.map(compactHttpMeasurement),
        legacyBypass: compactHttpMeasurement(derived.protocolReturn.legacyBypass),
        comparison: compactComparison(derived.protocolReturn.comparison)
      },
      breakdown: {
        ledger: compactHttpMeasurement(derived.breakdown.ledger),
        legacyBypass: compactHttpMeasurement(derived.breakdown.legacyBypass),
        comparison: compactComparison(derived.breakdown.comparison)
      }
    }))
  }
}

function compareJson(left: THttpMeasurement, right: THttpMeasurement): TComparisonResult {
  const normalizedLeft = normalizeJson(left.body)
  const normalizedRight = normalizeJson(right.body)
  const state = {
    mismatches: [] as string[],
    maximumAbsoluteDelta: 0,
    maximumRelativeDelta: 0
  }
  const compare = (leftValue: TJsonValue | undefined, rightValue: TJsonValue | undefined, path: string): void => {
    if (typeof leftValue === 'number' && typeof rightValue === 'number') {
      const absolute = Math.abs(leftValue - rightValue)
      const relative = absolute / Math.max(Math.abs(leftValue), Math.abs(rightValue), 1)
      state.maximumAbsoluteDelta = Math.max(state.maximumAbsoluteDelta, absolute)
      state.maximumRelativeDelta = Math.max(state.maximumRelativeDelta, relative)
      if (
        absolute >
        Math.max(
          NUMERIC_ABSOLUTE_TOLERANCE,
          NUMERIC_RELATIVE_TOLERANCE * Math.max(Math.abs(leftValue), Math.abs(rightValue))
        )
      ) {
        state.mismatches.push(`${path}: ${leftValue} != ${rightValue}`)
      }
      return
    }
    if (Array.isArray(leftValue) && Array.isArray(rightValue)) {
      if (leftValue.length !== rightValue.length) {
        state.mismatches.push(`${path}.length: ${leftValue.length} != ${rightValue.length}`)
      }
      Array.from({ length: Math.max(leftValue.length, rightValue.length) }, (_, index) =>
        compare(leftValue[index], rightValue[index], `${path}[${index}]`)
      )
      return
    }
    if (
      leftValue !== null &&
      rightValue !== null &&
      typeof leftValue === 'object' &&
      typeof rightValue === 'object' &&
      !Array.isArray(leftValue) &&
      !Array.isArray(rightValue)
    ) {
      const leftRecord = leftValue as Readonly<Record<string, TJsonValue>>
      const rightRecord = rightValue as Readonly<Record<string, TJsonValue>>
      const keys = Array.from(new Set([...Object.keys(leftRecord), ...Object.keys(rightRecord)])).toSorted()
      keys.forEach((key) => {
        compare(leftRecord[key], rightRecord[key], `${path}.${key}`)
      })
      return
    }
    if (leftValue !== rightValue) {
      state.mismatches.push(`${path}: ${JSON.stringify(leftValue)} != ${JSON.stringify(rightValue)}`)
    }
  }
  const validStatusPair = (left.status === 200 && right.status === 200) || (left.status === 404 && right.status === 404)
  if (!validStatusPair) {
    state.mismatches.push(`http.status.invalid: ${left.status}/${right.status}`)
  } else if (left.status !== right.status) {
    state.mismatches.push(`http.status: ${left.status} != ${right.status}`)
  }
  compare(normalizedLeft, normalizedRight, '$')
  return {
    match: state.mismatches.length === 0,
    leftStatus: left.status,
    rightStatus: right.status,
    leftHash: hashJson(normalizedLeft),
    rightHash: hashJson(normalizedRight),
    maximumAbsoluteDelta: state.maximumAbsoluteDelta,
    maximumRelativeDelta: state.maximumRelativeDelta,
    mismatches: state.mismatches.slice(0, 30)
  }
}

function compareHttpSeries(samples: readonly THttpMeasurement[], oracle: THttpMeasurement): TComparisonResult {
  const first = samples[0]
  if (!first) {
    throw new Error('Cannot compare an empty HTTP measurement series')
  }
  const comparison = compareJson(first, oracle)
  const seriesMismatches = samples.flatMap((sample, index) => {
    const validStatus = sample.status === 200 || sample.status === 404
    return validStatus && sample.status === first.status
      ? []
      : [`http.series[${index}].status: ${sample.status} (expected ${first.status}, valid 200/404)`]
  })
  return {
    ...comparison,
    match: comparison.match && seriesMismatches.length === 0,
    mismatches: [...comparison.mismatches, ...seriesMismatches].slice(0, 30)
  }
}

async function measureHandler(handler: () => Promise<Response>): Promise<THttpMeasurement> {
  const startedAt = performance.now()
  const response = await handler()
  const text = await response.text()
  return {
    status: response.status,
    durationMs: round(performance.now() - startedAt),
    bytes: Buffer.byteLength(text, 'utf8'),
    body: parseJson(text),
    headers: {
      snapshot: response.headers.get('x-holdings-ledger-snapshot'),
      revision: response.headers.get('x-holdings-ledger-revision'),
      sourceGeneration: response.headers.get('x-holdings-ledger-source-generation'),
      runtimeFingerprint: response.headers.get('x-holdings-ledger-runtime-fingerprint')
    }
  }
}

function createQueryPath(path: string, values: Readonly<Record<string, string>>): string {
  return `${path}?${new URLSearchParams(values).toString()}`
}

async function requestPortfolioFlow(
  args: TBenchmarkArgs,
  historyPath: string,
  protocolReturnPath: string,
  expectedSnapshotId: string
): Promise<TPortfolioFlowMeasurement> {
  const startedAt = performance.now()
  const [history, protocolReturn] = await Promise.all([
    requestJson(args, historyPath),
    requestJson(args, protocolReturnPath)
  ])
  if (history.headers.snapshot !== expectedSnapshotId || protocolReturn.headers.snapshot !== expectedSnapshotId) {
    throw new Error('Concurrent portfolio flow did not use the expected live snapshot')
  }
  return {
    durationMs: round(performance.now() - startedAt),
    bytes: history.bytes + protocolReturn.bytes,
    historyStatus: history.status,
    protocolReturnStatus: protocolReturn.status,
    historySnapshot: history.headers.snapshot,
    protocolReturnSnapshot: protocolReturn.headers.snapshot
  }
}

function requirePinnedMeasurement(measurement: THttpMeasurement, snapshotId: string, label: string): void {
  if (measurement.headers.snapshot !== snapshotId) {
    throw new Error(`${label} did not use the expected live snapshot`)
  }
}

async function benchmarkDerivedTimeframe(
  args: TBenchmarkArgs,
  address: string,
  timeframe: '1y' | 'all'
): Promise<TDerivedBenchmark> {
  const snapshot = await postJson(args, '/api/holdings/ledger/snapshot', { address, refresh: false })
  requireSuccessfulMeasurement(snapshot, `${address} ${timeframe} snapshot`)
  const snapshotBody = getBodyRecord(snapshot)
  const snapshotId = snapshotBody.snapshotId
  const settledTimestamp = snapshotBody.latestSettledDayTimestamp
  if (typeof snapshotId !== 'string' || typeof settledTimestamp !== 'number') {
    throw new Error('Snapshot response is missing its id or settled timestamp')
  }
  const common = { address, snapshotId, timeframe }
  const ledgerHistoryPath = createQueryPath('/api/holdings/ledger/history', common)
  const ledgerHistory = await mapSeries(Array.from({ length: args.runs }), () => requestJson(args, ledgerHistoryPath))
  ledgerHistory.forEach((measurement) => {
    requirePinnedMeasurement(measurement, snapshotId, `${address} ${timeframe} history`)
  })
  const legacyHistoryUrl = `${args.baseUrl}${createQueryPath('/api/holdings/history', { address, timeframe, fetchType: 'seq' })}`
  const legacyHistory = await measureHandler(() =>
    handleHoldingsHistoryRequest(new Request(legacyHistoryUrl), { cacheMode: 'bypass' })
  )
  const ledgerProtocolPath = createQueryPath('/api/holdings/ledger/protocol-return/history', common)
  const ledgerProtocol = await mapSeries(Array.from({ length: args.runs }), () => requestJson(args, ledgerProtocolPath))
  ledgerProtocol.forEach((measurement) => {
    requirePinnedMeasurement(measurement, snapshotId, `${address} ${timeframe} protocol return`)
  })
  const legacyProtocolUrl = `${args.baseUrl}${createQueryPath('/api/holdings/protocol-return/history', {
    address,
    timeframe,
    fetchType: 'seq',
    paginationMode: 'paged'
  })}`
  const legacyProtocol = await measureHandler(() =>
    handleHoldingsProtocolReturnHistoryRequest(new Request(legacyProtocolUrl), { cacheMode: 'bypass' })
  )
  const date = new Date(settledTimestamp * 1000).toISOString().slice(0, 10)
  const ledgerBreakdownPath = createQueryPath('/api/holdings/ledger/breakdown', { address, snapshotId, date })
  const ledgerBreakdown = await requestJson(args, ledgerBreakdownPath)
  requirePinnedMeasurement(ledgerBreakdown, snapshotId, `${address} ${timeframe} breakdown`)
  const legacyBreakdownUrl = `${args.baseUrl}${createQueryPath('/api/holdings/breakdown', {
    address,
    date,
    fetchType: 'seq',
    paginationMode: 'paged'
  })}`
  const legacyBreakdown = await measureHandler(() =>
    handleHoldingsBreakdownRequest(new Request(legacyBreakdownUrl), { cacheMode: 'bypass' })
  )
  const portfolioFlow = await mapSeries(Array.from({ length: args.runs }), () =>
    requestPortfolioFlow(args, ledgerHistoryPath, ledgerProtocolPath, snapshotId)
  )
  return {
    timeframe,
    snapshot,
    history: {
      ledger: ledgerHistory,
      legacyBypass: legacyHistory,
      comparison: compareHttpSeries(ledgerHistory, legacyHistory)
    },
    protocolReturn: {
      ledger: ledgerProtocol,
      legacyBypass: legacyProtocol,
      comparison: compareHttpSeries(ledgerProtocol, legacyProtocol)
    },
    breakdown: {
      ledger: ledgerBreakdown,
      legacyBypass: legacyBreakdown,
      comparison: compareJson(ledgerBreakdown, legacyBreakdown)
    },
    portfolioFlow
  }
}

async function benchmarkWallet(args: TBenchmarkArgs, redis: Redis, address: string): Promise<TWalletBenchmark> {
  const walletHash = hashLedgerWalletAddress(address)
  const existingKeys = await scanKeys(redis, `${getWalletPrefix(walletHash)}:*`)
  if (existingKeys.length > 0) {
    throw new Error(`Isolated benchmark namespace was not empty for ${address}`)
  }
  console.log(`[benchmark] ${address}: cold sync`)
  const coldSync = await postJson(args, '/api/holdings/ledger/sync', { address })
  requireSyncMeasurement(coldSync, `${address} cold sync`, 'bootstrap')
  const coldStorage = await measureStorage(redis, walletHash)
  if (coldStorage.activeRevision !== getBodyRecord(coldSync).revision) {
    throw new Error(`${address} cold sync was not committed in the expected Redis runtime scope`)
  }
  console.log(`[benchmark] ${address}: ${args.runs} hot sync runs`)
  const hotSyncs = await mapSeries(Array.from({ length: args.runs }), () =>
    postJson(args, '/api/holdings/ledger/sync', { address })
  )
  hotSyncs.forEach((measurement) => {
    requireSyncMeasurement(measurement, `${address} hot sync`, 'warm')
  })
  const hotStorage = await measureStorage(redis, walletHash)
  if (hotStorage.activeRevision !== getBodyRecord(hotSyncs.at(-1) as THttpMeasurement).revision) {
    throw new Error(`${address} hot sync head does not match the expected Redis runtime scope`)
  }
  console.log(`[benchmark] ${address}: exact raw-event parity`)
  const rawParitySync = await postJson(args, '/api/holdings/ledger/sync', { address, compareLegacy: true })
  requireSyncMeasurement(rawParitySync, `${address} raw parity sync`, 'warm')
  console.log(`[benchmark] ${address}: installing ${args.staleDays}-day stale fixture`)
  const staleFixture = await installStaleFixture(redis, walletHash, args.staleDays)
  const staleStorage = await measureStorage(redis, walletHash)
  console.log(`[benchmark] ${address}: tail repair sync`)
  const tailRepairSync = await postJson(args, '/api/holdings/ledger/sync', { address })
  requireSyncMeasurement(tailRepairSync, `${address} tail repair sync`, 'warm')
  const repairedStorage = await measureStorage(redis, walletHash)
  if (repairedStorage.activeRecords < staleFixture.staleRecords) {
    throw new Error(`${address} tail repair reduced the verified record count`)
  }
  const tailRevision = getBodyRecord(tailRepairSync).revision
  if (typeof tailRevision !== 'string' || repairedStorage.activeRevision !== tailRevision) {
    throw new Error(`${address} tail repair head does not match the expected Redis runtime scope`)
  }
  console.log(`[benchmark] ${address}: post-repair exact raw-event parity`)
  const postRepairParity = await compareActiveRevisionToLegacy({
    redis,
    walletHash,
    address,
    expectedRevision: tailRevision
  })
  console.log(`[benchmark] ${address}: 1y/all derived calculations and correctness`)
  const derived = await mapSeries(['1y', 'all'] as const, (timeframe) =>
    benchmarkDerivedTimeframe(args, address, timeframe)
  )
  const finalStorage = await measureStorage(redis, walletHash)
  return {
    address,
    walletHash,
    coldSync,
    coldStorage,
    hotSyncs,
    hotStorage,
    rawParitySync,
    staleFixture,
    staleStorage,
    tailRepairSync,
    repairedStorage,
    postRepairParity,
    derived,
    finalStorage
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 ** 2) return `${round(bytes / 1024, 1)} KiB`
  if (bytes < 1024 ** 3) return `${round(bytes / 1024 ** 2, 2)} MiB`
  if (bytes < 1024 ** 4) return `${round(bytes / 1024 ** 3, 2)} GiB`
  return `${round(bytes / 1024 ** 4, 2)} TiB`
}

function getSyncField(measurement: THttpMeasurement, path: readonly string[]): TJsonValue | undefined {
  return path.reduce<TJsonValue | undefined>((value, key) => {
    return value && !Array.isArray(value) && typeof value === 'object'
      ? (value as Readonly<Record<string, TJsonValue>>)[key]
      : undefined
  }, measurement.body)
}

function getParityStatus(measurement: THttpMeasurement): string {
  return String(getSyncField(measurement, ['parity', 'status']) ?? 'unknown')
}

function getWalletCorrectnessStatus(wallet: TWalletBenchmark): 'PASS' | 'FAIL' {
  const derivedMatches = wallet.derived.every(
    ({ history, protocolReturn, breakdown }) =>
      history.comparison.match && protocolReturn.comparison.match && breakdown.comparison.match
  )
  const flowStatusesAreValid = wallet.derived.every(({ portfolioFlow }) =>
    portfolioFlow.every(
      ({ historyStatus, protocolReturnStatus }) =>
        (historyStatus === 200 || historyStatus === 404) &&
        (protocolReturnStatus === 200 || protocolReturnStatus === 404)
    )
  )
  return getParityStatus(wallet.rawParitySync) === 'match' &&
    wallet.postRepairParity.status === 'match' &&
    derivedMatches &&
    flowStatusesAreValid
    ? 'PASS'
    : 'FAIL'
}

function renderReport(args: TBenchmarkArgs, wallets: readonly TWalletBenchmark[], startedAt: string): string {
  const zeroEventWallets = wallets.filter(({ repairedStorage }) => repairedStorage.activeRecords === 0)
  const populatedWallets = wallets.filter(({ repairedStorage }) => repairedStorage.activeRecords > 0)
  const validEmptyWallets = zeroEventWallets.filter((wallet) => getWalletCorrectnessStatus(wallet) === 'PASS')
  const inconsistentEmptyWallets = zeroEventWallets.filter((wallet) => getWalletCorrectnessStatus(wallet) === 'FAIL')
  const trueTailWallets = wallets.filter(({ staleFixture }) => staleFixture.removedRecords > 0)
  const summaryRows = wallets
    .map((wallet) => {
      const hot = summarizeTimings(wallet.hotSyncs)
      return `| \`${wallet.address}\` | ${wallet.coldSync.durationMs} ms | ${hot.medianMs} ms | ${wallet.tailRepairSync.durationMs} ms | ${wallet.repairedStorage.activeRecords.toLocaleString()} | ${formatBytes(wallet.repairedStorage.activeLogicalBytes)} | ${formatBytes(wallet.finalStorage.valueBytes)} | ${getWalletCorrectnessStatus(wallet)} |`
    })
    .join('\n')
  const refreshDetails = wallets
    .map((wallet) => {
      const coldType = String(getSyncField(wallet.coldSync, ['syncType']) ?? 'unknown')
      const tailType = String(getSyncField(wallet.tailRepairSync, ['syncType']) ?? 'unknown')
      const coldPages = String(getSyncField(wallet.coldSync, ['envio', 'pages']) ?? 'n/a')
      const coldRows = String(getSyncField(wallet.coldSync, ['envio', 'rows']) ?? 'n/a')
      const tailPages = String(getSyncField(wallet.tailRepairSync, ['envio', 'pages']) ?? 'n/a')
      const tailRows = String(getSyncField(wallet.tailRepairSync, ['envio', 'rows']) ?? 'n/a')
      return `### ${wallet.address}

- Cold: ${wallet.coldSync.durationMs} ms wall, type \`${coldType}\`, ${coldPages} pages / ${coldRows} rows.
- Hot: ${JSON.stringify(summarizeTimings(wallet.hotSyncs))}.
- One-week fixture: ${wallet.staleFixture.originalRecords.toLocaleString()} → ${wallet.staleFixture.staleRecords.toLocaleString()} records (${wallet.staleFixture.removedRecords.toLocaleString()} removed), ${formatBytes(wallet.staleFixture.fixtureEncodedBytes)} active.
- Tail repair: ${wallet.tailRepairSync.durationMs} ms wall, type \`${tailType}\`, ${tailPages} pages / ${tailRows} rows.
- Tail fixture kind: ${wallet.staleFixture.removedRecords > 0 ? 'true tail restoration' : 'overlap-only (no events existed in the removed week)'}; repaired revision has ${wallet.repairedStorage.activeRecords.toLocaleString()} records.
- Raw-event parity before fixture: \`${getParityStatus(wallet.rawParitySync)}\`; exact timed revision after repair: \`${wallet.postRepairParity.status}\` (${wallet.postRepairParity.durationMs} ms oracle check).`
    })
    .join('\n\n')
  const derivedRows = wallets
    .flatMap((wallet) =>
      wallet.derived.flatMap((derived) => {
        const validHistory = derived.history.ledger.filter(({ status }) => status === 200 || status === 404)
        const validProtocolReturn = derived.protocolReturn.ledger.filter(
          ({ status }) => status === 200 || status === 404
        )
        return [
          `| \`${wallet.address}\` | ${derived.timeframe} | balance history (prepared ledger) | ${summarizeTimings(validHistory.length > 0 ? validHistory : derived.history.ledger).medianMs} ms | ${derived.history.ledger.map(({ status }) => status).join('/')} | ${derived.history.legacyBypass.durationMs} ms | ${derived.history.comparison.match ? 'PASS' : 'FAIL'} |`,
          `| \`${wallet.address}\` | ${derived.timeframe} | protocol return (prepared ledger) | ${summarizeTimings(validProtocolReturn.length > 0 ? validProtocolReturn : derived.protocolReturn.ledger).medianMs} ms | ${derived.protocolReturn.ledger.map(({ status }) => status).join('/')} | ${derived.protocolReturn.legacyBypass.durationMs} ms | ${derived.protocolReturn.comparison.match ? 'PASS' : 'FAIL'} |`,
          `| \`${wallet.address}\` | after ${derived.timeframe} suite | settled-date breakdown repetition | ${derived.breakdown.ledger.durationMs} ms | ${derived.breakdown.ledger.status} | ${derived.breakdown.legacyBypass.durationMs} ms | ${derived.breakdown.comparison.match ? 'PASS' : 'FAIL'} |`,
          `| \`${wallet.address}\` | ${derived.timeframe} | concurrent prepared-ledger balance + return (excludes sync/pin) | ${median(derived.portfolioFlow.map(({ durationMs }) => durationMs))} ms | ${derived.portfolioFlow.map(({ historyStatus, protocolReturnStatus }) => `${historyStatus}/${protocolReturnStatus}`).join(', ')} | — | N/A |`
        ]
      })
    )
    .join('\n')
  const mismatchDetails = wallets
    .flatMap((wallet) =>
      wallet.derived.flatMap((derived) =>
        [
          ['history', derived.history.comparison],
          ['protocol return', derived.protocolReturn.comparison],
          ['breakdown', derived.breakdown.comparison]
        ]
          .filter(([, comparison]) => !(comparison as TComparisonResult).match)
          .map(
            ([label, comparison]) =>
              `- \`${wallet.address}\` ${derived.timeframe} ${label}: ${JSON.stringify((comparison as TComparisonResult).mismatches.slice(0, 5))}`
          )
      )
    )
    .join('\n')
  const comparisonGroups = wallets.flatMap((wallet) =>
    wallet.derived.flatMap((derived) => [
      derived.history.comparison,
      derived.protocolReturn.comparison,
      derived.breakdown.comparison
    ])
  )
  const strictComparisonPasses = comparisonGroups.filter(({ match }) => match).length
  const equalHashComparisons = comparisonGroups.filter(({ leftHash, rightHash }) => leftHash === rightHash).length
  const zeroDeltaComparisons = comparisonGroups.filter(
    ({ maximumAbsoluteDelta, maximumRelativeDelta }) => maximumAbsoluteDelta === 0 && maximumRelativeDelta === 0
  ).length
  const derivedResponseStatuses = wallets.flatMap((wallet) =>
    wallet.derived.flatMap((derived) => [
      ...derived.history.ledger.map(({ status }) => status),
      ...derived.protocolReturn.ledger.map(({ status }) => status),
      derived.breakdown.ledger.status,
      ...derived.portfolioFlow.flatMap(({ historyStatus, protocolReturnStatus }) => [
        historyStatus,
        protocolReturnStatus
      ])
    ])
  )
  const validDerivedResponses = derivedResponseStatuses.filter((status) => status === 200 || status === 404).length
  const invalidStatusSummary = Array.from(
    derivedResponseStatuses
      .filter((status) => status !== 200 && status !== 404)
      .reduce((counts, status) => counts.set(status, (counts.get(status) ?? 0) + 1), new Map<number, number>())
  )
    .map(([status, count]) => `${status} × ${count}`)
    .join(', ')
  const storageRows = wallets
    .flatMap((wallet) =>
      [
        ['cold', wallet.coldStorage],
        ['hot', wallet.hotStorage],
        ['stale fixture', wallet.staleStorage],
        ['tail repaired', wallet.repairedStorage],
        ['after derived', wallet.finalStorage]
      ].map(([checkpoint, storage]) => {
        const value = storage as TStorageMeasurement
        return `| \`${wallet.address}\` | ${checkpoint} | ${value.keys} | ${formatBytes(value.valueBytes)} | ${formatBytes(value.keyBytes)} | ${formatBytes(value.activeLogicalBytes)} | ${value.activeRecords.toLocaleString()} | ${formatBytes(value.orphanDataBytes)} |`
      })
    )
    .join('\n')
  const projectionWallets = populatedWallets.length > 0 ? populatedWallets : wallets
  const activeBytes = projectionWallets.map(({ repairedStorage }) => repairedStorage.activeLogicalBytes)
  const namespaceBytes = projectionWallets.map(({ finalStorage }) => finalStorage.valueBytes + finalStorage.keyBytes)
  const averageActive = activeBytes.reduce((total, value) => total + value, 0) / Math.max(activeBytes.length, 1)
  const averageNamespace =
    namespaceBytes.reduce((total, value) => total + value, 0) / Math.max(namespaceBytes.length, 1)
  const densityRows = populatedWallets
    .map(({ address, repairedStorage }) => {
      const bytesPerRecord = repairedStorage.activeLogicalBytes / repairedStorage.activeRecords
      const capUtilization = (repairedStorage.activeLogicalBytes / LEDGER_MAX_ACTIVE_REVISION_BYTES) * 100
      const linearRecordCapacity = Math.floor(LEDGER_MAX_ACTIVE_REVISION_BYTES / bytesPerRecord)
      return `| \`${address}\` | ${round(bytesPerRecord)} B | ${round(capUtilization)}% | ${linearRecordCapacity.toLocaleString()} |`
    })
    .join('\n')
  const populatedFixtureActiveBytes = 3_090_033
  const rawReportName = args.reportPath.replace(/\.md$/, '.json').split('/').at(-1)
  return `# Holdings Ledger Benchmark

Generated: ${new Date().toISOString()}

Started: ${startedAt}

Target: \`${args.baseUrl}\` (local production server)

Runs per hot/derived measurement: ${args.runs}

Configured chains: ${holdingsConfig.ledgerChainIds.join(', ')}

Source mode: sequential keyset pagination
Redis namespace: isolated benchmark namespace (cleaned after the run)

## Executive summary

| Wallet | Cold refresh | Hot refresh median | 7d tail repair | Records | Active logical data | Final namespace data | Correctness |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
${summaryRows}

## Correctness and tail-fixture validity

${zeroEventWallets.length === 0 ? `Both requested wallets produced populated ledgers. Raw six-stream parity and every derived comparison must still pass independently for a wallet to receive an overall \`PASS\`.` : inconsistentEmptyWallets.length === 0 ? `${validEmptyWallets.length} requested wallet(s) produced zero-record ledgers whose raw and derived results were consistent with the comparison adapter and oracle.` : `${inconsistentEmptyWallets.length} zero-record wallet(s) failed raw or derived correctness and must not be treated as valid performance samples; ${validEmptyWallets.length} other zero-record wallet(s) remained consistent with the comparison adapter and oracle. Raw parity uses a separate adapter over the same Envio indexer, so it is useful cross-implementation evidence but not an independent upstream data source.`}

${trueTailWallets.length === wallets.length ? `The seven-day fixture removed records from every wallet, so each tail timing measures restoration of a valid historical revision plus the configured overlap scan.` : trueTailWallets.length === 0 ? `The seven-day fixture removed zero records from every wallet. Tail timing therefore measures a warm overlap scan only; no requested wallet had an event in the removed week.` : `${trueTailWallets.length} of ${wallets.length} wallet(s) had events in the removed week and exercised true tail restoration; the remaining tail timing(s) measure warm overlap scans only.`}

## Refresh details

${refreshDetails}

## Prepared-ledger calculation timing and correctness

This section measures calculation after an event source is available. The ledger side starts from an already synchronized and pinned Redis revision; synchronization and snapshot creation are excluded. The legacy side is one direct in-process calculation with persistent derived-result caches bypassed and a fresh full wallet-event replay from Envio. The ratios therefore estimate the amortized benefit of reusing wallet events. They are not complete page-load speedups or a controlled cold-versus-cold comparison.

History and protocol ledger timings are medians of up to ${args.runs} valid 200/404 runs; invalid samples remain visible in the HTTP column and strict correctness result. Breakdown is one request per suite position and has no 1y/ALL timeframe. Legacy bypass is one sample used as the correctness oracle. Numeric comparisons use max(1e-6 absolute, 1e-8 relative) tolerance; protocol \`generatedAt\` is ignored.

| Wallet | Range/suite position | Surface | Prepared-ledger timing | HTTP samples | Fresh legacy replay | Correctness |
| --- | --- | --- | ---: | ---: | ---: | --- |
${derivedRows}

${mismatchDetails ? `### Mismatch samples\n\n${mismatchDetails}` : 'All normalized derived comparisons passed.'}

Strict comparison groups passed: ${strictComparisonPasses}/${comparisonGroups.length}. Representative normalized hashes matched in ${equalHashComparisons}/${comparisonGroups.length} groups, and ${zeroDeltaComparisons}/${comparisonGroups.length} had zero numeric delta. Across ${derivedResponseStatuses.length} standalone and concurrent ledger-derived responses, ${validDerivedResponses} returned a valid 200/404 (${round((validDerivedResponses / Math.max(derivedResponseStatuses.length, 1)) * 100)}%); invalid statuses: ${invalidStatusSummary || 'none'}. A strict group can therefore fail because of availability even when every successful response body matches the oracle.

Raw six-stream event parity is checked through \`compareLegacy:true\` before the stale fixture, then recomputed non-mutating against the exact timed repair revision. Derived legacy comparisons include Fantom while this ledger benchmark uses the configured six-chain scope without Fantom; a mismatch may therefore represent an intentional scope difference. Only 200/200 data responses or 404/404 no-holdings responses are eligible to pass a derived comparison.

## Redis storage

Storage figures are retained as benchmark evidence, but provider capacity is not a current development decision criterion.

\`Value bytes\` is exact Redis STRLEN payload, and \`key bytes\` is the UTF-8 key length. These exclude provider/allocator overhead. \`Active logical\` is manifest + active chunk/index payload before the ${OPAQUE_VALUE_PREFIX_BYTES}-byte per-value storage prefix. Orphans are immutable manifests/chunks/indexes unreachable from active, previous, or live snapshot pins.

| Wallet | Checkpoint | Keys | Value bytes | Key bytes | Active logical | Records | Orphan data |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
${storageRows}

### Active-ledger storage projection

${populatedWallets.length === 0 ? `Both live wallets produced zero-record revisions. The observed projection is therefore only an empty-ledger workload baseline, not a populated-user forecast; consult the correctness section before deciding whether those empty results are valid.` : populatedWallets.length === wallets.length ? `Both live wallets produced populated revisions. The projection below averages their measured active and workload-accumulated footprints; it is a scenario, not a forecast of the production wallet-size distribution.` : `The projection excludes ${zeroEventWallets.length} zero-record wallet(s) and averages only the ${populatedWallets.length} populated revision(s).`}

| Wallet count | Average active logical | Average observed workload-accumulated namespace footprint |
| ---: | ---: | ---: |
| 10,000 | ${formatBytes(averageActive * 10_000)} | ${formatBytes(averageNamespace * 10_000)} |
| 100,000 | ${formatBytes(averageActive * 100_000)} | ${formatBytes(averageNamespace * 100_000)} |
| 1,000,000 | ${formatBytes(averageActive * 1_000_000)} | ${formatBytes(averageNamespace * 1_000_000)} |

The active-logical column is the closest steady-revision sizing input. The observed namespace projection deliberately includes this benchmark's repeated hot commits, stale fixture, repair revisions, and snapshot pins; it is workload accumulation, not a steady-state per-user estimate.

### Measured event density and active-revision ceiling

| Wallet | Active bytes per record | 4 MiB cap used | Linear records at measured density |
| --- | ---: | ---: | ---: |
${densityRows || '| No populated wallet | — | — | — |'}

The linear record estimate holds each wallet's measured bytes-per-record constant and is not a guaranteed capacity. Fixed manifest/index overhead dominates smaller ledgers, while vault/month/dependency diversity can make larger ledgers less dense.

For context only, the repository's sanitized populated codec fixture contains 20,070 records in ${formatBytes(populatedFixtureActiveBytes)} active encoded data (~154 bytes/record). Linear active-data scenarios for that fixture are ${formatBytes(populatedFixtureActiveBytes * 10_000)} at 10,000 wallets, ${formatBytes(populatedFixtureActiveBytes * 100_000)} at 100,000, and ${formatBytes(populatedFixtureActiveBytes * 1_000_000)} at 1,000,000. They exclude retained revisions, Redis allocator overhead, and cross-wallet deduplication (which does not exist).

There is no production ledger garbage collector. Immutable manifests and blobs have no TTL, so total storage grows with every unique committed revision and failed pre-commit publication. Content-addressed blobs deduplicate only inside one wallet namespace. Hard limits remain 4 MiB active encoded, 32 MiB active decoded, 256 KiB manifest, and 256 KiB per chunk/index.

## Methodology and limitations

- Cold refresh starts from an empty isolated Redis namespace.
- Hot refresh runs immediately against the fully verified active revision.
- The 7-day fixture is a fully encoded and verified historical revision, not a corrupt manifest or deleted chunk.
- The benchmark sets reconciliation interval above seven days so the stale test exercises warm tailing. With the current seven-day default, exactly seven days selects a full \`reconcile\` scan.
- Warm tailing also includes the configured 50,000-block overlap on every chain.
- Balance history and breakdown consume pinned ledger events, then fetch live metadata/PPS/prices.
- Protocol return additionally performs live Envio companion-event enrichment, so it is not a Redis-only calculation.
- External Envio, Kong, price, and Redis latency are part of these wall-clock results.
- The 1y suite runs before ALL in one long-lived Next process. ALL can reuse warmed in-memory Kong metadata; both still perform their normal live PPS/price work.
- The concurrent portfolio-flow row starts balance history and protocol return together against one pinned snapshot.
- Prepared-ledger calculation rows exclude synchronization and snapshot creation; the benchmark did not measure a concurrent legacy page flow.
- Legacy calculation oracles are single direct-handler samples, while ledger history/protocol reads use up to three HTTP samples.
- Breakdown has no timeframe; its two rows are repetitions after the 1y and ALL suites.
- The local API and harness runtime scope (Redis credentials, namespace, ledger/source configuration) was matched by a one-way fingerprint before mutation.
- Cold and tail-repair measurements are single destructive-isolated samples; hot and derived figures use medians.
- The benchmark namespace was deleted and rescanned empty before this report was written.

Raw results: [${rawReportName}](./${rawReportName})
`
}

async function runBenchmarksWithCleanup(
  args: TBenchmarkArgs,
  redis: Redis,
  walletHashes: readonly string[]
): Promise<TWalletBenchmark[]> {
  try {
    return await mapSeries(args.wallets, (_wallet, index) =>
      benchmarkWallet(args, redis, args.wallets[index] as string)
    )
  } finally {
    const cleaned = await Promise.all(walletHashes.map((walletHash) => cleanupWalletNamespace(redis, walletHash)))
    console.log(
      `[benchmark] cleaned and verified isolated Redis keys: ${cleaned.reduce((total, count) => total + count, 0)}`
    )
  }
}

interface TExistingRawArtifact {
  readonly startedAt: string
  readonly cleanupVerified: boolean
  readonly args: TBenchmarkArgs
  readonly wallets: readonly TWalletBenchmark[]
}

function parseExistingRawArtifact(value: unknown): TExistingRawArtifact {
  if (
    value === null ||
    Array.isArray(value) ||
    typeof value !== 'object' ||
    typeof Reflect.get(value, 'startedAt') !== 'string' ||
    Reflect.get(value, 'cleanupVerified') !== true ||
    !Array.isArray(Reflect.get(value, 'wallets')) ||
    Reflect.get(value, 'args') === null ||
    typeof Reflect.get(value, 'args') !== 'object'
  ) {
    throw new Error('Existing benchmark artifact is invalid or was not cleanup-verified')
  }
  return value as TExistingRawArtifact
}

async function renderExistingArtifact(args: TBenchmarkArgs, sourcePath: string): Promise<void> {
  const source = parseExistingRawArtifact(JSON.parse(await readFile(sourcePath, 'utf8')))
  const wallets = source.wallets.map(compactWalletArtifact)
  const reportArgs = { ...source.args, reportPath: args.reportPath, renderExistingPath: sourcePath }
  await writeFile(sourcePath, `${JSON.stringify({ ...source, args: reportArgs, wallets }, null, 2)}\n`)
  await writeFile(args.reportPath, renderReport(reportArgs, wallets, source.startedAt))
  console.log(`[benchmark] compacted raw: ${sourcePath}`)
  console.log(`[benchmark] rendered report: ${args.reportPath}`)
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2))
  if (args.renderExistingPath) {
    await renderExistingArtifact(args, args.renderExistingPath)
    return
  }
  assertSafeBenchmark(args)
  const redis = getHoldingsLedgerRedisClient() as Redis | null
  if (!redis) {
    throw new Error('Holdings ledger Redis is unavailable')
  }
  const startedAt = new Date().toISOString()
  const walletHashes = args.wallets.map(hashLedgerWalletAddress)
  await assertServerRuntimeScope(args)
  const preexisting = await Promise.all(
    walletHashes.map((walletHash) => scanKeys(redis, `${getWalletPrefix(walletHash)}:*`))
  )
  if (preexisting.some((keys) => keys.length > 0)) {
    throw new Error('The unique benchmark namespace already contains data')
  }
  const wallets = await runBenchmarksWithCleanup(args, redis, walletHashes)
  const artifactWallets = wallets.map(compactWalletArtifact)
  const rawPath = args.reportPath.replace(/\.md$/, '.json')
  await mkdir(dirname(args.reportPath), { recursive: true })
  await writeFile(
    rawPath,
    `${JSON.stringify({ startedAt, cleanupVerified: true, args: { ...args, confirmedDevRedis: true }, wallets: artifactWallets }, null, 2)}\n`
  )
  await writeFile(args.reportPath, renderReport(args, artifactWallets, startedAt))
  console.log(`[benchmark] report: ${args.reportPath}`)
  console.log(`[benchmark] raw: ${rawPath}`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
