import { fetchRecap, RecapError } from '@wrapped/server/recap'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
const headers = { 'Cache-Control': 'private, no-store, max-age=0, must-revalidate' }

export async function GET(request: Request): Promise<Response> {
  const params = new URL(request.url).searchParams
  const address = params.get('address')
  if (new URL(request.url).searchParams.getAll('year').length > 1)
    return Response.json({ error: 'Provide one recap year.' }, { status: 400, headers })
  if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address) || params.getAll('address').length !== 1)
    return Response.json({ error: 'Enter a valid wallet address.' }, { status: 400, headers })
  if ((params.get('year') ?? '2026') !== '2026')
    return Response.json({ error: 'Only the 2026 recap is supported.' }, { status: 400, headers })
  try {
    return Response.json(await fetchRecap(address, request.signal), { headers })
  } catch (error) {
    const status = error instanceof RecapError ? error.status : 502
    return Response.json(
      { error: error instanceof RecapError ? error.message : 'The recap could not be loaded. Please try again.' },
      {
        status,
        headers: { ...headers, ...([429, 503].includes(status) ? { 'Retry-After': '5' } : {}) }
      }
    )
  }
}
