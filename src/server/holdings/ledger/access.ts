import { json, LEDGER_ADMIN_CORS_HEADERS } from '@/server/http'
import { holdingsConfig } from '@/server/lib/holdings/config'
import { isHoldingsLedgerStorageEnabled } from '@/server/lib/holdings/storage/ledgerRedis'

const LOOPBACK_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]'])

export function isValidLedgerWalletAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address)
}

function isUnauthenticatedLocalDevelopmentRequest(request: Request): boolean {
  return process.env.NODE_ENV === 'development' && LOOPBACK_HOSTNAMES.has(new URL(request.url).hostname.toLowerCase())
}

export function getLedgerAdminAccessError(
  request: Request,
  options?: { readonly requiresEnvio?: boolean }
): Response | null {
  if (!isUnauthenticatedLocalDevelopmentRequest(request)) {
    const adminSecret = process.env.ADMIN_SECRET
    if (!adminSecret) {
      return json(
        { error: 'Ledger admin endpoint not configured' },
        { status: 503, headers: LEDGER_ADMIN_CORS_HEADERS }
      )
    }
    if (request.headers.get('x-admin-secret') !== adminSecret) {
      return json({ error: 'Unauthorized' }, { status: 401, headers: LEDGER_ADMIN_CORS_HEADERS })
    }
  }
  if (holdingsConfig.ledgerMode === 'off') {
    return json({ error: 'Holdings ledger mode is off' }, { status: 503, headers: LEDGER_ADMIN_CORS_HEADERS })
  }
  if (!isHoldingsLedgerStorageEnabled()) {
    return json(
      { error: 'Holdings ledger storage is unavailable' },
      { status: 503, headers: LEDGER_ADMIN_CORS_HEADERS }
    )
  }
  if (options?.requiresEnvio && !process.env.ENVIO_GRAPHQL_URL) {
    return json({ error: 'Holdings ledger source is unavailable' }, { status: 503, headers: LEDGER_ADMIN_CORS_HEADERS })
  }
  return null
}
