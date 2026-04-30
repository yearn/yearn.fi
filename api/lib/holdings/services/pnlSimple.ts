import { formatUnits } from 'viem'
import { config } from '../config'
import type { VaultMetadata } from '../types'
import { debugError, debugLog } from './debug'
import {
  fetchHistoricalPricesForTokenTimestamps,
  getChainPrefix,
  getPriceAtTimestamp,
  type THistoricalPriceRequest
} from './defillama'
import {
  fetchActivityEventsByTransactionHashes,
  fetchRawUserPnlEvents,
  type HoldingsEventFetchType,
  type HoldingsEventPaginationMode,
  type VaultVersion
} from './graphql'
import {
  generateDailyTimestamps,
  generateDailyTimestampsFromRange,
  timestampToDateString,
  toSettledDayTimestamp
} from './holdings'
import { fetchMultipleVaultsPPS, getPPS } from './kong'
import {
  deriveNestedVaultAssetPriceData,
  expandNestedVaultAssetPriceRequests,
  getNestedVaultPpsIdentifiersFromPriceRequests,
  mergeVaultIdentifiers
} from './nestedVaultPrices'
import { buildRawPnlEvents, mergeAddressScopedRawPnlEventsWithTransactionActivity } from './pnl'
import { lowerCaseAddress, toVaultKey, ZERO } from './pnlShared'
import type { TRawPnlEvent } from './pnlTypes'
import {
  filterEventsByAuthoritativeVersion,
  getSettledVersionedPpsContext,
  getVaultIdentifiers,
  resolveNestedVaultAssetMetadata
} from './settledHoldingsContext'
import { getStakingVaultAddress } from './staking'
import { fetchMultipleVaultsMetadata } from './vaults'

type TProtocolReturnIssue = 'missing_metadata' | 'missing_pps' | 'missing_receipt_price' | 'unmatched_exit'

type TProtocolReturnReceiptKind = 'deposit' | 'transfer_in'
type TProtocolReturnExitKind = 'withdrawal' | 'transfer_out'

const RECEIPT_PRICE_BUCKET_SECONDS = 24 * 60 * 60
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'
const ETHEREUM_WETH_ADDRESS = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'
const ETHEREUM_WETH_PRICE_KEY = `${getChainPrefix(1)}:${ETHEREUM_WETH_ADDRESS.toLowerCase()}`
const ETH_FAMILY_SYMBOLS = new Set([
  'ETH',
  'WETH',
  'STETH',
  'WSTETH',
  'RETH',
  'FRXETH',
  'SFRXETH',
  'EETH',
  'WEETH',
  'EZETH',
  'METH',
  'MSETH'
])

type TProtocolReturnLot = {
  shares: bigint
  baselineUnderlying: number
  receiptTimestamp: number
  receiptPriceUsd: number
  receiptPriceEth: number
  receiptPriceMissing: boolean
  receiptPriceEthMissing: boolean
  receiptKind: TProtocolReturnReceiptKind
  transactionHash: string
}

type TProtocolReturnConsumedLot = {
  shares: bigint
  baselineUnderlying: number
  receiptTimestamp: number
  receiptPriceUsd: number
  receiptPriceEth: number
  receiptPriceMissing: boolean
  receiptPriceEthMissing: boolean
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
  realizedGrowthWeightEth: number
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
  missingReceiptEthPrice: boolean
  lastAccruedTimestamp: number | null
}

export type TSimpleReceiptPriceRequest = THistoricalPriceRequest

export type THoldingsPnLSimpleStatus = 'ok' | 'missing_metadata' | 'missing_pps' | 'missing_receipt_price' | 'partial'
export type TGrowthDisplay = 'usd' | 'eth' | 'index'
export type TGrowthDisplayReason = 'stable_dominant' | 'eth_dominant' | 'mixed'

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

export interface HoldingsPnLSimpleHistoryPoint {
  date: string
  timestamp: number
  growthWeightUsd: number
  growthWeightEth: number | null
  protocolReturnPct: number | null
  annualizedProtocolReturnPct: number | null
  growthIndex: number | null
  currentUnderlying?: number
  growthUnderlying?: number
  sharesFormatted?: number
  pricePerShare?: number
}

export interface HoldingsPnLSimpleHistoryFamilyPoint {
  date: string
  timestamp: number
  protocolReturnPct: number | null
  growthWeightUsd: number | null
  growthIndex: number | null
}

export interface HoldingsPnLSimpleHistoryFamilySeries {
  chainId: number
  vaultAddress: string
  symbol: string | null
  status: THoldingsPnLSimpleStatus
  dataPoints: HoldingsPnLSimpleHistoryFamilyPoint[]
}

export interface HoldingsPnLSimpleHistoryResponse {
  address: string
  version: VaultVersion
  timeframe: '1y' | 'all'
  generatedAt: string
  summary: {
    totalVaults: number
    completeVaults: number
    partialVaults: number
    recommendedGrowthDisplay: TGrowthDisplay
    recommendedGrowthDisplayReason: TGrowthDisplayReason
    openBaselineCompositionUsd: {
      stable: number
      ethFamily: number
      other: number
    }
    isComplete: boolean
  }
  dataPoints: HoldingsPnLSimpleHistoryPoint[]
  familySeries: HoldingsPnLSimpleHistoryFamilySeries[]
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
    realizedGrowthWeightEth: 0,
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
    missingReceiptEthPrice: false,
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

function advanceGrowthIndex(args: {
  previousIndex: number | null
  deltaGrowthWeightUsd: number
  deltaExposureWeightUsdYears: number
  deltaSeconds: number
  hasCapital: boolean
}): number | null {
  if (args.previousIndex === null) {
    return args.hasCapital ? 100 : null
  }

  if (args.deltaExposureWeightUsdYears <= 0 || args.deltaSeconds <= 0) {
    return args.previousIndex
  }

  const intervalYears = args.deltaSeconds / SECONDS_PER_YEAR
  if (intervalYears <= 0) {
    return args.previousIndex
  }

  const intervalReturn = (args.deltaGrowthWeightUsd * intervalYears) / args.deltaExposureWeightUsdYears
  const nextIndex = args.previousIndex * (1 + intervalReturn)
  return Number.isFinite(nextIndex) ? nextIndex : args.previousIndex
}

function normalizeTokenSymbol(symbol: string | null | undefined): string {
  return String(symbol ?? '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
}

function isEthFamilyMetadata(metadata: VaultMetadata | undefined): boolean {
  if (!metadata || metadata.category === 'stable') {
    return false
  }

  return ETH_FAMILY_SYMBOLS.has(normalizeTokenSymbol(metadata.token.symbol))
}

function classifyOpenBaselineBucket(metadata: VaultMetadata | undefined): 'stable' | 'ethFamily' | 'other' {
  if (metadata?.category === 'stable') {
    return 'stable'
  }

  if (isEthFamilyMetadata(metadata)) {
    return 'ethFamily'
  }

  return 'other'
}

function resolveRecommendedGrowthDisplay(composition: { stable: number; ethFamily: number; other: number }): {
  recommendedGrowthDisplay: TGrowthDisplay
  recommendedGrowthDisplayReason: TGrowthDisplayReason
} {
  const total = composition.stable + composition.ethFamily + composition.other

  if (total <= 0) {
    return {
      recommendedGrowthDisplay: 'index',
      recommendedGrowthDisplayReason: 'mixed'
    }
  }

  if (composition.stable / total >= 0.9) {
    return {
      recommendedGrowthDisplay: 'usd',
      recommendedGrowthDisplayReason: 'stable_dominant'
    }
  }

  if (composition.ethFamily / total >= 0.9) {
    return {
      recommendedGrowthDisplay: 'eth',
      recommendedGrowthDisplayReason: 'eth_dominant'
    }
  }

  return {
    recommendedGrowthDisplay: 'index',
    recommendedGrowthDisplayReason: 'mixed'
  }
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

async function fetchReceiptPrices(requests: TSimpleReceiptPriceRequest[]): Promise<Map<string, Map<number, number>>> {
  if (requests.length === 0) {
    return new Map()
  }

  try {
    return await fetchHistoricalPricesForTokenTimestamps(requests, { resolution: 'utc_day' })
  } catch (error) {
    debugError('pnl-simple', 'receipt price fetch failed, continuing with missing receipt prices', error, {
      tokens: requests.length,
      pricePoints: countReceiptPricePoints(requests)
    })
    return new Map()
  }
}

async function fetchEthReceiptPrices(timestamps: number[]): Promise<Map<number, number>> {
  if (timestamps.length === 0) {
    return new Map()
  }

  try {
    const priceData = await fetchHistoricalPricesForTokenTimestamps(
      [{ chainId: 1, address: ETHEREUM_WETH_ADDRESS, timestamps }],
      { resolution: 'utc_day' }
    )
    return priceData.get(ETHEREUM_WETH_PRICE_KEY) ?? new Map()
  } catch (error) {
    debugError('pnl-simple', 'eth receipt price fetch failed, continuing with missing eth receipt price', error, {
      timestamps: timestamps.length
    })
    return new Map()
  }
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

function getReceiptPriceEth(ethPriceData: Map<number, number>, receiptPriceUsd: number, timestamp: number): number {
  if (receiptPriceUsd <= 0) {
    return 0
  }

  const ethPriceUsd = getPriceAtTimestamp(ethPriceData, timestamp)
  return ethPriceUsd > 0 ? receiptPriceUsd / ethPriceUsd : 0
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
    receiptPriceEth: number
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
        receiptPriceEth: args.receiptPriceEth,
        receiptPriceMissing: args.receiptPriceUsd <= 0,
        receiptPriceEthMissing: args.receiptPriceEth <= 0,
        receiptKind: args.receiptKind,
        transactionHash: args.transactionHash
      }
    ],
    baselineUnderlying: ledger.baselineUnderlying + args.baselineUnderlying,
    receiptCount: ledger.receiptCount + 1,
    deposits: ledger.deposits + (args.receiptKind === 'deposit' ? 1 : 0),
    transfersIn: ledger.transfersIn + (args.receiptKind === 'transfer_in' ? 1 : 0),
    missingReceiptPrice: ledger.missingReceiptPrice || args.receiptPriceUsd <= 0,
    missingReceiptEthPrice: ledger.missingReceiptEthPrice || args.receiptPriceEth <= 0
  }
}

function getOutstandingBaselineUnderlying(lots: TProtocolReturnLot[]): number {
  return lots.reduce((total, lot) => total + lot.baselineUnderlying, 0)
}

function getOutstandingBaselineWeightUsd(lots: TProtocolReturnLot[]): number {
  return lots.reduce((total, lot) => total + lot.baselineUnderlying * lot.receiptPriceUsd, 0)
}

function getOutstandingBaselineWeightEth(lots: TProtocolReturnLot[]): number {
  return lots.reduce((total, lot) => total + lot.baselineUnderlying * lot.receiptPriceEth, 0)
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
    receiptPriceEth: lot.receiptPriceEth,
    receiptPriceMissing: lot.receiptPriceMissing,
    receiptPriceEthMissing: lot.receiptPriceEthMissing
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
          receiptPriceEth: lot.receiptPriceEth,
          receiptPriceMissing: lot.receiptPriceMissing,
          receiptPriceEthMissing: lot.receiptPriceEthMissing
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
  const consumedExitWeightEth = consumed.consumedLots.reduce(
    (total, lot) =>
      total + scaleNumber(matchedExitUnderlying, lot.shares, consumed.consumedShares) * lot.receiptPriceEth,
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
    realizedGrowthWeightEth:
      ledger.realizedGrowthWeightEth +
      (consumedExitWeightEth -
        consumed.consumedLots.reduce((total, lot) => total + lot.baselineUnderlying * lot.receiptPriceEth, 0)),
    unmatchedExitShares: ledger.unmatchedExitShares + unmatchedExitShares,
    unmatchedExitCount: ledger.unmatchedExitCount + (unmatchedExitShares > ZERO ? 1 : 0),
    exitCount: ledger.exitCount + 1,
    withdrawals: ledger.withdrawals + (args.exitKind === 'withdrawal' ? 1 : 0),
    transfersOut: ledger.transfersOut + (args.exitKind === 'transfer_out' ? 1 : 0),
    missingReceiptEthPrice:
      ledger.missingReceiptEthPrice || consumed.consumedLots.some((lot) => lot.receiptPriceEthMissing)
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
    ethPriceData: Map<number, number>
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

  if (event.kind === 'deposit') {
    const receiptPriceUsd = getReceiptPriceUsd(metadata, args.priceData, event.blockTimestamp)
    const receiptPriceEth = getReceiptPriceEth(args.ethPriceData, receiptPriceUsd, event.blockTimestamp)
    ledgers.set(
      vaultKey,
      addReceipt(currentLedger, {
        shares: event.shares,
        baselineUnderlying: formatAmount(event.assets, assetDecimals),
        receiptTimestamp: event.blockTimestamp,
        receiptPriceUsd,
        receiptPriceEth,
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
    ledgers.set(vaultKey, currentLedger)
    return ledgers
  }

  const pps = getEventPps(ppsMap, event.blockTimestamp)
  if (pps === null) {
    ledgers.set(vaultKey, { ...currentLedger, missingPps: true })
    return ledgers
  }

  if (event.receiver === args.userAddress) {
    const receiptPriceUsd = getReceiptPriceUsd(metadata, args.priceData, event.blockTimestamp)
    const receiptPriceEth = getReceiptPriceEth(args.ethPriceData, receiptPriceUsd, event.blockTimestamp)
    ledgers.set(
      vaultKey,
      addReceipt(currentLedger, {
        shares: event.shares,
        baselineUnderlying: formatAmount(event.shares, shareDecimals) * pps,
        receiptTimestamp: event.blockTimestamp,
        receiptPriceUsd,
        receiptPriceEth,
        receiptKind: 'transfer_in',
        transactionHash: event.transactionHash
      })
    )
    return ledgers
  }

  if (event.sender === args.userAddress) {
    ledgers.set(
      vaultKey,
      addExit(currentLedger, {
        shares: event.shares,
        exitUnderlying: formatAmount(event.shares, shareDecimals) * pps,
        exitKind: 'transfer_out'
      })
    )
    return ledgers
  }

  ledgers.set(vaultKey, currentLedger)
  return ledgers
}

function groupEventsByTransaction(events: TRawPnlEvent[]): TRawPnlEvent[][] {
  return Array.from(
    sortEvents(events).reduce<Map<string, TRawPnlEvent[]>>((grouped, event) => {
      const transactionKey = `${event.chainId}:${event.transactionHash}`
      const bucket = grouped.get(transactionKey) ?? []
      bucket.push(event)
      grouped.set(transactionKey, bucket)
      return grouped
    }, new Map())
  ).map(([, txEvents]) => txEvents)
}

function groupTransactionEventsByFamily(txEvents: TRawPnlEvent[]): TRawPnlEvent[][] {
  return Array.from(
    txEvents.reduce<Map<string, TRawPnlEvent[]>>((grouped, event) => {
      const familyKey = toVaultKey(event.chainId, event.familyVaultAddress)
      const bucket = grouped.get(familyKey) ?? []
      bucket.push(event)
      grouped.set(familyKey, bucket)
      return grouped
    }, new Map())
  ).map(([, familyEvents]) => familyEvents)
}

function minBigInt(left: bigint, right: bigint): bigint {
  return left < right ? left : right
}

function scaleBigInt(value: bigint, numerator: bigint, denominator: bigint): bigint {
  if (value <= ZERO || numerator <= ZERO || denominator <= ZERO) {
    return ZERO
  }

  return (value * numerator) / denominator
}

function cloneEventWithShares(event: TRawPnlEvent, shares: bigint): TRawPnlEvent {
  if (event.kind === 'deposit' || event.kind === 'withdrawal') {
    return {
      ...event,
      shares,
      assets: scaleBigInt(event.assets, shares, event.shares)
    }
  }

  return {
    ...event,
    shares
  }
}

function cloneEventWithAdjustedAssets(
  event: Extract<TRawPnlEvent, { kind: 'deposit' | 'withdrawal' }>,
  assets: bigint,
  idSuffix: string
): TRawPnlEvent {
  return {
    ...event,
    id: `${event.id}:${idSuffix}`,
    assets
  }
}

function splitAssetValuedEvent(
  event: Extract<TRawPnlEvent, { kind: 'deposit' | 'withdrawal' }>,
  matchedShares: bigint,
  matchedAssets: bigint,
  idPrefix: string
): TRawPnlEvent[] {
  if (matchedShares <= ZERO || matchedAssets <= ZERO) {
    return [event]
  }

  if (matchedShares >= event.shares) {
    return [cloneEventWithAdjustedAssets(event, matchedAssets, `${idPrefix}-matched`)]
  }

  const remainderShares = event.shares - matchedShares
  return [
    {
      ...cloneEventWithShares(event, matchedShares),
      id: `${event.id}:${idPrefix}-matched`,
      assets: matchedAssets
    },
    {
      ...cloneEventWithShares(event, remainderShares),
      id: `${event.id}:${idPrefix}-remainder`
    }
  ]
}

function allocateAssetPoolAcrossEvents(
  events: Array<Extract<TRawPnlEvent, { kind: 'deposit' | 'withdrawal' }>>,
  totalMatchedShares: bigint,
  totalMatchedAssets: bigint,
  idPrefix: string
): TRawPnlEvent[] {
  if (events.length === 0 || totalMatchedShares <= ZERO || totalMatchedAssets <= ZERO) {
    return events
  }

  let remainingMatchedShares = totalMatchedShares
  let remainingMatchedAssets = totalMatchedAssets

  return events.flatMap((event, index) => {
    if (remainingMatchedShares <= ZERO || remainingMatchedAssets <= ZERO) {
      return [event]
    }

    const matchedShares = minBigInt(event.shares, remainingMatchedShares)
    if (matchedShares <= ZERO) {
      return [event]
    }

    const matchedAssets =
      index === events.length - 1 || matchedShares === remainingMatchedShares
        ? remainingMatchedAssets
        : scaleBigInt(remainingMatchedAssets, matchedShares, remainingMatchedShares)

    remainingMatchedShares -= matchedShares
    remainingMatchedAssets -= matchedAssets

    return splitAssetValuedEvent(event, matchedShares, matchedAssets, idPrefix)
  })
}

function splitTransferIntoWithdrawalEvents(
  event: Extract<TRawPnlEvent, { kind: 'transfer' }>,
  matchedShares: bigint,
  matchedAssets: bigint,
  idPrefix: string,
  userAddress: string
): TRawPnlEvent[] {
  if (matchedShares <= ZERO || matchedAssets <= ZERO) {
    return [event]
  }

  const matchedWithdrawal: Extract<TRawPnlEvent, { kind: 'withdrawal' }> = {
    kind: 'withdrawal',
    id: `${event.id}:${idPrefix}-matched`,
    chainId: event.chainId,
    vaultAddress: event.vaultAddress,
    familyVaultAddress: event.familyVaultAddress,
    isStakingVault: event.isStakingVault,
    blockNumber: event.blockNumber,
    blockTimestamp: event.blockTimestamp,
    logIndex: event.logIndex,
    transactionHash: event.transactionHash,
    transactionFrom: event.transactionFrom,
    owner: userAddress,
    shares: matchedShares,
    assets: matchedAssets,
    scopes: event.scopes
  }

  if (matchedShares >= event.shares) {
    return [matchedWithdrawal]
  }

  return [
    matchedWithdrawal,
    {
      ...cloneEventWithShares(event, event.shares - matchedShares),
      id: `${event.id}:${idPrefix}-remainder`
    }
  ]
}

function allocateWithdrawalPoolAcrossTransferEvents(
  events: Array<Extract<TRawPnlEvent, { kind: 'transfer' }>>,
  totalMatchedShares: bigint,
  totalMatchedAssets: bigint,
  idPrefix: string,
  userAddress: string
): TRawPnlEvent[] {
  if (events.length === 0 || totalMatchedShares <= ZERO || totalMatchedAssets <= ZERO) {
    return events
  }

  let remainingMatchedShares = totalMatchedShares
  let remainingMatchedAssets = totalMatchedAssets

  return events.flatMap((event, index) => {
    if (remainingMatchedShares <= ZERO || remainingMatchedAssets <= ZERO) {
      return [event]
    }

    const matchedShares = minBigInt(event.shares, remainingMatchedShares)
    if (matchedShares <= ZERO) {
      return [event]
    }

    const matchedAssets =
      index === events.length - 1 || matchedShares === remainingMatchedShares
        ? remainingMatchedAssets
        : scaleBigInt(remainingMatchedAssets, matchedShares, remainingMatchedShares)

    remainingMatchedShares -= matchedShares
    remainingMatchedAssets -= matchedAssets

    return splitTransferIntoWithdrawalEvents(event, matchedShares, matchedAssets, idPrefix, userAddress)
  })
}

function buildEffectiveSimpleFamilyEvents(txFamilyEvents: TRawPnlEvent[], userAddress: string): TRawPnlEvent[] {
  const firstEvent = txFamilyEvents[0]
  if (!firstEvent) {
    return []
  }

  const stakingVaultAddress = getStakingVaultAddress(firstEvent.chainId, firstEvent.familyVaultAddress)
  const normalizedUserAddress = lowerCaseAddress(userAddress)
  let addressEvents = sortEvents(txFamilyEvents.filter((event) => event.scopes.address))

  const addressScopedMintTransfers = addressEvents.filter(
    (event): event is Extract<TRawPnlEvent, { kind: 'transfer' }> =>
      event.kind === 'transfer' &&
      lowerCaseAddress(event.sender) === ZERO_ADDRESS &&
      lowerCaseAddress(event.receiver) === normalizedUserAddress &&
      lowerCaseAddress(event.vaultAddress) === lowerCaseAddress(firstEvent.familyVaultAddress)
  )
  const sameVaultDeposits = txFamilyEvents.filter(
    (event): event is Extract<TRawPnlEvent, { kind: 'deposit' }> =>
      event.kind === 'deposit' &&
      lowerCaseAddress(event.vaultAddress) === lowerCaseAddress(firstEvent.familyVaultAddress)
  )
  const matchedDirectDepositShares = minBigInt(
    addressScopedMintTransfers.reduce((total, event) => total + event.shares, ZERO),
    sameVaultDeposits.reduce((total, event) => total + event.shares, ZERO)
  )

  addressEvents = stripMatchedShares(
    addressEvents,
    (event) =>
      event.kind === 'transfer' &&
      lowerCaseAddress(event.sender) === ZERO_ADDRESS &&
      lowerCaseAddress(event.receiver) === normalizedUserAddress &&
      lowerCaseAddress(event.vaultAddress) === lowerCaseAddress(firstEvent.familyVaultAddress),
    matchedDirectDepositShares
  )

  const addressScopedBurnTransfers = addressEvents.filter(
    (event): event is Extract<TRawPnlEvent, { kind: 'transfer' }> =>
      event.kind === 'transfer' &&
      lowerCaseAddress(event.sender) === normalizedUserAddress &&
      lowerCaseAddress(event.receiver) === ZERO_ADDRESS &&
      lowerCaseAddress(event.vaultAddress) === lowerCaseAddress(firstEvent.familyVaultAddress)
  )
  const sameVaultWithdrawals = txFamilyEvents.filter(
    (event): event is Extract<TRawPnlEvent, { kind: 'withdrawal' }> =>
      event.kind === 'withdrawal' &&
      lowerCaseAddress(event.vaultAddress) === lowerCaseAddress(firstEvent.familyVaultAddress)
  )
  const matchedDirectWithdrawalShares = minBigInt(
    addressScopedBurnTransfers.reduce((total, event) => total + event.shares, ZERO),
    sameVaultWithdrawals.reduce((total, event) => total + event.shares, ZERO)
  )

  addressEvents = stripMatchedShares(
    addressEvents,
    (event) =>
      event.kind === 'transfer' &&
      lowerCaseAddress(event.sender) === normalizedUserAddress &&
      lowerCaseAddress(event.receiver) === ZERO_ADDRESS &&
      lowerCaseAddress(event.vaultAddress) === lowerCaseAddress(firstEvent.familyVaultAddress),
    matchedDirectWithdrawalShares
  )

  const addressScopedTransferOuts = addressEvents.filter(
    (event): event is Extract<TRawPnlEvent, { kind: 'transfer' }> =>
      event.kind === 'transfer' &&
      lowerCaseAddress(event.sender) === normalizedUserAddress &&
      lowerCaseAddress(event.receiver) !== normalizedUserAddress
  )
  const txScopedUnderlyingWithdrawals = txFamilyEvents.filter(
    (event): event is Extract<TRawPnlEvent, { kind: 'withdrawal' }> =>
      event.kind === 'withdrawal' &&
      !event.isStakingVault &&
      !event.scopes.address &&
      lowerCaseAddress(event.vaultAddress) === lowerCaseAddress(firstEvent.familyVaultAddress)
  )
  const matchedIntermediaryExitShares = minBigInt(
    addressScopedTransferOuts.reduce((total, event) => total + event.shares, ZERO),
    txScopedUnderlyingWithdrawals.reduce((total, event) => total + event.shares, ZERO)
  )
  const matchedIntermediaryExitAssets = scaleBigInt(
    txScopedUnderlyingWithdrawals.reduce((total, event) => total + event.assets, ZERO),
    matchedIntermediaryExitShares,
    txScopedUnderlyingWithdrawals.reduce((total, event) => total + event.shares, ZERO)
  )

  if (matchedIntermediaryExitShares > ZERO && matchedIntermediaryExitAssets > ZERO) {
    const adjustedTransferOutIds = new Set(addressScopedTransferOuts.map((event) => event.id))
    const adjustedExits = allocateWithdrawalPoolAcrossTransferEvents(
      addressScopedTransferOuts,
      matchedIntermediaryExitShares,
      matchedIntermediaryExitAssets,
      'intermediary-exit',
      normalizedUserAddress
    )

    addressEvents = sortEvents([
      ...addressEvents.filter((event) => !adjustedTransferOutIds.has(event.id)),
      ...adjustedExits
    ])
  }

  if (!stakingVaultAddress) {
    return addressEvents
  }

  const addressScopedStakingMintTransfers = addressEvents.filter(
    (event): event is Extract<TRawPnlEvent, { kind: 'transfer' }> =>
      event.kind === 'transfer' &&
      event.isStakingVault &&
      lowerCaseAddress(event.sender) === ZERO_ADDRESS &&
      lowerCaseAddress(event.receiver) === normalizedUserAddress &&
      lowerCaseAddress(event.vaultAddress) === stakingVaultAddress
  )
  const addressScopedStakingDepositReceipts = addressEvents.filter(
    (event): event is Extract<TRawPnlEvent, { kind: 'deposit' }> =>
      event.kind === 'deposit' &&
      event.isStakingVault &&
      lowerCaseAddress(event.vaultAddress) === stakingVaultAddress &&
      lowerCaseAddress(event.owner) === normalizedUserAddress
  )
  const matchedStakingDepositMintShares = minBigInt(
    addressScopedStakingMintTransfers.reduce((total, event) => total + event.shares, ZERO),
    addressScopedStakingDepositReceipts.reduce((total, event) => total + event.shares, ZERO)
  )

  addressEvents = stripMatchedShares(
    addressEvents,
    (event) =>
      event.kind === 'transfer' &&
      event.isStakingVault &&
      lowerCaseAddress(event.sender) === ZERO_ADDRESS &&
      lowerCaseAddress(event.receiver) === normalizedUserAddress &&
      lowerCaseAddress(event.vaultAddress) === stakingVaultAddress,
    matchedStakingDepositMintShares
  )

  const addressScopedStakingBurnTransfers = addressEvents.filter(
    (event): event is Extract<TRawPnlEvent, { kind: 'transfer' }> =>
      event.kind === 'transfer' &&
      event.isStakingVault &&
      lowerCaseAddress(event.sender) === normalizedUserAddress &&
      lowerCaseAddress(event.receiver) === ZERO_ADDRESS &&
      lowerCaseAddress(event.vaultAddress) === stakingVaultAddress
  )
  const addressScopedStakingWithdrawalReceipts = addressEvents.filter(
    (event): event is Extract<TRawPnlEvent, { kind: 'withdrawal' }> =>
      event.kind === 'withdrawal' &&
      event.isStakingVault &&
      lowerCaseAddress(event.vaultAddress) === stakingVaultAddress &&
      lowerCaseAddress(event.owner) === normalizedUserAddress
  )
  const matchedStakingWithdrawalBurnShares = minBigInt(
    addressScopedStakingBurnTransfers.reduce((total, event) => total + event.shares, ZERO),
    addressScopedStakingWithdrawalReceipts.reduce((total, event) => total + event.shares, ZERO)
  )

  addressEvents = stripMatchedShares(
    addressEvents,
    (event) =>
      event.kind === 'transfer' &&
      event.isStakingVault &&
      lowerCaseAddress(event.sender) === normalizedUserAddress &&
      lowerCaseAddress(event.receiver) === ZERO_ADDRESS &&
      lowerCaseAddress(event.vaultAddress) === stakingVaultAddress,
    matchedStakingWithdrawalBurnShares
  )

  const underlyingDeposits = txFamilyEvents.filter(
    (event): event is Extract<TRawPnlEvent, { kind: 'deposit' }> =>
      event.kind === 'deposit' &&
      !event.isStakingVault &&
      lowerCaseAddress(event.vaultAddress) === lowerCaseAddress(firstEvent.familyVaultAddress)
  )
  const underlyingWithdrawals = txFamilyEvents.filter(
    (event): event is Extract<TRawPnlEvent, { kind: 'withdrawal' }> =>
      event.kind === 'withdrawal' &&
      !event.isStakingVault &&
      lowerCaseAddress(event.vaultAddress) === lowerCaseAddress(firstEvent.familyVaultAddress)
  )
  const underlyingTransfersToStaking = txFamilyEvents.filter(
    (event): event is Extract<TRawPnlEvent, { kind: 'transfer' }> =>
      event.kind === 'transfer' &&
      !event.isStakingVault &&
      lowerCaseAddress(event.vaultAddress) === lowerCaseAddress(firstEvent.familyVaultAddress) &&
      lowerCaseAddress(event.receiver) === stakingVaultAddress
  )
  const underlyingTransfersFromStaking = txFamilyEvents.filter(
    (event): event is Extract<TRawPnlEvent, { kind: 'transfer' }> =>
      event.kind === 'transfer' &&
      !event.isStakingVault &&
      lowerCaseAddress(event.vaultAddress) === lowerCaseAddress(firstEvent.familyVaultAddress) &&
      lowerCaseAddress(event.sender) === stakingVaultAddress
  )
  const addressScopedStakingDeposits = addressEvents.filter(
    (event): event is Extract<TRawPnlEvent, { kind: 'deposit' }> =>
      event.kind === 'deposit' &&
      event.isStakingVault &&
      lowerCaseAddress(event.vaultAddress) === stakingVaultAddress &&
      lowerCaseAddress(event.owner) === normalizedUserAddress
  )
  const addressScopedStakingWithdrawals = addressEvents.filter(
    (event): event is Extract<TRawPnlEvent, { kind: 'withdrawal' }> =>
      event.kind === 'withdrawal' &&
      event.isStakingVault &&
      lowerCaseAddress(event.vaultAddress) === stakingVaultAddress &&
      lowerCaseAddress(event.owner) === normalizedUserAddress
  )

  const matchedStakeShares = minBigInt(
    addressScopedStakingDeposits.reduce((total, event) => total + event.shares, ZERO),
    minBigInt(
      underlyingTransfersToStaking.reduce((total, event) => total + event.shares, ZERO),
      underlyingDeposits.reduce((total, event) => total + event.shares, ZERO)
    )
  )
  const matchedStakeAssets = scaleBigInt(
    underlyingDeposits.reduce((total, event) => total + event.assets, ZERO),
    matchedStakeShares,
    underlyingDeposits.reduce((total, event) => total + event.shares, ZERO)
  )

  if (matchedStakeShares > ZERO && matchedStakeAssets > ZERO) {
    const adjustedDepositIds = new Set(addressScopedStakingDeposits.map((event) => event.id))
    const adjustedDeposits = allocateAssetPoolAcrossEvents(
      addressScopedStakingDeposits,
      matchedStakeShares,
      matchedStakeAssets,
      'stake-basis'
    )

    addressEvents = sortEvents([
      ...addressEvents.filter((event) => !adjustedDepositIds.has(event.id)),
      ...adjustedDeposits
    ])
  }

  const matchedUnstakeShares = minBigInt(
    addressScopedStakingWithdrawals.reduce((total, event) => total + event.shares, ZERO),
    minBigInt(
      underlyingTransfersFromStaking.reduce((total, event) => total + event.shares, ZERO),
      underlyingWithdrawals.reduce((total, event) => total + event.shares, ZERO)
    )
  )
  const matchedUnstakeAssets = scaleBigInt(
    underlyingWithdrawals.reduce((total, event) => total + event.assets, ZERO),
    matchedUnstakeShares,
    underlyingWithdrawals.reduce((total, event) => total + event.shares, ZERO)
  )

  if (matchedUnstakeShares > ZERO && matchedUnstakeAssets > ZERO) {
    const adjustedWithdrawalIds = new Set(addressScopedStakingWithdrawals.map((event) => event.id))
    const adjustedWithdrawals = allocateAssetPoolAcrossEvents(
      addressScopedStakingWithdrawals,
      matchedUnstakeShares,
      matchedUnstakeAssets,
      'unstake-proceeds'
    )

    addressEvents = sortEvents([
      ...addressEvents.filter((event) => !adjustedWithdrawalIds.has(event.id)),
      ...adjustedWithdrawals
    ])
  }

  return addressEvents
}

function buildEffectiveSimpleEvents(events: TRawPnlEvent[], userAddress: string): TRawPnlEvent[] {
  return groupEventsByTransaction(events).flatMap((txEvents) =>
    groupTransactionEventsByFamily(txEvents).flatMap((txFamilyEvents) =>
      buildEffectiveSimpleFamilyEvents(txFamilyEvents, userAddress)
    )
  )
}

function stripMatchedShares(
  events: TRawPnlEvent[],
  matcher: (event: TRawPnlEvent) => boolean,
  sharesToStrip: bigint
): TRawPnlEvent[] {
  if (sharesToStrip <= ZERO) {
    return events
  }

  let remainingSharesToStrip = sharesToStrip

  return events.flatMap((event) => {
    if (!matcher(event) || remainingSharesToStrip <= ZERO) {
      return [event]
    }

    const strippedShares = minBigInt(event.shares, remainingSharesToStrip)
    remainingSharesToStrip -= strippedShares

    if (strippedShares === event.shares) {
      return []
    }

    return [cloneEventWithShares(event, event.shares - strippedShares)]
  })
}

function normalizeStakingWrapperEvents(txFamilyEvents: TRawPnlEvent[], userAddress: string): TRawPnlEvent[] {
  const firstEvent = txFamilyEvents[0]
  if (!firstEvent) {
    return txFamilyEvents
  }

  const familyVaultAddress = lowerCaseAddress(firstEvent.familyVaultAddress)
  const stakingVaultAddress = getStakingVaultAddress(firstEvent.chainId, firstEvent.familyVaultAddress)
  if (!stakingVaultAddress) {
    return txFamilyEvents
  }

  const normalizedUserAddress = lowerCaseAddress(userAddress)
  let remainingEvents = [...txFamilyEvents]

  const unstakeWithdrawalShares = remainingEvents.reduce(
    (total, event) =>
      event.kind === 'withdrawal' &&
      event.isStakingVault &&
      lowerCaseAddress(event.vaultAddress) === stakingVaultAddress
        ? total + event.shares
        : total,
    ZERO
  )
  const unstakeTransferInShares = remainingEvents.reduce(
    (total, event) =>
      event.kind === 'transfer' &&
      !event.isStakingVault &&
      lowerCaseAddress(event.vaultAddress) === familyVaultAddress &&
      lowerCaseAddress(event.sender) === stakingVaultAddress &&
      lowerCaseAddress(event.receiver) === normalizedUserAddress
        ? total + event.shares
        : total,
    ZERO
  )
  const matchedUnstakeShares = minBigInt(unstakeWithdrawalShares, unstakeTransferInShares)

  remainingEvents = stripMatchedShares(
    remainingEvents,
    (event) =>
      event.kind === 'withdrawal' &&
      event.isStakingVault &&
      lowerCaseAddress(event.vaultAddress) === stakingVaultAddress,
    matchedUnstakeShares
  )
  remainingEvents = stripMatchedShares(
    remainingEvents,
    (event) =>
      event.kind === 'transfer' &&
      !event.isStakingVault &&
      lowerCaseAddress(event.vaultAddress) === familyVaultAddress &&
      lowerCaseAddress(event.sender) === stakingVaultAddress &&
      lowerCaseAddress(event.receiver) === normalizedUserAddress,
    matchedUnstakeShares
  )

  const stakeTransferOutShares = remainingEvents.reduce(
    (total, event) =>
      event.kind === 'transfer' &&
      !event.isStakingVault &&
      lowerCaseAddress(event.vaultAddress) === familyVaultAddress &&
      lowerCaseAddress(event.sender) === normalizedUserAddress &&
      lowerCaseAddress(event.receiver) === stakingVaultAddress
        ? total + event.shares
        : total,
    ZERO
  )
  const stakeDepositShares = remainingEvents.reduce(
    (total, event) =>
      event.kind === 'deposit' && event.isStakingVault && lowerCaseAddress(event.vaultAddress) === stakingVaultAddress
        ? total + event.shares
        : total,
    ZERO
  )
  const matchedStakeShares = minBigInt(stakeTransferOutShares, stakeDepositShares)

  remainingEvents = stripMatchedShares(
    remainingEvents,
    (event) =>
      event.kind === 'transfer' &&
      !event.isStakingVault &&
      lowerCaseAddress(event.vaultAddress) === familyVaultAddress &&
      lowerCaseAddress(event.sender) === normalizedUserAddress &&
      lowerCaseAddress(event.receiver) === stakingVaultAddress,
    matchedStakeShares
  )
  remainingEvents = stripMatchedShares(
    remainingEvents,
    (event) =>
      event.kind === 'deposit' && event.isStakingVault && lowerCaseAddress(event.vaultAddress) === stakingVaultAddress,
    matchedStakeShares
  )

  return remainingEvents
}

function getProtocolReturnTimestamps(events: TRawPnlEvent[], timeframe: '1y' | 'all'): number[] {
  if (timeframe === '1y') {
    return generateDailyTimestamps(config.historyDays, 1).map((timestamp) => toSettledDayTimestamp(timestamp))
  }

  if (events.length === 0) {
    return []
  }

  const settledTimestamps = generateDailyTimestamps(config.historyDays, 1)
  const latestSettledTimestamp = settledTimestamps[settledTimestamps.length - 1] ?? 0
  const firstEventTimestamp = sortEvents(events)[0]?.blockTimestamp ?? latestSettledTimestamp
  return generateDailyTimestampsFromRange(firstEventTimestamp, latestSettledTimestamp).map((timestamp) =>
    toSettledDayTimestamp(timestamp)
  )
}

function buildTransactionHashesByChain(events: TRawPnlEvent[]): Map<number, string[]> {
  return events.reduce<Map<number, string[]>>((grouped, event) => {
    const transactionHash = lowerCaseAddress(event.transactionHash)
    const existing = grouped.get(event.chainId) ?? []

    if (existing.includes(transactionHash)) {
      return grouped
    }

    grouped.set(event.chainId, [...existing, transactionHash])
    return grouped
  }, new Map())
}

async function enrichSimpleHistoryRawEvents(args: {
  events: TRawPnlEvent[]
  version: VaultVersion
  maxTimestamp: number
}): Promise<TRawPnlEvent[]> {
  if (args.events.length === 0) {
    return args.events
  }

  const transactionHashesByChain = buildTransactionHashesByChain(args.events)
  const requestedTransactions = Array.from(transactionHashesByChain.values()).reduce(
    (total, transactionHashes) => total + transactionHashes.length,
    0
  )

  if (requestedTransactions === 0) {
    return args.events
  }

  const allowedFamilyKeys = new Set(args.events.map((event) => toVaultKey(event.chainId, event.familyVaultAddress)))
  const transactionEvents = await fetchActivityEventsByTransactionHashes(
    transactionHashesByChain,
    args.version,
    args.maxTimestamp
  )
  const enrichedEvents = mergeAddressScopedRawPnlEventsWithTransactionActivity(
    args.events,
    transactionEvents,
    allowedFamilyKeys
  )

  debugLog('pnl-simple-history', 'enriched simple-history raw events with same-family tx context', {
    addressEvents: args.events.length,
    enrichedEvents: enrichedEvents.length,
    requestedTransactions,
    txDeposits: transactionEvents.deposits.length,
    txWithdrawals: transactionEvents.withdrawals.length,
    txTransfers: transactionEvents.transfers.length
  })

  return enrichedEvents
}

export function buildProtocolReturnLedgers(args: {
  events: TRawPnlEvent[]
  userAddress: string
  metadata: Map<string, VaultMetadata>
  ppsData: Map<string, Map<number, number>>
  priceData: Map<string, Map<number, number>>
  ethPriceData?: Map<number, number>
  currentTimestamp?: number
}): Map<string, TProtocolReturnLedger> {
  const userAddress = lowerCaseAddress(args.userAddress)
  const effectiveEvents = buildEffectiveSimpleEvents(args.events, userAddress)
  const ledgers = groupEventsByTransaction(effectiveEvents).reduce((nextLedgers, txEvents) => {
    groupTransactionEventsByFamily(txEvents).forEach((txFamilyEvents) => {
      normalizeStakingWrapperEvents(txFamilyEvents, userAddress).forEach((event) => {
        processEvent(nextLedgers, event, {
          userAddress,
          metadata: args.metadata,
          ppsData: args.ppsData,
          priceData: args.priceData,
          ethPriceData: args.ethPriceData ?? new Map()
        })
      })
    })
    return nextLedgers
  }, new Map<string, TProtocolReturnLedger>())

  const finalTimestamp =
    args.currentTimestamp ??
    sortEvents(effectiveEvents).reduce((maxTimestamp, event) => Math.max(maxTimestamp, event.blockTimestamp), 0)

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

function computeVaultGrowthWeightEth(args: {
  ledger: TProtocolReturnLedger
  metadata: VaultMetadata | undefined
  ppsData: Map<string, Map<number, number>>
  currentTimestamp: number
}): number | null {
  if (args.ledger.missingReceiptEthPrice) {
    return null
  }

  const vaultKey = toVaultKey(args.ledger.chainId, args.ledger.vaultAddress)
  const shareDecimals = args.metadata?.decimals ?? 18
  const currentPps = getEventPps(args.ppsData.get(vaultKey), args.currentTimestamp)
  const currentShares = args.ledger.lots.reduce((total, lot) => total + lot.shares, ZERO)
  const sharesFormatted = formatAmount(currentShares, shareDecimals)
  const currentUnderlying = currentPps === null ? 0 : sharesFormatted * currentPps
  const unrealizedBaselineWeightEth = getOutstandingBaselineWeightEth(args.ledger.lots)
  const currentWeightEth = args.ledger.lots.reduce(
    (total, lot) => total + scaleNumber(currentUnderlying, lot.shares, currentShares) * lot.receiptPriceEth,
    0
  )
  const unrealizedGrowthWeightEth = currentWeightEth - unrealizedBaselineWeightEth

  return args.ledger.realizedGrowthWeightEth + unrealizedGrowthWeightEth
}

function buildGrowthWeightEthSummary(args: {
  ledgers: Map<string, TProtocolReturnLedger>
  metadata: Map<string, VaultMetadata>
  ppsData: Map<string, Map<number, number>>
  currentTimestamp: number
}): number | null {
  const perVaultGrowthWeightEth = Array.from(args.ledgers.values()).flatMap((ledger) => {
    const growthWeightEth = computeVaultGrowthWeightEth({
      ledger,
      metadata: args.metadata.get(toVaultKey(ledger.chainId, ledger.vaultAddress)),
      ppsData: args.ppsData,
      currentTimestamp: args.currentTimestamp
    })

    return growthWeightEth === null ? [] : [growthWeightEth]
  })

  return perVaultGrowthWeightEth.length > 0 ? perVaultGrowthWeightEth.reduce((total, value) => total + value, 0) : null
}

function buildOpenBaselineCompositionUsd(args: {
  ledgers: Map<string, TProtocolReturnLedger>
  metadata: Map<string, VaultMetadata>
}): {
  stable: number
  ethFamily: number
  other: number
} {
  return Array.from(args.ledgers.values()).reduce(
    (composition, ledger) => {
      const metadata = args.metadata.get(toVaultKey(ledger.chainId, ledger.vaultAddress))
      const bucket = classifyOpenBaselineBucket(metadata)
      const openBaselineWeightUsd = getOutstandingBaselineWeightUsd(ledger.lots)

      if (bucket === 'stable') {
        composition.stable += openBaselineWeightUsd
        return composition
      }

      if (bucket === 'ethFamily') {
        composition.ethFamily += openBaselineWeightUsd
        return composition
      }

      composition.other += openBaselineWeightUsd
      return composition
    },
    {
      stable: 0,
      ethFamily: 0,
      other: 0
    }
  )
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

function selectHistoryFamilies(vaults: HoldingsPnLSimpleVault[], limit = 5): HoldingsPnLSimpleVault[] {
  return vaults
    .filter((vault) => vault.baselineWeightUsd > 0 && vault.protocolReturnPct !== null)
    .sort((left, right) => right.baselineWeightUsd - left.baselineWeightUsd)
    .slice(0, limit)
}

export function buildProtocolReturnHistorySeries(args: {
  events: TRawPnlEvent[]
  userAddress: string
  metadata: Map<string, VaultMetadata>
  ppsData: Map<string, Map<number, number>>
  priceData: Map<string, Map<number, number>>
  ethPriceData?: Map<number, number>
  timestamps: number[]
  selectedVaultKey?: string
}): HoldingsPnLSimpleHistoryPoint[] {
  const userAddress = lowerCaseAddress(args.userAddress)
  const effectiveEvents = buildEffectiveSimpleEvents(args.events, userAddress)
  const groupedTransactions = groupEventsByTransaction(effectiveEvents)
  let transactionIndex = 0
  let ledgers = new Map<string, TProtocolReturnLedger>()
  let previousTimestamp: number | null = null
  let previousGrowthWeightUsd = 0
  let previousExposureWeightUsdYears = 0
  let growthIndex: number | null = null

  return args.timestamps.map((timestamp) => {
    while (
      transactionIndex < groupedTransactions.length &&
      groupedTransactions[transactionIndex]![0]!.blockTimestamp <= timestamp
    ) {
      groupTransactionEventsByFamily(groupedTransactions[transactionIndex]!).forEach((txFamilyEvents) => {
        normalizeStakingWrapperEvents(txFamilyEvents, userAddress).forEach((event) => {
          processEvent(ledgers, event, {
            userAddress,
            metadata: args.metadata,
            ppsData: args.ppsData,
            priceData: args.priceData,
            ethPriceData: args.ethPriceData ?? new Map()
          })
        })
      })
      transactionIndex += 1
    }

    ledgers = Array.from(ledgers.entries()).reduce<Map<string, TProtocolReturnLedger>>((nextLedgers, [key, ledger]) => {
      nextLedgers.set(key, accrueLedgerExposure(ledger, timestamp))
      return nextLedgers
    }, new Map())

    const vaults = materializeProtocolReturnVaults({
      ledgers,
      metadata: args.metadata,
      ppsData: args.ppsData,
      currentTimestamp: timestamp
    })
    const selectedVault = args.selectedVaultKey
      ? vaults.find((vault) => toVaultKey(vault.chainId, vault.vaultAddress) === args.selectedVaultKey)
      : null
    const summary = buildSummary(vaults)
    const growthWeightEth = buildGrowthWeightEthSummary({
      ledgers,
      metadata: args.metadata,
      ppsData: args.ppsData,
      currentTimestamp: timestamp
    })
    growthIndex = advanceGrowthIndex({
      previousIndex: growthIndex,
      deltaGrowthWeightUsd: summary.growthWeightUsd - previousGrowthWeightUsd,
      deltaExposureWeightUsdYears: summary.baselineExposureWeightUsdYears - previousExposureWeightUsdYears,
      deltaSeconds: previousTimestamp === null ? 0 : Math.max(0, timestamp - previousTimestamp),
      hasCapital: summary.baselineWeightUsd > 0 || summary.growthWeightUsd !== 0
    })
    previousTimestamp = timestamp
    previousGrowthWeightUsd = summary.growthWeightUsd
    previousExposureWeightUsdYears = summary.baselineExposureWeightUsdYears

    return {
      date: timestampToDateString(timestamp),
      timestamp,
      growthWeightUsd: summary.growthWeightUsd,
      growthWeightEth,
      protocolReturnPct: summary.protocolReturnPct,
      annualizedProtocolReturnPct: summary.annualizedProtocolReturnPct,
      growthIndex,
      ...(args.selectedVaultKey
        ? {
            currentUnderlying: selectedVault?.currentUnderlying ?? 0,
            growthUnderlying: selectedVault?.growthUnderlying ?? 0,
            sharesFormatted: selectedVault?.sharesFormatted ?? 0,
            pricePerShare: selectedVault?.pricePerShare ?? 0
          }
        : {})
    }
  })
}

export function buildProtocolReturnFamilyHistorySeries(args: {
  events: TRawPnlEvent[]
  userAddress: string
  metadata: Map<string, VaultMetadata>
  ppsData: Map<string, Map<number, number>>
  priceData: Map<string, Map<number, number>>
  ethPriceData?: Map<number, number>
  timestamps: number[]
  selectedVaults: HoldingsPnLSimpleVault[]
}): HoldingsPnLSimpleHistoryFamilySeries[] {
  if (args.selectedVaults.length === 0) {
    return []
  }

  const userAddress = lowerCaseAddress(args.userAddress)
  const effectiveEvents = buildEffectiveSimpleEvents(args.events, userAddress)
  const groupedTransactions = groupEventsByTransaction(effectiveEvents)
  const selectedVaultKeys = new Set(args.selectedVaults.map((vault) => toVaultKey(vault.chainId, vault.vaultAddress)))
  const selectedVaultsByKey = new Map(
    args.selectedVaults.map((vault) => [toVaultKey(vault.chainId, vault.vaultAddress), vault] as const)
  )
  const familyPointMap = new Map<string, HoldingsPnLSimpleHistoryFamilyPoint[]>(
    Array.from(selectedVaultKeys, (key) => [key, []] as const)
  )

  let transactionIndex = 0
  let ledgers = new Map<string, TProtocolReturnLedger>()
  const familyIndexState = new Map<
    string,
    {
      previousTimestamp: number | null
      previousGrowthWeightUsd: number
      previousExposureWeightUsdYears: number
      growthIndex: number | null
    }
  >(
    Array.from(
      selectedVaultKeys,
      (key) =>
        [
          key,
          {
            previousTimestamp: null,
            previousGrowthWeightUsd: 0,
            previousExposureWeightUsdYears: 0,
            growthIndex: null
          }
        ] as const
    )
  )

  args.timestamps.forEach((timestamp) => {
    while (
      transactionIndex < groupedTransactions.length &&
      groupedTransactions[transactionIndex]![0]!.blockTimestamp <= timestamp
    ) {
      groupTransactionEventsByFamily(groupedTransactions[transactionIndex]!).forEach((txFamilyEvents) => {
        normalizeStakingWrapperEvents(txFamilyEvents, userAddress).forEach((event) => {
          processEvent(ledgers, event, {
            userAddress,
            metadata: args.metadata,
            ppsData: args.ppsData,
            priceData: args.priceData,
            ethPriceData: args.ethPriceData ?? new Map()
          })
        })
      })
      transactionIndex += 1
    }

    ledgers = Array.from(ledgers.entries()).reduce<Map<string, TProtocolReturnLedger>>((nextLedgers, [key, ledger]) => {
      nextLedgers.set(key, accrueLedgerExposure(ledger, timestamp))
      return nextLedgers
    }, new Map())

    const vaultsByKey = new Map(
      materializeProtocolReturnVaults({
        ledgers,
        metadata: args.metadata,
        ppsData: args.ppsData,
        currentTimestamp: timestamp
      }).map((vault) => [toVaultKey(vault.chainId, vault.vaultAddress), vault] as const)
    )

    selectedVaultKeys.forEach((vaultKey) => {
      const familyVault = vaultsByKey.get(vaultKey)
      const state = familyIndexState.get(vaultKey)

      if (!state) {
        return
      }

      const hasOpenPosition = (familyVault?.sharesFormatted ?? 0) > 0

      state.growthIndex = advanceGrowthIndex({
        previousIndex: state.growthIndex,
        deltaGrowthWeightUsd: (familyVault?.growthWeightUsd ?? 0) - state.previousGrowthWeightUsd,
        deltaExposureWeightUsdYears:
          (familyVault?.baselineExposureWeightUsdYears ?? 0) - state.previousExposureWeightUsdYears,
        deltaSeconds: state.previousTimestamp === null ? 0 : Math.max(0, timestamp - state.previousTimestamp),
        hasCapital: (familyVault?.baselineWeightUsd ?? 0) > 0 || (familyVault?.growthWeightUsd ?? 0) !== 0
      })
      state.previousTimestamp = timestamp
      state.previousGrowthWeightUsd = familyVault?.growthWeightUsd ?? 0
      state.previousExposureWeightUsdYears = familyVault?.baselineExposureWeightUsdYears ?? 0

      familyPointMap.get(vaultKey)?.push({
        date: timestampToDateString(timestamp),
        timestamp,
        protocolReturnPct: hasOpenPosition ? (familyVault?.protocolReturnPct ?? null) : null,
        growthWeightUsd: hasOpenPosition ? (familyVault?.growthWeightUsd ?? null) : null,
        growthIndex: hasOpenPosition ? state.growthIndex : null
      })
    })
  })

  return Array.from(selectedVaultKeys).flatMap((vaultKey) => {
    const selectedVault = selectedVaultsByKey.get(vaultKey)
    const points = familyPointMap.get(vaultKey)

    if (!selectedVault || !points) {
      return []
    }

    return [
      {
        chainId: selectedVault.chainId,
        vaultAddress: selectedVault.vaultAddress,
        symbol: selectedVault.metadata.symbol,
        status: selectedVault.status,
        dataPoints: points
      }
    ]
  })
}

export async function getHoldingsPnLSimple(
  userAddress: string,
  version: VaultVersion = 'all',
  fetchType: HoldingsEventFetchType = 'seq',
  paginationMode: HoldingsEventPaginationMode = 'paged'
): Promise<HoldingsPnLSimpleResponse> {
  debugLog('pnl-simple', 'starting holdings simple pnl calculation', { version, fetchType, paginationMode })
  const rawContext = await fetchRawUserPnlEvents(userAddress, 'all', undefined, fetchType, paginationMode)
  const rawEvents = buildRawPnlEvents(rawContext)
  const rawVaultIdentifiers = getVaultIdentifiers(rawEvents)
  const resolvedVaultMetadata = await fetchMultipleVaultsMetadata(rawVaultIdentifiers)
  const effectiveEvents = buildEffectiveSimpleEvents(
    filterEventsByAuthoritativeVersion(rawEvents, resolvedVaultMetadata, version),
    userAddress
  )
  const filteredVaultIdentifiers = getVaultIdentifiers(effectiveEvents)
  const baseVaultMetadata = filteredVaultIdentifiers.reduce<Map<string, VaultMetadata>>((filtered, vault) => {
    const key = toVaultKey(vault.chainId, vault.vaultAddress)
    const metadata = resolvedVaultMetadata.get(key)

    if (metadata) {
      filtered.set(key, metadata)
    }

    return filtered
  }, new Map())
  const vaultMetadata = await resolveNestedVaultAssetMetadata(baseVaultMetadata)
  const currentTimestamp = Math.floor(Date.now() / 1000)

  debugLog('pnl-simple', 'loaded address-scoped events', {
    version,
    addressDeposits: rawContext.addressEvents.deposits.length,
    addressWithdrawals: rawContext.addressEvents.withdrawals.length,
    addressTransfersIn: rawContext.addressEvents.transfersIn.length,
    addressTransfersOut: rawContext.addressEvents.transfersOut.length,
    rawEvents: rawEvents.length,
    effectiveEvents: effectiveEvents.length,
    vaults: filteredVaultIdentifiers.length
  })

  if (effectiveEvents.length === 0 || filteredVaultIdentifiers.length === 0) {
    return {
      address: lowerCaseAddress(userAddress),
      version,
      generatedAt: new Date().toISOString(),
      summary: buildSummary([]),
      vaults: []
    }
  }

  const baseReceiptPriceRequests = buildReceiptPriceRequests({
    events: effectiveEvents,
    metadata: vaultMetadata,
    userAddress,
    currentTimestamp
  })
  const receiptPriceRequests = expandNestedVaultAssetPriceRequests(baseReceiptPriceRequests, vaultMetadata)
  const uniqueReceiptPriceTimestamps = new Set(receiptPriceRequests.flatMap((request) => request.timestamps))

  debugLog('pnl-simple', 'prepared targeted receipt price requests', {
    tokens: receiptPriceRequests.length,
    uniqueTimestamps: uniqueReceiptPriceTimestamps.size,
    pricePoints: countReceiptPricePoints(receiptPriceRequests),
    bucketSeconds: RECEIPT_PRICE_BUCKET_SECONDS
  })

  const ppsIdentifiers = mergeVaultIdentifiers([
    ...filteredVaultIdentifiers,
    ...getNestedVaultPpsIdentifiersFromPriceRequests(baseReceiptPriceRequests, vaultMetadata)
  ])
  const [ppsData, fetchedPriceData] = await Promise.all([
    fetchMultipleVaultsPPS(ppsIdentifiers),
    fetchReceiptPrices(receiptPriceRequests)
  ])
  const priceData = deriveNestedVaultAssetPriceData({
    priceData: fetchedPriceData,
    priceRequests: receiptPriceRequests,
    vaultMetadata,
    ppsData
  })
  const ledgers = buildProtocolReturnLedgers({
    events: effectiveEvents,
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

export async function getHoldingsPnLSimpleHistory(
  userAddress: string,
  version: VaultVersion = 'all',
  fetchType: HoldingsEventFetchType = 'seq',
  paginationMode: HoldingsEventPaginationMode = 'paged',
  timeframe: '1y' | 'all' = '1y',
  vaultAddress?: string,
  vaultChainId?: number
): Promise<HoldingsPnLSimpleHistoryResponse> {
  debugLog('pnl-simple-history', 'starting holdings simple pnl history calculation', {
    version,
    fetchType,
    paginationMode,
    timeframe
  })

  const requestedVault =
    vaultAddress && Number.isInteger(vaultChainId)
      ? {
          chainId: Number(vaultChainId),
          vaultAddress: lowerCaseAddress(vaultAddress)
        }
      : undefined
  const settledContext = await getSettledVersionedPpsContext({
    userAddress,
    version,
    fetchType,
    paginationMode,
    requestedVault
  })
  const rawEvents = await enrichSimpleHistoryRawEvents({
    events: settledContext.selectedEvents,
    version,
    maxTimestamp: settledContext.maxTimestamp
  })
  const effectiveEvents = rawEvents
  const filteredVaultIdentifiers = getVaultIdentifiers(effectiveEvents)
  const vaultMetadata = settledContext.vaultMetadata

  if (effectiveEvents.length === 0 || filteredVaultIdentifiers.length === 0) {
    return {
      address: lowerCaseAddress(userAddress),
      version,
      timeframe,
      generatedAt: new Date().toISOString(),
      summary: {
        totalVaults: 0,
        completeVaults: 0,
        partialVaults: 0,
        recommendedGrowthDisplay: 'index',
        recommendedGrowthDisplayReason: 'mixed',
        openBaselineCompositionUsd: {
          stable: 0,
          ethFamily: 0,
          other: 0
        },
        isComplete: true
      },
      dataPoints: [],
      familySeries: []
    }
  }

  const timestamps = getProtocolReturnTimestamps(effectiveEvents, timeframe)
  const latestTimestamp = timestamps[timestamps.length - 1] ?? settledContext.maxTimestamp
  const baseReceiptPriceRequests = buildReceiptPriceRequests({
    events: effectiveEvents,
    metadata: vaultMetadata,
    userAddress,
    currentTimestamp: latestTimestamp
  })
  const receiptPriceRequests = expandNestedVaultAssetPriceRequests(baseReceiptPriceRequests, vaultMetadata)
  const ethReceiptPriceTimestamps = Array.from(
    new Set(receiptPriceRequests.flatMap((request) => request.timestamps))
  ).sort((left, right) => left - right)

  const ppsIdentifiers = mergeVaultIdentifiers([
    ...filteredVaultIdentifiers,
    ...getNestedVaultPpsIdentifiersFromPriceRequests(baseReceiptPriceRequests, vaultMetadata)
  ])
  const [fetchedPriceData, ethPriceData] = await Promise.all([
    fetchReceiptPrices(receiptPriceRequests),
    fetchEthReceiptPrices(ethReceiptPriceTimestamps)
  ])
  const priceData = deriveNestedVaultAssetPriceData({
    priceData: fetchedPriceData,
    priceRequests: receiptPriceRequests,
    vaultMetadata,
    ppsData: settledContext.ppsData
  })

  const finalLedgers = buildProtocolReturnLedgers({
    events: effectiveEvents,
    userAddress,
    metadata: vaultMetadata,
    ppsData: settledContext.ppsData,
    priceData,
    ethPriceData,
    currentTimestamp: latestTimestamp
  })
  const finalVaults = materializeProtocolReturnVaults({
    ledgers: finalLedgers,
    metadata: vaultMetadata,
    ppsData: settledContext.ppsData,
    currentTimestamp: latestTimestamp
  })
  const selectedHistoryFamilies = selectHistoryFamilies(finalVaults)
  const history = buildProtocolReturnHistorySeries({
    events: effectiveEvents,
    userAddress,
    metadata: vaultMetadata,
    ppsData: settledContext.ppsData,
    priceData,
    ethPriceData,
    timestamps,
    selectedVaultKey:
      requestedVault && filteredVaultIdentifiers.length > 0
        ? toVaultKey(filteredVaultIdentifiers[0]!.chainId, filteredVaultIdentifiers[0]!.vaultAddress)
        : undefined
  })
  const familySeries = buildProtocolReturnFamilyHistorySeries({
    events: effectiveEvents,
    userAddress,
    metadata: vaultMetadata,
    ppsData: settledContext.ppsData,
    priceData,
    ethPriceData,
    timestamps,
    selectedVaults: requestedVault ? [] : selectedHistoryFamilies
  })
  const openBaselineCompositionUsd = buildOpenBaselineCompositionUsd({
    ledgers: finalLedgers,
    metadata: vaultMetadata
  })
  const { recommendedGrowthDisplay, recommendedGrowthDisplayReason } =
    resolveRecommendedGrowthDisplay(openBaselineCompositionUsd)

  debugLog('pnl-simple-history', 'completed holdings simple pnl history calculation', {
    version,
    timeframe,
    points: history.length,
    totalVaults: finalVaults.length,
    addressDeposits: settledContext.events.deposits.length,
    addressWithdrawals: settledContext.events.withdrawals.length,
    addressTransfersIn: settledContext.events.transfersIn.length,
    addressTransfersOut: settledContext.events.transfersOut.length,
    ppsResolved: settledContext.ppsData.size,
    ppsRequested: ppsIdentifiers.length,
    recommendedGrowthDisplay,
    recommendedGrowthDisplayReason
  })

  return {
    address: lowerCaseAddress(userAddress),
    version,
    timeframe,
    generatedAt: new Date().toISOString(),
    summary: {
      totalVaults: finalVaults.length,
      completeVaults: finalVaults.filter((vault) => vault.status === 'ok').length,
      partialVaults: finalVaults.filter((vault) => vault.status !== 'ok').length,
      recommendedGrowthDisplay,
      recommendedGrowthDisplayReason,
      openBaselineCompositionUsd,
      isComplete: finalVaults.every((vault) => vault.status === 'ok')
    },
    dataPoints: history,
    familySeries
  }
}
