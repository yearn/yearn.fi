import { parseWrapped, type TWrapped } from '@yearn/wrapped-contract'

export class RecapError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message)
  }
}

export async function fetchRecap(address: string, signal?: AbortSignal): Promise<TWrapped> {
  const base = process.env.YEARN_HOLDINGS_URL ?? 'https://yearn.fi'
  const url = new URL('/api/holdings/wrapped', base)
  url.searchParams.set('address', address.toLowerCase())
  url.searchParams.set('year', '2026')
  const response = await fetch(url, {
    cache: 'no-store',
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(180_000)]) : AbortSignal.timeout(180_000)
  }).catch(() => {
    throw new RecapError('Yearn history is temporarily unavailable. Please try again.', 503)
  })
  if (!response.ok) {
    const status = [400, 404, 429, 503].includes(response.status) ? response.status : 502
    throw new RecapError(
      status === 404
        ? 'No indexed Yearn history found for this address.'
        : 'Yearn history is temporarily unavailable. Please try again.',
      status
    )
  }
  const payload = parseWrapped(await response.json())
  if (payload.address.toLowerCase() !== address.toLowerCase())
    throw new RecapError('The recap address did not match the request.', 502)
  return payload
}
