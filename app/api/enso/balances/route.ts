import {
  createEnsoBalancesHandler,
  createOptionsHandler,
  ENSO_BALANCES_CACHE_CONTROL
} from '@yearn/vault-widget/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = createEnsoBalancesHandler({
  apiKey: process.env.ENSO_API_KEY,
  cacheControl: ENSO_BALANCES_CACHE_CONTROL,
  defaultChainId: 'all',
  useEoa: true
})
export const OPTIONS = createOptionsHandler()
