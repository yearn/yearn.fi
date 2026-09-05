import { getCachedWalletEvents, saveCachedWalletEvents } from '@/server/lib/holdings/services/walletEventCache'
import { holdingsConfig } from '../config'
import type { UserEvents, VaultMetadata } from '../types'
import { debugLog } from './debug'
import { fetchUserEvents } from './graphql'
import { buildPositionTimeline, generateDailyTimestamps, getUniqueVaults, toSettledDayTimestamp } from './holdings'
import { fetchMultipleVaultsPPS, type PPSTimeline } from './kong'
import {
  getNestedVaultPpsIdentifiersFromPriceRequests,
  mergeVaultIdentifiers,
  resolveNestedVaultAssetMetadata
} from './nestedVaultPrices'
import { buildAddressScopedRawPnlEvents } from './pnlEvents'
import { lowerCaseAddress, toVaultKey } from './pnlShared'
import type { TRawPnlEvent } from './pnlTypes'
import type { THistoricalPriceRequest } from './prices'
import { fetchMultipleVaultsMetadata, getVaultMetadataFetchFailedVaults, prefetchGlobalVaultMetadata } from './vaults'

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
  metadataFetchFailedVaults: number
}

export type TSettledAddressScopedContextSource =
  | Promise<TSettledAddressScopedContext>
  | (() => Promise<TSettledAddressScopedContext>)

export function resolveSettledAddressScopedContext(
  source: TSettledAddressScopedContextSource
): Promise<TSettledAddressScopedContext> {
  return typeof source === 'function' ? source() : source
}

interface TSettledSelection {
  events: TRawPnlEvent[]
  vaultIdentifiers: TVaultIdentifier[]
}

export interface TSettledPpsContext extends TSettledAddressScopedContext {
  selectedEvents: TRawPnlEvent[]
  selectedVaultIdentifiers: TVaultIdentifier[]
  ppsIdentifiers: TVaultIdentifier[]
  ppsData: Map<string, PPSTimeline>
}

const inFlightSettledAddressScopedContexts = new Map<string, Promise<TSettledAddressScopedContext>>()
const inFlightSettledPpsContexts = new Map<string, Promise<TSettledPpsContext>>()
const CURRENT_DAY_LOOKAHEAD_SECONDS = 24 * 60 * 60
function getContextKey(args: {
  userAddress: string
  requestedVault?: TRequestedVault
  vaultIdentifiers?: TVaultIdentifier[]
}): string {
  const normalizedVaultScope =
    args.vaultIdentifiers !== undefined
      ? args.vaultIdentifiers.length > 0
        ? args.vaultIdentifiers
            .map((vault) => `${vault.chainId}:${lowerCaseAddress(vault.vaultAddress)}`)
            .sort()
            .join(',')
        : 'none'
      : args.requestedVault
        ? `${args.requestedVault.chainId}:${lowerCaseAddress(args.requestedVault.vaultAddress)}`
        : 'all'

  return [lowerCaseAddress(args.userAddress), normalizedVaultScope].join(':')
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

function filterEventsByRequestedVault(events: TRawPnlEvent[], requestedVault?: TRequestedVault): TRawPnlEvent[] {
  if (!requestedVault) {
    return events
  }

  const requestedVaultAddress = lowerCaseAddress(requestedVault.vaultAddress)
  return events.filter(
    (event) => event.chainId === requestedVault.chainId && event.familyVaultAddress === requestedVaultAddress
  )
}

function filterVisibleEvents(events: TRawPnlEvent[], metadata: Map<string, VaultMetadata>): TRawPnlEvent[] {
  return events.filter((event) => {
    const eventMetadata = metadata.get(toVaultKey(event.chainId, event.familyVaultAddress))
    return !eventMetadata?.isHidden
  })
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

export function selectEvents(
  context: TSettledAddressScopedContext,
  requestedVault?: TRequestedVault
): TSettledSelection {
  const selectedEvents = filterEventsByRequestedVault(
    filterVisibleEvents(context.rawEvents, context.vaultMetadata),
    requestedVault
  )

  return {
    events: selectedEvents,
    vaultIdentifiers: getVaultIdentifiers(selectedEvents)
  }
}

export async function getSettledAddressScopedContext(args: {
  userAddress: string
}): Promise<TSettledAddressScopedContext> {
  const key = getContextKey(args)
  const existing = inFlightSettledAddressScopedContexts.get(key)

  if (existing) {
    debugLog('holdings-context', 'reusing in-flight settled address-scoped context', { key })
    return existing
  }

  const request = (async () => {
    const metadataPrefetch = prefetchGlobalVaultMetadata().catch(() => undefined)
    const settledTimestamps = generateDailyTimestamps(holdingsConfig.historyDays, 1)
    const latestSettledDayTimestamp = settledTimestamps[settledTimestamps.length - 1] ?? 0
    const maxTimestamp = toSettledDayTimestamp(latestSettledDayTimestamp)
    const activityMaxTimestamp = maxTimestamp + CURRENT_DAY_LOOKAHEAD_SECONDS
    const eventCacheIdentity = {
      userAddress: args.userAddress,
      maxTimestamp: activityMaxTimestamp
    }
    const cachedEvents = await getCachedWalletEvents(eventCacheIdentity)
    const events = cachedEvents ?? (await fetchUserEvents(args.userAddress, activityMaxTimestamp))
    const eventCacheSave = cachedEvents ? Promise.resolve(false) : saveCachedWalletEvents(eventCacheIdentity, events)

    const timeline = buildPositionTimeline(events.deposits, events.withdrawals, events.transfersIn, events.transfersOut)
    const rawEvents = buildAddressScopedRawPnlEvents(events)
    const rawVaultIdentifiers = timeline.length > 0 ? getUniqueVaults(timeline) : getVaultIdentifiers(rawEvents)
    await metadataPrefetch
    const baseVaultMetadata =
      rawVaultIdentifiers.length > 0 ? await fetchMultipleVaultsMetadata(rawVaultIdentifiers) : new Map()
    const vaultMetadata = await resolveNestedVaultAssetMetadata(baseVaultMetadata)
    const metadataFetchFailedVaults = getVaultMetadataFetchFailedVaults(vaultMetadata)
    await eventCacheSave

    return {
      address: lowerCaseAddress(args.userAddress),
      latestSettledDayTimestamp,
      maxTimestamp,
      events,
      timeline,
      hasActivity: timeline.length > 0,
      rawEvents,
      rawVaultIdentifiers,
      vaultMetadata,
      metadataFetchFailedVaults
    }
  })().finally(() => {
    inFlightSettledAddressScopedContexts.delete(key)
  })

  inFlightSettledAddressScopedContexts.set(key, request)
  return request
}

export async function getSettledPpsContext(args: {
  userAddress: string
  requestedVault?: TRequestedVault
  vaultIdentifiers?: TVaultIdentifier[]
  context?: TSettledAddressScopedContext
}): Promise<TSettledPpsContext> {
  const key = getContextKey(args)
  const existing = inFlightSettledPpsContexts.get(key)

  if (existing) {
    debugLog('holdings-context', 'reusing in-flight settled PPS context', { key })
    return existing
  }

  const request = (async () => {
    const context = args.context ?? (await getSettledAddressScopedContext({ userAddress: args.userAddress }))
    const selection = selectEvents(context, args.requestedVault)
    const settledEvents = selection.events.filter((event) => event.blockTimestamp <= context.maxTimestamp)
    const selectedVaultIdentifiers = args.vaultIdentifiers ?? getVaultIdentifiers(settledEvents)
    const basePriceRequests = buildUnderlyingTokenRequests(selectedVaultIdentifiers, context.vaultMetadata)
    const ppsIdentifiers = mergeVaultIdentifiers([
      ...selectedVaultIdentifiers,
      ...getNestedVaultPpsIdentifiersFromPriceRequests(basePriceRequests, context.vaultMetadata)
    ])
    const ppsData = ppsIdentifiers.length === 0 ? new Map() : await fetchMultipleVaultsPPS(ppsIdentifiers)

    return {
      ...context,
      selectedEvents: settledEvents,
      selectedVaultIdentifiers,
      ppsIdentifiers,
      ppsData
    }
  })().finally(() => {
    inFlightSettledPpsContexts.delete(key)
  })

  inFlightSettledPpsContexts.set(key, request)
  return request
}
