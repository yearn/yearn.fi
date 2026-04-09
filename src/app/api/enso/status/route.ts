import type { NextRequest } from 'next/server'
import { getEnsoStatusResult } from '@/lib/api/enso'
import { jsonResponse, optionsResponse } from '@/lib/api/http'

export const dynamic = 'force-dynamic'

export function OPTIONS() {
  return optionsResponse()
}

export async function GET(_request: NextRequest) {
  const result = getEnsoStatusResult()
  return jsonResponse(result.body, { status: result.status })
}
