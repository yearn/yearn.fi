import { z } from 'zod'
import { json, noContent, POST_CORS_HEADERS, WALLET_SCOPED_CACHE_CONTROL } from '@/server/http'

const requestSchema = z.object({
  addresses: z.array(z.string().regex(/^0x(?!0{40}$)[0-9a-fA-F]{40}$/)).min(1),
  timeframe: z.enum(['1y', 'all']).default('1y'),
  vault: z
    .object({
      chainId: z.number().int().positive(),
      vaultAddress: z.string().regex(/^0x(?!0{40}$)[0-9a-fA-F]{40}$/),
      valueMode: z.enum(['underlying', 'usd']).default('underlying')
    })
    .optional()
})

const headers = { ...POST_CORS_HEADERS, 'Cache-Control': WALLET_SCOPED_CACHE_CONTROL }

export const OPTIONS = () => noContent(POST_CORS_HEADERS)

export async function POST(request: Request): Promise<Response> {
  const parsed = requestSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success)
    return json({ error: 'Provide wallet addresses and a valid history timeframe.' }, { status: 400, headers })
  if (!process.env.ENVIO_GRAPHQL_URL)
    return json({ error: 'Holdings data is not configured.' }, { status: 503, headers })
  const addresses = [...new Set(parsed.data.addresses.map((address) => address.toLowerCase()))].sort()

  try {
    const { getHoldingsBundleGrowth } = await import('@/server/lib/holdings/services/pnlSimple')
    const { timeframe, vault } = parsed.data
    return json({ addresses, ...(await getHoldingsBundleGrowth(addresses, timeframe, vault)) }, { headers })
  } catch {
    return json({ error: 'Unable to load bundle growth right now.' }, { status: 502, headers })
  }
}
