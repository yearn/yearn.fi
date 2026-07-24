import { createEnsoBridgeStatusHandler, createOptionsHandler } from '@yearn/vault-widget/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = createEnsoBridgeStatusHandler({
  apiKey: process.env.ENSO_API_KEY
})
export const OPTIONS = createOptionsHandler()
