import { debugError, debugLog, startHoldingsDebugTimer } from '@/server/lib/holdings/services/debug'
import type { THoldingsEventSource } from '@/server/lib/holdings/services/eventSource'
import type { VaultVersion } from '@/server/lib/holdings/services/graphql'
import { fetchMultipleVaultsPPS, getPPS } from '@/server/lib/holdings/services/kong'
import { resolveLedgerHistoricalPps } from '@/server/lib/holdings/services/ledger/pps'
import { resolveNestedVaultAssetMetadata } from '@/server/lib/holdings/services/nestedVaultPrices'
import { buildAddressScopedRawPnlEvents } from '@/server/lib/holdings/services/pnlEvents'
import {
  buildProtocolReturnVaultRowSummaries,
  getProtocolReturnHistoricalPpsRequirements,
  type HoldingsProtocolReturnVaultRowSummary,
  type TProtocolReturnCurrentPpsValue
} from '@/server/lib/holdings/services/pnlSimple'
import {
  filterEventsByAuthoritativeVersion,
  getVaultIdentifiers
} from '@/server/lib/holdings/services/settledHoldingsContext'
import { fetchMultipleVaultsMetadata } from '@/server/lib/holdings/services/vaults'

export type THoldingsLedgerGrowthResponse = {
  address: string
  version: VaultVersion
  generatedAt: string
  summary: {
    totalVaults: number
    completeVaults: number
    partialVaults: number
    historicalPpsRequirements: number
    historicalPpsCacheHits: number
    historicalPpsFetched: number
    historicalPpsMissing: number
    currentPpsFallbackVaults: number
    isComplete: boolean
  }
  vaults: HoldingsProtocolReturnVaultRowSummary[]
}

type TGetLedgerProtocolReturnRowsOptions = {
  fetchMetadata?: typeof fetchMultipleVaultsMetadata
  resolveNestedMetadata?: typeof resolveNestedVaultAssetMetadata
  resolveHistoricalPps?: typeof resolveLedgerHistoricalPps
  fetchPps?: typeof fetchMultipleVaultsPPS
}

function getVaultKey(chainId: number, vaultAddress: string): string {
  return `${chainId}:${vaultAddress.toLowerCase()}`
}

function getMetadataCurrentPps(
  vaults: readonly { chainId: number; vaultAddress: string }[],
  metadata: Awaited<ReturnType<typeof resolveNestedVaultAssetMetadata>>
): TProtocolReturnCurrentPpsValue[] {
  return vaults.flatMap((vault) => {
    const pricePerShare = metadata.get(getVaultKey(vault.chainId, vault.vaultAddress))?.currentPricePerShare
    return typeof pricePerShare === 'number' && Number.isFinite(pricePerShare) && pricePerShare > 0
      ? [{ chainId: vault.chainId, vaultAddress: vault.vaultAddress, pricePerShare }]
      : []
  })
}

async function resolveMissingCurrentPps(args: {
  rows: readonly HoldingsProtocolReturnVaultRowSummary[]
  currentPps: readonly TProtocolReturnCurrentPpsValue[]
  currentTimestamp: number
  fetchPps: typeof fetchMultipleVaultsPPS
}): Promise<TProtocolReturnCurrentPpsValue[]> {
  const knownKeys = new Set(args.currentPps.map((value) => getVaultKey(value.chainId, value.vaultAddress)))
  const missingOpenVaults = Array.from(
    args.rows
      .filter((row) => row.sharesFormatted > 0 && !knownKeys.has(getVaultKey(row.chainId, row.vaultAddress)))
      .reduce<Map<string, { chainId: number; vaultAddress: string }>>((vaults, row) => {
        vaults.set(getVaultKey(row.chainId, row.vaultAddress), {
          chainId: row.chainId,
          vaultAddress: row.vaultAddress
        })
        return vaults
      }, new Map())
      .values()
  )

  if (missingOpenVaults.length === 0) {
    return []
  }

  try {
    const timelines = await args.fetchPps(missingOpenVaults)
    return missingOpenVaults.flatMap((vault) => {
      const timeline = timelines.get(getVaultKey(vault.chainId, vault.vaultAddress))
      const pricePerShare = timeline ? getPPS(timeline, args.currentTimestamp) : null
      return pricePerShare !== null && Number.isFinite(pricePerShare) && pricePerShare > 0
        ? [{ ...vault, pricePerShare }]
        : []
    })
  } catch (error) {
    debugError('ledger-growth', 'current PPS fallback failed', error, { vaults: missingOpenVaults.length })
    return []
  }
}

export async function getLedgerProtocolReturnRows(args: {
  address: string
  version: VaultVersion
  eventSource: THoldingsEventSource
  options?: TGetLedgerProtocolReturnRowsOptions
}): Promise<THoldingsLedgerGrowthResponse> {
  const getDurationMs = startHoldingsDebugTimer()
  const fetchMetadata = args.options?.fetchMetadata ?? fetchMultipleVaultsMetadata
  const resolveNestedMetadata = args.options?.resolveNestedMetadata ?? resolveNestedVaultAssetMetadata
  const resolveHistoricalPps = args.options?.resolveHistoricalPps ?? resolveLedgerHistoricalPps
  const fetchPps = args.options?.fetchPps ?? fetchMultipleVaultsPPS
  const events = await args.eventSource.load({
    userAddress: args.address,
    version: 'all',
    maxTimestamp: args.eventSource.eventUpperTimestamp,
    fetchType: 'seq',
    paginationMode: 'paged'
  })
  const rawEvents = buildAddressScopedRawPnlEvents(events)
  const rawVaults = getVaultIdentifiers(rawEvents)
  const baseMetadata = rawVaults.length > 0 ? await fetchMetadata(rawVaults) : new Map()
  const metadata = await resolveNestedMetadata(baseMetadata)
  const selectedEvents = filterEventsByAuthoritativeVersion(rawEvents, metadata, args.version)
  const selectedVaults = getVaultIdentifiers(selectedEvents)
  const requirements = getProtocolReturnHistoricalPpsRequirements(selectedEvents, args.address)
  const historicalPps = await resolveHistoricalPps(requirements)
  const metadataCurrentPps = getMetadataCurrentPps(selectedVaults, metadata)
  const initialRows = buildProtocolReturnVaultRowSummaries({
    events: selectedEvents,
    userAddress: args.address,
    metadata,
    currentTimestamp: args.eventSource.eventUpperTimestamp,
    currentPps: metadataCurrentPps,
    historicalPps: historicalPps.values
  })
  const fallbackCurrentPps = await resolveMissingCurrentPps({
    rows: initialRows,
    currentPps: metadataCurrentPps,
    currentTimestamp: args.eventSource.eventUpperTimestamp,
    fetchPps
  })
  const rows = buildProtocolReturnVaultRowSummaries({
    events: selectedEvents,
    userAddress: args.address,
    metadata,
    currentTimestamp: args.eventSource.eventUpperTimestamp,
    currentPps: [...metadataCurrentPps, ...fallbackCurrentPps],
    historicalPps: historicalPps.values
  }).filter((row) => row.sharesFormatted > 0)
  const completeVaults = rows.filter((row) => row.status === 'ok').length

  debugLog('ledger-growth', 'completed fast ledger row projection', {
    durationMs: getDurationMs(),
    rawEvents: rawEvents.length,
    selectedEvents: selectedEvents.length,
    vaults: rows.length,
    completeVaults,
    historicalPpsRequirements: requirements.length,
    historicalPpsCacheHits: historicalPps.cacheHits,
    historicalPpsFetched: historicalPps.fetched,
    historicalPpsMissing: historicalPps.missing,
    currentPpsFallbackVaults: fallbackCurrentPps.length
  })

  return {
    address: args.address.toLowerCase(),
    version: args.version,
    generatedAt: new Date().toISOString(),
    summary: {
      totalVaults: rows.length,
      completeVaults,
      partialVaults: rows.length - completeVaults,
      historicalPpsRequirements: requirements.length,
      historicalPpsCacheHits: historicalPps.cacheHits,
      historicalPpsFetched: historicalPps.fetched,
      historicalPpsMissing: historicalPps.missing,
      currentPpsFallbackVaults: fallbackCurrentPps.length,
      isComplete: completeVaults === rows.length
    },
    vaults: rows
  }
}
