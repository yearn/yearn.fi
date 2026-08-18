import { Buffer } from 'node:buffer'
import { createHash, randomUUID } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, relative, resolve } from 'node:path'
import type { Redis } from '@upstash/redis'
import { holdingsConfig } from '@/server/lib/holdings/config'
import { stringifyCanonicalLedgerValue } from '@/server/lib/holdings/services/ledger/codec'
import { fetchEnvioLedgerMetadata } from '@/server/lib/holdings/services/ledger/envio'
import { hashLedgerWalletAddress } from '@/server/lib/holdings/services/ledger/keys'
import { LEDGER_STREAMS, type TLedgerSixStreams } from '@/server/lib/holdings/services/ledger/types'
import { encodeWalletLedgerPayload } from '@/server/lib/holdings/services/ledger/walletCodec'
import {
  acquireWalletLedgerLock,
  commitStoredWalletLedger,
  getWalletLedgerKey,
  getWalletLedgerLockKey,
  readStoredWalletLedger,
  releaseWalletLedgerLock,
  type TWalletLedgerLock
} from '@/server/lib/holdings/services/ledger/walletStore'
import { createWalletLedgerDailyUsdCacheCommitTransitions } from '@/server/lib/holdings/services/ledger/walletTotalsCache'
import {
  type TWalletLedgerState,
  WALLET_LEDGER_FRESHNESS_MS,
  WALLET_LEDGER_LOCK_TTL_MS,
  WALLET_LEDGER_SCHEMA_VERSION
} from '@/server/lib/holdings/services/ledger/walletTypes'
import {
  getHoldingsLedgerRedisClient,
  getHoldingsLedgerRuntimeFingerprint,
  HoldingsLedgerRedisOperationError
} from '@/server/lib/holdings/storage/ledgerRedis'
import { SUPPORTED_CHAINS } from '@/server/lib/holdings/types'

const DEFAULT_WALLETS = [
  '0x96A489A533bA0913dD8E507e6D985a45BC783566',
  '0x93A62dA5a14C80f265DAbC077fCEE437B1a0Efde'
] as const
const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000
const DEFAULT_REPORT_PATH = 'docs/performance/holdings-wallet-ledger-portfolio-optimization.md'
const EVM_ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/
const NAMESPACE_PATTERN = /^benchmark_[A-Za-z0-9_-]{1,54}$/
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000
const HOT_REDUCTION_TARGET_PERCENT = 70
const BENCHMARK_METADATA_RESET_HEADER = 'x-holdings-benchmark-metadata-cache-reset'
const FIXTURE_REDIS_MAX_ATTEMPTS = 3
const FIXTURE_REDIS_RETRY_BASE_MS = 250
const WRITE_BEHIND_STORAGE_WAIT_MS = 10_000
const WRITE_BEHIND_STORAGE_POLL_MS = 250
const TRANSIENT_REDIS_ERROR_NAMES = new Set([
  'AbortError',
  'AggregateError',
  'DOMException',
  'TimeoutError',
  'TypeError',
  'UpstashError',
  'UpstashJSONParseError'
])

type TJsonPrimitive = string | number | boolean | null
type TJsonValue = TJsonPrimitive | readonly TJsonValue[] | { readonly [key: string]: TJsonValue }

interface TBenchmarkArgs {
  readonly baseUrl: string
  readonly wallets: readonly string[]
  readonly hotRuns: number
  readonly tailDays: number
  readonly reportPath: string
  readonly artifactPath: string
  readonly confirmedDevRedis: boolean
  readonly skipExpiredWarm: boolean
  readonly skipTail: boolean
  readonly renderExistingPath: string | null
}

interface TPortfolioSummary {
  readonly error: string | null
  readonly ledgerRevision: string | null
  readonly eventRevision: string | null
  readonly eventCount: number | null
  readonly freshness: string | null
  readonly syncedAtMs: number | null
  readonly balancePoints: number
  readonly balanceComplete: boolean | null
  readonly protocolReturnPoints: number
  readonly protocolReturnVaults: number
  readonly protocolReturnComplete: boolean | null
  readonly growthVaults: number
  readonly growthComplete: boolean | null
}

interface THttpMeasurement {
  readonly status: number
  readonly durationMs: number
  readonly bytes: number
  readonly bodyDigest: string
  readonly serverMetadataCacheReset?: boolean
  readonly summary: TPortfolioSummary
}

interface TStorageClass {
  readonly keys: number
  readonly keyBytes: number
  readonly logicalValueBytes: number
}

interface TStorageMeasurement {
  readonly keys: number
  readonly keyBytes: number
  readonly logicalValueBytes: number
  readonly ledgerEncodedBytes: number
  readonly ledgerDecodedBytes: number
  readonly ledgerEvents: number
  readonly ledgerRevision: string | null
  readonly eventRevision: string | null
  readonly writeBehindStatus?: 'observed' | 'not-expected' | 'timeout'
  readonly byClass: Readonly<Record<string, TStorageClass>>
}

interface TExpiredWarmResult {
  readonly status: 'completed' | 'skipped' | 'unavailable'
  readonly measurement?: THttpMeasurement
  readonly storage?: TStorageMeasurement
  readonly validation?: TExpiredWarmValidation
  readonly reason?: string
}

interface TExpiredWarmFixture {
  readonly eventRevision: string
  readonly eventCount: number
}

interface TExpiredWarmValidation {
  readonly status: 'exact' | 'advanced' | 'failed'
  readonly refreshWasNotStale: boolean
  readonly responseMatchesStoredLedger: boolean
  readonly restoredAtLeastFixtureEventCount: boolean
  readonly exactFixtureEventRevision: boolean
  readonly exactFixtureEventCount: boolean
}

interface TTailFixture {
  readonly cutoffTimestamp: number
  readonly cutoffBlocks: Readonly<Record<number, number>>
  readonly authoritativeSource: string
  readonly originalEvents: number
  readonly fixtureEvents: number
  readonly removedEvents: number
  readonly originalEventRevision: string
  readonly fixtureEventRevision: string
  readonly fixtureEncodedBytes: number
  readonly originalDailyUsdRows: number
  readonly retainedDailyUsdRows: number
  readonly invalidatedDailyUsdRows: number
  readonly deletedDerivedCacheKeys: number
}

interface TTailValidation {
  readonly status: 'exact' | 'advanced' | 'failed'
  readonly refreshWasNotStale: boolean
  readonly responseMatchesStoredLedger: boolean
  readonly restoredAtLeastOriginalEventCount: boolean
  readonly allOriginalEventsRestored: boolean
  readonly exactOriginalEventRevision: boolean
  readonly exactOriginalEventCount: boolean
}

interface TInstalledTailFixture {
  readonly fixture: TTailFixture
  readonly originalStreams: TLedgerSixStreams
}

interface TTailResult {
  readonly status: 'completed' | 'skipped' | 'unavailable'
  readonly fixture?: TTailFixture
  readonly measurement?: THttpMeasurement
  readonly storage?: TStorageMeasurement
  readonly validation?: TTailValidation
  readonly reason?: string
}

interface TWalletBenchmark {
  readonly address: string
  readonly walletHash: string
  readonly deletedColdKeys: number
  readonly cold: THttpMeasurement
  readonly coldStorage: TStorageMeasurement
  readonly hot: readonly THttpMeasurement[]
  readonly hotStorage: TStorageMeasurement
  readonly hotMatchesCold: readonly boolean[]
  readonly expiredWarm: TExpiredWarmResult
  readonly tail: TTailResult
}

interface TBenchmarkArtifact {
  readonly schemaVersion: 1
  readonly generatedAt: string
  readonly baseUrl: string
  readonly namespace: string
  readonly settings: {
    readonly hotRuns: number
    readonly tailDays: number
    readonly skipExpiredWarm: boolean
    readonly skipTail: boolean
    readonly freshnessMs: number
    readonly reconcileIntervalMs: number
  }
  readonly wallets: readonly TWalletBenchmark[]
}

function printUsage(): void {
  console.log(`Usage:
  bun scripts/benchmark-wallet-ledger-portfolio.ts \\
    --base-url http://127.0.0.1:3010 \\
    --hot-runs 3 \\
    --tail-days 7 \\
    --report ${DEFAULT_REPORT_PATH} \\
    --confirm-dev-redis

The two standard benchmark wallets are used by default. Repeat --wallet to override them.

Optional flags:
  --wallet 0x...          Override the default wallets (repeatable)
  --artifact path.json   Raw, credential-free artifact path
  --skip-expired-warm    Skip the synthetic expired-freshness stage
  --skip-tail            Skip the authoritative seven-day tail fixture
  --render-existing file Render a Markdown report from an existing JSON artifact

Required safety conditions for a live run:
  - the base URL must be loopback-only
  - HOLDINGS_LEDGER_KEY_NAMESPACE must start with benchmark_
  - --confirm-dev-redis must be present
  - server and benchmark process runtime fingerprints must match

Cold cleanup deletes only one-value wallet-ledger keys for each selected wallet inside
the isolated benchmark namespace. Each cold request also resets and verifies the server's
vault-metadata module cache. It never flushes Redis or scans/deletes another namespace.`)
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

function getDefaultArtifactPath(reportPath: string): string {
  return reportPath.endsWith('.md') ? `${reportPath.slice(0, -3)}.json` : `${reportPath}.json`
}

function parseArgs(args: readonly string[]): TBenchmarkArgs {
  if (args.includes('--help')) {
    printUsage()
    process.exit(0)
  }
  const reportPath = resolve(getSingleFlag(args, '--report', DEFAULT_REPORT_PATH))
  const selectedWallets = getFlagValues(args, '--wallet')
  const renderExisting = getFlagValues(args, '--render-existing').at(-1)
  return {
    baseUrl: getSingleFlag(args, '--base-url', 'http://127.0.0.1:3010').replace(/\/$/, ''),
    wallets: selectedWallets.length > 0 ? selectedWallets : DEFAULT_WALLETS,
    hotRuns: parsePositiveInteger(getSingleFlag(args, '--hot-runs', '3'), 'hot-runs'),
    tailDays: parsePositiveInteger(getSingleFlag(args, '--tail-days', '7'), 'tail-days'),
    reportPath,
    artifactPath: resolve(getSingleFlag(args, '--artifact', getDefaultArtifactPath(reportPath))),
    confirmedDevRedis: args.includes('--confirm-dev-redis'),
    skipExpiredWarm: args.includes('--skip-expired-warm'),
    skipTail: args.includes('--skip-tail'),
    renderExistingPath: renderExisting ? resolve(renderExisting) : null
  }
}

function assertSafeBenchmark(args: TBenchmarkArgs): string {
  const parsedBaseUrl = new URL(args.baseUrl)
  const hostname = parsedBaseUrl.hostname
  const namespace = process.env.HOLDINGS_LEDGER_KEY_NAMESPACE ?? ''
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(hostname)) {
    throw new Error('Benchmark base URL must use a loopback hostname')
  }
  if (
    parsedBaseUrl.protocol !== 'http:' ||
    parsedBaseUrl.username !== '' ||
    parsedBaseUrl.password !== '' ||
    parsedBaseUrl.search !== '' ||
    parsedBaseUrl.hash !== '' ||
    (parsedBaseUrl.pathname !== '' && parsedBaseUrl.pathname !== '/')
  ) {
    throw new Error('Benchmark base URL must be a credential-free loopback HTTP origin')
  }
  if (!args.confirmedDevRedis) {
    throw new Error('Refusing Redis mutation without --confirm-dev-redis')
  }
  if (!NAMESPACE_PATTERN.test(namespace)) {
    throw new Error('HOLDINGS_LEDGER_KEY_NAMESPACE must be a unique benchmark_ namespace')
  }
  if (args.wallets.length === 0 || args.wallets.some((wallet) => !EVM_ADDRESS_PATTERN.test(wallet))) {
    throw new Error('All benchmark wallet addresses must be 20-byte EVM addresses')
  }
  if (holdingsConfig.ledgerMode === 'off') {
    throw new Error('Holdings ledger mode must be enabled')
  }
  if (!args.skipTail && holdingsConfig.ledgerReconcileIntervalMs <= args.tailDays * MILLISECONDS_PER_DAY) {
    throw new Error('Ledger reconciliation interval must be longer than the synthetic tail period')
  }
  if (!args.skipExpiredWarm && holdingsConfig.ledgerReconcileIntervalMs <= WALLET_LEDGER_FRESHNESS_MS + 1_000) {
    throw new Error('Ledger reconciliation interval must be longer than the synthetic expired-warm period')
  }
  return namespace
}

async function mapSeries<TValue, TResult>(
  values: readonly TValue[],
  mapper: (value: TValue, index: number) => Promise<TResult>
): Promise<TResult[]> {
  return values.reduce<Promise<TResult[]>>(async (pending, value, index) => {
    const resolvedValues = await pending
    return [...resolvedValues, await mapper(value, index)]
  }, Promise.resolve([]))
}

function getRedisErrorStatus(error: unknown): number | null {
  if (error === null || typeof error !== 'object') {
    return null
  }
  try {
    const candidate = Reflect.get(error, 'status') ?? Reflect.get(error, 'statusCode')
    const parsed = typeof candidate === 'string' && /^\d{3}$/.test(candidate) ? Number(candidate) : candidate
    return Number.isInteger(parsed) ? Number(parsed) : null
  } catch {
    return null
  }
}

function isTransientRedisError(error: unknown): boolean {
  if (error instanceof HoldingsLedgerRedisOperationError) {
    return true
  }
  const status = getRedisErrorStatus(error)
  if (status === 408 || status === 425 || status === 429 || (status !== null && status >= 500)) {
    return true
  }
  return error instanceof Error && TRANSIENT_REDIS_ERROR_NAMES.has(error.name)
}

function waitForMilliseconds(durationMs: number): Promise<void> {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, durationMs))
}

async function retryTransientRedisOperation<TResult>(
  label: string,
  operation: () => Promise<TResult>,
  attempt = 1
): Promise<TResult> {
  try {
    return await operation()
  } catch (error) {
    if (attempt >= FIXTURE_REDIS_MAX_ATTEMPTS || !isTransientRedisError(error)) {
      throw error
    }
    console.warn(
      `[portfolio-benchmark] ${label}: transient Redis failure; retrying ${attempt + 1}/${FIXTURE_REDIS_MAX_ATTEMPTS}`
    )
    await waitForMilliseconds(FIXTURE_REDIS_RETRY_BASE_MS * 2 ** (attempt - 1))
    return retryTransientRedisOperation(label, operation, attempt + 1)
  }
}

async function acquireFixtureWalletLedgerLock(args: {
  readonly redis: Redis
  readonly walletHash: string
  readonly token: string
  readonly label: string
}): Promise<TWalletLedgerLock> {
  return retryTransientRedisOperation(`${args.label} lock acquisition`, async () => {
    const acquired = await (async () => {
      try {
        return await acquireWalletLedgerLock({
          redis: args.redis,
          walletHash: args.walletHash,
          token: args.token,
          ttlMs: WALLET_LEDGER_LOCK_TTL_MS
        })
      } catch (error) {
        if (!isTransientRedisError(error)) {
          throw error
        }
        const owner = await args.redis.get<string>(getWalletLedgerLockKey(args.walletHash))
        if (owner === args.token) {
          return { status: 'acquired' as const, lock: { token: args.token } }
        }
        throw error
      }
    })()
    if (acquired.status === 'acquired') {
      return acquired.lock
    }
    const owner = await args.redis.get<string>(getWalletLedgerLockKey(args.walletHash))
    if (owner === args.token) {
      return { token: args.token }
    }
    throw new Error(`Could not acquire the isolated ${args.label} lock`)
  })
}

async function releaseFixtureWalletLedgerLock(args: {
  readonly redis: Redis
  readonly walletHash: string
  readonly lock: TWalletLedgerLock
  readonly label: string
}): Promise<void> {
  await retryTransientRedisOperation(`${args.label} lock release`, async () => {
    await releaseWalletLedgerLock({ redis: args.redis, walletHash: args.walletHash, lock: args.lock })
  })
}

function round(value: number, digits = 2): number {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

function median(values: readonly number[]): number {
  const sorted = [...values].toSorted((left, right) => left - right)
  const middle = Math.floor(sorted.length / 2)
  return round(
    sorted.length % 2 === 0 ? ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2 : (sorted[middle] ?? 0)
  )
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function readRecord(value: unknown): Readonly<Record<string, unknown>> {
  return isRecord(value) ? value : {}
}

function readNullableString(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function readNullableNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function readNullableBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown
  } catch {
    return null
  }
}

function normalizeForDigest(value: unknown, path = ''): TJsonValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') {
    return value
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : String(value)
  }
  if (Array.isArray(value)) {
    return value.map((entry, index) => normalizeForDigest(entry, `${path}[${index}]`))
  }
  if (!isRecord(value)) {
    return String(value)
  }
  return Object.fromEntries(
    Object.keys(value)
      .toSorted()
      .filter((key) => {
        const childPath = `${path}.${key}`
        return (
          childPath !== '.ledger.freshness' &&
          childPath !== '.protocolReturn.generatedAt' &&
          childPath !== '.growth.generatedAt'
        )
      })
      .map((key) => [key, normalizeForDigest(value[key], `${path}.${key}`)])
  )
}

function digestBody(value: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(normalizeForDigest(value)))
    .digest('hex')
}

function summarizePortfolioBody(body: unknown): TPortfolioSummary {
  const root = readRecord(body)
  const ledger = readRecord(root.ledger)
  const balance = readRecord(root.balance)
  const protocolReturn = readRecord(root.protocolReturn)
  const protocolSummary = readRecord(protocolReturn.summary)
  const growth = readRecord(root.growth)
  const growthSummary = readRecord(growth.summary)
  return {
    error: readNullableString(root.error),
    ledgerRevision: readNullableString(ledger.revision),
    eventRevision: readNullableString(ledger.eventRevision),
    eventCount: readNullableNumber(ledger.eventCount),
    freshness: readNullableString(ledger.freshness),
    syncedAtMs: readNullableNumber(ledger.syncedAtMs),
    balancePoints: Array.isArray(balance.dataPoints) ? balance.dataPoints.length : 0,
    balanceComplete: readNullableBoolean(balance.isComplete),
    protocolReturnPoints: Array.isArray(protocolReturn.dataPoints) ? protocolReturn.dataPoints.length : 0,
    protocolReturnVaults: readNullableNumber(protocolSummary.totalVaults) ?? 0,
    protocolReturnComplete: readNullableBoolean(protocolSummary.isComplete),
    growthVaults: readNullableNumber(growthSummary.totalVaults) ?? 0,
    growthComplete: readNullableBoolean(growthSummary.isComplete)
  }
}

function createPortfolioPath(address: string, options?: { readonly resetMetadataCache?: boolean }): string {
  const query = new URLSearchParams({
    address,
    version: 'all',
    denomination: 'usd',
    timeframe: '1y',
    refresh: '1',
    debug: '1'
  })
  if (options?.resetMetadataCache) {
    query.set('benchmarkResetMetadataCache', '1')
  }
  return `/api/holdings/ledger/portfolio?${query.toString()}`
}

function getRequestHeaders(): Headers {
  const headers = new Headers({ Accept: 'application/json' })
  if (process.env.ADMIN_SECRET) {
    headers.set('x-admin-secret', process.env.ADMIN_SECRET)
  }
  return headers
}

async function requestPortfolio(
  args: TBenchmarkArgs,
  address: string,
  options?: { readonly resetMetadataCache?: boolean }
): Promise<THttpMeasurement> {
  const startedAt = performance.now()
  const response = await fetch(`${args.baseUrl}${createPortfolioPath(address, options)}`, {
    headers: getRequestHeaders(),
    signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS)
  })
  const text = await response.text()
  const body = parseJson(text)
  const serverMetadataCacheReset = response.headers.get(BENCHMARK_METADATA_RESET_HEADER) === '1'
  if (options?.resetMetadataCache && !serverMetadataCacheReset) {
    throw new Error('Benchmark server did not confirm the requested process metadata cache reset')
  }
  return {
    status: response.status,
    durationMs: round(performance.now() - startedAt),
    bytes: Buffer.byteLength(text, 'utf8'),
    bodyDigest: digestBody(body),
    serverMetadataCacheReset,
    summary: summarizePortfolioBody(body)
  }
}

function requireSuccessfulPortfolio(measurement: THttpMeasurement, label: string): void {
  if (
    measurement.status !== 200 ||
    measurement.summary.ledgerRevision === null ||
    measurement.summary.eventRevision === null ||
    measurement.summary.eventCount === null
  ) {
    throw new Error(
      `${label} failed with HTTP ${measurement.status}: ${measurement.summary.error ?? 'invalid response'}`
    )
  }
}

async function assertServerRuntimeScope(args: TBenchmarkArgs): Promise<void> {
  const address = args.wallets[0]
  if (!address) {
    throw new Error('Runtime preflight requires a benchmark wallet')
  }
  const query = new URLSearchParams({ address })
  const response = await fetch(`${args.baseUrl}/api/holdings/ledger/status?${query.toString()}`, {
    headers: getRequestHeaders(),
    signal: AbortSignal.timeout(30_000)
  })
  if (response.status !== 200) {
    throw new Error(`Ledger runtime preflight failed with HTTP ${response.status}`)
  }
  if (response.headers.get('x-holdings-ledger-runtime-fingerprint') !== getHoldingsLedgerRuntimeFingerprint()) {
    throw new Error('Local server and benchmark process do not share the same ledger runtime scope')
  }
}

async function scanKeys(redis: Redis, pattern: string, cursor = '0', collected: string[] = []): Promise<string[]> {
  const [nextCursor, keys] = await redis.scan(cursor, { match: pattern, count: 500 })
  const next = [...collected, ...keys]
  return nextCursor === '0' ? next.toSorted() : scanKeys(redis, pattern, nextCursor, next)
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

function assertWalletKeysInScope(keys: readonly string[], walletHash: string, namespace: string): void {
  const prefix = getWalletLedgerKey(walletHash)
  if (!prefix.includes(`:namespace:${namespace}`) || keys.some((key) => !key.startsWith(prefix))) {
    throw new Error('Refusing to mutate a wallet key outside the isolated benchmark namespace')
  }
}

async function getWalletKeys(redis: Redis, walletHash: string): Promise<string[]> {
  const prefix = getWalletLedgerKey(walletHash)
  return (await scanKeys(redis, `${prefix}*`)).filter((key) => key === prefix || key.startsWith(`${prefix}:`))
}

async function cleanupWalletKeys(redis: Redis, walletHash: string, namespace: string): Promise<number> {
  const keys = await getWalletKeys(redis, walletHash)
  assertWalletKeysInScope(keys, walletHash, namespace)
  await deleteKeys(redis, keys)
  const remaining = await getWalletKeys(redis, walletHash)
  if (remaining.length > 0) {
    throw new Error('Benchmark wallet-key cleanup verification failed')
  }
  return keys.length
}

function classifyWalletKey(key: string, walletHash: string): string {
  const ledgerKey = getWalletLedgerKey(walletHash)
  if (key === ledgerKey) return 'wallet-ledger'
  if (key.endsWith(':checked')) return 'checked-marker'
  if (key.includes(':daily-usd:')) return 'daily-usd'
  if (key.includes(':derived-portfolio:')) return 'derived-portfolio'
  if (key.endsWith(':lock')) return 'lock'
  return 'other'
}

function getUnknownValueBytes(value: unknown): number {
  if (typeof value === 'string') {
    return Buffer.byteLength(value, 'utf8')
  }
  return Buffer.byteLength(JSON.stringify(value) ?? String(value), 'utf8')
}

async function getLogicalValueBytes(redis: Redis, key: string): Promise<number> {
  const type = await redis.type(key)
  if (type === 'string') {
    return Number(await redis.strlen(key))
  }
  if (type === 'hash') {
    const value = await redis.hgetall<Record<string, unknown>>(key)
    return value
      ? Object.entries(value).reduce(
          (total, [field, fieldValue]) => total + Buffer.byteLength(field, 'utf8') + getUnknownValueBytes(fieldValue),
          0
        )
      : 0
  }
  if (type === 'list') {
    return (await redis.lrange<string>(key, 0, -1)).reduce((total, value) => total + getUnknownValueBytes(value), 0)
  }
  return 0
}

function getEventCount(ledger: TWalletLedgerState): number {
  return LEDGER_STREAMS.reduce((total, stream) => total + ledger.streams[stream].length, 0)
}

async function readReadyLedger(redis: Redis, walletHash: string): Promise<TWalletLedgerState> {
  const result = await readStoredWalletLedger({ redis, walletHash })
  if (result.status !== 'ready') {
    throw new Error(`Expected a ready one-value wallet ledger, received ${result.status}`)
  }
  return result.ledger
}

async function measureStorage(
  redis: Redis,
  walletHash: string,
  writeBehindStatus?: TStorageMeasurement['writeBehindStatus']
): Promise<TStorageMeasurement> {
  const keys = await getWalletKeys(redis, walletHash)
  const sizes = await Promise.all(keys.map((key) => getLogicalValueBytes(redis, key)))
  const ledgerResult = await readStoredWalletLedger({ redis, walletHash })
  const classNames = Array.from(new Set(keys.map((key) => classifyWalletKey(key, walletHash))))
  const byClass = Object.fromEntries(
    classNames.map((className) => {
      const classIndexes = keys.flatMap((key, index) =>
        classifyWalletKey(key, walletHash) === className ? [index] : []
      )
      return [
        className,
        {
          keys: classIndexes.length,
          keyBytes: classIndexes.reduce((total, index) => total + Buffer.byteLength(keys[index] ?? '', 'utf8'), 0),
          logicalValueBytes: classIndexes.reduce((total, index) => total + (sizes[index] ?? 0), 0)
        }
      ]
    })
  )
  return {
    keys: keys.length,
    keyBytes: keys.reduce((total, key) => total + Buffer.byteLength(key, 'utf8'), 0),
    logicalValueBytes: sizes.reduce((total, size) => total + size, 0),
    ledgerEncodedBytes: ledgerResult.status === 'ready' ? ledgerResult.ledger.encodedBytes : 0,
    ledgerDecodedBytes: ledgerResult.status === 'ready' ? ledgerResult.ledger.decodedBytes : 0,
    ledgerEvents: ledgerResult.status === 'ready' ? getEventCount(ledgerResult.ledger) : 0,
    ledgerRevision: ledgerResult.status === 'ready' ? ledgerResult.ledger.revision : null,
    eventRevision: ledgerResult.status === 'ready' ? ledgerResult.ledger.eventRevision : null,
    ...(writeBehindStatus ? { writeBehindStatus } : {}),
    byClass
  }
}

async function pollForDerivedPortfolioStorage(redis: Redis, walletHash: string, deadlineMs: number): Promise<boolean> {
  const keys = await retryTransientRedisOperation('derived-cache write-behind visibility check', () =>
    getWalletKeys(redis, walletHash)
  )
  if (keys.some((key) => key.includes(':derived-portfolio:'))) {
    return true
  }
  if (Date.now() >= deadlineMs) {
    return false
  }
  await waitForMilliseconds(WRITE_BEHIND_STORAGE_POLL_MS)
  return pollForDerivedPortfolioStorage(redis, walletHash, deadlineMs)
}

async function measureStorageAfterPortfolio(args: {
  readonly redis: Redis
  readonly walletHash: string
  readonly measurement: THttpMeasurement
  readonly label: string
}): Promise<TStorageMeasurement> {
  const expectsDerivedPortfolio =
    args.measurement.summary.protocolReturnVaults > 0 || args.measurement.summary.growthVaults > 0
  const writeBehindStatus = expectsDerivedPortfolio
    ? (await pollForDerivedPortfolioStorage(args.redis, args.walletHash, Date.now() + WRITE_BEHIND_STORAGE_WAIT_MS))
      ? ('observed' as const)
      : ('timeout' as const)
    : ('not-expected' as const)
  if (writeBehindStatus === 'timeout') {
    console.warn(
      `[portfolio-benchmark] ${args.label}: derived-cache write-behind was not visible after ${WRITE_BEHIND_STORAGE_WAIT_MS}ms; recording the keys actually present`
    )
  }
  return retryTransientRedisOperation(`${args.label} storage measurement`, () =>
    measureStorage(args.redis, args.walletHash, writeBehindStatus)
  )
}

async function ageWalletLedgerFreshness(redis: Redis, walletHash: string): Promise<TExpiredWarmFixture> {
  const current = await retryTransientRedisOperation('freshness fixture initial ledger read', () =>
    readReadyLedger(redis, walletHash)
  )
  const staleAtMs = Date.now() - WALLET_LEDGER_FRESHNESS_MS - 1_000
  const encoded = encodeWalletLedgerPayload({
    schemaVersion: WALLET_LEDGER_SCHEMA_VERSION,
    calculationVersion: current.calculationVersion,
    walletHash,
    sourceFingerprint: current.sourceFingerprint,
    sourceGeneration: current.sourceGeneration,
    appliedInvalidationSequence: current.appliedInvalidationSequence,
    coverage: current.coverage,
    streams: current.streams,
    createdAtMs: Math.min(current.createdAtMs, staleAtMs),
    updatedAtMs: staleAtMs,
    reconciledAtMs: Math.min(current.reconciledAtMs, staleAtMs)
  })
  const token = `benchmark-${randomUUID().replaceAll('-', '')}`
  const lock = await acquireFixtureWalletLedgerLock({
    redis,
    walletHash,
    token,
    label: 'wallet-ledger freshness fixture'
  })
  try {
    const lockedCurrent = await retryTransientRedisOperation('freshness fixture locked ledger read', () =>
      readReadyLedger(redis, walletHash)
    )
    if (lockedCurrent.revision !== current.revision) {
      throw new Error('Wallet ledger changed while preparing the freshness fixture')
    }
    const commit = await retryTransientRedisOperation('freshness fixture ledger commit', () =>
      commitStoredWalletLedger({
        redis,
        walletHash,
        lock,
        value: encoded.value,
        cacheTransitions: createWalletLedgerDailyUsdCacheCommitTransitions({
          previous: current,
          current: encoded.ledger,
          dirtyFromDate: null,
          reset: false
        }),
        checkedAtMs: staleAtMs,
        effectiveReconciledAtMs: encoded.ledger.reconciledAtMs
      })
    )
    if (commit.status !== 'ok') {
      throw new Error('Wallet-ledger freshness fixture lock was lost before commit')
    }
  } finally {
    await releaseFixtureWalletLedgerLock({
      redis,
      walletHash,
      lock,
      label: 'wallet-ledger freshness fixture'
    })
  }
  const fixture = await retryTransientRedisOperation('freshness fixture verification ledger read', () =>
    readReadyLedger(redis, walletHash)
  )
  if (
    fixture.revision !== encoded.ledger.revision ||
    fixture.eventRevision !== current.eventRevision ||
    getEventCount(fixture) !== getEventCount(current)
  ) {
    throw new Error('Wallet-ledger freshness fixture verification failed after commit')
  }
  return { eventRevision: fixture.eventRevision, eventCount: getEventCount(fixture) }
}

async function resolveCutoffBlock(chainId: number, cutoffTimestamp: number): Promise<number> {
  const chain = SUPPORTED_CHAINS.find(({ id }) => id === chainId)
  if (!chain) {
    throw new Error(`No timestamp-to-block chain mapping exists for chain ${chainId}`)
  }
  const response = await fetch(`https://coins.llama.fi/block/${chain.defillamaPrefix}/${cutoffTimestamp}`, {
    signal: AbortSignal.timeout(30_000)
  })
  const payload = (await response.json()) as { readonly height?: unknown }
  if (!response.ok || !Number.isSafeInteger(payload.height) || Number(payload.height) < 0) {
    throw new Error(`Could not resolve the authoritative cutoff block for chain ${chainId}`)
  }
  return Number(payload.height)
}

async function countDailyUsdRows(redis: Redis, walletHash: string): Promise<number> {
  const keys = (await getWalletKeys(redis, walletHash)).filter((key) => key.includes(':daily-usd:'))
  const rowCounts = await Promise.all(
    keys.map(async (key) => {
      const fields = await redis.hkeys(key)
      return fields.filter((field) => /^\d{4}-\d{2}-\d{2}$/.test(field)).length
    })
  )
  return rowCounts.reduce((total, count) => total + count, 0)
}

async function deleteDerivedPortfolioCaches(redis: Redis, walletHash: string, namespace: string): Promise<number> {
  const keys = (
    await retryTransientRedisOperation('tail fixture derived-cache key read', () => getWalletKeys(redis, walletHash))
  ).filter((key) => key.includes(':derived-portfolio:'))
  assertWalletKeysInScope(keys, walletHash, namespace)
  await retryTransientRedisOperation('tail fixture derived-cache deletion', () => deleteKeys(redis, keys))
  const remaining = (
    await retryTransientRedisOperation('tail fixture derived-cache deletion verification', () =>
      getWalletKeys(redis, walletHash)
    )
  ).filter((key) => key.includes(':derived-portfolio:'))
  if (remaining.length > 0) {
    throw new Error('Tail fixture derived-cache deletion verification failed')
  }
  return keys.length
}

async function installTailFixture(
  redis: Redis,
  walletHash: string,
  namespace: string,
  tailDays: number
): Promise<TInstalledTailFixture> {
  const current = await retryTransientRedisOperation('tail fixture initial ledger read', () =>
    readReadyLedger(redis, walletHash)
  )
  const originalDailyUsdRows = await retryTransientRedisOperation('tail fixture daily-USD row read', () =>
    countDailyUsdRows(redis, walletHash)
  )
  const cutoffTimestamp = Math.floor(Date.now() / 1000) - tailDays * 24 * 60 * 60
  const cutoffMs = cutoffTimestamp * 1000
  const cutoffDate = new Date(cutoffMs).toISOString().slice(0, 10)
  const envioMetadata = await fetchEnvioLedgerMetadata()
  const metadataByChain = new Map(envioMetadata.map((entry) => [entry.chainId, entry]))
  const cutoffEntries = await Promise.all(
    current.coverage.map(async (coverage) => {
      const metadata = metadataByChain.get(coverage.chainId)
      if (!metadata) {
        throw new Error(`Envio metadata is missing chain ${coverage.chainId}`)
      }
      const timestampBlock = await resolveCutoffBlock(coverage.chainId, cutoffTimestamp)
      const cutoffBlock = Math.max(
        coverage.startBlock,
        Math.min(timestampBlock, metadata.progressBlock, coverage.completeThroughBlock)
      )
      return [coverage.chainId, cutoffBlock] as const
    })
  )
  const cutoffBlocks = Object.fromEntries(cutoffEntries) as Readonly<Record<number, number>>
  const streams = Object.fromEntries(
    LEDGER_STREAMS.map((stream) => [
      stream,
      current.streams[stream].filter(
        (event) => event.blockTimestamp <= cutoffTimestamp && event.blockNumber <= (cutoffBlocks[event.chainId] ?? -1)
      )
    ])
  ) as unknown as TLedgerSixStreams
  const coverage = current.coverage.map((entry) => ({
    ...entry,
    completeThroughBlock: cutoffBlocks[entry.chainId] ?? entry.startBlock
  }))
  const encoded = encodeWalletLedgerPayload({
    schemaVersion: WALLET_LEDGER_SCHEMA_VERSION,
    calculationVersion: current.calculationVersion,
    walletHash,
    sourceFingerprint: current.sourceFingerprint,
    sourceGeneration: current.sourceGeneration,
    appliedInvalidationSequence: current.appliedInvalidationSequence,
    coverage,
    streams,
    createdAtMs: Math.min(current.createdAtMs, cutoffMs),
    updatedAtMs: cutoffMs,
    reconciledAtMs: cutoffMs
  })
  const token = `benchmark-${randomUUID().replaceAll('-', '')}`
  const lock = await acquireFixtureWalletLedgerLock({
    redis,
    walletHash,
    token,
    label: 'wallet-ledger tail fixture'
  })
  try {
    const lockedCurrent = await retryTransientRedisOperation('tail fixture locked ledger read', () =>
      readReadyLedger(redis, walletHash)
    )
    if (lockedCurrent.revision !== current.revision) {
      throw new Error('Wallet ledger changed while preparing the tail fixture')
    }
    const commit = await retryTransientRedisOperation('tail fixture ledger commit', () =>
      commitStoredWalletLedger({
        redis,
        walletHash,
        lock,
        value: encoded.value,
        cacheTransitions: createWalletLedgerDailyUsdCacheCommitTransitions({
          previous: current,
          current: encoded.ledger,
          dirtyFromDate: cutoffDate,
          reset: false
        }),
        checkedAtMs: cutoffMs,
        effectiveReconciledAtMs: cutoffMs
      })
    )
    if (commit.status !== 'ok') {
      throw new Error('Wallet-ledger fixture lock was lost before commit')
    }
  } finally {
    await releaseFixtureWalletLedgerLock({ redis, walletHash, lock, label: 'wallet-ledger tail fixture' })
  }
  const retainedDailyUsdRows = await retryTransientRedisOperation('tail fixture retained daily-USD row read', () =>
    countDailyUsdRows(redis, walletHash)
  )
  const deletedDerivedCacheKeys = await deleteDerivedPortfolioCaches(redis, walletHash, namespace)
  const fixture = await retryTransientRedisOperation('tail fixture verification ledger read', () =>
    readReadyLedger(redis, walletHash)
  )
  if (fixture.revision !== encoded.ledger.revision || fixture.eventRevision !== encoded.ledger.eventRevision) {
    throw new Error('Tail fixture verification failed after commit')
  }
  return {
    fixture: {
      cutoffTimestamp,
      cutoffBlocks,
      authoritativeSource: 'DefiLlama timestamp-to-block, capped by Envio progress and stored chain coverage',
      originalEvents: getEventCount(current),
      fixtureEvents: getEventCount(fixture),
      removedEvents: getEventCount(current) - getEventCount(fixture),
      originalEventRevision: current.eventRevision,
      fixtureEventRevision: fixture.eventRevision,
      fixtureEncodedBytes: fixture.encodedBytes,
      originalDailyUsdRows,
      retainedDailyUsdRows,
      invalidatedDailyUsdRows: originalDailyUsdRows - retainedDailyUsdRows,
      deletedDerivedCacheKeys
    },
    originalStreams: current.streams
  }
}

function redactError(error: unknown): string {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : 'UnknownError'
  const secrets = [holdingsConfig.redisUrl, holdingsConfig.redisToken, process.env.ADMIN_SECRET].filter(
    (value): value is string => typeof value === 'string' && value.length > 0
  )
  return secrets
    .reduce((redacted, secret) => redacted.replaceAll(secret, '[redacted]'), message)
    .replace(/https?:\/\/[^\s)]+/g, '[redacted-url]')
    .slice(0, 500)
}

function validateTailRepair(
  fixture: TTailFixture,
  originalStreams: TLedgerSixStreams,
  measurement: THttpMeasurement,
  stored: TWalletLedgerState
): TTailValidation {
  const refreshWasNotStale = measurement.summary.freshness !== 'stale'
  const responseMatchesStoredLedger =
    measurement.summary.ledgerRevision === stored.revision &&
    measurement.summary.eventRevision === stored.eventRevision &&
    measurement.summary.eventCount === getEventCount(stored)
  const restoredAtLeastOriginalEventCount = getEventCount(stored) >= fixture.originalEvents
  const allOriginalEventsRestored = LEDGER_STREAMS.every((stream) => {
    const storedByIdentity = new Map(
      stored.streams[stream].map((event) => [
        stringifyCanonicalLedgerValue([event.chainId, event.id]),
        stringifyCanonicalLedgerValue(event)
      ])
    )
    return originalStreams[stream].every(
      (event) =>
        storedByIdentity.get(stringifyCanonicalLedgerValue([event.chainId, event.id])) ===
        stringifyCanonicalLedgerValue(event)
    )
  })
  const exactOriginalEventRevision = stored.eventRevision === fixture.originalEventRevision
  const exactOriginalEventCount = getEventCount(stored) === fixture.originalEvents
  return {
    status:
      !refreshWasNotStale ||
      !responseMatchesStoredLedger ||
      !restoredAtLeastOriginalEventCount ||
      !allOriginalEventsRestored
        ? 'failed'
        : exactOriginalEventRevision && exactOriginalEventCount
          ? 'exact'
          : 'advanced',
    refreshWasNotStale,
    responseMatchesStoredLedger,
    restoredAtLeastOriginalEventCount,
    allOriginalEventsRestored,
    exactOriginalEventRevision,
    exactOriginalEventCount
  }
}

function validateExpiredWarm(
  fixture: TExpiredWarmFixture,
  measurement: THttpMeasurement,
  stored: TWalletLedgerState
): TExpiredWarmValidation {
  const storedEventCount = getEventCount(stored)
  const refreshWasNotStale = measurement.summary.freshness !== 'stale'
  const responseMatchesStoredLedger =
    measurement.summary.ledgerRevision === stored.revision &&
    measurement.summary.eventRevision === stored.eventRevision &&
    measurement.summary.eventCount === storedEventCount
  const restoredAtLeastFixtureEventCount = storedEventCount >= fixture.eventCount
  const exactFixtureEventRevision = stored.eventRevision === fixture.eventRevision
  const exactFixtureEventCount = storedEventCount === fixture.eventCount
  return {
    status:
      !refreshWasNotStale || !responseMatchesStoredLedger || !restoredAtLeastFixtureEventCount
        ? 'failed'
        : exactFixtureEventRevision && exactFixtureEventCount
          ? 'exact'
          : 'advanced',
    refreshWasNotStale,
    responseMatchesStoredLedger,
    restoredAtLeastFixtureEventCount,
    exactFixtureEventRevision,
    exactFixtureEventCount
  }
}

async function runExpiredWarm(
  args: TBenchmarkArgs,
  redis: Redis,
  walletHash: string,
  address: string
): Promise<TExpiredWarmResult> {
  if (args.skipExpiredWarm) {
    return { status: 'skipped' }
  }
  try {
    const fixture = await ageWalletLedgerFreshness(redis, walletHash)
    const measurement = await requestPortfolio(args, address)
    requireSuccessfulPortfolio(measurement, 'Expired-warm portfolio request')
    const stored = await retryTransientRedisOperation('expired-warm validation ledger read', () =>
      readReadyLedger(redis, walletHash)
    )
    const validation = validateExpiredWarm(fixture, measurement, stored)
    return {
      status: 'completed',
      measurement,
      storage: await measureStorageAfterPortfolio({
        redis,
        walletHash,
        measurement,
        label: 'expired-warm'
      }),
      validation
    }
  } catch (error) {
    return { status: 'unavailable', reason: redactError(error) }
  }
}

async function runTailRepair(
  args: TBenchmarkArgs,
  redis: Redis,
  walletHash: string,
  namespace: string,
  address: string
): Promise<TTailResult> {
  if (args.skipTail) {
    return { status: 'skipped' }
  }
  try {
    const installed = await installTailFixture(redis, walletHash, namespace, args.tailDays)
    const measurement = await requestPortfolio(args, address)
    requireSuccessfulPortfolio(measurement, 'Tail-repair portfolio request')
    const stored = await retryTransientRedisOperation('tail-repair validation ledger read', () =>
      readReadyLedger(redis, walletHash)
    )
    const validation = validateTailRepair(installed.fixture, installed.originalStreams, measurement, stored)
    return {
      status: 'completed',
      fixture: installed.fixture,
      measurement,
      storage: await measureStorageAfterPortfolio({
        redis,
        walletHash,
        measurement,
        label: 'tail-repair'
      }),
      validation
    }
  } catch (error) {
    return { status: 'unavailable', reason: redactError(error) }
  }
}

function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`
}

async function benchmarkWallet(
  args: TBenchmarkArgs,
  redis: Redis,
  namespace: string,
  address: string
): Promise<TWalletBenchmark> {
  const walletHash = hashLedgerWalletAddress(address)
  const label = shortAddress(address)
  console.log(`[portfolio-benchmark] ${label}: clearing isolated wallet keys`)
  const deletedColdKeys = await cleanupWalletKeys(redis, walletHash, namespace)
  console.log(`[portfolio-benchmark] ${label}: wallet-storage and server-metadata cold request`)
  const cold = await requestPortfolio(args, address, { resetMetadataCache: true })
  requireSuccessfulPortfolio(cold, 'Cold portfolio request')
  const coldStorage = await measureStorageAfterPortfolio({
    redis,
    walletHash,
    measurement: cold,
    label: `${label} cold`
  })
  console.log(`[portfolio-benchmark] ${label}: ${args.hotRuns} immediate refresh request(s)`)
  const hot = await mapSeries(
    Array.from({ length: args.hotRuns }, (_, index) => index),
    () => requestPortfolio(args, address)
  )
  hot.forEach((measurement, index) => {
    requireSuccessfulPortfolio(measurement, `Hot portfolio request ${index + 1}`)
  })
  const lastHot = hot.at(-1)
  if (!lastHot) {
    throw new Error('Immediate-hot benchmark did not produce a measurement')
  }
  const hotStorage = await measureStorageAfterPortfolio({
    redis,
    walletHash,
    measurement: lastHot,
    label: `${label} immediate-hot`
  })
  const hotMatchesCold = hot.map(({ bodyDigest }) => bodyDigest === cold.bodyDigest)
  console.log(`[portfolio-benchmark] ${label}: expired-warm freshness stage`)
  const expiredWarm = await runExpiredWarm(args, redis, walletHash, address)
  console.log(`[portfolio-benchmark] ${label}: ${args.tailDays}-day tail-repair stage`)
  const tail = await runTailRepair(args, redis, walletHash, namespace, address)
  return {
    address,
    walletHash,
    deletedColdKeys,
    cold,
    coldStorage,
    hot,
    hotStorage,
    hotMatchesCold,
    expiredWarm,
    tail
  }
}

function formatDuration(durationMs: number | null): string {
  return durationMs === null ? '—' : `${round(durationMs / 1_000, 2).toFixed(2)}s`
}

function formatBytes(bytes: number): string {
  if (bytes < 1_024) return `${bytes} B`
  if (bytes < 1_024 ** 2) return `${round(bytes / 1_024, 1)} KiB`
  return `${round(bytes / 1_024 ** 2, 2)} MiB`
}

function formatPercent(value: number): string {
  return `${round(value, 1).toFixed(1)}%`
}

function getStageDuration(result: TExpiredWarmResult | TTailResult): number | null {
  return result.status === 'completed' && result.measurement ? result.measurement.durationMs : null
}

function getHotMedian(wallet: TWalletBenchmark): number {
  return median(wallet.hot.map(({ durationMs }) => durationMs))
}

function getReduction(coldMs: number, hotMs: number): number {
  return coldMs > 0 ? (1 - hotMs / coldMs) * 100 : 0
}

function getColdTarget(wallet: TWalletBenchmark): { readonly thresholdMs: number; readonly label: string } {
  return wallet.address.toLowerCase() === DEFAULT_WALLETS[0].toLowerCase()
    ? { thresholdMs: 5_000, label: '<5s' }
    : { thresholdMs: 15_000, label: '<15s' }
}

function getHotReductionTargetStatus(reduction: number): string {
  return reduction >= HOT_REDUCTION_TARGET_PERCENT
    ? `Pass ≥${HOT_REDUCTION_TARGET_PERCENT}%`
    : `Needs work ≥${HOT_REDUCTION_TARGET_PERCENT}%`
}

function renderKeyClassRows(wallet: TWalletBenchmark): string {
  const storage = wallet.tail.storage ?? wallet.expiredWarm.storage ?? wallet.hotStorage
  const rows = Object.entries(storage.byClass).map(
    ([className, value]) =>
      `| ${wallet.address} | ${className} | ${value.keys} | ${formatBytes(value.keyBytes)} | ${formatBytes(value.logicalValueBytes)} |`
  )
  return rows.length > 0 ? rows.join('\n') : `| ${wallet.address} | none | 0 | 0 B | 0 B |`
}

function renderHttpRows(wallet: TWalletBenchmark): string {
  const hotStatuses = wallet.hot.map(({ status }) => status).join(', ')
  const hotMedianBytes = median(wallet.hot.map(({ bytes }) => bytes))
  const optionalRows: readonly [string, THttpMeasurement | undefined][] = [
    ['expired-warm', wallet.expiredWarm.measurement],
    ['tail-repair', wallet.tail.measurement]
  ]
  return [
    `| ${wallet.address} | cold | 1 | ${wallet.cold.status} | ${formatDuration(wallet.cold.durationMs)} | ${formatBytes(wallet.cold.bytes)} |`,
    `| ${wallet.address} | immediate-hot | ${wallet.hot.length} | ${hotStatuses} | ${formatDuration(getHotMedian(wallet))} | ${formatBytes(hotMedianBytes)} |`,
    ...optionalRows.flatMap(([stage, measurement]) =>
      measurement
        ? [
            `| ${wallet.address} | ${stage} | 1 | ${measurement.status} | ${formatDuration(measurement.durationMs)} | ${formatBytes(measurement.bytes)} |`
          ]
        : []
    )
  ].join('\n')
}

function renderReport(artifact: TBenchmarkArtifact, artifactPath: string, reportPath: string): string {
  const metadataResetVerified = artifact.wallets.every((wallet) => wallet.cold.serverMetadataCacheReset === true)
  const performanceRows = artifact.wallets
    .map((wallet) => {
      const hotMedian = getHotMedian(wallet)
      const reduction = getReduction(wallet.cold.durationMs, hotMedian)
      const coldTarget = getColdTarget(wallet)
      const coldTargetStatus =
        wallet.cold.durationMs < coldTarget.thresholdMs ? `Pass ${coldTarget.label}` : `Needs work ${coldTarget.label}`
      const hotTargetStatus = getHotReductionTargetStatus(reduction)
      const tailKind =
        wallet.tail.status === 'completed' && wallet.tail.fixture
          ? wallet.tail.fixture.removedEvents > 0
            ? `true repair (${wallet.tail.fixture.removedEvents.toLocaleString()} removed)`
            : 'overlap-only (no events in cutoff tail)'
          : wallet.tail.status
      return `| ${wallet.address} | ${wallet.cold.summary.eventCount?.toLocaleString() ?? '—'} | ${formatDuration(wallet.cold.durationMs)} | ${formatDuration(hotMedian)} | ${formatPercent(reduction)} | ${hotTargetStatus} | ${formatDuration(getStageDuration(wallet.expiredWarm))} | ${formatDuration(getStageDuration(wallet.tail))} | ${coldTargetStatus} | ${tailKind} |`
    })
    .join('\n')
  const correctnessRows = artifact.wallets
    .map((wallet) => {
      const hotParity = `${wallet.hotMatchesCold.filter(Boolean).length}/${wallet.hotMatchesCold.length}`
      const metadataReset =
        wallet.cold.serverMetadataCacheReset === true
          ? 'yes'
          : wallet.cold.serverMetadataCacheReset === false
            ? 'no'
            : 'unknown (older artifact)'
      const expiredWarmValidation = wallet.expiredWarm.validation?.status ?? wallet.expiredWarm.status
      const tailValidation = wallet.tail.validation?.status ?? wallet.tail.status
      return `| ${wallet.address} | ${metadataReset} | ${hotParity} | ${wallet.cold.summary.balanceComplete ?? 'unknown'} | ${wallet.cold.summary.protocolReturnComplete ?? 'unknown'} | ${wallet.cold.summary.growthComplete ?? 'unknown'} | ${expiredWarmValidation} | ${tailValidation} |`
    })
    .join('\n')
  const storageRows = artifact.wallets
    .flatMap((wallet) => {
      const stages: readonly [string, TStorageMeasurement | undefined][] = [
        ['cold', wallet.coldStorage],
        ['hot', wallet.hotStorage],
        ['expired-warm', wallet.expiredWarm.storage],
        ['tail-repaired', wallet.tail.storage]
      ]
      return stages.flatMap(([stage, storage]) =>
        storage
          ? [
              `| ${wallet.address} | ${stage} | ${storage.keys} | ${formatBytes(storage.logicalValueBytes)} | ${formatBytes(storage.ledgerEncodedBytes)} | ${formatBytes(storage.ledgerDecodedBytes)} | ${storage.ledgerEvents.toLocaleString()} | ${storage.writeBehindStatus ?? 'unknown (older artifact)'} |`
            ]
          : []
      )
    })
    .join('\n')
  const httpRows = artifact.wallets.map(renderHttpRows).join('\n')
  const responseRows = artifact.wallets
    .map(
      (wallet) =>
        `| ${wallet.address} | ${wallet.cold.summary.balancePoints.toLocaleString()} | ${wallet.cold.summary.protocolReturnPoints.toLocaleString()} | ${wallet.cold.summary.protocolReturnVaults.toLocaleString()} | ${wallet.cold.summary.growthVaults.toLocaleString()} | ${formatBytes(wallet.cold.bytes)} |`
    )
    .join('\n')
  const tailCacheRows = artifact.wallets
    .map((wallet) => {
      const fixture = wallet.tail.fixture
      return `| ${wallet.address} | ${fixture?.originalDailyUsdRows ?? '—'} | ${fixture?.retainedDailyUsdRows ?? '—'} | ${fixture?.invalidatedDailyUsdRows ?? '—'} | ${fixture?.deletedDerivedCacheKeys ?? '—'} |`
    })
    .join('\n')
  const keyRows = artifact.wallets.map(renderKeyClassRows).join('\n')
  const unavailableNotes = artifact.wallets
    .flatMap((wallet) => [
      ...(wallet.expiredWarm.status === 'unavailable'
        ? [`- ${wallet.address} expired-warm stage unavailable: ${wallet.expiredWarm.reason ?? 'unknown'}`]
        : []),
      ...(wallet.tail.status === 'unavailable'
        ? [`- ${wallet.address} tail stage unavailable: ${wallet.tail.reason ?? 'unknown'}`]
        : [])
    ])
    .join('\n')
  const relativeArtifact = relative(dirname(reportPath), artifactPath) || artifactPath
  return `# Holdings wallet-ledger portfolio benchmark

Generated: ${artifact.generatedAt}

Raw artifact: [${relativeArtifact}](${relativeArtifact})

## Outcome

This measures the current combined \`GET /api/holdings/ledger/portfolio\` route backed by the one-value wallet ledger. “Cold” means the selected wallet has no keys in the isolated wallet-ledger namespace${metadataResetVerified ? ' and the server process confirmed that its Yearn vault-metadata maps were reset' : ''}. It does **not** claim that CDN, operating-system, runtime HTTP, or upstream provider caches were flushed.

| Wallet | Ledger events | Cold refresh | Immediate hot median | Hot reduction | Hot target | Expired warm | ${artifact.settings.tailDays}-day repair | Cold target | Tail fixture |
| --- | ---: | ---: | ---: | ---: | --- | ---: | ---: | --- | --- |
${performanceRows}

The hot target is at least ${HOT_REDUCTION_TARGET_PERCENT}% lower wall time than cold and is evaluated in the “Hot target” column. The absolute cold threshold is evaluated separately; neither result substitutes for the other.

## What was tested

1. **${metadataResetVerified ? 'Wallet-storage + server-metadata cold' : 'Wallet-storage cold'}:** delete only \`holdings:wallet-ledger:v3:{wallet}:namespace:${artifact.namespace}*\` for the selected wallet, verify none remain, ${metadataResetVerified ? 'reset the server process’s global and fallback vault-metadata maps, require the server’s reset-confirmation header, then ' : ''}call the combined route with \`refresh=1\`.
2. **True immediate hot:** repeat that same \`refresh=1\` request ${artifact.settings.hotRuns} time(s) immediately. No marker or ledger fixture is changed first.
3. **Expired warm:** atomically age the ledger bookkeeping and checked marker beyond the ${Math.round(artifact.settings.freshnessMs / 60_000)}-minute freshness window without changing events, invalidations, or coverage, then call \`refresh=1\`.
4. **${artifact.settings.tailDays}-day tail repair:** decode the stored ledger, resolve an authoritative timestamp-to-block cutoff per chain, remove later events, rewind each chain’s \`completeThroughBlock\`, atomically transition daily-USD metadata while deleting only dates on or after the cutoff, delete the revision-bound derived-portfolio key, then call \`refresh=1\`.

All calls use \`version=all&denomination=usd&timeframe=1y&debug=1\`. HTTP wall time, status, response bytes, output summaries, event revisions/counts, and wallet-scoped Redis logical sizes are captured. Before each storage snapshot, the harness waits up to ${WRITE_BEHIND_STORAGE_WAIT_MS / 1_000} seconds for an expected asynchronous derived-portfolio write to become visible; that wait is excluded from the reported HTTP wall time. Credentials are neither serialized nor printed.

## HTTP samples

| Wallet | Stage | Runs | HTTP status(es) | Median wall time | Median body bytes |
| --- | --- | ---: | --- | ---: | ---: |
${httpRows}

## Cold response shape

| Wallet | Balance points | Protocol points | Protocol vaults | Growth vaults | Response bytes |
| --- | ---: | ---: | ---: | ---: | ---: |
${responseRows}

## Correctness and completeness

| Wallet | Metadata reset confirmed | Immediate-hot bodies matching cold | Balance complete | Protocol return complete | Growth complete | Expired-warm verification | Tail restoration |
| --- | --- | ---: | --- | --- | --- | --- | --- |
${correctnessRows}

Body parity hashes omit only the intentionally request-time fields \`ledger.freshness\`, \`protocolReturn.generatedAt\`, and \`growth.generatedAt\`. Tail status means:

- **exact:** the repaired event count and event revision equal the pre-fixture ledger;
- **advanced:** every original event was restored byte-for-byte, but the indexer added events during the run;
- **failed:** synchronization fell back to a stale ledger, the HTTP response and stored ledger disagree, or any original event was not restored byte-for-byte.

Expired-warm verification uses the same statuses against the synthetically aged ledger. It therefore cannot silently count a stale fallback as a successful warm verification.

Immediate-hot body parity is a consistency check between cold and cached execution of this implementation, not an independent numeric correctness oracle. The three completeness columns are the route’s own provider-coverage signals. Tail restoration independently checks that every pre-fixture ledger event returns byte-for-byte; this harness does not compare portfolio values with legacy or an external accounting source.

### Tail cache preservation

The fixture transitions daily-USD metadata exactly like a real ledger change. Dates before the cutoff remain reusable; only the affected tail is removed. Revision-bound protocol-return/growth data is deleted in full because those payloads are not partitioned by date.

| Wallet | Daily USD rows before fixture | Rows retained | Rows invalidated | Derived keys deleted |
| --- | ---: | ---: | ---: | ---: |
${tailCacheRows}

## Wallet-scoped Redis footprint

“Logical value bytes” are string lengths plus hash field/value payload lengths. This is deterministic application data size, not Redis allocator memory.
“Derived persistence” is \`observed\` when the derived-portfolio key was visible before measurement, \`not-expected\` when the response contained no derived vault result, and \`timeout\` when an expected write was still absent after the bounded wait; the latter records the keys actually present rather than assuming persistence.

| Wallet | Stage | Keys | Logical values | Encoded ledger | Decoded ledger | Events | Derived persistence |
| --- | --- | ---: | ---: | ---: | ---: | ---: | --- |
${storageRows}

### Final key classes

| Wallet | Key class | Keys | Key bytes | Logical value bytes |
| --- | --- | ---: | ---: | ---: |
${keyRows}

## Interpretation guardrails

- Cold and hot are compared on the **same combined route**. This avoids comparing a hot ledger projection with a cold legacy calculation.
- ${metadataResetVerified ? 'Every cold request reset the server process’s vault metadata and verified the reset response header, so a later wallet could not inherit that module cache from an earlier wallet.' : 'This older artifact does not prove that the server metadata module cache was reset between wallets; treat later-wallet cold samples as process-warm.'} Shared Kong/Yearn/DefiLlama/runtime HTTP caches may still be warm.
- The global invalidation log is intentionally preserved because it is source state, while only the selected wallet namespace is cleared.
- Fixture-only Redis reads and idempotent mutations retry transient transport/service failures up to ${FIXTURE_REDIS_MAX_ATTEMPTS} times. Portfolio HTTP requests are never retried, so route failures and timings remain visible.
- The expired-warm fixture is synthetic. Its purpose is to isolate the cost of a real warm Envio verification after the five-minute shortcut expires.
- The tail fixture uses DefiLlama’s timestamp-to-block result capped by live Envio progress and the ledger’s current coverage. It never invents a last-event cursor.
- Balance, protocol-return, and growth completeness are reported independently. A fast incomplete response is not counted as a correctness win.
- Tail cache preservation reports retained row counts; it does not compare every retained USD value with an external oracle.
- Inspect the request-correlated \`[HoldingsDebug]\` server logs alongside this report for the internal timing breakdown.

## Unavailable or skipped stages

${unavailableNotes || '- None.'}

## Next comparison

Re-run this exact harness after each scheduling/cache change with a fresh \`benchmark_...\` namespace. Compare the raw artifact and this table, then record the code revision and any upstream incident in a short note here.
`
}

async function writeArtifactAndReport(
  artifact: TBenchmarkArtifact,
  artifactPath: string,
  reportPath: string
): Promise<void> {
  await Promise.all([
    mkdir(dirname(artifactPath), { recursive: true }),
    mkdir(dirname(reportPath), { recursive: true })
  ])
  await writeFile(artifactPath, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8')
  await writeFile(reportPath, renderReport(artifact, artifactPath, reportPath), 'utf8')
}

function parseArtifact(value: unknown): TBenchmarkArtifact {
  if (!isRecord(value) || value.schemaVersion !== 1 || !Array.isArray(value.wallets)) {
    throw new Error('Existing benchmark artifact is invalid')
  }
  return value as unknown as TBenchmarkArtifact
}

async function renderExisting(args: TBenchmarkArgs): Promise<void> {
  if (!args.renderExistingPath) {
    throw new Error('Missing existing artifact path')
  }
  const artifact = parseArtifact(JSON.parse(await readFile(args.renderExistingPath, 'utf8')) as unknown)
  await mkdir(dirname(args.reportPath), { recursive: true })
  await writeFile(args.reportPath, renderReport(artifact, args.renderExistingPath, args.reportPath), 'utf8')
  console.log(`[portfolio-benchmark] rendered ${args.reportPath}`)
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2))
  if (args.renderExistingPath) {
    await renderExisting(args)
    return
  }
  const namespace = assertSafeBenchmark(args)
  const redis = getHoldingsLedgerRedisClient()
  if (!redis) {
    throw new Error('Holdings ledger Redis is unavailable')
  }
  await assertServerRuntimeScope(args)
  const wallets = await mapSeries(args.wallets, (address) => benchmarkWallet(args, redis, namespace, address))
  const artifact: TBenchmarkArtifact = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    baseUrl: args.baseUrl,
    namespace,
    settings: {
      hotRuns: args.hotRuns,
      tailDays: args.tailDays,
      skipExpiredWarm: args.skipExpiredWarm,
      skipTail: args.skipTail,
      freshnessMs: WALLET_LEDGER_FRESHNESS_MS,
      reconcileIntervalMs: holdingsConfig.ledgerReconcileIntervalMs
    },
    wallets
  }
  await writeArtifactAndReport(artifact, args.artifactPath, args.reportPath)
  console.log(`[portfolio-benchmark] artifact: ${args.artifactPath}`)
  console.log(`[portfolio-benchmark] report: ${args.reportPath}`)
}

main().catch((error) => {
  console.error(`[portfolio-benchmark] ${redactError(error)}`)
  process.exitCode = 1
})
