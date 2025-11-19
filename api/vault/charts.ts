import type { VercelRequest, VercelResponse } from '@vercel/node'

const GRAPHQL_ENDPOINT = process.env.KONG_GRAPHQL_URL ?? 'https://kong.yearn.farm/api/gql'
const DEFAULT_LIMIT = 1000
const MAX_LIMIT = 2000

const VAULT_CHARTS_QUERY = `
  query VaultCharts($chainId: Int!, $address: String!, $limit: Int) {
    apyWeekly: timeseries(
      chainId: $chainId
      address: $address
      label: "apy-bwd-delta-pps"
      component: "weeklyNet"
      limit: $limit
    ) {
      chainId
      address
      label
      component
      period
      time
      value
    }
    apyMonthly: timeseries(
      chainId: $chainId
      address: $address
      label: "apy-bwd-delta-pps"
      component: "monthlyNet"
      limit: $limit
    ) {
      chainId
      address
      label
      component
      period
      time
      value
    }
    tvl: timeseries(
      chainId: $chainId
      address: $address
      label: "tvl"
      limit: $limit
    ) {
      chainId
      address
      label
      period
      time
      value
    }
    pps: timeseries(
      address: $address
      label: "pps"
      component: "humanized"
      limit: $limit
    ) {
      chainId
      address
      label
      component
      period
      time
      value
    }
  }
`

export default async function handler(request: VercelRequest, response: VercelResponse) {
  response.setHeader('Access-Control-Allow-Origin', '*')
  response.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS')
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (request.method === 'OPTIONS') {
    return response.status(204).end()
  }

  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET')
    return response.status(405).json({ error: 'Method not allowed' })
  }

  const { chainId, address, limit } = request.query

  if (!chainId || !address || typeof chainId !== 'string' || typeof address !== 'string') {
    return response.status(400).json({ error: 'Missing or invalid chainId or address' })
  }

  const numericChainId = Number(chainId)
  if (!Number.isInteger(numericChainId)) {
    return response.status(400).json({ error: 'chainId must be an integer' })
  }

  const sanitizedAddress = address.toLowerCase()
  const parsedLimit = Array.isArray(limit) ? Number(limit[0]) : Number(limit ?? DEFAULT_LIMIT)
  const limitValue = Math.min(Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : DEFAULT_LIMIT, MAX_LIMIT)

  if (!GRAPHQL_ENDPOINT) {
    return response.status(500).json({ error: 'Missing GraphQL endpoint' })
  }

  try {
    const gqlResponse = await fetch(GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query: VAULT_CHARTS_QUERY,
        variables: {
          chainId: numericChainId,
          address: sanitizedAddress,
          limit: limitValue
        }
      })
    })

    const payload = await gqlResponse.json()

    if (!gqlResponse.ok || payload.errors) {
      const message = payload?.errors?.[0]?.message || 'Failed to fetch chart data'
      console.error('[api/vault/charts] GraphQL error:', message)
      return response.status(502).json({ error: message })
    }

    response.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=3600')
    return response.status(200).json(payload.data)
  } catch (error) {
    console.error('[api/vault/charts] Unexpected error:', error)
    return response.status(500).json({ error: 'Unable to fetch vault chart data' })
  }
}
