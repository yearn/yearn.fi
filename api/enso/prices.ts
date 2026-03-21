export const config = { runtime: 'edge' }

const ENSO_API_BASE = 'https://api.enso.finance'
const KONG_REST_BASE = 'https://kong.yearn.fi/api/rest'
const CONCURRENCY = 5
const DELAY_MS = 200
const ENSO_CHAINS = [1, 8453, 747474, 10, 137, 42161, 100, 146, 80094]

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function fetchEnsoPrice(
  chainId: number,
  address: string,
  apiKey: string,
  retries = 2
): Promise<{ address: string; price: number } | null> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(`${ENSO_API_BASE}/api/v1/prices/${chainId}/${address}`, {
        headers: { Authorization: `Bearer ${apiKey}` }
      })
      if (res.status === 429) {
        await sleep(1000 * (attempt + 1))
        continue
      }
      if (!res.ok) return null
      const data = await res.json()
      return { address, price: data.price }
    } catch {
      if (attempt < retries) {
        await sleep(500 * (attempt + 1))
        continue
      }
      return null
    }
  }
  return null
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  const apiKey = process.env.ENSO_API_KEY
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'Enso API not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  try {
    const vaults: { chainId: number; address: string; asset?: { address?: string } }[] = await fetch(
      `${KONG_REST_BASE}/list/vaults`
    ).then((r) => r.json())

    const addressesByChain = new Map<number, Set<string>>()
    for (const v of vaults) {
      if (!ENSO_CHAINS.includes(v.chainId)) continue
      if (!addressesByChain.has(v.chainId)) addressesByChain.set(v.chainId, new Set())
      const set = addressesByChain.get(v.chainId)!
      if (v.address) set.add(v.address.toLowerCase())
      if (v.asset?.address) set.add(v.asset.address.toLowerCase())
    }

    const result: Record<string, Record<string, string>> = {}

    for (const [chainId, addresses] of addressesByChain) {
      const chainKey = String(chainId)
      result[chainKey] = {}
      const addressList = [...addresses]

      for (let i = 0; i < addressList.length; i += CONCURRENCY) {
        const batch = addressList.slice(i, i + CONCURRENCY)
        const results = await Promise.all(batch.map((a) => fetchEnsoPrice(chainId, a, apiKey)))
        for (const r of results) {
          if (r && r.price != null) {
            result[chainKey][r.address] = Math.round(r.price * 1e6).toString()
          }
        }
        await sleep(DELAY_MS)
      }
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=600'
      }
    })
  } catch (error) {
    console.error('Error fetching Enso prices:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}
