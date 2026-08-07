import { handleHoldingsBreakdownRequest } from '@/server/holdings/breakdown'
import { handleLedgerDerivedRequest } from '@/server/holdings/ledger/derived'
import { LEDGER_ADMIN_CORS_HEADERS, noContent } from '@/server/http'

export function OPTIONS(): Response {
  return noContent(LEDGER_ADMIN_CORS_HEADERS)
}

export async function GET(request: Request): Promise<Response> {
  return handleLedgerDerivedRequest(request, handleHoldingsBreakdownRequest, { debugRoute: 'ledger-breakdown' })
}
