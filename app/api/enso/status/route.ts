import { createEnsoStatusHandler, createOptionsHandler } from '@yearn/vault-widget/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = createEnsoStatusHandler({
  apiKey: process.env.ENSO_API_KEY,
  mode: 'configuration'
})
export const OPTIONS = createOptionsHandler()
