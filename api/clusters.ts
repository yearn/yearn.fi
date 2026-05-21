const DEFAULT_CLUSTERS_API_URL = 'https://api.clusters.xyz/v1'

const resolveClustersApiBaseUrl = (): string =>
  (process.env.CLUSTERS_API_URL?.trim() || DEFAULT_CLUSTERS_API_URL).replace(/\/$/, '')

const isValidAddress = (address: string): boolean => /^0x[a-fA-F0-9]{40}$/.test(address)

export async function handleClustersName(req: Request): Promise<Response> {
  if (req.method !== 'GET') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 })
  }

  const requestUrl = new URL(req.url)
  const address = requestUrl.searchParams.get('address')?.trim()

  if (!address || !isValidAddress(address)) {
    return Response.json({ error: 'Invalid address' }, { status: 400 })
  }

  const apiKey = process.env.CLUSTERS_API_KEY?.trim()
  if (!apiKey) {
    return Response.json({ error: 'Clusters API not configured' }, { status: 500 })
  }

  try {
    const upstreamUrl = `${resolveClustersApiBaseUrl()}/names/address/${encodeURIComponent(address.toLowerCase())}`
    const response = await fetch(upstreamUrl, {
      headers: {
        Accept: 'application/json',
        'X-API-KEY': apiKey
      }
    })

    if (!response.ok) {
      if (response.status === 404) {
        return Response.json(null, { status: 404 })
      }
      return Response.json({ error: 'Clusters upstream error' }, { status: response.status })
    }

    const data = await response.json()
    return Response.json(data, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600'
      }
    })
  } catch (error) {
    console.error('Error proxying Clusters request:', error instanceof Error ? error.message : String(error))
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
