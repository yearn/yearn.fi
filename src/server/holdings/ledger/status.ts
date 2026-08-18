import { getLedgerAdminAccessError, isValidLedgerWalletAddress } from '@/server/holdings/ledger/access'
import { json, LEDGER_ADMIN_CORS_HEADERS, noContent } from '@/server/http'
import { getHoldingsLedgerStatus, HoldingsLedgerStatusError } from '@/server/lib/holdings/services/ledger/status'
import { getHoldingsLedgerRuntimeFingerprint } from '@/server/lib/holdings/storage/ledgerRedis'

const INVALID_STATUS_QUERY = { error: 'Invalid request query' } as const
const STATUS_FAILED_ERROR = 'Holdings ledger status read failed'

function getStatusHeaders(): HeadersInit {
  return {
    ...LEDGER_ADMIN_CORS_HEADERS,
    'X-Holdings-Ledger-Runtime-Fingerprint': getHoldingsLedgerRuntimeFingerprint()
  }
}

function getStatusAddress(request: Request): string | null {
  const entries = Array.from(new URL(request.url).searchParams.entries())
  const address = entries.length === 1 && entries[0]?.[0] === 'address' ? entries[0][1] : null
  return address && isValidLedgerWalletAddress(address) ? address : null
}

export function OPTIONS(): Response {
  return noContent(LEDGER_ADMIN_CORS_HEADERS)
}

export async function GET(request: Request): Promise<Response> {
  const accessError = getLedgerAdminAccessError(request)
  if (accessError) {
    return accessError
  }
  const address = getStatusAddress(request)
  if (!address) {
    return json(INVALID_STATUS_QUERY, { status: 400, headers: LEDGER_ADMIN_CORS_HEADERS })
  }

  try {
    return json(await getHoldingsLedgerStatus(address), { status: 200, headers: getStatusHeaders() })
  } catch (error) {
    return error instanceof HoldingsLedgerStatusError
      ? json(
          { error: STATUS_FAILED_ERROR, reasonCode: error.reasonCode },
          { status: error.statusCode, headers: LEDGER_ADMIN_CORS_HEADERS }
        )
      : json(
          { error: STATUS_FAILED_ERROR, reasonCode: 'storage_failed' },
          { status: 500, headers: LEDGER_ADMIN_CORS_HEADERS }
        )
  }
}
