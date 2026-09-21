import { createHash } from 'node:crypto'
import { Redis } from '@upstash/redis'

// All deployments using the same Enso key must share this Redis database. Fail closed if it is unavailable.
// Any caller can service the oldest queued route; an absent tab cannot block the queue.
// Redis TIME owns pacing, so clock skew between server instances cannot spend the credential budget twice.
export const BRIDGE_GATEWAY_CLAIM = `
local clock = redis.call('TIME')
local now = tonumber(clock[1]) * 1000 + math.floor(tonumber(clock[2]) / 1000)
local cached = redis.call('GET', KEYS[4])
if cached then return {'cached', cached, tostring(now)} end
local expired = redis.call('ZRANGEBYSCORE', KEYS[2], '-inf', now - 120000)
if #expired > 0 then redis.call('ZREM', KEYS[1], unpack(expired)); redis.call('HDEL', KEYS[5], unpack(expired)) end
redis.call('ZREMRANGEBYSCORE', KEYS[2], '-inf', now - 120000)
if redis.call('ZCARD', KEYS[1]) >= 1024 and not redis.call('ZSCORE', KEYS[1], ARGV[1]) then return {'deferred', '', tostring(now + 30000)} end
redis.call('ZADD', KEYS[1], 'NX', now, ARGV[1])
redis.call('HSET', KEYS[5], ARGV[1], ARGV[2])
redis.call('PEXPIRE', KEYS[5], 180000)
redis.call('ZADD', KEYS[2], now, ARGV[1])
redis.call('PEXPIRE', KEYS[1], 180000)
redis.call('PEXPIRE', KEYS[2], 180000)
local wait = redis.call('PTTL', KEYS[3])
local first = redis.call('ZRANGE', KEYS[1], 0, 0)[1]
if wait > 0 then return {'deferred', '', tostring(now + math.max(wait, 1000))} end
redis.call('SET', KEYS[3], 'busy', 'PX', 30000)
local payload = redis.call('HGET', KEYS[5], first)
redis.call('ZREM', KEYS[1], first)
redis.call('ZREM', KEYS[2], first)
redis.call('HDEL', KEYS[5], first)
return {'claimed', payload, tostring(now), first}
`
// Backoff can extend an existing reservation, including one installed by another worker, but never shorten it.
export const BRIDGE_GATEWAY_BACKOFF = `
local clock = redis.call('TIME')
local now = tonumber(clock[1]) * 1000 + math.floor(tonumber(clock[2]) / 1000)
local wait = math.max(10000, redis.call('PTTL', KEYS[1]), tonumber(ARGV[1]), tonumber(ARGV[2]) - now)
redis.call('SET', KEYS[1], 'backoff', 'PX', wait)
return {tostring(now + wait), tostring(wait)}
`

function retryAfter(response: Response): [string, string] {
  const header = response.headers.get('Retry-After') ?? ''
  const milliseconds = /^\d+$/.test(header) ? Number(header) * 1000 : undefined
  if (milliseconds !== undefined && Number.isSafeInteger(milliseconds)) return [String(milliseconds), '0']
  const deadline = milliseconds === undefined ? Date.parse(header) : NaN
  return Number.isFinite(deadline) ? ['0', String(deadline)] : ['30000', '0']
}

const retryHeaders = (status: number, nextCheckAt: number, now: number) =>
  status === 429 ? { 'Retry-After': String(Math.max(1, Math.ceil((nextCheckAt - now) / 1000))) } : undefined

export type TBridgeGatewayStore = Pick<Redis, 'eval' | 'set'>
export async function runBridgeGateway(
  store: TBridgeGatewayStore,
  namespace: string,
  identity: string,
  request: (signal: AbortSignal, identity: string) => Promise<Response>
): Promise<Response> {
  const signal = AbortSignal.timeout(9_000)
  const key = createHash('sha256').update(identity).digest('hex')
  const prefix = `yearn:enso-bridge:{${namespace}}`
  const cacheKey = `${prefix}:cache:${key}`
  const claim = await store.eval<[string, string], [string, string, string, string?]>(
    BRIDGE_GATEWAY_CLAIM,
    [`${prefix}:queue`, `${prefix}:seen`, `${prefix}:budget`, cacheKey, `${prefix}:payloads`],
    [key, identity]
  )
  if (claim[0] === 'cached') {
    const saved = JSON.parse(claim[1]) as { body: Record<string, unknown>; status: number }
    return Response.json(saved.body, {
      status: saved.status,
      headers: retryHeaders(saved.status, Number(saved.body.nextCheckAt), Number(claim[2]))
    })
  }
  if (claim[0] !== 'claimed')
    return Response.json(
      { error: 'Bridge status check queued. Tracking will retry.', nextCheckAt: Number(claim[2]) },
      { status: 429, headers: { 'Retry-After': '10' } }
    )
  const observedAt = Number(claim[2])
  signal.throwIfAborted()
  const workKey = claim[3] ?? key
  const response = await request(signal, claim[1] || identity)
  const [nextCheckAt, wait] =
    response.status === 429
      ? (
          await store.eval<[string, string], [string, string]>(
            BRIDGE_GATEWAY_BACKOFF,
            [`${prefix}:budget`],
            retryAfter(response)
          )
        ).map(Number)
      : [observedAt + 30_000, 30_000]
  const headers = { 'Retry-After': String(Math.ceil(wait / 1000)) }
  const body = { ...(await response.json()), observedAt, nextCheckAt }
  // Retain failed observations briefly as well: concurrent tabs must not amplify outages.
  await store.set(`${prefix}:cache:${workKey}`, JSON.stringify({ body, status: response.status }), { px: 10_000 })
  if (workKey !== key)
    return Response.json(
      { error: 'Bridge status check queued. Tracking will retry.', nextCheckAt },
      { status: 429, headers }
    )
  return Response.json(body, { status: response.status, headers: response.status === 429 ? headers : undefined })
}

export async function bridgeGateway(
  identity: string,
  request: (signal: AbortSignal, identity: string) => Promise<Response>
): Promise<Response> {
  const url = process.env.UPSTASH_REDIS_REST_URL_BRIDGE_COORDINATION
  const token = process.env.UPSTASH_REDIS_REST_TOKEN_BRIDGE_COORDINATION
  if (!url || !token)
    return Response.json({ error: 'Shared bridge tracking is unavailable. Tracking will retry.' }, { status: 503 })
  const namespace = createHash('sha256')
    .update(process.env.ENSO_API_KEY ?? 'unauthenticated')
    .digest('hex')
    .slice(0, 24)
  try {
    return await runBridgeGateway(
      new Redis({ url, token, automaticDeserialization: false }),
      namespace,
      identity,
      request
    )
  } catch {
    return Response.json({ error: 'Bridge tracking is temporarily unavailable. Tracking will retry.' }, { status: 503 })
  }
}
