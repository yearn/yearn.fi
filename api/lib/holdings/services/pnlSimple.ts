import { formatUnits } from 'viem'
import type { VaultMetadata } from '../types'
import { debugError, debugLog } from './debug'
import { fetchHistoricalPrices, getChainPrefix, getPriceAtTimestamp } from './defillama'
import {
  fetchUserEvents,
  type HoldingsEventFetchType,
  type HoldingsEventPaginationMode,
  type VaultVersion
} from './graphql'
import { fetchMultipleVaultsPPS, getPPS } from './kong'
import { buildRawPnlEvents } from './pnl'
import { lowerCaseAddress, toVaultKey, ZERO } from './pnlShared'
import type { TRawPnlEvent } from './pnlTypes'
import { fetchMultipleVaultsMetadata } from './vaults'

type TProtocolReturnIssue = 'missing_metadata' | 'missing_pps' | 'missing_receipt_price' | 'unmatched_exit'

type TProtocolReturnReceiptKind = 'deposit' | 'transfer_in'
type TProtocolReturnExitKind = 'withdrawal' | 'transfer_out'

const RECEIPT_PRICE_BUCKET_SECONDS = 24 * 60 * 60
const RECEIPT_PRICE_FETCH_CONCURRENCY = 4

type TProtocolReturnLot = {
  shares: bigint
  baselineUnderlying: number
  receiptTimestamp: number
  receiptPriceUsd: number
  receiptPriceMissing: boolean
  receiptKind: TProtocolReturnReceiptKind
  transactionHash: string
}

type TProtocolReturnConsumedLot = {
  shares: bigint
  baselineUnderlying: number
  receiptTimestamp: number
  receiptPriceUsd: number
  receiptPriceMissing: boolean
}

type TProtocolReturnLedger = {
  chainId: number
  vaultAddress: string
  lots: TProtocolReturnLot[]
  baselineUnderlying: number
  baselineExposureUnderlyingSeconds: number
  baselineExposureWeightUsdSeconds: number
  realizedBaselineUnderlying: number
  realizedGrowthUnderlying: number
  realizedBaselineWeightUsd: number
  realizedGrowthWeightUsd: number
  unmatchedExitShares: bigint
  unmatchedExitCount: number
  receiptCount: number
  exitCount: number
  deposits: number
  withdrawals: number
  transfersIn: number
  transfersOut: number
  missingPps: boolean
  missingReceiptPrice: boolean
  lastAccruedTimestamp: number | null
}

export type TSimpleReceiptPriceRequest = {
  chainId: number
  address: string
  timestamps: number[]
}

export type THoldingsPnLSimpleStatus = 'ok' | 'missing_metadata' | 'missing_pps' | 'missing_receipt_price' | 'partial'

export interface HoldingsPnLSimpleVault {
  chainId: number
  vaultAddress: string
  status: THoldingsPnLSimpleStatus
  issues: TProtocolReturnIssue[]
  shares: string
  sharesFormatted: number
  pricePerShare: number
  currentUnderlying: number
  baselineUnderlying: number
  baselineExposureUnderlyingYears: number
  baselineExposureWeightUsdYears: number
  realizedBaselineUnderlying: number
  unrealizedBaselineUnderlying: number
  realizedGrowthUnderlying: number
  unrealizedGrowthUnderlying: number
  growthUnderlying: number
  baselineWeightUsd: number
  growthWeightUsd: number
  realizedGrowthWeightUsd: number
  unrealizedGrowthWeightUsd: number
  protocolReturnPct: number | null
  annualizedProtocolReturnPct: number | null
  receiptCount: number
  exitCount: number
  deposits: number
  withdrawals: number
  transfersIn: number
  transfersOut: number
  unmatchedExitShares: string
  unmatchedExitSharesFormatted: number
  metadata: {
    symbol: string | null
    decimals: number
    assetDecimals: number
    tokenAddress: string | null
  }
}

export interface HoldingsPnLSimpleResponse {
  address: string
  version: VaultVersion
  generatedAt: string
  summary: {
    totalVaults: number
    completeVaults: number
    partialVaults: number
    baselineWeightUsd: number
    growthWeightUsd: number
    baselineExposureWeightUsdYears: number
    realizedGrowthWeightUsd: number
    unrealizedGrowthWeightUsd: number
    protocolReturnPct: number | null
    annualizedProtocolReturnPct: number | null
    isComplete: boolean
  }
  vaults: HoldingsPnLSimpleVault[]
}

const SECONDS_PER_YEAR = 365 * 24 * 60 * 60

function emptyLedger(chainId: number, vaultAddress: string): TProtocolReturnLedger {
  return {
    chainId,
    vaultAddress,
    lots: [],
    baselineUnderlying: 0,
    baselineExposureUnderlyingSeconds: 0,
    baselineExposureWeightUsdSeconds: 0,
    realizedBaselineUnderlying: 0,
    realizedGrowthUnderlying: 0,
    realizedBaselineWeightUsd: 0,
    realizedGrowthWeightUsd: 0,
    unmatchedExitShares: ZERO,
    unmatchedExitCount: 0,
    receiptCount: 0,
    exitCount: 0,
    deposits: 0,
    withdrawals: 0,
    transfersIn: 0,
    transfersOut: 0,
    missingPps: false,
    missingReceiptPrice: false,
    lastAccruedTimestamp: null
  }
}

function formatAmount(value: bigint, decimals: number): number {
  return parseFloat(formatUnits(value, decimals))
}

function scaleNumber(value: number, numerator: bigint, denominator: bigint): number {
  return denominator === ZERO ? 0 : value * (Number(numerator) / Number(denominator))
}

function protocolReturnPct(growth: number, baseline: number): number | null {
  return baseline > 0 ? (growth / baseline) * 100 : null
}

function annualizedProtocolReturnPct(growth: number, exposureYears: number): number | null {
  return exposureYears > 0 ? (growth / exposureYears) * 100 : null
}

function getVaultIdentifiers(events: TRawPnlEvent[]): Array<{ chainId: number; vaultAddress: string }> {
  return Array.from(
    events.reduce<Map<string, { chainId: number; vaultAddress: string }>>((identifiers, event) => {
      const key = toVaultKey(event.chainId, event.familyVaultAddress)

      if (!identifiers.has(key)) {
        identifiers.set(key, {
          chainId: event.chainId,
          vaultAddress: event.familyVaultAddress
        })
      }

      return identifiers
    }, new Map())
  ).map(([, identifier]) => identifier)
}

function filterEventsByAuthoritativeVersion(
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

function tokenPriceMapKey(metadata: VaultMetadata): string {
  return `${getChainPrefix(metadata.chainId)}:${metadata.token.address.toLowerCase()}`
}

function chunkItems<T>(items: T[], chunkSize: number): T[][] {
  return Array.from({ length: Math.ceil(items.length / chunkSize) }, (_value, index) =>
    items.slice(index * chunkSize, index * chunkSize + chunkSize)
  )
}

function getReceiptPriceBucketTimestamps(timestamp: number, currentTimestamp: number): number[] {
  const dayStart = Math.floor(timestamp / RECEIPT_PRICE_BUCKET_SECONDS) * RECEIPT_PRICE_BUCKET_SECONDS
  const nextDayStart = dayStart + RECEIPT_PRICE_BUCKET_SECONDS

  return [dayStart, ...(nextDayStart <= currentTimestamp ? [nextDayStart] : [])]
}

function isReceiptEvent(event: TRawPnlEvent, userAddress: string): boolean {
  return event.kind === 'deposit' || (event.kind === 'transfer' && event.receiver === userAddress)
}

export function buildReceiptPriceRequests(args: {
  events: TRawPnlEvent[]
  metadata: Map<string, VaultMetadata>
  userAddress: string
  currentTimestamp: number
}): TSimpleReceiptPriceRequest[] {
  const userAddress = lowerCaseAddress(args.userAddress)
  return Array.from(
    args.events
      .filter((event) => isReceiptEvent(event, userAddress))
      .reduce<Map<string, { chainId: number; address: string; timestamps: Set<number> }>>((requests, event) => {
        const metadata = args.metadata.get(toVaultKey(event.chainId, event.familyVaultAddress))

        if (!metadata) {
          return requests
        }

        const tokenKey = tokenPriceMapKey(metadata)
        const request = requests.get(tokenKey) ?? {
          chainId: metadata.chainId,
          address: metadata.token.address,
          timestamps: new Set<number>()
        }

        getReceiptPriceBucketTimestamps(event.blockTimestamp, args.currentTimestamp).forEach((timestamp) => {
          request.timestamps.add(timestamp)
        })
        requests.set(tokenKey, request)
        return requests
      }, new Map())
      .values()
  ).map((request) => ({
    chainId: request.chainId,
    address: request.address,
    timestamps: Array.from(request.timestamps).sort((a, b) => a - b)
  }))
}

function countReceiptPricePoints(requests: TSimpleReceiptPriceRequest[]): number {
  return requests.reduce((total, request) => total + request.timestamps.length, 0)
}

function mergePriceData(priceMaps: Array<Map<string, Map<number, number>>>): Map<string, Map<number, number>> {
  return priceMaps.reduce<Map<string, Map<number, number>>>((merged, priceMap) => {
    priceMap.forEach((prices, tokenKey) => {
      const existingPrices = merged.get(tokenKey) ?? new Map<number, number>()

      prices.forEach((price, timestamp) => {
        existingPrices.set(timestamp, price)
      })

      merged.set(tokenKey, existingPrices)
    })

    return merged
  }, new Map())
}

async function fetchReceiptPriceRequestGroup(
  requests: TSimpleReceiptPriceRequest[]
): Promise<Array<Map<string, Map<number, number>>>> {
  const results = await Promise.allSettled(
    requests.map((request) =>
      fetchHistoricalPrices([{ chainId: request.chainId, address: request.address }], request.timestamps)
    )
  )

  return results.flatMap((result, index) => {
    if (result.status === 'fulfilled') {
      return [result.value]
    }

    const request = requests[index]
    debugError('pnl-simple', 'receipt price fetch failed, continuing with missing receipt price', result.reason, {
      chainId: request?.chainId ?? null,
      address: request?.address ?? null,
      timestamps: request?.timestamps.length ?? 0
    })
    return []
  })
}

async function fetchReceiptPrices(requests: TSimpleReceiptPriceRequest[]): Promise<Map<string, Map<number, number>>> {
  if (requests.length === 0) {
    return new Map()
  }

  const priceMaps = await chunkItems(requests, RECEIPT_PRICE_FETCH_CONCURRENCY).reduce<
    Promise<Array<Map<string, Map<number, number>>>>
  >(async (previousPromise, requestGroup) => {
    const previous = await previousPromise
    const current = await fetchReceiptPriceRequestGroup(requestGroup)
    return previous.concat(current)
  }, Promise.resolve([]))

  return mergePriceData(priceMaps)
}

function getReceiptPriceUsd(
  metadata: VaultMetadata | undefined,
  priceData: Map<string, Map<number, number>>,
  timestamp: number
): number {
  if (!metadata) {
    return 0
  }

  const priceMap = priceData.get(tokenPriceMapKey(metadata))
  return priceMap ? getPriceAtTimestamp(priceMap, timestamp) : 0
}

function getEventPps(ppsMap: Map<number, number> | undefined, timestamp: number): number | null {
  return ppsMap ? getPPS(ppsMap, timestamp) : null
}

function addReceipt(
  ledger: TProtocolReturnLedger,
  args: {
    shares: bigint
    baselineUnderlying: number
    receiptTimestamp: number
    receiptPriceUsd: number
    receiptKind: TProtocolReturnReceiptKind
    transactionHash: string
  }
): TProtocolReturnLedger {
  if (args.shares <= ZERO) {
    return ledger
  }

  return {
    ...ledger,
    lots: [
      ...ledger.lots,
      {
        shares: args.shares,
        baselineUnderlying: args.baselineUnderlying,
        receiptTimestamp: args.receiptTimestamp,
        receiptPriceUsd: args.receiptPriceUsd,
        receiptPriceMissing: args.receiptPriceUsd <= 0,
        receiptKind: args.receiptKind,
        transactionHash: args.transactionHash
      }
    ],
    baselineUnderlying: ledger.baselineUnderlying + args.baselineUnderlying,
    receiptCount: ledger.receiptCount + 1,
    deposits: ledger.deposits + (args.receiptKind === 'deposit' ? 1 : 0),
    transfersIn: ledger.transfersIn + (args.receiptKind === 'transfer_in' ? 1 : 0),
    missingReceiptPrice: ledger.missingReceiptPrice || args.receiptPriceUsd <= 0
  }
}

function getOutstandingBaselineUnderlying(lots: TProtocolReturnLot[]): number {
  return lots.reduce((total, lot) => total + lot.baselineUnderlying, 0)
}

function getOutstandingBaselineWeightUsd(lots: TProtocolReturnLot[]): number {
  return lots.reduce((total, lot) => total + lot.baselineUnderlying * lot.receiptPriceUsd, 0)
}

function accrueLedgerExposure(ledger: TProtocolReturnLedger, nextTimestamp: number): TProtocolReturnLedger {
  if (ledger.lastAccruedTimestamp === null) {
    return {
      ...ledger,
      lastAccruedTimestamp: nextTimestamp
    }
  }

  const elapsedSeconds = Math.max(0, nextTimestamp - ledger.lastAccruedTimestamp)
  if (elapsedSeconds === 0) {
    return ledger
  }

  return {
    ...ledger,
    baselineExposureUnderlyingSeconds:
      ledger.baselineExposureUnderlyingSeconds + getOutstandingBaselineUnderlying(ledger.lots) * elapsedSeconds,
    baselineExposureWeightUsdSeconds:
      ledger.baselineExposureWeightUsdSeconds + getOutstandingBaselineWeightUsd(ledger.lots) * elapsedSeconds,
    lastAccruedTimestamp: nextTimestamp
  }
}

function splitLot(lot: TProtocolReturnLot, shares: bigint): TProtocolReturnConsumedLot {
  return {
    shares,
    baselineUnderlying: scaleNumber(lot.baselineUnderlying, shares, lot.shares),
    receiptTimestamp: lot.receiptTimestamp,
    receiptPriceUsd: lot.receiptPriceUsd,
    receiptPriceMissing: lot.receiptPriceMissing
  }
}

function consumeLots(
  lots: TProtocolReturnLot[],
  shares: bigint
): {
  consumedLots: TProtocolReturnConsumedLot[]
  remainingLots: TProtocolReturnLot[]
  consumedShares: bigint
} {
  const consumed = lots.reduce<{
    sharesToConsume: bigint
    consumedLots: TProtocolReturnConsumedLot[]
    remainingLots: TProtocolReturnLot[]
    consumedShares: bigint
  }>(
    (state, lot) => {
      if (state.sharesToConsume <= ZERO) {
        state.remainingLots.push(lot)
        return state
      }

      if (lot.shares <= state.sharesToConsume) {
        state.sharesToConsume -= lot.shares
        state.consumedLots.push({
          shares: lot.shares,
          baselineUnderlying: lot.baselineUnderlying,
          receiptTimestamp: lot.receiptTimestamp,
          receiptPriceUsd: lot.receiptPriceUsd,
          receiptPriceMissing: lot.receiptPriceMissing
        })
        state.consumedShares += lot.shares
        return state
      }

      const remainingShares = lot.shares - state.sharesToConsume
      const consumedLot = splitLot(lot, state.sharesToConsume)
      const remainingLot: TProtocolReturnLot = {
        ...lot,
        shares: remainingShares,
        baselineUnderlying: scaleNumber(lot.baselineUnderlying, remainingShares, lot.shares)
      }

      state.sharesToConsume = ZERO
      state.consumedLots.push(consumedLot)
      state.remainingLots.push(remainingLot)
      state.consumedShares += consumedLot.shares
      return state
    },
    {
      sharesToConsume: shares,
      consumedLots: [],
      remainingLots: [],
      consumedShares: ZERO
    }
  )

  return {
    consumedLots: consumed.consumedLots,
    remainingLots: consumed.remainingLots,
    consumedShares: consumed.consumedShares
  }
}

function addExit(
  ledger: TProtocolReturnLedger,
  args: {
    shares: bigint
    exitUnderlying: number
    exitKind: TProtocolReturnExitKind
  }
): TProtocolReturnLedger {
  if (args.shares <= ZERO) {
    return ledger
  }

  const consumed = consumeLots(ledger.lots, args.shares)
  const matchedExitUnderlying = scaleNumber(args.exitUnderlying, consumed.consumedShares, args.shares)
  const consumedBaselineUnderlying = consumed.consumedLots.reduce((total, lot) => total + lot.baselineUnderlying, 0)
  const consumedBaselineWeightUsd = consumed.consumedLots.reduce(
    (total, lot) => total + lot.baselineUnderlying * lot.receiptPriceUsd,
    0
  )
  const consumedExitWeightUsd = consumed.consumedLots.reduce(
    (total, lot) =>
      total + scaleNumber(matchedExitUnderlying, lot.shares, consumed.consumedShares) * lot.receiptPriceUsd,
    0
  )
  const unmatchedExitShares = args.shares - consumed.consumedShares

  return {
    ...ledger,
    lots: consumed.remainingLots,
    realizedBaselineUnderlying: ledger.realizedBaselineUnderlying + consumedBaselineUnderlying,
    realizedGrowthUnderlying: ledger.realizedGrowthUnderlying + (matchedExitUnderlying - consumedBaselineUnderlying),
    realizedBaselineWeightUsd: ledger.realizedBaselineWeightUsd + consumedBaselineWeightUsd,
    realizedGrowthWeightUsd: ledger.realizedGrowthWeightUsd + (consumedExitWeightUsd - consumedBaselineWeightUsd),
    unmatchedExitShares: ledger.unmatchedExitShares + unmatchedExitShares,
    unmatchedExitCount: ledger.unmatchedExitCount + (unmatchedExitShares > ZERO ? 1 : 0),
    exitCount: ledger.exitCount + 1,
    withdrawals: ledger.withdrawals + (args.exitKind === 'withdrawal' ? 1 : 0),
    transfersOut: ledger.transfersOut + (args.exitKind === 'transfer_out' ? 1 : 0)
  }
}

function eventSortKey(event: TRawPnlEvent): string {
  return [
    String(event.blockTimestamp).padStart(12, '0'),
    String(event.blockNumber).padStart(12, '0'),
    String(event.logIndex).padStart(8, '0'),
    event.id
  ].join(':')
}

function sortEvents(events: TRawPnlEvent[]): TRawPnlEvent[] {
  return [...events].sort((a, b) => eventSortKey(a).localeCompare(eventSortKey(b)))
}

function processEvent(
  ledgers: Map<string, TProtocolReturnLedger>,
  event: TRawPnlEvent,
  args: {
    userAddress: string
    metadata: Map<string, VaultMetadata>
    ppsData: Map<string, Map<number, number>>
    priceData: Map<string, Map<number, number>>
  }
): Map<string, TProtocolReturnLedger> {
  const vaultKey = toVaultKey(event.chainId, event.familyVaultAddress)
  const metadata = args.metadata.get(vaultKey)
  const assetDecimals = metadata?.token.decimals ?? 18
  const shareDecimals = metadata?.decimals ?? 18
  const ppsMap = args.ppsData.get(vaultKey)
  const currentLedger = accrueLedgerExposure(
    ledgers.get(vaultKey) ?? emptyLedger(event.chainId, event.familyVaultAddress),
    event.blockTimestamp
  )
  const receiptPriceUsd = getReceiptPriceUsd(metadata, args.priceData, event.blockTimestamp)

  if (event.kind === 'deposit') {
    ledgers.set(
      vaultKey,
      addReceipt(currentLedger, {
        shares: event.shares,
        baselineUnderlying: formatAmount(event.assets, assetDecimals),
        receiptTimestamp: event.blockTimestamp,
        receiptPriceUsd,
        receiptKind: 'deposit',
        transactionHash: event.transactionHash
      })
    )
    return ledgers
  }

  if (event.kind === 'withdrawal') {
    ledgers.set(
      vaultKey,
      addExit(currentLedger, {
        shares: event.shares,
        exitUnderlying: formatAmount(event.assets, assetDecimals),
        exitKind: 'withdrawal'
      })
    )
    return ledgers
  }

  if (event.sender === args.userAddress && event.receiver === args.userAddress) {
    return ledgers
  }

  if (event.receiver === args.userAddress) {
    const pps = getEventPps(ppsMap, event.blockTimestamp)
    const ledger = pps === null ? { ...currentLedger, missingPps: true } : currentLedger
    ledgers.set(
      vaultKey,
      addReceipt(ledger, {
        shares: event.shares,
        baselineUnderlying: pps === null ? 0 : formatAmount(event.shares, shareDecimals) * pps,
        receiptTimestamp: event.blockTimestamp,
        receiptPriceUsd,
        receiptKind: 'transfer_in',
        transactionHash: event.transactionHash
      })
    )
    return ledgers
  }

  if (event.sender === args.userAddress) {
    const pps = getEventPps(ppsMap, event.blockTimestamp)
    const ledger = pps === null ? { ...currentLedger, missingPps: true } : currentLedger
    ledgers.set(
      vaultKey,
      addExit(ledger, {
        shares: event.shares,
        exitUnderlying: pps === null ? 0 : formatAmount(event.shares, shareDecimals) * pps,
        exitKind: 'transfer_out'
      })
    )
    return ledgers
  }

  return ledgers
}

export function buildProtocolReturnLedgers(args: {
  events: TRawPnlEvent[]
  userAddress: string
  metadata: Map<string, VaultMetadata>
  ppsData: Map<string, Map<number, number>>
  priceData: Map<string, Map<number, number>>
  currentTimestamp?: number
}): Map<string, TProtocolReturnLedger> {
  const userAddress = lowerCaseAddress(args.userAddress)
  const ledgers = sortEvents(args.events).reduce(
    (ledgers, event) =>
      processEvent(ledgers, event, {
        userAddress,
        metadata: args.metadata,
        ppsData: args.ppsData,
        priceData: args.priceData
      }),
    new Map<string, TProtocolReturnLedger>()
  )

  const finalTimestamp =
    args.currentTimestamp ??
    sortEvents(args.events).reduce((maxTimestamp, event) => Math.max(maxTimestamp, event.blockTimestamp), 0)

  return Array.from(ledgers.entries()).reduce<Map<string, TProtocolReturnLedger>>((finalLedgers, [key, ledger]) => {
    finalLedgers.set(key, accrueLedgerExposure(ledger, finalTimestamp))
    return finalLedgers
  }, new Map())
}

function ledgerIssues(args: {
  ledger: TProtocolReturnLedger
  metadata: VaultMetadata | undefined
  currentPps: number | null
}): TProtocolReturnIssue[] {
  return [
    ...(args.metadata ? [] : (['missing_metadata'] as const)),
    ...(args.ledger.missingPps || args.currentPps === null ? (['missing_pps'] as const) : []),
    ...(args.ledger.missingReceiptPrice ? (['missing_receipt_price'] as const) : []),
    ...(args.ledger.unmatchedExitShares > ZERO ? (['unmatched_exit'] as const) : [])
  ]
}

function vaultStatus(issues: TProtocolReturnIssue[]): THoldingsPnLSimpleStatus {
  if (issues.includes('missing_metadata')) {
    return 'missing_metadata'
  }

  if (issues.includes('missing_pps')) {
    return 'missing_pps'
  }

  if (issues.includes('missing_receipt_price')) {
    return 'missing_receipt_price'
  }

  return issues.includes('unmatched_exit') ? 'partial' : 'ok'
}

export function materializeProtocolReturnVaults(args: {
  ledgers: Map<string, TProtocolReturnLedger>
  metadata: Map<string, VaultMetadata>
  ppsData: Map<string, Map<number, number>>
  currentTimestamp: number
}): HoldingsPnLSimpleVault[] {
  return Array.from(args.ledgers.values()).map((ledger) => {
    const vaultKey = toVaultKey(ledger.chainId, ledger.vaultAddress)
    const metadata = args.metadata.get(vaultKey)
    const shareDecimals = metadata?.decimals ?? 18
    const ppsMap = args.ppsData.get(vaultKey)
    const currentPps = ppsMap ? getPPS(ppsMap, args.currentTimestamp) : null
    const currentShares = ledger.lots.reduce((total, lot) => total + lot.shares, ZERO)
    const sharesFormatted = formatAmount(currentShares, shareDecimals)
    const currentUnderlying = currentPps === null ? 0 : sharesFormatted * currentPps
    const unrealizedBaselineUnderlying = ledger.lots.reduce((total, lot) => total + lot.baselineUnderlying, 0)
    const unrealizedBaselineWeightUsd = ledger.lots.reduce(
      (total, lot) => total + lot.baselineUnderlying * lot.receiptPriceUsd,
      0
    )
    const currentWeightUsd = ledger.lots.reduce(
      (total, lot) => total + scaleNumber(currentUnderlying, lot.shares, currentShares) * lot.receiptPriceUsd,
      0
    )
    const unrealizedGrowthUnderlying = currentUnderlying - unrealizedBaselineUnderlying
    const unrealizedGrowthWeightUsd = currentWeightUsd - unrealizedBaselineWeightUsd
    const baselineExposureUnderlyingYears = ledger.baselineExposureUnderlyingSeconds / SECONDS_PER_YEAR
    const baselineExposureWeightUsdYears = ledger.baselineExposureWeightUsdSeconds / SECONDS_PER_YEAR
    const baselineWeightUsd = ledger.realizedBaselineWeightUsd + unrealizedBaselineWeightUsd
    const growthWeightUsd = ledger.realizedGrowthWeightUsd + unrealizedGrowthWeightUsd
    const issues = ledgerIssues({ ledger, metadata, currentPps })
    const status = vaultStatus(issues)

    return {
      chainId: ledger.chainId,
      vaultAddress: ledger.vaultAddress,
      status,
      issues,
      shares: currentShares.toString(),
      sharesFormatted,
      pricePerShare: currentPps ?? 0,
      currentUnderlying,
      baselineUnderlying: ledger.realizedBaselineUnderlying + unrealizedBaselineUnderlying,
      baselineExposureUnderlyingYears,
      baselineExposureWeightUsdYears,
      realizedBaselineUnderlying: ledger.realizedBaselineUnderlying,
      unrealizedBaselineUnderlying,
      realizedGrowthUnderlying: ledger.realizedGrowthUnderlying,
      unrealizedGrowthUnderlying,
      growthUnderlying: ledger.realizedGrowthUnderlying + unrealizedGrowthUnderlying,
      baselineWeightUsd,
      growthWeightUsd,
      realizedGrowthWeightUsd: ledger.realizedGrowthWeightUsd,
      unrealizedGrowthWeightUsd,
      protocolReturnPct: protocolReturnPct(growthWeightUsd, baselineWeightUsd),
      annualizedProtocolReturnPct: annualizedProtocolReturnPct(growthWeightUsd, baselineExposureWeightUsdYears),
      receiptCount: ledger.receiptCount,
      exitCount: ledger.exitCount,
      deposits: ledger.deposits,
      withdrawals: ledger.withdrawals,
      transfersIn: ledger.transfersIn,
      transfersOut: ledger.transfersOut,
      unmatchedExitShares: ledger.unmatchedExitShares.toString(),
      unmatchedExitSharesFormatted: formatAmount(ledger.unmatchedExitShares, shareDecimals),
      metadata: {
        symbol: metadata?.token.symbol ?? null,
        decimals: metadata?.decimals ?? 18,
        assetDecimals: metadata?.token.decimals ?? 18,
        tokenAddress: metadata?.token.address ?? null
      }
    }
  })
}

function buildSummary(vaults: HoldingsPnLSimpleVault[]): HoldingsPnLSimpleResponse['summary'] {
  const baselineWeightUsd = vaults.reduce((total, vault) => total + vault.baselineWeightUsd, 0)
  const growthWeightUsd = vaults.reduce((total, vault) => total + vault.growthWeightUsd, 0)
  const baselineExposureWeightUsdYears = vaults.reduce(
    (total, vault) => total + vault.baselineExposureWeightUsdYears,
    0
  )
  const realizedGrowthWeightUsd = vaults.reduce((total, vault) => total + vault.realizedGrowthWeightUsd, 0)
  const unrealizedGrowthWeightUsd = vaults.reduce((total, vault) => total + vault.unrealizedGrowthWeightUsd, 0)
  const completeVaults = vaults.filter((vault) => vault.status === 'ok').length
  const partialVaults = vaults.length - completeVaults

  return {
    totalVaults: vaults.length,
    completeVaults,
    partialVaults,
    baselineWeightUsd,
    growthWeightUsd,
    baselineExposureWeightUsdYears,
    realizedGrowthWeightUsd,
    unrealizedGrowthWeightUsd,
    protocolReturnPct: protocolReturnPct(growthWeightUsd, baselineWeightUsd),
    annualizedProtocolReturnPct: annualizedProtocolReturnPct(growthWeightUsd, baselineExposureWeightUsdYears),
    isComplete: partialVaults === 0
  }
}

export async function getHoldingsPnLSimple(
  userAddress: string,
  version: VaultVersion = 'all',
  fetchType: HoldingsEventFetchType = 'seq',
  paginationMode: HoldingsEventPaginationMode = 'paged'
): Promise<HoldingsPnLSimpleResponse> {
  debugLog('pnl-simple', 'starting holdings simple pnl calculation', { version, fetchType, paginationMode })
  const addressEvents = await fetchUserEvents(userAddress, 'all', undefined, fetchType, paginationMode)
  const rawEvents = buildRawPnlEvents({
    addressEvents,
    transactionEvents: {
      deposits: [],
      withdrawals: [],
      transfers: []
    }
  })
  const rawVaultIdentifiers = getVaultIdentifiers(rawEvents)
  const resolvedVaultMetadata = await fetchMultipleVaultsMetadata(rawVaultIdentifiers)
  const filteredEvents = filterEventsByAuthoritativeVersion(rawEvents, resolvedVaultMetadata, version)
  const filteredVaultIdentifiers = getVaultIdentifiers(filteredEvents)
  const vaultMetadata = filteredVaultIdentifiers.reduce<Map<string, VaultMetadata>>((filtered, vault) => {
    const key = toVaultKey(vault.chainId, vault.vaultAddress)
    const metadata = resolvedVaultMetadata.get(key)

    if (metadata) {
      filtered.set(key, metadata)
    }

    return filtered
  }, new Map())
  const currentTimestamp = Math.floor(Date.now() / 1000)

  debugLog('pnl-simple', 'loaded address-scoped events', {
    version,
    addressDeposits: addressEvents.deposits.length,
    addressWithdrawals: addressEvents.withdrawals.length,
    addressTransfersIn: addressEvents.transfersIn.length,
    addressTransfersOut: addressEvents.transfersOut.length,
    rawEvents: rawEvents.length,
    filteredEvents: filteredEvents.length,
    vaults: filteredVaultIdentifiers.length
  })

  if (filteredEvents.length === 0 || filteredVaultIdentifiers.length === 0) {
    return {
      address: lowerCaseAddress(userAddress),
      version,
      generatedAt: new Date().toISOString(),
      summary: buildSummary([]),
      vaults: []
    }
  }

  const receiptPriceRequests = buildReceiptPriceRequests({
    events: filteredEvents,
    metadata: vaultMetadata,
    userAddress,
    currentTimestamp
  })
  const uniqueReceiptPriceTimestamps = new Set(receiptPriceRequests.flatMap((request) => request.timestamps))

  debugLog('pnl-simple', 'prepared targeted receipt price requests', {
    tokens: receiptPriceRequests.length,
    uniqueTimestamps: uniqueReceiptPriceTimestamps.size,
    pricePoints: countReceiptPricePoints(receiptPriceRequests),
    bucketSeconds: RECEIPT_PRICE_BUCKET_SECONDS,
    fetchConcurrency: RECEIPT_PRICE_FETCH_CONCURRENCY
  })

  const [ppsData, priceData] = await Promise.all([
    fetchMultipleVaultsPPS(filteredVaultIdentifiers),
    fetchReceiptPrices(receiptPriceRequests)
  ])
  const ledgers = buildProtocolReturnLedgers({
    events: filteredEvents,
    userAddress,
    metadata: vaultMetadata,
    ppsData,
    priceData,
    currentTimestamp
  })
  const vaults = materializeProtocolReturnVaults({
    ledgers,
    metadata: vaultMetadata,
    ppsData,
    currentTimestamp
  }).sort((a, b) => b.baselineWeightUsd - a.baselineWeightUsd)
  const summary = buildSummary(vaults)

  debugLog('pnl-simple', 'completed holdings simple pnl calculation', {
    version,
    totalVaults: summary.totalVaults,
    baselineWeightUsd: summary.baselineWeightUsd,
    growthWeightUsd: summary.growthWeightUsd,
    protocolReturnPct: summary.protocolReturnPct,
    isComplete: summary.isComplete
  })

  return {
    address: lowerCaseAddress(userAddress),
    version,
    generatedAt: new Date().toISOString(),
    summary,
    vaults
  }
}
