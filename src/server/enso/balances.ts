import { GET_CORS_HEADERS, json, noContent, queryString } from '../http'
import { ENSO_BALANCES_CACHE_CONTROL } from './cache'

const ENSO_API_BASE = 'https://api.enso.finance'

export function OPTIONS(): Response {
  return noContent(GET_CORS_HEADERS)
}

export async function GET(request: Request): Promise<Response> {
  const eoaAddress = queryString(request, 'eoaAddress')

  if (!eoaAddress) {
    return json({ error: 'Missing or invalid eoaAddress' }, { status: 400, headers: GET_CORS_HEADERS })
  }

  const apiKey = process.env.ENSO_API_KEY
  if (!apiKey) {
    console.error('ENSO_API_KEY not configured')
    return json({ error: 'Enso API not configured' }, { status: 500, headers: GET_CORS_HEADERS })
  }

  try {
    const params = new URLSearchParams({
      eoaAddress,
      useEoa: 'true',
      chainId: 'all'
    })

    const url = `${ENSO_API_BASE}/api/v1/wallet/balances?${params}`

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`
      }
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`Enso API error: ${response.status}`, errorText)
      return json(
        {
          error: 'Enso API error',
          status: response.status,
          details: errorText
        },
        { status: response.status, headers: GET_CORS_HEADERS }
      )
    }

    const data = await response.json()

    return json(data, {
      headers: {
        ...GET_CORS_HEADERS,
        'Cache-Control': ENSO_BALANCES_CACHE_CONTROL
      }
    })
  } catch (error) {
    console.error('Error proxying Enso request:', error)
    return json({ error: 'Internal server error' }, { status: 500, headers: GET_CORS_HEADERS })
  }
}

export default GET
