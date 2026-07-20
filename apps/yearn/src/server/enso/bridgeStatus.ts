import { isEnsoBridgeProtocol, isEnsoBridgeStatus, type TEnsoBridgeStatus } from '@shared/types/ensoBridge'
import { isHash } from 'viem'
import { GET_CORS_HEADERS, json, noContent, queryString, WALLET_SCOPED_CACHE_CONTROL } from '@/server/http'

const ENSO_API_BASE = 'https://api.enso.finance'
const RELAY_API_BASE = 'https://api.relay.link'
const RESPONSE_HEADERS = { ...GET_CORS_HEADERS, 'Cache-Control': WALLET_SCOPED_CACHE_CONTROL }

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
  const response = await fetch(`${RELAY_API_BASE}/intents/status/v3?${statusParams}`, {
    cache: 'no-store'
  })
  if (!response.ok) return undefined
  return normalizeRelayBridgeStatusResponse(await response.json(), sourceChainId, sourceTxHash, bridgeRequestId)
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
  const response = await fetch(`${RELAY_API_BASE}/requests/v3?${requestParams}`, {
    headers: { 'x-api-key': apiKey },
    cache: 'no-store'
  })
  if (!response.ok) return undefined
  return getRelayRequestId(await response.json())
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
    const relayRequestId =
      protocol === 'relay' && !persistedRelayRequestId && sourceTxHash && relayApiKey
        ? await fetchRelayRequestIdBySourceTxHash(chainId, sourceTxHash, relayApiKey).catch((error) => {
            console.warn('Unable to resolve Relay request ID from the source transaction:', error)
            return undefined
          })
        : persistedRelayRequestId

    if (protocol === 'relay' && relayRequestId) {
      try {
        const relayStatus = await fetchRelayBridgeStatusByRequestId(chainId, relayRequestId, sourceTxHash)
        if (relayStatus && (relayStatus.status !== 'unknown' || !sourceTxHash)) {
          return json(relayStatus, { headers: RESPONSE_HEADERS })
        }
      } catch (error) {
        console.warn('Unable to resolve bridge status through a Relay request ID:', error)
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

    if (protocol === 'relay') {
      const ensoStatus = {
        ...data,
        ...(relayRequestId ? { bridgeRequestId: relayRequestId } : {})
      }
      return json(ensoStatus, { headers: RESPONSE_HEADERS })
    }
    return json(data, { headers: RESPONSE_HEADERS })
  } catch (error) {
    console.error('Error proxying Enso bridge status request:', error)
    return json({ error: 'Unable to check bridge status' }, { status: 502, headers: RESPONSE_HEADERS })
  }
}

export default GET
