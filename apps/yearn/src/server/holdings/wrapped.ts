import { parseWrapped } from '@yearn/wrapped-contract'
import { GET_CORS_HEADERS, json, noContent, queryString, WALLET_SCOPED_CACHE_CONTROL } from '@/server/http'

const headers = { ...GET_CORS_HEADERS, 'Cache-Control': WALLET_SCOPED_CACHE_CONTROL }
export const OPTIONS = (): Response => noContent(GET_CORS_HEADERS)

export async function GET(request: Request): Promise<Response> {
  const address = queryString(request, 'address')
  const year = queryString(request, 'year') ?? '2026'
  if (new URL(request.url).searchParams.getAll('year').length > 1)
    return Response.json({ error: 'Provide one recap year.' }, { status: 400, headers })
  if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address))
    return json({ error: 'Enter a valid wallet address.' }, { status: 400, headers })
  if (year !== '2026') return json({ error: 'Only the 2026 recap is supported.' }, { status: 400, headers })
  if (!process.env.ENVIO_GRAPHQL_URL)
    return json({ error: 'Holdings data is not configured.' }, { status: 503, headers })
  try {
    const { getWrapped } = await import('@/server/lib/holdings/services/wrapped')
    const payload = parseWrapped(await getWrapped(address))
    if (!payload.firstActivity && payload.vaults.length === 0)
      return json({ error: 'No indexed Yearn history found.' }, { status: 404, headers })
    return json(payload, { headers })
  } catch {
    return json({ error: 'Yearn history is temporarily unavailable. Please try again.' }, { status: 502, headers })
  }
}
