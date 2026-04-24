import { config } from '../config'
import type { UserEvents, VaultMetadata } from '../types'
import { debugLog } from './debug'
import type { THistoricalPriceRequest } from './defillama'
import {
  fetchUserEvents,
  type HoldingsEventFetchType,
  type HoldingsEventPaginationMode,
  type VaultVersion
} from './graphql'
import { buildPositionTimeline, generateDailyTimestamps, getUniqueVaults, toSettledDayTimestamp } from './holdings'
import { fetchMultipleVaultsPPS, type PPSTimeline } from './kong'
import { getNestedVaultPpsIdentifiersFromPriceRequests, mergeVaultIdentifiers } from './nestedVaultPrices'
import { buildAddressScopedRawPnlEvents } from './pnl'
import { lowerCaseAddress, toVaultKey } from './pnlShared'
import type { TRawPnlEvent } from './pnlTypes'
import { fetchMultipleVaultsMetadata } from './vaults'

type TVaultIdentifier = {
  chainId: number
  vaultAddress: string
}

type TRequestedVault = {
  chainId: number
  vaultAddress: string
}

type TPositionTimeline = ReturnType<typeof buildPositionTimeline>

export interface TSettledAddressScopedContext {
  address: string
  latestSettledDayTimestamp: number
  maxTimestamp: number
  events: UserEvents
  timeline: TPositionTimeline
  hasActivity: boolean
  rawEvents: TRawPnlEvent[]
  rawVaultIdentifiers: TVaultIdentifier[]
  vaultMetadata: Map<string, VaultMetadata>
}

export interface TSettledVersionedSelection {
  events: TRawPnlEvent[]
  vaultIdentifiers: TVaultIdentifier[]
}

export interface TSettledVersionedPpsContext extends TSettledAddressScopedContext {
  selectedEvents: TRawPnlEvent[]
  selectedVaultIdentifiers: TVaultIdentifier[]
  ppsIdentifiers: TVaultIdentifier[]
  ppsData: Map<string, PPSTimeline>
}

const inFlightSettledAddressScopedContexts = new Map<string, Promise<TSettledAddressScopedContext>>()
const inFlightSettledVersionedPpsContexts = new Map<string, Promise<TSettledVersionedPpsContext>>()

function getContextKey(args: {
  userAddress: string
  version?: VaultVersion
  fetchType: HoldingsEventFetchType
  paginationMode: HoldingsEventPaginationMode
  requestedVault?: TRequestedVault
}): string {
  const normalizedRequestedVault = args.requestedVault
    ? `${args.requestedVault.chainId}:${lowerCaseAddress(args.requestedVault.vaultAddress)}`
    : 'all'

  return [
    lowerCaseAddress(args.userAddress),
    args.version ?? 'all',
    args.fetchType,
    args.paginationMode,
    normalizedRequestedVault
  ].join(':')
}

export function getVaultIdentifiers(events: TRawPnlEvent[]): TVaultIdentifier[] {
  return Array.from(
    events
      .reduce<Map<string, TVaultIdentifier>>((identifiers, event) => {
        const key = toVaultKey(event.chainId, event.familyVaultAddress)

        if (!identifiers.has(key)) {
          identifiers.set(key, {
            chainId: event.chainId,
            vaultAddress: event.familyVaultAddress
          })
        }

        return identifiers
      }, new Map())
      .values()
  )
}

export function filterEventsByRequestedVault(events: TRawPnlEvent[], requestedVault?: TRequestedVault): TRawPnlEvent[] {
  if (!requestedVault) {
    return events
  }

  const requestedVaultAddress = lowerCaseAddress(requestedVault.vaultAddress)
  return events.filter(
    (event) => event.chainId === requestedVault.chainId && event.familyVaultAddress === requestedVaultAddress
  )
}

export function filterEventsByAuthoritativeVersion(
  events: TRawPnlEvent[],
  metadata: Map<string, VaultMetadata>,
  version: VaultVersion
): TRawPnlEvent[] {
  return events.filter((event) => {
    const eventMetadata = metadata.get(toVaultKey(event.chainId, event.familyVaultAddress))

    if (eventMetadata?.isHidden) {
      return false
    }

    if (version === 'all') {
      return true
    }

    return eventMetadata?.version === version
  })
}

export async function resolveNestedVaultAssetMetadata(
  vaultMetadata: Map<string, VaultMetadata>
): Promise<Map<string, VaultMetadata>> {
  const assetVaultIdentifiers = mergeVaultIdentifiers(
    Array.from(vaultMetadata.values()).map((metadata) => ({
      chainId: metadata.chainId,
      vaultAddress: metadata.token.address
    }))
  )

  if (assetVaultIdentifiers.length === 0) {
    return vaultMetadata
  }

  const assetVaultMetadata = await fetchMultipleVaultsMetadata(assetVaultIdentifiers, { skipSnapshotFallback: true })
  return new Map([...vaultMetadata, ...assetVaultMetadata])
}

function buildUnderlyingTokenRequests(
  vaultIdentifiers: TVaultIdentifier[],
  vaultMetadata: Map<string, VaultMetadata>
): THistoricalPriceRequest[] {
  return Array.from(
    vaultIdentifiers
      .reduce<Map<string, THistoricalPriceRequest>>((requests, vault) => {
        const metadata = vaultMetadata.get(toVaultKey(vault.chainId, vault.vaultAddress))

        if (!metadata) {
          return requests
        }

        const requestKey = `${metadata.chainId}:${metadata.token.address.toLowerCase()}`
        if (!requests.has(requestKey)) {
          requests.set(requestKey, {
            chainId: metadata.chainId,
            address: metadata.token.address,
            timestamps: []
          })
        }

        return requests
      }, new Map())
      .values()
  )
}

export function selectVersionedEvents(
  context: TSettledAddressScopedContext,
  version: VaultVersion,
  requestedVault?: TRequestedVault
): TSettledVersionedSelection {
  const selectedEvents = filterEventsByRequestedVault(
    filterEventsByAuthoritativeVersion(context.rawEvents, context.vaultMetadata, version),
    requestedVault
  )

  return {
    events: selectedEvents,
    vaultIdentifiers: getVaultIdentifiers(selectedEvents)
  }
}

export async function getSettledAddressScopedContext(args: {
  userAddress: string
  fetchType: HoldingsEventFetchType
  paginationMode: HoldingsEventPaginationMode
}): Promise<TSettledAddressScopedContext> {
  const key = getContextKey(args)
  const existing = inFlightSettledAddressScopedContexts.get(key)

  if (existing) {
    debugLog('holdings-context', 'reusing in-flight settled address-scoped context', { key })
    return existing
  }

  const request = (async () => {
    const settledTimestamps = generateDailyTimestamps(config.historyDays, 1)
    const latestSettledDayTimestamp = settledTimestamps[settledTimestamps.length - 1] ?? 0
    const maxTimestamp = toSettledDayTimestamp(latestSettledDayTimestamp)
    const events = await fetchUserEvents(args.userAddress, 'all', maxTimestamp, args.fetchType, args.paginationMode)
    const timeline = buildPositionTimeline(events.deposits, events.withdrawals, events.transfersIn, events.transfersOut)
    const rawEvents = buildAddressScopedRawPnlEvents(events)
    const rawVaultIdentifiers = timeline.length > 0 ? getUniqueVaults(timeline) : getVaultIdentifiers(rawEvents)
    const baseVaultMetadata =
      rawVaultIdentifiers.length > 0 ? await fetchMultipleVaultsMetadata(rawVaultIdentifiers) : new Map()
    const vaultMetadata = await resolveNestedVaultAssetMetadata(baseVaultMetadata)

    return {
      address: lowerCaseAddress(args.userAddress),
      latestSettledDayTimestamp,
      maxTimestamp,
      events,
      timeline,
      hasActivity: timeline.length > 0,
      rawEvents,
      rawVaultIdentifiers,
      vaultMetadata
    }
  })().finally(() => {
    inFlightSettledAddressScopedContexts.delete(key)
  })

  inFlightSettledAddressScopedContexts.set(key, request)
  return request
}

export async function getSettledVersionedPpsContext(args: {
  userAddress: string
  version: VaultVersion
  fetchType: HoldingsEventFetchType
  paginationMode: HoldingsEventPaginationMode
  requestedVault?: TRequestedVault
  vaultIdentifiers?: TVaultIdentifier[]
  context?: TSettledAddressScopedContext
}): Promise<TSettledVersionedPpsContext> {
  const key = getContextKey(args)
  const existing = inFlightSettledVersionedPpsContexts.get(key)

  if (existing) {
    debugLog('holdings-context', 'reusing in-flight settled versioned PPS context', { key })
    return existing
  }

  const request = (async () => {
    const context =
      args.context ??
      (await getSettledAddressScopedContext({
        userAddress: args.userAddress,
        fetchType: args.fetchType,
        paginationMode: args.paginationMode
      }))
    const selection = selectVersionedEvents(context, args.version, args.requestedVault)
    const selectedVaultIdentifiers = args.vaultIdentifiers ?? selection.vaultIdentifiers
    const basePriceRequests = buildUnderlyingTokenRequests(selectedVaultIdentifiers, context.vaultMetadata)
    const ppsIdentifiers = mergeVaultIdentifiers([
      ...selectedVaultIdentifiers,
      ...getNestedVaultPpsIdentifiersFromPriceRequests(basePriceRequests, context.vaultMetadata)
    ])
    const ppsData = ppsIdentifiers.length > 0 ? await fetchMultipleVaultsPPS(ppsIdentifiers) : new Map()

    return {
      ...context,
      selectedEvents: selection.events,
      selectedVaultIdentifiers,
      ppsIdentifiers,
      ppsData
    }
  })().finally(() => {
    inFlightSettledVersionedPpsContexts.delete(key)
  })

  inFlightSettledVersionedPpsContexts.set(key, request)
  return request
}
