import type { NextRequest } from 'next/server'
import { getEnsoBalancesResult } from '@/lib/api/enso'
import { jsonResponse, optionsResponse } from '@/lib/api/http'

export const dynamic = 'force-dynamic'

export function OPTIONS() {
  return optionsResponse()
}

export async function GET(request: NextRequest) {
  const result = await getEnsoBalancesResult(new URLSearchParams(request.nextUrl.searchParams))
  return jsonResponse(result.body, {
    status: result.status,
    headers: result.headers
  })
}
