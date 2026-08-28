import { NextResponse } from 'next/server'

const DEFAULT_GLOBAL_DATA_URL = 'https://data.dao-ops.com/prod/stats.json'

export async function GET(): Promise<NextResponse> {
  const upstreamUrl =
    process.env.NEXT_PUBLIC_GLOBAL_DATA_URL || process.env.VITE_GLOBAL_DATA_URL || DEFAULT_GLOBAL_DATA_URL
  if (!upstreamUrl) {
    return NextResponse.json({ error: 'NEXT_PUBLIC_GLOBAL_DATA_URL is not configured' }, { status: 404 })
  }

  try {
    const response = await fetch(upstreamUrl, { next: { revalidate: 60 } })
    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to fetch governance global data' }, { status: response.status })
    }

    const data = await response.json()
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'public, max-age=60, s-maxage=60, stale-while-revalidate=120'
      }
    })
  } catch {
    return NextResponse.json({ error: 'Failed to fetch governance global data' }, { status: 502 })
  }
}

export function OPTIONS(): Response {
  return new Response(null, { status: 204 })
}
