import { GET_CORS_HEADERS, json, noContent, queryString } from '../http'
import { getHoldingsProgress } from '../lib/holdings/services/progress'

export function OPTIONS(): Response {
  return noContent(GET_CORS_HEADERS)
}

export async function GET(request: Request): Promise<Response> {
  const progress = await getHoldingsProgress(queryString(request, 'id') ?? null)

  if (!progress) {
    return json({ error: 'Progress not found' }, { status: 404, headers: GET_CORS_HEADERS })
  }

  return json(progress, {
    headers: {
      ...GET_CORS_HEADERS,
      'Cache-Control': 'no-store'
    }
  })
}

export default GET
