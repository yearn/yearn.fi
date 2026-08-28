import { Redis } from '@upstash/redis'
import type { VaultOptimization } from './schema'
import { parseVaultOptimizations } from './schema'

const OPTIMIZATIONS_KEY_PATTERN = 'doa:optimizations:*'
const OPTIMIZATIONS_KEY_REGEX = /^doa:optimizations:(\d+):(.+)$/
const MIN_UNIX_SECONDS = 946684800
const MAX_UNIX_SECONDS = 4102444800
const LOCAL_CACHE_TTL_MS = 60 * 1000
export const REDIS_MISSING_CONFIGURATION_MESSAGE =
  'UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must both be set'
export const REDIS_AUTHENTICATION_ERROR_MESSAGE =
  'Backend Redis authentication failed. Check UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN credentials.'
export const REDIS_CONNECTIVITY_ERROR_MESSAGE = 'Backend connectivity unavailable. Unable to access Redis.'

interface OptimizationKeyInfo {
  key: string
  chainId: number | null
  revision: string
  revisionUnixSeconds: number | null
  revisionTimestampUtc: string | null
  isLatestAlias: boolean
}

interface OptimizationPayloadRecord {
  keyInfo: OptimizationKeyInfo
  rawPayload: string
}

export interface OptimizationSourceMeta {
  key: string
  chainId: number | null
  revision: string
  isLatestAlias: boolean
  timestampUtc: string | null
  latestMatchedTimestampUtc: string | null
}

export type VaultOptimizationRecord = VaultOptimization & {
  source: OptimizationSourceMeta
}

interface ReadOptimizationsCache {
  value: VaultOptimizationRecord[] | null
  expiresAtMs: number
}

let client: Redis | null = null
let optimizationsCache: ReadOptimizationsCache | null = null
let optimizationsInFlight: Promise<VaultOptimizationRecord[] | null> | null = null

function getClient(): Redis {
  if (!client) {
    const url = process.env.UPSTASH_REDIS_REST_URL
    const token = process.env.UPSTASH_REDIS_REST_TOKEN
    if (!url || !token) {
      throw new RedisConnectivityError(REDIS_MISSING_CONFIGURATION_MESSAGE)
    }

    client = new Redis({ url, token })
  }

  return client
}

export class RedisConnectivityError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message)
    this.name = 'RedisConnectivityError'
    if (options?.cause !== undefined) {
      ;(this as Error & { cause?: unknown }).cause = options.cause
    }
  }
}

export function isRedisConnectivityError(error: unknown): error is RedisConnectivityError {
  return error instanceof RedisConnectivityError
}

export class RedisAuthenticationError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message)
    this.name = 'RedisAuthenticationError'
    if (options?.cause !== undefined) {
      ;(this as Error & { cause?: unknown }).cause = options.cause
    }
  }
}

export function isRedisAuthenticationError(error: unknown): error is RedisAuthenticationError {
  return error instanceof RedisAuthenticationError
}

function classifyError(error: unknown): Error {
  if (!(error instanceof Error)) {
    return new Error(String(error), { cause: error })
  }

  const message = error.message.toLowerCase()

  if (message.includes('unauthorized') || message.includes('invalid token')) {
    return new RedisAuthenticationError('Redis authentication failed', { cause: error })
  }

  if (
    message.includes('fetch failed') ||
    message.includes('econnrefused') ||
    message.includes('enotfound') ||
    message.includes('timeout') ||
    message.includes('network')
  ) {
    return new RedisConnectivityError('Unable to reach Redis backend', { cause: error })
  }

  return error
}

function formatUtcTimestampFromUnixSeconds(unixSeconds: number): string {
  return `${new Date(unixSeconds * 1000).toISOString().slice(0, 19).replace('T', ' ')} UTC`
}

function parseOptimizationKey(key: string): OptimizationKeyInfo {
  const match = key.match(OPTIMIZATIONS_KEY_REGEX)
  if (!match) {
    return {
      key,
      chainId: null,
      revision: '',
      revisionUnixSeconds: null,
      revisionTimestampUtc: null,
      isLatestAlias: false
    }
  }

  const chainId = Number.parseInt(match[1], 10)
  const revision = match[2]
  const isLatestAlias = revision === 'latest'
  const parsedRevision = Number.parseInt(revision, 10)
  const isUnixSeconds =
    !isLatestAlias &&
    /^\d+$/.test(revision) &&
    Number.isFinite(parsedRevision) &&
    parsedRevision >= MIN_UNIX_SECONDS &&
    parsedRevision <= MAX_UNIX_SECONDS
  const revisionUnixSeconds = isUnixSeconds ? parsedRevision : null

  return {
    key,
    chainId,
    revision,
    revisionUnixSeconds,
    revisionTimestampUtc: revisionUnixSeconds !== null ? formatUtcTimestampFromUnixSeconds(revisionUnixSeconds) : null,
    isLatestAlias
  }
}

function keySortRank(key: string): { chainId: number | null; revisionRank: number } {
  const keyInfo = parseOptimizationKey(key)
  if (keyInfo.chainId === null) {
    return { chainId: null, revisionRank: Number.MIN_SAFE_INTEGER }
  }

  if (keyInfo.isLatestAlias) {
    return { chainId: keyInfo.chainId, revisionRank: Number.MAX_SAFE_INTEGER }
  }

  return {
    chainId: keyInfo.chainId,
    revisionRank: keyInfo.revisionUnixSeconds ?? Number.MIN_SAFE_INTEGER
  }
}

function sortOptimizationKeys(keys: string[]): string[] {
  return [...new Set(keys)].sort((left, right) => {
    const leftRank = keySortRank(left)
    const rightRank = keySortRank(right)

    if (leftRank.chainId === null && rightRank.chainId !== null) {
      return 1
    }
    if (leftRank.chainId !== null && rightRank.chainId === null) {
      return -1
    }
    if (leftRank.chainId !== null && rightRank.chainId !== null && leftRank.chainId !== rightRank.chainId) {
      return leftRank.chainId - rightRank.chainId
    }
    if (leftRank.revisionRank !== rightRank.revisionRank) {
      return rightRank.revisionRank - leftRank.revisionRank
    }

    return left.localeCompare(right)
  })
}

async function readOptimizationKeys(): Promise<string[]> {
  const keys: string[] = []
  let cursor = '0'

  do {
    const [nextCursor, foundKeys] = await getClient().scan(cursor, {
      match: OPTIMIZATIONS_KEY_PATTERN,
      count: 500
    })
    cursor = nextCursor
    keys.push(...foundKeys)
  } while (cursor !== '0')

  return sortOptimizationKeys(keys)
}

function findLatestAliasTimestamp(
  keyInfo: OptimizationKeyInfo,
  rawPayload: string,
  records: OptimizationPayloadRecord[]
): string | null {
  if (!keyInfo.isLatestAlias || keyInfo.chainId === null) {
    return null
  }

  let newestMatchingTimestamp: number | null = null
  for (const record of records) {
    if (record.keyInfo.chainId !== keyInfo.chainId) {
      continue
    }
    if (record.keyInfo.revisionUnixSeconds === null) {
      continue
    }
    if (record.rawPayload !== rawPayload) {
      continue
    }
    if (newestMatchingTimestamp === null || record.keyInfo.revisionUnixSeconds > newestMatchingTimestamp) {
      newestMatchingTimestamp = record.keyInfo.revisionUnixSeconds
    }
  }

  return newestMatchingTimestamp === null ? null : formatUtcTimestampFromUnixSeconds(newestMatchingTimestamp)
}

async function fetchOptimizationsFromRedis(): Promise<VaultOptimizationRecord[] | null> {
  let keys: string[]
  let rawPayloads: Array<string | null>

  try {
    keys = await readOptimizationKeys()
    if (keys.length === 0) {
      return null
    }

    rawPayloads = await Promise.all(keys.map((key) => getClient().get<string>(key)))
  } catch (error) {
    throw classifyError(error)
  }

  const payloadRecords: OptimizationPayloadRecord[] = []
  for (const [index, rawPayload] of rawPayloads.entries()) {
    if (!rawPayload) {
      continue
    }

    const normalizedRawPayload = typeof rawPayload === 'string' ? rawPayload : JSON.stringify(rawPayload)
    payloadRecords.push({
      keyInfo: parseOptimizationKey(keys[index]),
      rawPayload: normalizedRawPayload
    })
  }

  const optimizations: VaultOptimizationRecord[] = []
  for (const [index, rawPayload] of rawPayloads.entries()) {
    if (!rawPayload) {
      continue
    }

    const parsed = typeof rawPayload === 'string' ? JSON.parse(rawPayload) : rawPayload
    const key = keys[index]
    const keyInfo = parseOptimizationKey(key)
    const normalizedRawPayload = typeof rawPayload === 'string' ? rawPayload : JSON.stringify(rawPayload)
    const latestMatchedTimestampUtc = findLatestAliasTimestamp(keyInfo, normalizedRawPayload, payloadRecords)
    const source: OptimizationSourceMeta = {
      key,
      chainId: keyInfo.chainId,
      revision: keyInfo.revision,
      isLatestAlias: keyInfo.isLatestAlias,
      timestampUtc: keyInfo.revisionTimestampUtc,
      latestMatchedTimestampUtc
    }

    const parsedOptimizations = parseVaultOptimizations(parsed, `redis payload (${key})`)
    for (const optimization of parsedOptimizations) {
      optimizations.push({
        ...optimization,
        source
      })
    }
  }

  return optimizations.length > 0 ? optimizations : null
}

export async function readOptimizations(): Promise<VaultOptimizationRecord[] | null> {
  if (optimizationsCache && Date.now() < optimizationsCache.expiresAtMs) {
    return optimizationsCache.value
  }

  if (optimizationsInFlight) {
    return optimizationsInFlight
  }

  optimizationsInFlight = (async () => {
    const value = await fetchOptimizationsFromRedis()
    optimizationsCache = {
      value,
      expiresAtMs: Date.now() + LOCAL_CACHE_TTL_MS
    }
    return value
  })()

  try {
    return await optimizationsInFlight
  } finally {
    optimizationsInFlight = null
  }
}

export function findVaultOptimization<T extends VaultOptimization>(
  optimizations: readonly T[],
  vaultAddress: string
): T | undefined {
  const normalizedAddress = vaultAddress.toLowerCase()
  return optimizations.find((opt) => opt.vault.toLowerCase() === normalizedAddress)
}
