import { formatUnits } from 'viem'
import type { VaultMetadata } from '../types'
import { debugError, debugLog } from './debug'
import {
  fetchHistoricalPricesForTokenTimestamps,
  getChainPrefix,
  getPriceAtTimestamp,
  type THistoricalPriceRequest
} from './defillama'
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

type TProtocolReturnIssue = 'missing_metadata' | 'missing_pps' | 'missing_token_price' | 'unmatched_exit'

type TProtocolReturnReceiptKind = 'deposit' | 'transfer_in'
type TProtocolReturnExitKind = 'withdrawal' | 'transfer_out'

const RECEIPT_PRICE_BUCKET_SECONDS = 24 * 60 * 60

type TProtocolReturnLot = {
  shares: bigint
  baselineUnderlying: number
  basisUsd: number
  receiptTimestamp: number
  receiptPriceUsd: number
  receiptKind: TProtocolReturnReceiptKind
  transactionHash: string
}

type TProtocolReturnConsumedLot = {
  shares: bigint
  baselineUnderlying: number
  basisUsd: number
  receiptTimestamp: number
  receiptPriceUsd: number
}

type TProtocolReturnLedger = {
  chainId: number
  vaultAddress: string
  lots: TProtocolReturnLot[]
  baselineUnderlying: number
  realizedBaselineUnderlying: number
  realizedGrowthUnderlying: number
  realizedBaselineWeightUsd: number
  realizedGrowthWeightUsd: number
  realizedBasisUsd: number
  realizedExitValueUsd: number
  realizedPricePnlUsd: number
  unmatchedExitShares: bigint
  unmatchedExitCount: number
  receiptCount: number
  exitCount: number
  deposits: number
  withdrawals: number
  transfersIn: number
  transfersOut: number
  missingPps: boolean
  missingTokenPrice: boolean
}

export type TSimpleReceiptPriceRequest = THistoricalPriceRequest

export type THoldingsPnLSimpleStatus = 'ok' | 'missing_metadata' | 'missing_pps' | 'missing_token_price' | 'partial'

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
  realizedBaselineUnderlying: number
  unrealizedBaselineUnderlying: number
  realizedGrowthUnderlying: number
  unrealizedGrowthUnderlying: number
  growthUnderlying: number
  baselineWeightUsd: number
  growthWeightUsd: number
  realizedGrowthWeightUsd: number
  unrealizedGrowthWeightUsd: number
  protocolReturnUsd: number
  protocolReturnPct: number | null
  currentValueUsd: number
  estimatedBasisUsd: number
  realizedBasisUsd: number
  unrealizedBasisUsd: number
  realizedExitValueUsd: number
  realizedPricePnlUsd: number
  unrealizedPricePnlUsd: number
  priceBasedPnlUsd: number
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
    realizedGrowthWeightUsd: number
    unrealizedGrowthWeightUsd: number
    protocolReturnUsd: number
    protocolReturnPct: number | null
    totalCurrentValueUsd: number
    estimatedBasisUsd: number
    realizedExitValueUsd: number
    realizedPricePnlUsd: number
    unrealizedPricePnlUsd: number
    priceBasedPnlUsd: number
    isComplete: boolean
  }
  vaults: HoldingsPnLSimpleVault[]
}

function emptyLedger(chainId: number, vaultAddress: string): TProtocolReturnLedger {
  return {
    chainId,
    vaultAddress,
    lots: [],
    baselineUnderlying: 0,
    realizedBaselineUnderlying: 0,
    realizedGrowthUnderlying: 0,
    realizedBaselineWeightUsd: 0,
    realizedGrowthWeightUsd: 0,
    realizedBasisUsd: 0,
    realizedExitValueUsd: 0,
    realizedPricePnlUsd: 0,
    unmatchedExitShares: ZERO,
    unmatchedExitCount: 0,
    receiptCount: 0,
    exitCount: 0,
    deposits: 0,
    withdrawals: 0,
    transfersIn: 0,
    transfersOut: 0,
    missingPps: false,
    missingTokenPrice: false
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

function getReceiptPriceBucketTimestamps(timestamp: number, currentTimestamp: number): number[] {
  const dayStart = Math.floor(timestamp / RECEIPT_PRICE_BUCKET_SECONDS) * RECEIPT_PRICE_BUCKET_SECONDS
  const nextDayStart = dayStart + RECEIPT_PRICE_BUCKET_SECONDS

  return [dayStart, ...(nextDayStart <= currentTimestamp ? [nextDayStart] : [])]
}

function isReceiptEvent(event: TRawPnlEvent, userAddress: string): boolean {
  return event.kind === 'deposit' || (event.kind === 'transfer' && event.receiver === userAddress)
}

function isExitEvent(event: TRawPnlEvent, userAddress: string): boolean {
  return event.kind === 'withdrawal' || (event.kind === 'transfer' && event.sender === userAddress)
}

type TPriceRequestDraft = {
  chainId: number
  address: string
  timestamps: Set<number>
  uncachedTimestamps: Set<number>
}

function addTokenPriceRequest(
  requests: Map<string, TPriceRequestDraft>,
  metadata: VaultMetadata,
  timestamps: number[],
  uncachedTimestamps: number[] = []
): void {
  const tokenKey = tokenPriceMapKey(metadata)
  const request = requests.get(tokenKey) ?? {
    chainId: metadata.chainId,
    address: metadata.token.address,
    timestamps: new Set<number>(),
    uncachedTimestamps: new Set<number>()
  }

  timestamps.forEach((timestamp) => {
    request.timestamps.add(timestamp)
  })
  uncachedTimestamps.forEach((timestamp) => {
    request.timestamps.add(timestamp)
    request.uncachedTimestamps.add(timestamp)
  })
  requests.set(tokenKey, request)
}

function materializeTokenPriceRequests(requests: Map<string, TPriceRequestDraft>): TSimpleReceiptPriceRequest[] {
  return Array.from(requests.values()).map((request) => {
    const uncachedTimestamps = Array.from(request.uncachedTimestamps).sort((a, b) => a - b)

    return {
      chainId: request.chainId,
      address: request.address,
      timestamps: Array.from(request.timestamps).sort((a, b) => a - b),
      ...(uncachedTimestamps.length > 0 ? { uncachedTimestamps } : {})
    }
  })
}

export function buildReceiptPriceRequests(args: {
  events: TRawPnlEvent[]
  metadata: Map<string, VaultMetadata>
  userAddress: string
  currentTimestamp: number
}): TSimpleReceiptPriceRequest[] {
  const userAddress = lowerCaseAddress(args.userAddress)
  const requests = args.events
    .filter((event) => isReceiptEvent(event, userAddress))
    .reduce<Map<string, TPriceRequestDraft>>((priceRequests, event) => {
      const metadata = args.metadata.get(toVaultKey(event.chainId, event.familyVaultAddress))

      if (!metadata) {
        return priceRequests
      }

      addTokenPriceRequest(
        priceRequests,
        metadata,
        getReceiptPriceBucketTimestamps(event.blockTimestamp, args.currentTimestamp)
      )
      return priceRequests
    }, new Map())

  return materializeTokenPriceRequests(requests)
}

function buildSimplePriceRequests(args: {
  events: TRawPnlEvent[]
  metadata: Map<string, VaultMetadata>
  userAddress: string
  currentTimestamp: number
}): TSimpleReceiptPriceRequest[] {
  const userAddress = lowerCaseAddress(args.userAddress)
  const requests = args.events.reduce<Map<string, TPriceRequestDraft>>((priceRequests, event) => {
    const metadata = args.metadata.get(toVaultKey(event.chainId, event.familyVaultAddress))

    if (!metadata) {
      return priceRequests
    }

    if (isReceiptEvent(event, userAddress) || isExitEvent(event, userAddress)) {
      addTokenPriceRequest(
        priceRequests,
        metadata,
        getReceiptPriceBucketTimestamps(event.blockTimestamp, args.currentTimestamp)
      )
    }

    return priceRequests
  }, new Map())

  args.metadata.forEach((metadata) => {
    addTokenPriceRequest(requests, metadata, [], [args.currentTimestamp])
  })

  return materializeTokenPriceRequests(requests)
}

function countTokenPricePoints(requests: TSimpleReceiptPriceRequest[]): number {
  return requests.reduce((total, request) => total + request.timestamps.length, 0)
}

async function fetchTokenPrices(requests: TSimpleReceiptPriceRequest[]): Promise<Map<string, Map<number, number>>> {
  if (requests.length === 0) {
    return new Map()
  }

  try {
    return await fetchHistoricalPricesForTokenTimestamps(requests)
  } catch (error) {
    debugError('pnl-simple', 'token price request failed, continuing with missing token price', error, {
      tokens: requests.length,
      pricePoints: countTokenPricePoints(requests)
    })
    return new Map()
  }
}

function getTokenPriceUsd(
  metadata: VaultMetadata | undefined,
  priceData: Map<string, Map<number, number>>,
  timestamp: number,
  currentTimestamp?: number
): number {
  if (!metadata) {
    return 0
  }

  const priceMap = priceData.get(tokenPriceMapKey(metadata))
  if (!priceMap) {
    return 0
  }

  if (currentTimestamp !== undefined && timestamp !== currentTimestamp && priceMap.has(currentTimestamp)) {
    const historicalPrices = new Map(
      Array.from(priceMap.entries()).filter(([priceTimestamp]) => priceTimestamp !== currentTimestamp)
    )
    return getPriceAtTimestamp(historicalPrices, timestamp)
  }

  return getPriceAtTimestamp(priceMap, timestamp)
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
        basisUsd: args.baselineUnderlying * args.receiptPriceUsd,
        receiptTimestamp: args.receiptTimestamp,
        receiptPriceUsd: args.receiptPriceUsd,
        receiptKind: args.receiptKind,
        transactionHash: args.transactionHash
      }
    ],
    baselineUnderlying: ledger.baselineUnderlying + args.baselineUnderlying,
    receiptCount: ledger.receiptCount + 1,
    deposits: ledger.deposits + (args.receiptKind === 'deposit' ? 1 : 0),
    transfersIn: ledger.transfersIn + (args.receiptKind === 'transfer_in' ? 1 : 0),
    missingTokenPrice: ledger.missingTokenPrice || args.receiptPriceUsd <= 0
  }
}

function splitLot(lot: TProtocolReturnLot, shares: bigint): TProtocolReturnConsumedLot {
  return {
    shares,
    baselineUnderlying: scaleNumber(lot.baselineUnderlying, shares, lot.shares),
    basisUsd: scaleNumber(lot.basisUsd, shares, lot.shares),
    receiptTimestamp: lot.receiptTimestamp,
    receiptPriceUsd: lot.receiptPriceUsd
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
          basisUsd: lot.basisUsd,
          receiptTimestamp: lot.receiptTimestamp,
          receiptPriceUsd: lot.receiptPriceUsd
        })
        state.consumedShares += lot.shares
        return state
      }

      const remainingShares = lot.shares - state.sharesToConsume
      const consumedLot = splitLot(lot, state.sharesToConsume)
      const remainingLot: TProtocolReturnLot = {
        ...lot,
        shares: remainingShares,
        baselineUnderlying: scaleNumber(lot.baselineUnderlying, remainingShares, lot.shares),
        basisUsd: scaleNumber(lot.basisUsd, remainingShares, lot.shares)
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
    exitPriceUsd: number
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
  const consumedBasisUsd = consumed.consumedLots.reduce((total, lot) => total + lot.basisUsd, 0)
  const consumedExitWeightUsd = consumed.consumedLots.reduce(
    (total, lot) =>
      total + scaleNumber(matchedExitUnderlying, lot.shares, consumed.consumedShares) * lot.receiptPriceUsd,
    0
  )
  const matchedExitValueUsd = matchedExitUnderlying * args.exitPriceUsd
  const unmatchedExitShares = args.shares - consumed.consumedShares

  return {
    ...ledger,
    lots: consumed.remainingLots,
    realizedBaselineUnderlying: ledger.realizedBaselineUnderlying + consumedBaselineUnderlying,
    realizedGrowthUnderlying: ledger.realizedGrowthUnderlying + (matchedExitUnderlying - consumedBaselineUnderlying),
    realizedBaselineWeightUsd: ledger.realizedBaselineWeightUsd + consumedBaselineWeightUsd,
    realizedGrowthWeightUsd: ledger.realizedGrowthWeightUsd + (consumedExitWeightUsd - consumedBaselineWeightUsd),
    realizedBasisUsd: ledger.realizedBasisUsd + consumedBasisUsd,
    realizedExitValueUsd: ledger.realizedExitValueUsd + matchedExitValueUsd,
    realizedPricePnlUsd: ledger.realizedPricePnlUsd + (matchedExitValueUsd - consumedBasisUsd),
    unmatchedExitShares: ledger.unmatchedExitShares + unmatchedExitShares,
    unmatchedExitCount: ledger.unmatchedExitCount + (unmatchedExitShares > ZERO ? 1 : 0),
    exitCount: ledger.exitCount + 1,
    withdrawals: ledger.withdrawals + (args.exitKind === 'withdrawal' ? 1 : 0),
    transfersOut: ledger.transfersOut + (args.exitKind === 'transfer_out' ? 1 : 0),
    missingTokenPrice: ledger.missingTokenPrice || args.exitPriceUsd <= 0
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
    currentTimestamp?: number
  }
): Map<string, TProtocolReturnLedger> {
  const vaultKey = toVaultKey(event.chainId, event.familyVaultAddress)
  const metadata = args.metadata.get(vaultKey)
  const assetDecimals = metadata?.token.decimals ?? 18
  const shareDecimals = metadata?.decimals ?? 18
  const ppsMap = args.ppsData.get(vaultKey)
  const currentLedger = ledgers.get(vaultKey) ?? emptyLedger(event.chainId, event.familyVaultAddress)
  const eventTokenPriceUsd = getTokenPriceUsd(metadata, args.priceData, event.blockTimestamp, args.currentTimestamp)

  if (event.kind === 'deposit') {
    ledgers.set(
      vaultKey,
      addReceipt(currentLedger, {
        shares: event.shares,
        baselineUnderlying: formatAmount(event.assets, assetDecimals),
        receiptTimestamp: event.blockTimestamp,
        receiptPriceUsd: eventTokenPriceUsd,
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
        exitPriceUsd: eventTokenPriceUsd,
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
        receiptPriceUsd: eventTokenPriceUsd,
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
        exitPriceUsd: eventTokenPriceUsd,
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
  return sortEvents(args.events).reduce(
    (ledgers, event) =>
      processEvent(ledgers, event, {
        userAddress,
        metadata: args.metadata,
        ppsData: args.ppsData,
        priceData: args.priceData,
        currentTimestamp: args.currentTimestamp
      }),
    new Map<string, TProtocolReturnLedger>()
  )
}

function ledgerIssues(args: {
  ledger: TProtocolReturnLedger
  metadata: VaultMetadata | undefined
  currentPps: number | null
  currentTokenPriceUsd: number
  currentShares: bigint
}): TProtocolReturnIssue[] {
  return [
    ...(args.metadata ? [] : (['missing_metadata'] as const)),
    ...(args.ledger.missingPps || args.currentPps === null ? (['missing_pps'] as const) : []),
    ...(args.ledger.missingTokenPrice || (args.currentShares > ZERO && args.currentTokenPriceUsd <= 0)
      ? (['missing_token_price'] as const)
      : []),
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

  if (issues.includes('missing_token_price')) {
    return 'missing_token_price'
  }

  return issues.includes('unmatched_exit') ? 'partial' : 'ok'
}

export function materializeProtocolReturnVaults(args: {
  ledgers: Map<string, TProtocolReturnLedger>
  metadata: Map<string, VaultMetadata>
  ppsData: Map<string, Map<number, number>>
  priceData: Map<string, Map<number, number>>
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
    const currentTokenPriceUsd = getTokenPriceUsd(metadata, args.priceData, args.currentTimestamp)
    const currentValueUsd = currentUnderlying * currentTokenPriceUsd
    const unrealizedBaselineUnderlying = ledger.lots.reduce((total, lot) => total + lot.baselineUnderlying, 0)
    const unrealizedBaselineWeightUsd = ledger.lots.reduce(
      (total, lot) => total + lot.baselineUnderlying * lot.receiptPriceUsd,
      0
    )
    const unrealizedBasisUsd = ledger.lots.reduce((total, lot) => total + lot.basisUsd, 0)
    const currentWeightUsd = ledger.lots.reduce(
      (total, lot) => total + scaleNumber(currentUnderlying, lot.shares, currentShares) * lot.receiptPriceUsd,
      0
    )
    const unrealizedGrowthUnderlying = currentUnderlying - unrealizedBaselineUnderlying
    const unrealizedGrowthWeightUsd = currentWeightUsd - unrealizedBaselineWeightUsd
    const baselineWeightUsd = ledger.realizedBaselineWeightUsd + unrealizedBaselineWeightUsd
    const growthWeightUsd = ledger.realizedGrowthWeightUsd + unrealizedGrowthWeightUsd
    const unrealizedPricePnlUsd = currentValueUsd - unrealizedBasisUsd
    const priceBasedPnlUsd = ledger.realizedPricePnlUsd + unrealizedPricePnlUsd
    const issues = ledgerIssues({ ledger, metadata, currentPps, currentTokenPriceUsd, currentShares })
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
      realizedBaselineUnderlying: ledger.realizedBaselineUnderlying,
      unrealizedBaselineUnderlying,
      realizedGrowthUnderlying: ledger.realizedGrowthUnderlying,
      unrealizedGrowthUnderlying,
      growthUnderlying: ledger.realizedGrowthUnderlying + unrealizedGrowthUnderlying,
      baselineWeightUsd,
      growthWeightUsd,
      realizedGrowthWeightUsd: ledger.realizedGrowthWeightUsd,
      unrealizedGrowthWeightUsd,
      protocolReturnUsd: growthWeightUsd,
      protocolReturnPct: protocolReturnPct(growthWeightUsd, baselineWeightUsd),
      currentValueUsd,
      estimatedBasisUsd: ledger.realizedBasisUsd + unrealizedBasisUsd,
      realizedBasisUsd: ledger.realizedBasisUsd,
      unrealizedBasisUsd,
      realizedExitValueUsd: ledger.realizedExitValueUsd,
      realizedPricePnlUsd: ledger.realizedPricePnlUsd,
      unrealizedPricePnlUsd,
      priceBasedPnlUsd,
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
  const realizedGrowthWeightUsd = vaults.reduce((total, vault) => total + vault.realizedGrowthWeightUsd, 0)
  const unrealizedGrowthWeightUsd = vaults.reduce((total, vault) => total + vault.unrealizedGrowthWeightUsd, 0)
  const totalCurrentValueUsd = vaults.reduce((total, vault) => total + vault.currentValueUsd, 0)
  const estimatedBasisUsd = vaults.reduce((total, vault) => total + vault.estimatedBasisUsd, 0)
  const realizedExitValueUsd = vaults.reduce((total, vault) => total + vault.realizedExitValueUsd, 0)
  const realizedPricePnlUsd = vaults.reduce((total, vault) => total + vault.realizedPricePnlUsd, 0)
  const unrealizedPricePnlUsd = vaults.reduce((total, vault) => total + vault.unrealizedPricePnlUsd, 0)
  const priceBasedPnlUsd = vaults.reduce((total, vault) => total + vault.priceBasedPnlUsd, 0)
  const completeVaults = vaults.filter((vault) => vault.status === 'ok').length
  const partialVaults = vaults.length - completeVaults

  return {
    totalVaults: vaults.length,
    completeVaults,
    partialVaults,
    baselineWeightUsd,
    growthWeightUsd,
    realizedGrowthWeightUsd,
    unrealizedGrowthWeightUsd,
    protocolReturnUsd: growthWeightUsd,
    protocolReturnPct: protocolReturnPct(growthWeightUsd, baselineWeightUsd),
    totalCurrentValueUsd,
    estimatedBasisUsd,
    realizedExitValueUsd,
    realizedPricePnlUsd,
    unrealizedPricePnlUsd,
    priceBasedPnlUsd,
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

  const priceRequests = buildSimplePriceRequests({
    events: filteredEvents,
    metadata: vaultMetadata,
    userAddress,
    currentTimestamp
  })
  const uniquePriceTimestamps = new Set(priceRequests.flatMap((request) => request.timestamps))

  debugLog('pnl-simple', 'prepared targeted token price requests', {
    tokens: priceRequests.length,
    uniqueTimestamps: uniquePriceTimestamps.size,
    pricePoints: countTokenPricePoints(priceRequests),
    bucketSeconds: RECEIPT_PRICE_BUCKET_SECONDS
  })

  const [ppsData, priceData] = await Promise.all([
    fetchMultipleVaultsPPS(filteredVaultIdentifiers),
    fetchTokenPrices(priceRequests)
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
    priceData,
    currentTimestamp
  }).sort((a, b) => b.baselineWeightUsd - a.baselineWeightUsd)
  const summary = buildSummary(vaults)

  debugLog('pnl-simple', 'completed holdings simple pnl calculation', {
    version,
    totalVaults: summary.totalVaults,
    baselineWeightUsd: summary.baselineWeightUsd,
    growthWeightUsd: summary.growthWeightUsd,
    priceBasedPnlUsd: summary.priceBasedPnlUsd,
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
