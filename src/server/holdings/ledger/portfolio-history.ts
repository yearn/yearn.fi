import { handleLedgerDerivedRequest } from '@/server/holdings/ledger/derived'
import { json, LEDGER_ADMIN_CORS_HEADERS, noContent, queryString } from '@/server/http'
import {
  getHistoricalHoldingsChart,
  getHoldingsProtocolReturnHistory,
  type HoldingsHistoryDenomination,
  type HoldingsHistoryTimeframe,
  type VaultVersion
} from '@/server/lib/holdings'
import { debugLog, startHoldingsDebugTimer } from '@/server/lib/holdings/services/debug'

function parseVersion(value: string | undefined): VaultVersion {
  return value === 'v2' || value === 'v3' ? value : 'all'
}

function parseDenomination(value: string | undefined): HoldingsHistoryDenomination {
  return value === 'eth' ? 'eth' : 'usd'
}

function parseTimeframe(value: string | undefined): HoldingsHistoryTimeframe {
  return value === 'all' ? 'all' : '1y'
}

export function OPTIONS(): Response {
  return noContent(LEDGER_ADMIN_CORS_HEADERS)
}

export async function GET(request: Request): Promise<Response> {
  return handleLedgerDerivedRequest(
    request,
    async (derivedRequest, options) => {
      const getDurationMs = startHoldingsDebugTimer()
      const address = queryString(derivedRequest, 'address')!
      const version = parseVersion(queryString(derivedRequest, 'version'))
      const denomination = parseDenomination(queryString(derivedRequest, 'denomination'))
      const timeframe = parseTimeframe(queryString(derivedRequest, 'timeframe'))

      debugLog('ledger-portfolio-history', 'started combined ledger portfolio calculation', {
        version,
        denomination,
        timeframe
      })

      const [balance, protocolReturn] = await Promise.all([
        getHistoricalHoldingsChart(address, version, 'seq', 'paged', denomination, timeframe, undefined, options),
        getHoldingsProtocolReturnHistory(address, version, 'seq', 'paged', timeframe, undefined, undefined, {
          ...options,
          protocolReturnEventEnrichment: 'address-only'
        })
      ])

      if (!balance.hasActivity && protocolReturn.summary.totalVaults === 0) {
        debugLog('ledger-portfolio-history', 'completed combined ledger portfolio calculation', {
          durationMs: getDurationMs(),
          status: 'empty'
        })
        return json({ error: 'No holdings found for address' }, { status: 404, headers: LEDGER_ADMIN_CORS_HEADERS })
      }

      debugLog('ledger-portfolio-history', 'completed combined ledger portfolio calculation', {
        durationMs: getDurationMs(),
        status: 'ready',
        balancePoints: balance.dataPoints.length,
        protocolReturnPoints: protocolReturn.dataPoints.length,
        protocolReturnVaults: protocolReturn.summary.totalVaults
      })

      return json(
        {
          address: balance.address,
          version,
          denomination,
          timeframe,
          balance: {
            address: balance.address,
            denomination,
            timeframe,
            isComplete: balance.isComplete,
            dataPoints: balance.dataPoints.map((point) => ({
              date: point.date,
              value: point.value,
              isComplete: point.isComplete
            }))
          },
          protocolReturn
        },
        { headers: LEDGER_ADMIN_CORS_HEADERS }
      )
    },
    { debugRoute: 'ledger-portfolio-history' }
  )
}
