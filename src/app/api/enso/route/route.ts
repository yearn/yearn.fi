import type { NextRequest } from 'next/server'
import { getEnsoRouteResult } from '@/lib/api/enso'
import { jsonResponse, optionsResponse } from '@/lib/api/http'

export const dynamic = 'force-dynamic'

export function OPTIONS() {
  return optionsResponse()
}

export async function GET(request: NextRequest) {
  const result = await getEnsoRouteResult(new URLSearchParams(request.nextUrl.searchParams))
  return jsonResponse(result.body, { status: result.status })
}
