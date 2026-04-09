const DEFAULT_YVUSD_APR_SERVICE_API = 'https://yearn-yvusd-apr-service.vercel.app/api/aprs'

const YVUSD_APR_SERVICE_API = (process.env.YVUSD_APR_SERVICE_API || DEFAULT_YVUSD_APR_SERVICE_API).replace(/\/$/, '')

export async function getYvUsdAprsResult(searchParams: URLSearchParams) {
  try {
    const upstreamUrl = new URL(YVUSD_APR_SERVICE_API)
    searchParams.forEach((value, key) => {
      upstreamUrl.searchParams.set(key, value)
    })

    const response = await fetch(upstreamUrl.toString(), {
      headers: {
        Accept: 'application/json'
      }
    })

    if (!response.ok) {
      const details = await response.text()
      return {
        status: response.status,
        body: {
          error: 'yvUSD APR upstream error',
          status: response.status,
          details
        }
      }
    }

    return {
      status: 200,
      body: await response.json(),
      headers: {
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=120'
      }
    }
  } catch (error) {
    console.error('Error proxying yvUSD APR request:', error)
    return {
      status: 500,
      body: { error: 'Internal server error' }
    }
  }
}
