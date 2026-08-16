import { createHash } from 'node:crypto'
import { brotliCompressSync, brotliDecompressSync, constants as zlibConstants } from 'node:zlib'
import { z } from 'zod'
import { getHoldingsRedisClient, handleHoldingsRedisError } from '@/server/lib/holdings/storage/redis'
import type { UserEvents } from '@/server/lib/holdings/types'

// v2 cannot reuse event sets produced by the old count-free 50k query, which Envio could silently cap at 1k rows.
const WALLET_EVENT_CACHE_KEY_PREFIX = 'holdings:wallet-events:v2'
const WALLET_EVENT_CACHE_VALUE_PREFIX = 'br1:'
const WALLET_EVENT_CACHE_TTL_SECONDS = 5 * 60
const WALLET_EVENT_CACHE_MAX_AGE_MS = WALLET_EVENT_CACHE_TTL_SECONDS * 1000
const WALLET_EVENT_CACHE_MAX_ENCODED_BYTES = 4 * 1024 * 1024
const WALLET_EVENT_CACHE_MAX_DECODED_BYTES = 32 * 1024 * 1024

const baseEventSchema = z.object({
  id: z.string(),
  vaultAddress: z.string(),
  chainId: z.number().int(),
  blockNumber: z.number().int(),
  blockTimestamp: z.number().int(),
  logIndex: z.number().int(),
  transactionHash: z.string(),
  transactionFrom: z.string()
})

const depositEventSchema = baseEventSchema.extend({
  owner: z.string(),
  sender: z.string(),
  assets: z.string(),
  shares: z.string()
})

const withdrawEventSchema = baseEventSchema.extend({
  owner: z.string(),
  assets: z.string(),
  shares: z.string()
})

const transferEventSchema = baseEventSchema.extend({
  sender: z.string(),
  receiver: z.string(),
  value: z.string()
})

const walletEventCachePayloadSchema = z.object({
  version: z.literal(1),
  maxTimestamp: z.number().int().nonnegative(),
  cachedAtMs: z.number().int().nonnegative(),
  events: z.object({
    deposits: z.array(depositEventSchema),
    withdrawals: z.array(withdrawEventSchema),
    transfersIn: z.array(transferEventSchema),
    transfersOut: z.array(transferEventSchema)
  })
})

interface WalletEventCachePayload {
  version: 1
  maxTimestamp: number
  cachedAtMs: number
  events: UserEvents
}

export interface WalletEventCacheIdentity {
  userAddress: string
  maxTimestamp: number
}

function getWalletHash(userAddress: string): string {
  return createHash('sha256').update(userAddress.toLowerCase()).digest('hex')
}

export function getWalletEventCacheKey(identity: WalletEventCacheIdentity): string {
  return `${WALLET_EVENT_CACHE_KEY_PREFIX}:${getWalletHash(identity.userAddress)}:${identity.maxTimestamp}`
}

export function encodeWalletEventCachePayload(payload: WalletEventCachePayload): string {
  const compressed = brotliCompressSync(Buffer.from(JSON.stringify(payload)), {
    params: {
      [zlibConstants.BROTLI_PARAM_QUALITY]: 4
    }
  })

  return `${WALLET_EVENT_CACHE_VALUE_PREFIX}${compressed.toString('base64')}`
}

export function decodeWalletEventCachePayload(value: unknown): WalletEventCachePayload | null {
  if (
    typeof value !== 'string' ||
    Buffer.byteLength(value) > WALLET_EVENT_CACHE_MAX_ENCODED_BYTES ||
    !value.startsWith(WALLET_EVENT_CACHE_VALUE_PREFIX)
  ) {
    return null
  }

  try {
    const encoded = value.slice(WALLET_EVENT_CACHE_VALUE_PREFIX.length)
    const compressed = Buffer.from(encoded, 'base64')
    if (compressed.length === 0 || compressed.toString('base64') !== encoded) {
      return null
    }

    const parsed = JSON.parse(
      brotliDecompressSync(compressed, { maxOutputLength: WALLET_EVENT_CACHE_MAX_DECODED_BYTES }).toString()
    )
    const result = walletEventCachePayloadSchema.safeParse(parsed)
    return result.success ? result.data : null
  } catch {
    return null
  }
}

export async function getCachedWalletEvents(
  identity: WalletEventCacheIdentity,
  nowMs = Date.now()
): Promise<UserEvents | null> {
  const redis = getHoldingsRedisClient()
  if (!redis) {
    return null
  }

  try {
    const payload = decodeWalletEventCachePayload(await redis.get(getWalletEventCacheKey(identity)))
    if (!payload || payload.maxTimestamp !== identity.maxTimestamp) {
      return null
    }

    const ageMs = nowMs - payload.cachedAtMs
    return ageMs >= 0 && ageMs < WALLET_EVENT_CACHE_MAX_AGE_MS ? payload.events : null
  } catch (error) {
    handleHoldingsRedisError('wallet event cache lookup failed', error)
    return null
  }
}

export async function saveCachedWalletEvents(
  identity: WalletEventCacheIdentity,
  events: UserEvents,
  nowMs = Date.now()
): Promise<boolean> {
  const redis = getHoldingsRedisClient()
  if (!redis) {
    return false
  }

  try {
    const value = encodeWalletEventCachePayload({
      version: 1,
      maxTimestamp: identity.maxTimestamp,
      cachedAtMs: nowMs,
      events
    })

    await redis.set(getWalletEventCacheKey(identity), value, { ex: WALLET_EVENT_CACHE_TTL_SECONDS })
    return true
  } catch (error) {
    handleHoldingsRedisError('wallet event cache save failed', error)
    return false
  }
}
