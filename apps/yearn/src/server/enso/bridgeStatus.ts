import { isEnsoBridgeProtocol, isEnsoBridgeStatus } from '@shared/types/ensoBridge'
import { isHash } from 'viem'
import { GET_CORS_HEADERS, json, noContent, queryString, WALLET_SCOPED_CACHE_CONTROL } from '@/server/http'

const ENSO_API_BASE = 'https://api.enso.finance'
const RELAY_API_BASE = 'https://api.relay.link'
const RESPONSE_HEADERS = { ...GET_CORS_HEADERS, 'Cache-Control': WALLET_SCOPED_CACHE_CONTROL }

type BridgeStatusResponse = {
  status: 'pending' | 'inflight' | 'delivered' | 'failed' | 'unknown'
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

function asRecords(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.map(asRecord).filter((entry) => entry !== undefined) : []
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

async function fetchRelayBridgeStatus(
  sourceChainId: number,
  sourceTxHash?: `0x${string}`,
  knownRequestId?: `0x${string}`
): Promise<BridgeStatusResponse | undefined> {
  let bridgeRequestId = knownRequestId
  if (!bridgeRequestId) {
    if (!sourceTxHash) return undefined
    const lookupParams = new URLSearchParams({ hash: sourceTxHash })
    const lookupResponse = await fetch(`${RELAY_API_BASE}/requests/v2?${lookupParams}`, {
      cache: 'force-cache',
      next: { revalidate: 10 }
    })
    if (!lookupResponse.ok) return undefined
    const relayRequest = asRecords(asRecord(await lookupResponse.json())?.requests)[0]
    if (typeof relayRequest?.id !== 'string' || !isHash(relayRequest.id)) return undefined
    bridgeRequestId = relayRequest.id
  }

  const statusParams = new URLSearchParams({ requestId: bridgeRequestId })
  const response = await fetch(`${RELAY_API_BASE}/intents/status/v3?${statusParams}`, {
    cache: 'force-cache',
    next: { revalidate: 10 }
  })
  if (!response.ok) return undefined
  return normalizeRelayBridgeStatusResponse(await response.json(), sourceChainId, sourceTxHash, bridgeRequestId)
}

export function OPTIONS(): Response {
  return noContent(GET_CORS_HEADERS)
}

export async function GET(request: Request): Promise<Response> {
  const protocol = queryString(request, 'protocol')?.toLowerCase()
  const chainId = Number(queryString(request, 'chainId'))
  const txHash = queryString(request, 'txHash')
  const requestId = queryString(request, 'requestId')
  const relayRequestId = requestId && isHash(requestId) ? requestId : undefined

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
  if (requestId && !relayRequestId) {
    return json({ error: 'Invalid requestId' }, { status: 400, headers: RESPONSE_HEADERS })
  }
  if (!sourceTxHash && !(protocol === 'relay' && relayRequestId)) {
    return json({ error: 'Missing or invalid txHash' }, { status: 400, headers: RESPONSE_HEADERS })
  }

  try {
    if (protocol === 'relay') {
      try {
        // Enso can keep returning a stale pending snapshot after Relay has
        // completed the fill. Resolve and persist Relay's request ID as soon
        // as the source transaction is indexed, then poll Relay directly.
        const relayStatus = await fetchRelayBridgeStatus(chainId, sourceTxHash, relayRequestId)
        if (relayStatus) return json(relayStatus, { headers: RESPONSE_HEADERS })
      } catch (error) {
        console.warn('Unable to resolve bridge status through Relay:', error)
      }
    }
    if (!sourceTxHash) {
      return json({ error: 'Unable to resolve Relay bridge status' }, { status: 502, headers: RESPONSE_HEADERS })
    }
    const apiKey = process.env.ENSO_API_KEY
    if (!apiKey) return json({ error: 'Enso API not configured' }, { status: 500, headers: RESPONSE_HEADERS })
    const params = new URLSearchParams({ chainId: String(chainId), txHash: sourceTxHash })
    const response = await fetch(`${ENSO_API_BASE}/api/v1/${protocol}/bridge/check?${params}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: 'force-cache',
      next: { revalidate: 10 }
    })
    const data = (await response.json()) as Record<string, unknown>
    if (!response.ok) return json(data, { status: response.status, headers: RESPONSE_HEADERS })
    if (!isEnsoBridgeStatus(data.status)) {
      return json({ error: 'Invalid Enso bridge status response' }, { status: 502, headers: RESPONSE_HEADERS })
    }
    return json(data, { headers: RESPONSE_HEADERS })
  } catch (error) {
    console.error('Error proxying Enso bridge status request:', error)
    return json({ error: 'Unable to check bridge status' }, { status: 502, headers: RESPONSE_HEADERS })
  }
}

export default GET
