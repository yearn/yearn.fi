import { createEnsoRouteHandler, createOptionsHandler, ENSO_SUPPORTED_CHAIN_IDS } from '@yearn/vault-widget/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = createEnsoRouteHandler({
  apiKey: process.env.ENSO_API_KEY,
  policy: {
    allowedChainIds: ENSO_SUPPORTED_CHAIN_IDS,
    maxSlippageBps: 500
  }
})
export const OPTIONS = createOptionsHandler()
