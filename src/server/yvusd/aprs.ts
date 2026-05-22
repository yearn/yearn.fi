import { GET_CORS_HEADERS, json, noContent } from '../http'

const YVUSD_APR_SERVICE_API = (
  process.env.YVUSD_APR_SERVICE_API || 'https://yearn-yvusd-apr-service.vercel.app/api/aprs'
).replace(/\/$/, '')

export function OPTIONS(): Response {
  return noContent(GET_CORS_HEADERS)
}

export async function GET(request: Request): Promise<Response> {
  try {
    const upstreamUrl = new URL(YVUSD_APR_SERVICE_API)
    new URL(request.url).searchParams.forEach((value, key) => {
      upstreamUrl.searchParams.set(key, value)
    })

    const response = await fetch(upstreamUrl.toString(), {
      headers: {
        Accept: 'application/json'
      }
    })

    if (!response.ok) {
      const details = await response.text()
      return json(
        {
          error: 'yvUSD APR upstream error',
          status: response.status,
          details
        },
        { status: response.status, headers: GET_CORS_HEADERS }
      )
    }

    const data = await response.json()
    return json(data, {
      headers: {
        ...GET_CORS_HEADERS,
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=120'
      }
    })
  } catch (error) {
    console.error('Error proxying yvUSD APR request:', error)
    return json({ error: 'Internal server error' }, { status: 500, headers: GET_CORS_HEADERS })
  }
}

export default GET
