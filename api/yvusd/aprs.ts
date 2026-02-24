import type { VercelRequest, VercelResponse } from '@vercel/node'

const YVUSD_APR_SERVICE_API = (
  process.env.YVUSD_APR_SERVICE_API || 'https://yearn-yvusd-apr-service.vercel.app/api/aprs'
).replace(/\/$/, '')

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const upstreamUrl = new URL(YVUSD_APR_SERVICE_API)
    Object.entries(req.query).forEach(([key, value]) => {
      if (typeof value === 'string') {
        upstreamUrl.searchParams.set(key, value)
      }
    })

    const response = await fetch(upstreamUrl.toString(), {
      headers: {
        Accept: 'application/json'
      }
    })

    if (!response.ok) {
      const details = await response.text()
      return res.status(response.status).json({
        error: 'yvUSD APR upstream error',
        status: response.status,
        details
      })
    }

    const data = await response.json()
    res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=120')
    return res.status(200).json(data)
  } catch (error) {
    console.error('Error proxying yvUSD APR request:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
