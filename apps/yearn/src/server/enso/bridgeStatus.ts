import { isEnsoBridgeProtocol, isEnsoBridgeStatus, type TEnsoBridgeStatus } from '@shared/types/ensoBridge'
import { isHash } from 'viem'
import { GET_CORS_HEADERS, json, noContent, queryString, WALLET_SCOPED_CACHE_CONTROL } from '@/server/http'

const ENSO_API_BASE = 'https://api.enso.finance'
const RELAY_API_BASE = 'https://api.relay.link'
const RESPONSE_HEADERS = { ...GET_CORS_HEADERS, 'Cache-Control': WALLET_SCOPED_CACHE_CONTROL }
const LOG_PREFIX = '[BridgeStatus]'

type BridgeStatusResponse = {
  status: TEnsoBridgeStatus
  bridgeRequestId?: `0x${string}`
  sourceChainId?: number
  sourceTxHash?: `0x${string}`
  destinationChainId?: number
  destinationTxHash?: `0x${string}`
  error?: string
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : undefined
}

function logBridgeStatus(event: string, details: Record<string, unknown>): void {
  if (process.env.NODE_ENV === 'test') return
  console.info(`${LOG_PREFIX} ${event}`, details)
}

function getRelayRequestId(data: unknown): `0x${string}` | undefined {
  const requests = asRecord(data)?.requests
  if (!Array.isArray(requests)) return undefined

  return requests
    .map((request) => asRecord(request)?.id)
    .find((requestId): requestId is `0x${string}` => typeof requestId === 'string' && isHash(requestId))
}

export function normalizeRelayBridgeStatusResponse(
  data: unknown,
  sourceChainId: number,
  sourceTxHash: `0x${string}` | undefined,
  bridgeRequestId: `0x${string}`
): BridgeStatusResponse | undefined {
  const response = asRecord(data)
  if (!response) return undefined
  const relayStatus = typeof response.status === 'string' ? response.status.toLowerCase() : ''
  const status: BridgeStatusResponse['status'] =
    relayStatus === 'success'
      ? 'delivered'
      : ['failure', 'failed', 'refund', 'refunded'].includes(relayStatus)
        ? 'failed'
        : relayStatus === 'waiting'
          ? 'pending'
          : ['depositing', 'pending', 'submitted', 'inflight', 'delayed'].includes(relayStatus)
            ? 'inflight'
            : 'unknown'

  const destinationTxHash = Array.isArray(response.txHashes)
    ? response.txHashes.findLast((hash): hash is `0x${string}` => typeof hash === 'string' && isHash(hash))
    : undefined
  const resolvedSourceTxHash =
    sourceTxHash ??
    (Array.isArray(response.inTxHashes)
      ? response.inTxHashes.findLast((hash): hash is `0x${string}` => typeof hash === 'string' && isHash(hash))
      : undefined)
  const destinationChainId = typeof response.destinationChainId === 'number' ? response.destinationChainId : undefined
  const failReason = typeof response.failReason === 'string' ? response.failReason : undefined

  return {
    status,
    bridgeRequestId,
    sourceChainId,
    ...(resolvedSourceTxHash ? { sourceTxHash: resolvedSourceTxHash } : {}),
    ...(destinationChainId !== undefined ? { destinationChainId } : {}),
    ...(destinationTxHash ? { destinationTxHash } : {}),
    ...(status === 'failed'
      ? { error: failReason && failReason !== 'N/A' ? failReason : 'Relay transfer failed.' }
      : {})
  }
}

async function fetchRelayBridgeStatusByRequestId(
  sourceChainId: number,
  bridgeRequestId: `0x${string}`,
  sourceTxHash?: `0x${string}`
): Promise<BridgeStatusResponse | undefined> {
  const statusParams = new URLSearchParams({ requestId: bridgeRequestId })
  logBridgeStatus('relay-status-start', { sourceChainId, sourceTxHash, bridgeRequestId })
  const response = await fetch(`${RELAY_API_BASE}/intents/status/v3?${statusParams}`, {
    cache: 'no-store'
  })
  if (!response.ok) {
    logBridgeStatus('relay-status-upstream-error', {
      sourceChainId,
      sourceTxHash,
      bridgeRequestId,
      httpStatus: response.status
    })
    return undefined
  }
  const data = await response.json()
  const result = normalizeRelayBridgeStatusResponse(data, sourceChainId, sourceTxHash, bridgeRequestId)
  logBridgeStatus('relay-status-result', {
    sourceChainId,
    sourceTxHash,
    bridgeRequestId,
    httpStatus: response.status,
    upstreamStatus: asRecord(data)?.status,
    normalizedStatus: result?.status,
    destinationChainId: result?.destinationChainId,
    destinationTxHash: result?.destinationTxHash
  })
  return result
}

async function fetchRelayRequestIdBySourceTxHash(
  sourceChainId: number,
  sourceTxHash: `0x${string}`,
  apiKey: string
): Promise<`0x${string}` | undefined> {
  const requestParams = new URLSearchParams({
    depositTxHash: sourceTxHash,
    originChainId: String(sourceChainId),
    limit: '1'
  })
  logBridgeStatus('relay-request-lookup-start', { sourceChainId, sourceTxHash })
  const response = await fetch(`${RELAY_API_BASE}/requests/v3?${requestParams}`, {
    headers: { 'x-api-key': apiKey },
    cache: 'no-store'
  })
  if (!response.ok) {
    logBridgeStatus('relay-request-lookup-upstream-error', {
      sourceChainId,
      sourceTxHash,
      httpStatus: response.status
    })
    return undefined
  }
  const data = await response.json()
  const requests = asRecord(data)?.requests
  const bridgeRequestId = getRelayRequestId(data)
  logBridgeStatus('relay-request-lookup-result', {
    sourceChainId,
    sourceTxHash,
    httpStatus: response.status,
    requestCount: Array.isArray(requests) ? requests.length : undefined,
    bridgeRequestId
  })
  return bridgeRequestId
}

export function OPTIONS(): Response {
  return noContent(GET_CORS_HEADERS)
}

export async function GET(request: Request): Promise<Response> {
  const protocol = queryString(request, 'protocol')?.toLowerCase()
  const chainId = Number(queryString(request, 'chainId'))
  const txHash = queryString(request, 'txHash')
  const requestId = queryString(request, 'requestId')
  const persistedRelayRequestId = requestId && isHash(requestId) ? requestId : undefined

  if (!isEnsoBridgeProtocol(protocol)) {
    return json({ error: 'Unsupported bridge protocol' }, { status: 400, headers: RESPONSE_HEADERS })
  }
  if (!Number.isInteger(chainId) || chainId <= 0) {
    return json({ error: 'Missing or invalid chainId' }, { status: 400, headers: RESPONSE_HEADERS })
  }
  const sourceTxHash = txHash && isHash(txHash) ? txHash : undefined
  if (txHash && !sourceTxHash) {
    return json({ error: 'Missing or invalid txHash' }, { status: 400, headers: RESPONSE_HEADERS })
  }
  if (requestId && !persistedRelayRequestId) {
    return json({ error: 'Invalid requestId' }, { status: 400, headers: RESPONSE_HEADERS })
  }
  if (!sourceTxHash && !(protocol === 'relay' && persistedRelayRequestId)) {
    return json({ error: 'Missing or invalid txHash' }, { status: 400, headers: RESPONSE_HEADERS })
  }

  try {
    const relayApiKey = process.env.RELAY_API_KEY?.trim()
    logBridgeStatus('request', {
      protocol,
      chainId,
      sourceTxHash,
      persistedRelayRequestId,
      relayApiConfigured: Boolean(relayApiKey),
      ensoApiConfigured: Boolean(process.env.ENSO_API_KEY)
    })
    const relayRequestId =
      protocol === 'relay' && !persistedRelayRequestId && sourceTxHash && relayApiKey
        ? await fetchRelayRequestIdBySourceTxHash(chainId, sourceTxHash, relayApiKey).catch((error) => {
            console.warn(`${LOG_PREFIX} relay-request-lookup-failed`, {
              chainId,
              sourceTxHash,
              error: (error as Error)?.message || error
            })
            return undefined
          })
        : persistedRelayRequestId

    if (protocol === 'relay' && relayRequestId) {
      try {
        const relayStatus = await fetchRelayBridgeStatusByRequestId(chainId, relayRequestId, sourceTxHash)
        if (relayStatus && (relayStatus.status !== 'unknown' || !sourceTxHash)) {
          logBridgeStatus('response', {
            source: 'relay',
            protocol,
            chainId,
            sourceTxHash,
            bridgeRequestId: relayRequestId,
            status: relayStatus.status
          })
          return json(relayStatus, { headers: RESPONSE_HEADERS })
        }
      } catch (error) {
        console.warn(`${LOG_PREFIX} relay-status-failed`, {
          chainId,
          sourceTxHash,
          bridgeRequestId: relayRequestId,
          error: (error as Error)?.message || error
        })
      }
    }
    if (!sourceTxHash) {
      return json({ error: 'Unable to resolve Relay bridge status' }, { status: 502, headers: RESPONSE_HEADERS })
    }
    if (protocol === 'relay') {
      logBridgeStatus('fallback-to-enso', {
        chainId,
        sourceTxHash,
        bridgeRequestId: relayRequestId,
        reason: relayRequestId ? 'relay-status-unavailable' : 'relay-request-id-unavailable'
      })
    }
    const apiKey = process.env.ENSO_API_KEY
    if (!apiKey) return json({ error: 'Enso API not configured' }, { status: 500, headers: RESPONSE_HEADERS })
    const params = new URLSearchParams({ chainId: String(chainId), txHash: sourceTxHash })
    logBridgeStatus('enso-status-start', { protocol, chainId, sourceTxHash })
    const response = await fetch(`${ENSO_API_BASE}/api/v1/${protocol}/bridge/check?${params}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: 'force-cache',
      next: { revalidate: 10 }
    })
    const data = (await response.json()) as Record<string, unknown>
    logBridgeStatus('enso-status-result', {
      protocol,
      chainId,
      sourceTxHash,
      httpStatus: response.status,
      upstreamStatus: data.status
    })
    if (!response.ok) return json(data, { status: response.status, headers: RESPONSE_HEADERS })
    if (!isEnsoBridgeStatus(data.status)) {
      return json({ error: 'Invalid Enso bridge status response' }, { status: 502, headers: RESPONSE_HEADERS })
    }

    if (protocol === 'relay') {
      const ensoStatus = {
        ...data,
        ...(relayRequestId ? { bridgeRequestId: relayRequestId } : {})
      }
      logBridgeStatus('response', {
        source: 'enso',
        protocol,
        chainId,
        sourceTxHash,
        bridgeRequestId: relayRequestId,
        status: data.status
      })
      return json(ensoStatus, { headers: RESPONSE_HEADERS })
    }
    logBridgeStatus('response', { source: 'enso', protocol, chainId, sourceTxHash, status: data.status })
    return json(data, { headers: RESPONSE_HEADERS })
  } catch (error) {
    console.error(`${LOG_PREFIX} request-failed`, {
      protocol,
      chainId,
      sourceTxHash,
      persistedRelayRequestId,
      error: (error as Error)?.message || error
    })
    return json({ error: 'Unable to check bridge status' }, { status: 502, headers: RESPONSE_HEADERS })
  }
}

export default GET
