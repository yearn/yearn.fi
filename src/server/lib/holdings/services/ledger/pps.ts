import { debugError, debugLog, startHoldingsDebugTimer } from '@/server/lib/holdings/services/debug'
import { fetchMultipleVaultsPPS, getPPS, type PPSTimeline } from '@/server/lib/holdings/services/kong'
import type {
  TProtocolReturnHistoricalPpsRequirement,
  TProtocolReturnHistoricalPpsValue
} from '@/server/lib/holdings/services/pnlSimple'

type TResolveHistoricalPpsOptions = {
  fetchPps?: typeof fetchMultipleVaultsPPS
}

export type TResolvedLedgerHistoricalPps = {
  values: TProtocolReturnHistoricalPpsValue[]
  fetched: number
  missing: number
}

function getVaultKey(requirement: TProtocolReturnHistoricalPpsRequirement): string {
  return `${requirement.chainId}:${requirement.vaultAddress.toLowerCase()}`
}

export async function resolveLedgerHistoricalPps(
  requirements: readonly TProtocolReturnHistoricalPpsRequirement[],
  options: TResolveHistoricalPpsOptions = {}
): Promise<TResolvedLedgerHistoricalPps> {
  if (requirements.length === 0) {
    return { values: [], fetched: 0, missing: 0 }
  }

  const getDurationMs = startHoldingsDebugTimer()
  const fetchPps = options.fetchPps ?? fetchMultipleVaultsPPS
  const uniqueVaults = Array.from(
    requirements
      .reduce<Map<string, { chainId: number; vaultAddress: string }>>((vaults, requirement) => {
        const key = getVaultKey(requirement)
        if (!vaults.has(key)) {
          vaults.set(key, { chainId: requirement.chainId, vaultAddress: requirement.vaultAddress })
        }
        return vaults
      }, new Map())
      .values()
  )

  const timelines = await (async (): Promise<Map<string, PPSTimeline>> => {
    try {
      return await fetchPps(uniqueVaults)
    } catch (error) {
      debugError('ledger-pps', 'targeted historical PPS fetch failed', error, {
        vaults: uniqueVaults.length,
        requirements: requirements.length
      })
      return new Map()
    }
  })()

  const fetchedValues = requirements.flatMap((requirement) => {
    const timeline = timelines.get(getVaultKey(requirement))
    const pricePerShare = timeline ? getPPS(timeline, requirement.blockTimestamp) : null
    return pricePerShare !== null && Number.isFinite(pricePerShare) && pricePerShare > 0
      ? [{ requirement, pricePerShare }]
      : []
  })

  const values = fetchedValues.map(({ requirement, pricePerShare }) => ({
    key: requirement.key,
    pricePerShare
  }))
  const missing = requirements.length - values.length

  debugLog('ledger-pps', 'resolved targeted historical PPS requirements', {
    durationMs: getDurationMs(),
    storage: 'request-memory',
    requirements: requirements.length,
    fetched: fetchedValues.length,
    missing,
    vaultsFetched: uniqueVaults.length
  })

  return {
    values,
    fetched: fetchedValues.length,
    missing
  }
}
