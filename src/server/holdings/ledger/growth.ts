import { handleLedgerDerivedRequest } from '@/server/holdings/ledger/derived'
import { json, LEDGER_ADMIN_CORS_HEADERS, noContent, queryString } from '@/server/http'
import type { VaultVersion } from '@/server/lib/holdings'
import { getLedgerProtocolReturnRows } from '@/server/lib/holdings/services/ledger/rows'

function parseVersion(value: string | undefined): VaultVersion {
  return value === 'v2' || value === 'v3' ? value : 'all'
}

export function OPTIONS(): Response {
  return noContent(LEDGER_ADMIN_CORS_HEADERS)
}

export async function GET(request: Request): Promise<Response> {
  return handleLedgerDerivedRequest(
    request,
    async (derivedRequest, options) => {
      if (!options.eventSource) {
        return json(
          { error: 'Verified holdings ledger event source is unavailable' },
          { status: 500, headers: LEDGER_ADMIN_CORS_HEADERS }
        )
      }

      const address = queryString(derivedRequest, 'address')!
      const response = await getLedgerProtocolReturnRows({
        address,
        version: parseVersion(queryString(derivedRequest, 'version')),
        eventSource: options.eventSource
      })

      if (response.summary.totalVaults === 0) {
        return json({ error: 'No holdings found for address' }, { status: 404, headers: LEDGER_ADMIN_CORS_HEADERS })
      }

      return json(response, { headers: LEDGER_ADMIN_CORS_HEADERS })
    },
    { debugRoute: 'ledger-growth' }
  )
}
