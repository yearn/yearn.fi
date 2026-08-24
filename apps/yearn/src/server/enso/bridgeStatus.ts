import { isEnsoBridgeProtocol, isEnsoBridgeStatus } from '@shared/types/ensoBridge'
import { isHash } from 'viem'
import { GET_CORS_HEADERS, json, noContent, queryString, WALLET_SCOPED_CACHE_CONTROL } from '@/server/http'

const ENSO_API_BASE = 'https://api.enso.finance'
const RESPONSE_HEADERS = { ...GET_CORS_HEADERS, 'Cache-Control': WALLET_SCOPED_CACHE_CONTROL }

export function OPTIONS(): Response {
  return noContent(GET_CORS_HEADERS)
}

export async function GET(request: Request): Promise<Response> {
  const protocol = queryString(request, 'protocol')?.toLowerCase()
  const chainId = Number(queryString(request, 'chainId'))
  const txHash = queryString(request, 'txHash')

  if (!isEnsoBridgeProtocol(protocol)) {
    return json({ error: 'Unsupported bridge protocol' }, { status: 400, headers: RESPONSE_HEADERS })
  }
  if (!Number.isInteger(chainId) || chainId <= 0) {
    return json({ error: 'Missing or invalid chainId' }, { status: 400, headers: RESPONSE_HEADERS })
  }
  if (!txHash || !isHash(txHash)) {
    return json({ error: 'Missing or invalid txHash' }, { status: 400, headers: RESPONSE_HEADERS })
  }

  const apiKey = process.env.ENSO_API_KEY
  if (!apiKey) return json({ error: 'Enso API not configured' }, { status: 500, headers: RESPONSE_HEADERS })

  try {
    const params = new URLSearchParams({ chainId: String(chainId), txHash })
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
