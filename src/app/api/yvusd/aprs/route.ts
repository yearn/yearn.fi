import type { NextRequest } from 'next/server'
import { jsonResponse, optionsResponse } from '@/lib/api/http'
import { getYvUsdAprsResult } from '@/lib/api/yvusd'

export const dynamic = 'force-dynamic'

export function OPTIONS() {
  return optionsResponse()
}

export async function GET(request: NextRequest) {
  const result = await getYvUsdAprsResult(new URLSearchParams(request.nextUrl.searchParams))
  return jsonResponse(result.body, {
    status: result.status,
    headers: result.headers
  })
}
