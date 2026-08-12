import { Buffer } from 'node:buffer'
import { brotliCompressSync, brotliDecompressSync, constants as zlibConstants } from 'node:zlib'
import {
  canonicalizeLedgerStreams,
  decodeCanonicalLedgerTuples,
  getLedgerSha256,
  stringifyCanonicalLedgerValue
} from '@/server/lib/holdings/services/ledger/codec'
import { LEDGER_STREAMS, type TLedgerSixStreams } from '@/server/lib/holdings/services/ledger/types'
import {
  type TWalletLedgerCoverageV1,
  type TWalletLedgerPayloadV3,
  type TWalletLedgerState,
  WALLET_LEDGER_CODEC,
  WALLET_LEDGER_MAX_DECODED_BYTES,
  WALLET_LEDGER_MAX_ENCODED_BYTES,
  WALLET_LEDGER_SCHEMA_VERSION
} from '@/server/lib/holdings/services/ledger/walletTypes'

const SHA256_PATTERN = /^[a-f0-9]{64}$/
const WALLET_LEDGER_VALUE_PREFIX = `holdings-wallet-ledger:opaque:v${WALLET_LEDGER_SCHEMA_VERSION}:${WALLET_LEDGER_CODEC}:`
const PAYLOAD_FIELDS = [
  'schemaVersion',
  'calculationVersion',
  'walletHash',
  'sourceFingerprint',
  'sourceGeneration',
  'appliedInvalidationSequence',
  'coverage',
  'streams',
  'createdAtMs',
  'updatedAtMs',
  'reconciledAtMs'
] as const
const COVERAGE_FIELDS = ['chainId', 'startBlock', 'endBlock', 'completeThroughBlock'] as const

export interface TEncodedWalletLedger {
  readonly value: string
  readonly ledger: TWalletLedgerState
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function assertExactObjectKeys(
  value: unknown,
  fields: readonly string[],
  label: string
): asserts value is Record<string, unknown> {
  if (!isPlainObject(value)) {
    throw new Error(`${label} must be a plain object`)
  }
  const actual = Object.keys(value).toSorted()
  const expected = [...fields].toSorted()
  if (actual.length !== expected.length || actual.some((field, index) => field !== expected[index])) {
    throw new Error(`${label} contains unsupported or missing fields`)
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

function parseCoverage(value: unknown): TWalletLedgerCoverageV1[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error('Wallet ledger coverage must contain at least one chain')
  }
  const coverage = value.map((entry): TWalletLedgerCoverageV1 => {
    assertExactObjectKeys(entry, COVERAGE_FIELDS, 'Wallet ledger chain coverage')
    assertSafeInteger(entry.chainId, 'Wallet ledger coverage chain id', 1)
    assertSafeInteger(entry.startBlock, 'Wallet ledger coverage start block')
    assertSafeInteger(entry.completeThroughBlock, 'Wallet ledger coverage checkpoint')
    if (entry.endBlock !== null) {
      assertSafeInteger(entry.endBlock, 'Wallet ledger coverage end block')
    }
    if (
      entry.completeThroughBlock < entry.startBlock ||
      (entry.endBlock !== null && (entry.endBlock < entry.startBlock || entry.completeThroughBlock > entry.endBlock))
    ) {
      throw new Error('Wallet ledger chain coverage bounds are invalid')
    }
    return {
      chainId: entry.chainId,
      startBlock: entry.startBlock,
      endBlock: entry.endBlock,
      completeThroughBlock: entry.completeThroughBlock
    }
  })
  const sorted = [...coverage].toSorted((left, right) => left.chainId - right.chainId)
  if (
    new Set(sorted.map(({ chainId }) => chainId)).size !== sorted.length ||
    stringifyCanonicalLedgerValue(coverage) !== stringifyCanonicalLedgerValue(sorted)
  ) {
    throw new Error('Wallet ledger coverage must contain unique chains in canonical order')
  }
  return sorted
}

function normalizeStreams(value: unknown): TLedgerSixStreams {
  assertExactObjectKeys(value, LEDGER_STREAMS, 'Wallet ledger streams')
  if (LEDGER_STREAMS.some((stream) => !Array.isArray(value[stream]))) {
    throw new Error('Wallet ledger streams must contain six event arrays')
  }
  const source = value as unknown as TLedgerSixStreams
  const normalized = decodeCanonicalLedgerTuples(canonicalizeLedgerStreams(source))
  if (stringifyCanonicalLedgerValue(source) !== stringifyCanonicalLedgerValue(normalized)) {
    throw new Error('Wallet ledger streams must be canonical, ordered, and unique')
  }
  return normalized
}

function assertStreamsWithinCoverage(streams: TLedgerSixStreams, coverage: readonly TWalletLedgerCoverageV1[]): void {
  const coverageByChain = new Map(coverage.map((entry) => [entry.chainId, entry]))
  const outsideCoverage = LEDGER_STREAMS.some((stream) =>
    streams[stream].some((event) => {
      const chainCoverage = coverageByChain.get(event.chainId)
      return (
        chainCoverage === undefined ||
        event.blockNumber < chainCoverage.startBlock ||
        event.blockNumber > chainCoverage.completeThroughBlock
      )
    })
  )
  if (outsideCoverage) {
    throw new Error('Wallet ledger events fall outside synchronized chain coverage')
  }
}

export function parseWalletLedgerPayload(value: unknown): TWalletLedgerPayloadV3 {
  assertExactObjectKeys(value, PAYLOAD_FIELDS, 'Wallet ledger payload')
  if (value.schemaVersion !== WALLET_LEDGER_SCHEMA_VERSION) {
    throw new Error('Wallet ledger schema version is unsupported')
  }
  if (
    typeof value.calculationVersion !== 'string' ||
    value.calculationVersion.length === 0 ||
    value.calculationVersion.trim() !== value.calculationVersion
  ) {
    throw new Error('Wallet ledger calculation version is invalid')
  }
  assertSha256(value.walletHash, 'Wallet ledger wallet hash')
  assertSha256(value.sourceFingerprint, 'Wallet ledger source fingerprint')
  assertSafeInteger(value.sourceGeneration, 'Wallet ledger source generation', 1)
  assertSafeInteger(value.appliedInvalidationSequence, 'Wallet ledger applied invalidation sequence')
  assertSafeInteger(value.createdAtMs, 'Wallet ledger creation timestamp')
  assertSafeInteger(value.updatedAtMs, 'Wallet ledger update timestamp')
  assertSafeInteger(value.reconciledAtMs, 'Wallet ledger reconciliation timestamp')
  if (
    value.updatedAtMs < value.createdAtMs ||
    value.reconciledAtMs < value.createdAtMs ||
    value.reconciledAtMs > value.updatedAtMs
  ) {
    throw new Error('Wallet ledger timestamps are inconsistent')
  }
  const coverage = parseCoverage(value.coverage)
  const streams = normalizeStreams(value.streams)
  assertStreamsWithinCoverage(streams, coverage)
  return {
    schemaVersion: WALLET_LEDGER_SCHEMA_VERSION,
    calculationVersion: value.calculationVersion,
    walletHash: value.walletHash,
    sourceFingerprint: value.sourceFingerprint,
    sourceGeneration: value.sourceGeneration,
    appliedInvalidationSequence: value.appliedInvalidationSequence,
    coverage,
    streams,
    createdAtMs: value.createdAtMs,
    updatedAtMs: value.updatedAtMs,
    reconciledAtMs: value.reconciledAtMs
  }
}

function getEnvelopeParts(value: string): { readonly revision: string; readonly data: string } {
  if (!value.startsWith(WALLET_LEDGER_VALUE_PREFIX)) {
    throw new Error('Wallet ledger value encoding is unsupported')
  }
  const remainder = value.slice(WALLET_LEDGER_VALUE_PREFIX.length)
  const separator = remainder.indexOf(':')
  const revision = separator < 0 ? '' : remainder.slice(0, separator)
  const data = separator < 0 ? '' : remainder.slice(separator + 1)
  assertSha256(revision, 'Wallet ledger revision')
  if (data.length === 0) {
    throw new Error('Wallet ledger compressed value is empty')
  }
  return { revision, data }
}

function decodeBrotliJson(data: string): { readonly json: string; readonly decodedBytes: number } {
  const compressed = Buffer.from(data, 'base64')
  if (compressed.length === 0 || compressed.toString('base64') !== data) {
    throw new Error('Wallet ledger value is not canonical base64')
  }
  const decoded = (() => {
    try {
      return brotliDecompressSync(compressed, { maxOutputLength: WALLET_LEDGER_MAX_DECODED_BYTES })
    } catch {
      throw new Error('Wallet ledger value is not valid Brotli data')
    }
  })()
  return { json: decoded.toString('utf8'), decodedBytes: decoded.length }
}

export function getWalletLedgerEventRevision(streams: TLedgerSixStreams): string {
  return getLedgerSha256(stringifyCanonicalLedgerValue(canonicalizeLedgerStreams(streams)))
}

export function encodeWalletLedgerPayload(payload: TWalletLedgerPayloadV3): TEncodedWalletLedger {
  const normalized = parseWalletLedgerPayload(payload)
  const json = stringifyCanonicalLedgerValue(normalized)
  const decoded = Buffer.from(json, 'utf8')
  if (decoded.length > WALLET_LEDGER_MAX_DECODED_BYTES) {
    throw new Error('Wallet ledger payload exceeds the decoded byte limit')
  }
  const revision = getLedgerSha256(decoded)
  const data = brotliCompressSync(decoded, {
    params: { [zlibConstants.BROTLI_PARAM_QUALITY]: 4 }
  }).toString('base64')
  const value = `${WALLET_LEDGER_VALUE_PREFIX}${revision}:${data}`
  const encodedBytes = Buffer.byteLength(value, 'utf8')
  if (encodedBytes > WALLET_LEDGER_MAX_ENCODED_BYTES) {
    throw new Error('Wallet ledger payload exceeds the encoded byte limit')
  }
  return {
    value,
    ledger: {
      ...normalized,
      revision,
      eventRevision: getWalletLedgerEventRevision(normalized.streams),
      encodedBytes,
      decodedBytes: decoded.length
    }
  }
}

export function decodeWalletLedgerValue(value: unknown, expectedWalletHash?: string): TWalletLedgerState {
  if (typeof value !== 'string') {
    throw new Error('Wallet ledger value must be an opaque string')
  }
  const encodedBytes = Buffer.byteLength(value, 'utf8')
  if (encodedBytes > WALLET_LEDGER_MAX_ENCODED_BYTES) {
    throw new Error('Wallet ledger value exceeds the encoded byte limit')
  }
  const { revision, data } = getEnvelopeParts(value)
  const decoded = decodeBrotliJson(data)
  const parsed = (() => {
    try {
      return JSON.parse(decoded.json) as unknown
    } catch {
      throw new Error('Wallet ledger value does not contain valid JSON')
    }
  })()
  if (stringifyCanonicalLedgerValue(parsed) !== decoded.json || getLedgerSha256(decoded.json) !== revision) {
    throw new Error('Wallet ledger value checksum or canonical encoding is invalid')
  }
  const payload = parseWalletLedgerPayload(parsed)
  if (expectedWalletHash !== undefined && payload.walletHash !== expectedWalletHash) {
    throw new Error('Wallet ledger value belongs to another wallet')
  }
  return {
    ...payload,
    revision,
    eventRevision: getWalletLedgerEventRevision(payload.streams),
    encodedBytes,
    decodedBytes: decoded.decodedBytes
  }
}
