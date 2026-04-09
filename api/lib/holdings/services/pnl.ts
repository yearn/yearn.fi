import type { DepositEvent, TransferEvent, VaultMetadata, WithdrawEvent } from '../types'
import { enrichRawPnlEventsWithCowTradeAcquisitions } from './cow'
import { debugLog, debugTable, getHoldingsDebugFilters } from './debug'
import { fetchHistoricalPrices, getChainPrefix, getPriceAtTimestamp } from './defillama'
import {
  fetchRawUserPnlEvents,
  type HoldingsEventFetchType,
  type HoldingsEventPaginationMode,
  type RawPnlEventContext,
  type VaultVersion
} from './graphql'
import { fetchMultipleVaultsPPS, getPPS } from './kong'
import {
  formatAmount,
  isKnownCompatibleAssetVaultRollover,
  isKnownZeroBasisRewardDistribution,
  KNOWN_VAULT_ROLLOVER_INTERMEDIARIES,
  lowerCaseAddress,
  minBigInt,
  negativeBigIntMagnitude,
  positiveBigInt,
  sumKnownCostBasis,
  sumShares,
  toVaultKey,
  ZERO,
  ZERO_ADDRESS
} from './pnlShared'

export type {
  HoldingsPnLDrilldownResponse,
  HoldingsPnLDrilldownVault,
  HoldingsPnLResponse,
  HoldingsPnLVault,
  UnknownTransferInPnlMode
} from './pnlTypes'

import type {
  FamilyPnlLedger,
  HoldingsPnLDrilldownResponse,
  HoldingsPnLDrilldownVault,
  HoldingsPnLResponse,
  HoldingsPnLVault,
  TLocation,
  TLot,
  TLotSummary,
  TPnlDebugJournalRow,
  TRawPnlEvent,
  TRawScopes,
  UnknownTransferInPnlMode
} from './pnlTypes'
import {
  applyUnknownTransferInModeAdjustment,
  createEmptyHoldingsPnlResponse,
  createMissingMetadataPnlVault,
  summarizePnlVaults,
  toHoldingsPnlEventCounts
} from './pnlValuation'
import { getFamilyVaultAddress, getStakingVaultAddress, isStakingVault } from './staking'
import { fetchMultipleVaultsMetadata } from './vaults'

function createLot(shares: bigint, costBasis: bigint | null, acquiredAt?: number): TLot {
  return acquiredAt === undefined ? { shares, costBasis } : { shares, costBasis, acquiredAt }
}

function cloneLots(lots: TLot[]): TLot[] {
  return lots.map((lot) => createLot(lot.shares, lot.costBasis, lot.acquiredAt))
}

function summarizeLots(lots: TLot[]): TLotSummary {
  const knownLots = lots.filter((lot) => lot.costBasis !== null)
  const unknownLots = lots.filter((lot) => lot.costBasis === null)

  return {
    lotCount: lots.length,
    totalShares: sumShares(lots).toString(),
    knownShares: sumShares(knownLots).toString(),
    unknownShares: sumShares(unknownLots).toString(),
    totalKnownCostBasis: sumKnownCostBasis(knownLots).toString()
  }
}

function serializeLots(
  lots: TLot[],
  shareDecimals?: number,
  assetDecimals?: number
): Array<{
  index: number
  shares: string
  sharesFormatted?: number
  costBasis: string | null
  costBasisFormatted?: number | null
  acquiredAt?: number
}> {
  return lots.map((lot, index) => ({
    index,
    shares: lot.shares.toString(),
    sharesFormatted: shareDecimals === undefined ? undefined : formatAmount(lot.shares, shareDecimals),
    costBasis: lot.costBasis?.toString() ?? null,
    costBasisFormatted:
      lot.costBasis === null || assetDecimals === undefined ? null : formatAmount(lot.costBasis, assetDecimals),
    acquiredAt: lot.acquiredAt
  }))
}

function getTokenPriceForTimestamp(
  tokenPriceMap: Map<number, number> | null,
  timestamp: number | undefined,
  fallbackTokenPrice: number
): number {
  if (!timestamp || timestamp <= 0) {
    return fallbackTokenPrice
  }

  return tokenPriceMap ? getPriceAtTimestamp(tokenPriceMap, timestamp) : fallbackTokenPrice
}

function getKnownLotsCostBasisUsd(
  lots: TLot[],
  assetDecimals: number,
  tokenPriceMap: Map<number, number> | null,
  fallbackTokenPrice: number
): number {
  return lots.reduce((total, lot) => {
    if (lot.costBasis === null) {
      return total
    }

    return (
      total +
      formatAmount(lot.costBasis, assetDecimals) *
        getTokenPriceForTimestamp(tokenPriceMap, lot.acquiredAt, fallbackTokenPrice)
    )
  }, 0)
}

function countTxEventsByKind(txFamilyEvents: TRawPnlEvent[]): string {
  const counts = txFamilyEvents.reduce(
    (totals, event) => {
      if (event.kind === 'deposit') totals.deposits += 1
      if (event.kind === 'withdrawal') totals.withdrawals += 1
      if (event.kind === 'transfer') totals.transfers += 1
      return totals
    },
    { deposits: 0, withdrawals: 0, transfers: 0 }
  )

  return `dep:${counts.deposits} wd:${counts.withdrawals} xfer:${counts.transfers}`
}

function serializeJournalRows(
  rows: TPnlDebugJournalRow[],
  shareDecimals?: number,
  assetDecimals?: number
): Array<Record<string, unknown>> {
  return rows.map((row) => ({
    timestamp: row.timestamp,
    txHash: row.txHash,
    view: row.view,
    direct: row.hasAddressActivity ? 'yes' : 'no',
    rawEvents: row.rawEvents,
    depShares: shareDecimals === undefined ? row.depositShares : formatAmount(BigInt(row.depositShares), shareDecimals),
    depAssets: assetDecimals === undefined ? row.depositAssets : formatAmount(BigInt(row.depositAssets), assetDecimals),
    wdShares:
      shareDecimals === undefined ? row.withdrawShares : formatAmount(BigInt(row.withdrawShares), shareDecimals),
    wdAssets:
      assetDecimals === undefined ? row.withdrawAssets : formatAmount(BigInt(row.withdrawAssets), assetDecimals),
    stake: shareDecimals === undefined ? row.stakeShares : formatAmount(BigInt(row.stakeShares), shareDecimals),
    unstake: shareDecimals === undefined ? row.unstakeShares : formatAmount(BigInt(row.unstakeShares), shareDecimals),
    rewardVault:
      shareDecimals === undefined
        ? row.rewardInVaultShares
        : formatAmount(BigInt(row.rewardInVaultShares), shareDecimals),
    rewardStaked:
      shareDecimals === undefined
        ? row.rewardInStakedShares
        : formatAmount(BigInt(row.rewardInStakedShares), shareDecimals),
    unkVault:
      shareDecimals === undefined
        ? row.unknownInVaultShares
        : formatAmount(BigInt(row.unknownInVaultShares), shareDecimals),
    unkStaked:
      shareDecimals === undefined
        ? row.unknownInStakedShares
        : formatAmount(BigInt(row.unknownInStakedShares), shareDecimals),
    outVault:
      shareDecimals === undefined
        ? row.transferOutVaultShares
        : formatAmount(BigInt(row.transferOutVaultShares), shareDecimals),
    outStaked:
      shareDecimals === undefined
        ? row.transferOutStakedShares
        : formatAmount(BigInt(row.transferOutStakedShares), shareDecimals),
    pnlShares:
      shareDecimals === undefined
        ? row.realizedKnownShares
        : formatAmount(BigInt(row.realizedKnownShares), shareDecimals),
    proceeds:
      assetDecimals === undefined
        ? row.realizedProceedsAssets
        : formatAmount(BigInt(row.realizedProceedsAssets), assetDecimals),
    basisConsumed:
      assetDecimals === undefined
        ? row.realizedBasisAssets
        : formatAmount(BigInt(row.realizedBasisAssets), assetDecimals),
    realizedPnl:
      assetDecimals === undefined ? row.realizedPnlAssets : formatAmount(BigInt(row.realizedPnlAssets), assetDecimals)
  }))
}

type TPnlComputationArtifacts = {
  userAddress: string
  version: VaultVersion
  unknownTransferInPnlMode: UnknownTransferInPnlMode
  currentTimestamp: number
  vaults: FamilyPnlLedger[]
  vaultMetadata: Map<string, VaultMetadata>
  ppsData: Map<string, Map<number, number>>
  priceData: Map<string, Map<number, number>>
  debugTxLedgerKeys: Set<string>
}

function filterVaultsByAuthoritativeVersion(
  vaults: FamilyPnlLedger[],
  vaultMetadata: Map<string, VaultMetadata>,
  version: VaultVersion
): FamilyPnlLedger[] {
  return vaults.filter((vault) => {
    const metadata = vaultMetadata.get(toVaultKey(vault.chainId, vault.vaultAddress))

    if (metadata?.isHidden) {
      return false
    }

    if (version === 'all') {
      return true
    }

    return metadata?.version === version
  })
}

function formatLotSummaryForResponse(
  summary: TLotSummary,
  shareDecimals: number,
  assetDecimals: number
): HoldingsPnLDrilldownVault['journal'][number]['vaultLotsBefore'] {
  return {
    ...summary,
    totalSharesFormatted: formatAmount(BigInt(summary.totalShares), shareDecimals),
    knownSharesFormatted: formatAmount(BigInt(summary.knownShares), shareDecimals),
    unknownSharesFormatted: formatAmount(BigInt(summary.unknownShares), shareDecimals),
    totalKnownCostBasisFormatted: formatAmount(BigInt(summary.totalKnownCostBasis), assetDecimals)
  }
}

function serializeLotForResponse(args: {
  lot: TLot
  index: number
  shareDecimals: number
  assetDecimals: number
  resolvedPricePerShare: number
  currentTokenPrice: number
  ppsMap: Map<number, number> | undefined
  tokenPriceMap: Map<number, number> | null
}): HoldingsPnLDrilldownVault['currentLots']['vault'][number] {
  const { lot, index, shareDecimals, assetDecimals, resolvedPricePerShare, currentTokenPrice, ppsMap, tokenPriceMap } =
    args
  const acquiredAt = lot.acquiredAt ?? null
  const sharesFormatted = formatAmount(lot.shares, shareDecimals)
  const costBasisFormatted = lot.costBasis === null ? null : formatAmount(lot.costBasis, assetDecimals)
  const pricePerShareAtAcquisition =
    acquiredAt === null
      ? resolvedPricePerShare
      : ppsMap
        ? (getPPS(ppsMap, acquiredAt) ?? resolvedPricePerShare)
        : resolvedPricePerShare
  const tokenPriceAtAcquisition =
    acquiredAt === null ? currentTokenPrice : getTokenPriceForTimestamp(tokenPriceMap, acquiredAt, currentTokenPrice)
  const currentUnderlying = sharesFormatted * resolvedPricePerShare

  return {
    index,
    shares: lot.shares.toString(),
    sharesFormatted,
    costBasis: lot.costBasis?.toString() ?? null,
    costBasisFormatted,
    acquiredAt,
    costBasisUsd: costBasisFormatted === null ? null : costBasisFormatted * tokenPriceAtAcquisition,
    pricePerShareAtAcquisition,
    tokenPriceAtAcquisition,
    currentUnderlying,
    currentValueUsd: currentUnderlying * currentTokenPrice
  }
}

function serializeRealizedEntryForResponse(args: {
  entry: FamilyPnlLedger['realizedEntries'][number]
  shareDecimals: number
  assetDecimals: number
  currentTokenPrice: number
  tokenPriceMap: Map<number, number> | null
  resolvedPricePerShare: number
  ppsMap: Map<number, number> | undefined
}): HoldingsPnLDrilldownVault['realizedEntries'][number] {
  const { entry, shareDecimals, assetDecimals, currentTokenPrice, tokenPriceMap, resolvedPricePerShare, ppsMap } = args
  const realizedTokenPrice = getTokenPriceForTimestamp(tokenPriceMap, entry.timestamp, currentTokenPrice)
  const basisUsd = getKnownLotsCostBasisUsd(entry.consumedLots, assetDecimals, tokenPriceMap, currentTokenPrice)

  return {
    timestamp: entry.timestamp,
    proceedsAssets: entry.proceedsAssets.toString(),
    proceedsUnderlying: formatAmount(entry.proceedsAssets, assetDecimals),
    proceedsUsd: formatAmount(entry.proceedsAssets, assetDecimals) * realizedTokenPrice,
    basisAssets: entry.basisAssets.toString(),
    basisUnderlying: formatAmount(entry.basisAssets, assetDecimals),
    basisUsd,
    pnlAssets: entry.pnlAssets.toString(),
    pnlUnderlying: formatAmount(entry.pnlAssets, assetDecimals),
    pnlUsd: formatAmount(entry.proceedsAssets, assetDecimals) * realizedTokenPrice - basisUsd,
    consumedLots: entry.consumedLots.map((lot, index) =>
      serializeLotForResponse({
        lot,
        index,
        shareDecimals,
        assetDecimals,
        resolvedPricePerShare,
        currentTokenPrice,
        ppsMap,
        tokenPriceMap
      })
    )
  }
}

function serializeUnknownTransferInEntryForResponse(args: {
  entry: FamilyPnlLedger['unknownTransferInEntries'][number]
  shareDecimals: number
  currentTokenPrice: number
  resolvedPricePerShare: number
  ppsMap: Map<number, number> | undefined
  tokenPriceMap: Map<number, number> | null
}): HoldingsPnLDrilldownVault['unknownTransferInEntries'][number] {
  const { entry, shareDecimals, currentTokenPrice, resolvedPricePerShare, ppsMap, tokenPriceMap } = args
  const pricePerShareAtReceipt = ppsMap
    ? (getPPS(ppsMap, entry.timestamp) ?? resolvedPricePerShare)
    : resolvedPricePerShare
  const tokenPriceAtReceipt = getTokenPriceForTimestamp(tokenPriceMap, entry.timestamp, currentTokenPrice)
  const sharesFormatted = formatAmount(entry.shares, shareDecimals)
  const receiptUnderlying = sharesFormatted * pricePerShareAtReceipt

  return {
    timestamp: entry.timestamp,
    location: entry.location,
    shares: entry.shares.toString(),
    sharesFormatted,
    pricePerShareAtReceipt,
    tokenPriceAtReceipt,
    receiptUnderlying,
    receiptValueUsd: receiptUnderlying * tokenPriceAtReceipt
  }
}

function serializeRewardTransferInEntryForResponse(args: {
  entry: FamilyPnlLedger['rewardTransferInEntries'][number]
  shareDecimals: number
  currentTokenPrice: number
  resolvedPricePerShare: number
  ppsMap: Map<number, number> | undefined
  tokenPriceMap: Map<number, number> | null
}): HoldingsPnLDrilldownVault['rewardTransferInEntries'][number] {
  const { entry, shareDecimals, currentTokenPrice, resolvedPricePerShare, ppsMap, tokenPriceMap } = args
  const pricePerShareAtReceipt = ppsMap
    ? (getPPS(ppsMap, entry.timestamp) ?? resolvedPricePerShare)
    : resolvedPricePerShare
  const tokenPriceAtReceipt = getTokenPriceForTimestamp(tokenPriceMap, entry.timestamp, currentTokenPrice)
  const sharesFormatted = formatAmount(entry.shares, shareDecimals)
  const receiptUnderlying = sharesFormatted * pricePerShareAtReceipt

  return {
    timestamp: entry.timestamp,
    location: entry.location,
    distributor: entry.distributor,
    shares: entry.shares.toString(),
    sharesFormatted,
    pricePerShareAtReceipt,
    tokenPriceAtReceipt,
    receiptUnderlying,
    receiptValueUsd: receiptUnderlying * tokenPriceAtReceipt
  }
}

function serializeUnknownWithdrawalEntryForResponse(args: {
  entry: FamilyPnlLedger['unknownWithdrawalEntries'][number]
  shareDecimals: number
  assetDecimals: number
  currentTokenPrice: number
  tokenPriceMap: Map<number, number> | null
  resolvedPricePerShare: number
  ppsMap: Map<number, number> | undefined
}): HoldingsPnLDrilldownVault['unknownWithdrawalEntries'][number] {
  const { entry, shareDecimals, assetDecimals, currentTokenPrice, tokenPriceMap, resolvedPricePerShare, ppsMap } = args
  const realizedTokenPrice = getTokenPriceForTimestamp(tokenPriceMap, entry.timestamp, currentTokenPrice)

  return {
    timestamp: entry.timestamp,
    shares: entry.shares.toString(),
    sharesFormatted: formatAmount(entry.shares, shareDecimals),
    proceedsAssets: entry.proceedsAssets.toString(),
    proceedsUnderlying: formatAmount(entry.proceedsAssets, assetDecimals),
    proceedsUsd: formatAmount(entry.proceedsAssets, assetDecimals) * realizedTokenPrice,
    consumedLots: entry.consumedLots.map((lot, index) =>
      serializeLotForResponse({
        lot,
        index,
        shareDecimals,
        assetDecimals,
        resolvedPricePerShare,
        currentTokenPrice,
        ppsMap,
        tokenPriceMap
      })
    )
  }
}

function serializeJournalEntryForResponse(args: {
  row: TPnlDebugJournalRow
  shareDecimals: number
  assetDecimals: number
}): HoldingsPnLDrilldownVault['journal'][number] {
  const { row, shareDecimals, assetDecimals } = args

  return {
    timestamp: row.timestamp,
    txHash: row.txHash,
    view: row.view,
    hasAddressActivity: row.hasAddressActivity,
    rawEvents: row.rawEvents,
    depositShares: row.depositShares,
    depositSharesFormatted: formatAmount(BigInt(row.depositShares), shareDecimals),
    depositAssets: row.depositAssets,
    depositAssetsFormatted: formatAmount(BigInt(row.depositAssets), assetDecimals),
    withdrawShares: row.withdrawShares,
    withdrawSharesFormatted: formatAmount(BigInt(row.withdrawShares), shareDecimals),
    withdrawAssets: row.withdrawAssets,
    withdrawAssetsFormatted: formatAmount(BigInt(row.withdrawAssets), assetDecimals),
    stakeShares: row.stakeShares,
    stakeSharesFormatted: formatAmount(BigInt(row.stakeShares), shareDecimals),
    unstakeShares: row.unstakeShares,
    unstakeSharesFormatted: formatAmount(BigInt(row.unstakeShares), shareDecimals),
    rewardInVaultShares: row.rewardInVaultShares,
    rewardInVaultSharesFormatted: formatAmount(BigInt(row.rewardInVaultShares), shareDecimals),
    rewardInStakedShares: row.rewardInStakedShares,
    rewardInStakedSharesFormatted: formatAmount(BigInt(row.rewardInStakedShares), shareDecimals),
    unknownInVaultShares: row.unknownInVaultShares,
    unknownInVaultSharesFormatted: formatAmount(BigInt(row.unknownInVaultShares), shareDecimals),
    unknownInStakedShares: row.unknownInStakedShares,
    unknownInStakedSharesFormatted: formatAmount(BigInt(row.unknownInStakedShares), shareDecimals),
    transferOutVaultShares: row.transferOutVaultShares,
    transferOutVaultSharesFormatted: formatAmount(BigInt(row.transferOutVaultShares), shareDecimals),
    transferOutStakedShares: row.transferOutStakedShares,
    transferOutStakedSharesFormatted: formatAmount(BigInt(row.transferOutStakedShares), shareDecimals),
    realizedKnownShares: row.realizedKnownShares,
    realizedKnownSharesFormatted: formatAmount(BigInt(row.realizedKnownShares), shareDecimals),
    realizedProceedsAssets: row.realizedProceedsAssets,
    realizedProceedsAssetsFormatted: formatAmount(BigInt(row.realizedProceedsAssets), assetDecimals),
    realizedBasisAssets: row.realizedBasisAssets,
    realizedBasisAssetsFormatted: formatAmount(BigInt(row.realizedBasisAssets), assetDecimals),
    realizedPnlAssets: row.realizedPnlAssets,
    realizedPnlAssetsFormatted: formatAmount(BigInt(row.realizedPnlAssets), assetDecimals),
    vaultLotsBefore: formatLotSummaryForResponse(row.vaultLotsBefore, shareDecimals, assetDecimals),
    stakedLotsBefore: formatLotSummaryForResponse(row.stakedLotsBefore, shareDecimals, assetDecimals),
    vaultLotsAfter: formatLotSummaryForResponse(row.vaultLotsAfter, shareDecimals, assetDecimals),
    stakedLotsAfter: formatLotSummaryForResponse(row.stakedLotsAfter, shareDecimals, assetDecimals)
  }
}

function serializeRawEvent(event: TRawPnlEvent): Record<string, unknown> {
  if (event.kind === 'deposit') {
    return {
      kind: event.kind,
      vaultAddress: event.vaultAddress,
      familyVaultAddress: event.familyVaultAddress,
      isStakingVault: event.isStakingVault,
      transactionHash: event.transactionHash,
      logIndex: event.logIndex,
      shares: event.shares.toString(),
      assets: event.assets.toString(),
      owner: event.owner,
      sender: event.sender,
      scopes: event.scopes
    }
  }

  if (event.kind === 'withdrawal') {
    return {
      kind: event.kind,
      vaultAddress: event.vaultAddress,
      familyVaultAddress: event.familyVaultAddress,
      isStakingVault: event.isStakingVault,
      transactionHash: event.transactionHash,
      logIndex: event.logIndex,
      shares: event.shares.toString(),
      assets: event.assets.toString(),
      owner: event.owner,
      scopes: event.scopes
    }
  }

  return {
    kind: event.kind,
    vaultAddress: event.vaultAddress,
    familyVaultAddress: event.familyVaultAddress,
    isStakingVault: event.isStakingVault,
    transactionHash: event.transactionHash,
    logIndex: event.logIndex,
    shares: event.shares.toString(),
    sender: event.sender,
    receiver: event.receiver,
    scopes: event.scopes
  }
}

function matchesLedgerDebugVault(ledger: FamilyPnlLedger, vaultFilter: string | null): boolean {
  if (vaultFilter === null) {
    return true
  }

  return ledger.vaultAddress === vaultFilter || ledger.stakingVaultAddress === vaultFilter
}

function shouldLogLotTransactions(ledger: FamilyPnlLedger, transactionHash: string): boolean {
  const { lotsEnabled, vaultFilter, txFilter } = getHoldingsDebugFilters()

  if (!lotsEnabled || (vaultFilter === null && txFilter === null)) {
    return false
  }

  if (!matchesLedgerDebugVault(ledger, vaultFilter)) {
    return false
  }

  if (txFilter !== null && transactionHash.toLowerCase() !== txFilter) {
    return false
  }

  return true
}

function shouldIncludeDetailedLotLogs(): boolean {
  const { lotsEnabled, vaultFilter, txFilter } = getHoldingsDebugFilters()
  return lotsEnabled && (vaultFilter !== null || txFilter !== null)
}

function getDebugTxLedgerKeys(events: TRawPnlEvent[]): Set<string> {
  const { lotsEnabled, txFilter } = getHoldingsDebugFilters()

  if (!lotsEnabled || txFilter === null) {
    return new Set()
  }

  return events.reduce<Set<string>>((keys, event) => {
    if (event.transactionHash.toLowerCase() === txFilter) {
      keys.add(toVaultKey(event.chainId, event.familyVaultAddress))
    }
    return keys
  }, new Set())
}

function shouldLogFinalLots(ledger: FamilyPnlLedger, debugTxLedgerKeys: Set<string>): boolean {
  const { lotsEnabled, vaultFilter, txFilter } = getHoldingsDebugFilters()

  if (!lotsEnabled) {
    return false
  }

  if (!matchesLedgerDebugVault(ledger, vaultFilter)) {
    return false
  }

  if (txFilter !== null) {
    return debugTxLedgerKeys.has(toVaultKey(ledger.chainId, ledger.vaultAddress))
  }

  return true
}

function compareRawEvents(a: TRawPnlEvent, b: TRawPnlEvent): number {
  return (
    a.blockTimestamp - b.blockTimestamp ||
    a.blockNumber - b.blockNumber ||
    a.logIndex - b.logIndex ||
    a.id.localeCompare(b.id)
  )
}

function normalizeDeposit(event: DepositEvent): Omit<Extract<TRawPnlEvent, { kind: 'deposit' }>, 'scopes'> {
  return {
    kind: 'deposit',
    id: event.id,
    chainId: event.chainId,
    vaultAddress: lowerCaseAddress(event.vaultAddress),
    familyVaultAddress: getFamilyVaultAddress(event.chainId, event.vaultAddress),
    isStakingVault: isStakingVault(event.chainId, event.vaultAddress),
    blockNumber: event.blockNumber,
    blockTimestamp: event.blockTimestamp,
    logIndex: event.logIndex,
    transactionHash: event.transactionHash,
    transactionFrom: lowerCaseAddress(event.transactionFrom),
    owner: lowerCaseAddress(event.owner),
    sender: lowerCaseAddress(event.sender),
    shares: BigInt(event.shares),
    assets: BigInt(event.assets)
  }
}

function normalizeWithdrawal(event: WithdrawEvent): Omit<Extract<TRawPnlEvent, { kind: 'withdrawal' }>, 'scopes'> {
  return {
    kind: 'withdrawal',
    id: event.id,
    chainId: event.chainId,
    vaultAddress: lowerCaseAddress(event.vaultAddress),
    familyVaultAddress: getFamilyVaultAddress(event.chainId, event.vaultAddress),
    isStakingVault: isStakingVault(event.chainId, event.vaultAddress),
    blockNumber: event.blockNumber,
    blockTimestamp: event.blockTimestamp,
    logIndex: event.logIndex,
    transactionHash: event.transactionHash,
    transactionFrom: lowerCaseAddress(event.transactionFrom),
    owner: lowerCaseAddress(event.owner),
    shares: BigInt(event.shares),
    assets: BigInt(event.assets)
  }
}

function normalizeTransfer(event: TransferEvent): Omit<Extract<TRawPnlEvent, { kind: 'transfer' }>, 'scopes'> {
  return {
    kind: 'transfer',
    id: event.id,
    chainId: event.chainId,
    vaultAddress: lowerCaseAddress(event.vaultAddress),
    familyVaultAddress: getFamilyVaultAddress(event.chainId, event.vaultAddress),
    isStakingVault: isStakingVault(event.chainId, event.vaultAddress),
    blockNumber: event.blockNumber,
    blockTimestamp: event.blockTimestamp,
    logIndex: event.logIndex,
    transactionHash: event.transactionHash,
    transactionFrom: lowerCaseAddress(event.transactionFrom),
    sender: lowerCaseAddress(event.sender),
    receiver: lowerCaseAddress(event.receiver),
    shares: BigInt(event.value)
  }
}

function mergeRawEvent(
  merged: Map<string, TRawPnlEvent>,
  event: Omit<TRawPnlEvent, 'scopes'>,
  scope: keyof TRawScopes
): void {
  const eventKey = `${event.kind}:${event.id}`
  const existing = merged.get(eventKey)

  if (existing) {
    existing.scopes[scope] = true
    return
  }

  merged.set(eventKey, {
    ...event,
    scopes: {
      address: scope === 'address',
      tx: scope === 'tx'
    }
  })
}

export function buildRawPnlEvents(context: RawPnlEventContext): TRawPnlEvent[] {
  const merged = new Map<string, TRawPnlEvent>()
  const eventSources: Array<{ events: Array<Omit<TRawPnlEvent, 'scopes'>>; scope: keyof TRawScopes }> = [
    { events: context.addressEvents.deposits.map(normalizeDeposit), scope: 'address' },
    { events: context.addressEvents.withdrawals.map(normalizeWithdrawal), scope: 'address' },
    { events: context.addressEvents.transfersIn.map(normalizeTransfer), scope: 'address' },
    { events: context.addressEvents.transfersOut.map(normalizeTransfer), scope: 'address' },
    { events: context.transactionEvents.deposits.map(normalizeDeposit), scope: 'tx' },
    { events: context.transactionEvents.withdrawals.map(normalizeWithdrawal), scope: 'tx' },
    { events: context.transactionEvents.transfers.map(normalizeTransfer), scope: 'tx' }
  ]

  eventSources.forEach(({ events, scope }) => {
    events.forEach((event) => {
      mergeRawEvent(merged, event, scope)
    })
  })

  return Array.from(merged.values()).sort(compareRawEvents)
}

function groupEventsByTransaction(events: TRawPnlEvent[]): TRawPnlEvent[][] {
  const grouped = events.reduce<Map<string, TRawPnlEvent[]>>((groups, event) => {
    const transactionKey = `${event.chainId}:${event.transactionHash}`
    const bucket = groups.get(transactionKey) ?? []
    bucket.push(event)
    groups.set(transactionKey, bucket)
    return groups
  }, new Map())

  return Array.from(grouped.values()).map((txEvents) => [...txEvents].sort(compareRawEvents))
}

function groupTransactionEventsByFamily(txEvents: TRawPnlEvent[]): TRawPnlEvent[][] {
  const grouped = txEvents.reduce<Map<string, TRawPnlEvent[]>>((groups, event) => {
    const familyKey = toVaultKey(event.chainId, event.familyVaultAddress)
    const bucket = groups.get(familyKey) ?? []
    bucket.push(event)
    groups.set(familyKey, bucket)
    return groups
  }, new Map())

  return Array.from(grouped.values()).map((familyEvents) => [...familyEvents].sort(compareRawEvents))
}

function createFamilyLedger(chainId: number, familyVaultAddress: string): FamilyPnlLedger {
  return {
    chainId,
    vaultAddress: familyVaultAddress,
    stakingVaultAddress: getStakingVaultAddress(chainId, familyVaultAddress),
    vaultLots: [],
    stakedLots: [],
    totalDepositedAssets: ZERO,
    totalWithdrawnAssets: ZERO,
    unknownCostBasisTransferInCount: 0,
    unknownCostBasisTransferInShares: ZERO,
    withdrawalsWithUnknownCostBasis: 0,
    unmatchedTransferOutCount: 0,
    unmatchedTransferOutShares: ZERO,
    realizedEntries: [],
    rewardTransferInEntries: [],
    unknownTransferInEntries: [],
    unknownWithdrawalEntries: [],
    debugJournal: [],
    eventCounts: {
      underlyingDeposits: 0,
      underlyingWithdrawals: 0,
      stakes: 0,
      unstakes: 0,
      rewardTransfersIn: 0,
      externalTransfersIn: 0,
      externalTransfersOut: 0,
      migrationsIn: 0,
      migrationsOut: 0
    }
  }
}

function getOrCreateLedger(
  ledgers: Map<string, FamilyPnlLedger>,
  chainId: number,
  familyVaultAddress: string
): FamilyPnlLedger {
  const vaultKey = toVaultKey(chainId, familyVaultAddress)
  const existing = ledgers.get(vaultKey)

  if (existing) {
    return existing
  }

  const ledger = createFamilyLedger(chainId, familyVaultAddress)
  ledgers.set(vaultKey, ledger)
  return ledger
}

function getLocationLots(ledger: FamilyPnlLedger, location: TLocation): TLot[] {
  return location === 'vault' ? ledger.vaultLots : ledger.stakedLots
}

function setLocationLots(ledger: FamilyPnlLedger, location: TLocation, lots: TLot[]): void {
  if (location === 'vault') {
    ledger.vaultLots = lots
    return
  }

  ledger.stakedLots = lots
}

function addLotsToLocation(ledger: FamilyPnlLedger, location: TLocation, lots: TLot[]): void {
  const existingLots = getLocationLots(ledger, location)
  const nextLots = [...existingLots]

  lots
    .filter((lot) => lot.shares > ZERO)
    .forEach((lot) => {
      nextLots.push(lot)
    })

  setLocationLots(ledger, location, nextLots)
}

function consumeLots(
  lots: TLot[],
  targetShares: bigint
): { nextLots: TLot[]; consumedLots: TLot[]; consumedShares: bigint } {
  const remaining = { value: targetShares }
  const nextLots: TLot[] = []
  const consumedLots: TLot[] = []

  lots.forEach((lot) => {
    if (lot.shares === ZERO) {
      return
    }

    if (remaining.value === ZERO) {
      nextLots.push(lot)
      return
    }

    const consumedShares = minBigInt(lot.shares, remaining.value)
    const remainingShares = lot.shares - consumedShares
    const consumedCostBasis = lot.costBasis === null ? null : (lot.costBasis * consumedShares) / lot.shares
    const remainingCostBasis = lot.costBasis === null ? null : lot.costBasis - (consumedCostBasis ?? ZERO)

    consumedLots.push(createLot(consumedShares, consumedCostBasis, lot.acquiredAt))

    if (remainingShares > ZERO) {
      nextLots.push(createLot(remainingShares, remainingCostBasis, lot.acquiredAt))
    }

    remaining.value -= consumedShares
  })

  return {
    nextLots,
    consumedLots: consumedLots.filter((lot) => lot.shares > ZERO),
    consumedShares: targetShares - remaining.value
  }
}

function consumeFromLocation(
  ledger: FamilyPnlLedger,
  location: TLocation,
  targetShares: bigint
): { consumedLots: TLot[]; consumedShares: bigint } {
  const consumed = consumeLots(getLocationLots(ledger, location), targetShares)
  setLocationLots(ledger, location, consumed.nextLots)
  return {
    consumedLots: consumed.consumedLots,
    consumedShares: consumed.consumedShares
  }
}

function moveBetweenLocations(ledger: FamilyPnlLedger, from: TLocation, to: TLocation, targetShares: bigint): bigint {
  const consumed = consumeFromLocation(ledger, from, targetShares)
  addLotsToLocation(ledger, to, consumed.consumedLots)
  return consumed.consumedShares
}

function calculateUserContractDelta(txEvents: TRawPnlEvent[], userAddress: string, contractAddress: string): bigint {
  return txEvents.reduce((delta, event) => {
    if (!event.scopes.address || event.vaultAddress !== contractAddress) {
      return delta
    }

    if (event.kind === 'deposit' && event.owner === userAddress) {
      return delta + event.shares
    }

    if (event.kind === 'withdrawal' && event.owner === userAddress) {
      return delta - event.shares
    }

    if (event.kind === 'transfer' && event.receiver === userAddress && event.sender !== ZERO_ADDRESS) {
      return delta + event.shares
    }

    if (event.kind === 'transfer' && event.sender === userAddress && event.receiver !== ZERO_ADDRESS) {
      return delta - event.shares
    }

    return delta
  }, ZERO)
}

function sumEventShares<T extends { shares: bigint }>(events: T[]): bigint {
  return events.reduce((total, event) => total + event.shares, ZERO)
}

function sumEventAssets<T extends { assets: bigint }>(events: T[]): bigint {
  return events.reduce((total, event) => total + event.assets, ZERO)
}

function hasAddressScopedFamilyActivity(
  txFamilyEvents: TRawPnlEvent[],
  familyVaultAddress: string,
  stakingVaultAddress: string | null
): boolean {
  return txFamilyEvents.some(
    (event) =>
      event.scopes.address &&
      (event.vaultAddress === familyVaultAddress ||
        (stakingVaultAddress !== null && event.vaultAddress === stakingVaultAddress))
  )
}

function shouldIncludeFamilyVaultAssetEvent(
  event: Extract<TRawPnlEvent, { kind: 'deposit' | 'withdrawal' }>,
  familyHasAddressActivity: boolean
): boolean {
  return event.scopes.address || familyHasAddressActivity
}

function isLedgerEmpty(ledger: FamilyPnlLedger): boolean {
  return (
    sumShares(ledger.vaultLots) === ZERO &&
    sumShares(ledger.stakedLots) === ZERO &&
    ledger.totalDepositedAssets === ZERO &&
    ledger.totalWithdrawnAssets === ZERO &&
    ledger.unknownCostBasisTransferInCount === 0 &&
    ledger.unmatchedTransferOutCount === 0 &&
    ledger.realizedEntries.length === 0
  )
}

function isDirectInteractionLedger(ledger: FamilyPnlLedger): boolean {
  return (
    ledger.totalDepositedAssets > ZERO ||
    ledger.totalWithdrawnAssets > ZERO ||
    ledger.realizedEntries.length > 0 ||
    ledger.eventCounts.migrationsIn > 0
  )
}

function hasCurrentShares(ledger: FamilyPnlLedger): boolean {
  return sumShares(ledger.vaultLots) > ZERO || sumShares(ledger.stakedLots) > ZERO
}

function isCurrentTransferOnlyHoldingsLedger(ledger: FamilyPnlLedger): boolean {
  return (
    hasCurrentShares(ledger) &&
    !isDirectInteractionLedger(ledger) &&
    ledger.realizedEntries.length === 0 &&
    ledger.unknownWithdrawalEntries.length === 0 &&
    [...ledger.vaultLots, ...ledger.stakedLots].every((lot) => lot.costBasis === null)
  )
}

type TDetectedKnownMigration = {
  chainId: number
  sourceFamilyVaultAddress: string
  destinationFamilyVaultAddress: string
  transactionHash: string
  blockTimestamp: number
  sourceTransferShares: bigint
  destinationDepositShares: bigint
  destinationDepositAssets: bigint
  sourceUnderlyingWithdrawCount: number
  sourceUnderlyingWithdrawAssets: bigint
  destinationUnderlyingDepositCount: number
  destinationUnderlyingDepositAssets: bigint
}

export function filterDirectInteractionLedgers(ledgers: Map<string, FamilyPnlLedger>): Map<string, FamilyPnlLedger> {
  return Array.from(ledgers.entries()).reduce<Map<string, FamilyPnlLedger>>((filtered, [key, ledger]) => {
    if (isDirectInteractionLedger(ledger)) {
      filtered.set(key, ledger)
    }

    return filtered
  }, new Map<string, FamilyPnlLedger>())
}

export function filterRelevantHoldingsLedgers(ledgers: Map<string, FamilyPnlLedger>): Map<string, FamilyPnlLedger> {
  return Array.from(ledgers.entries()).reduce<Map<string, FamilyPnlLedger>>((filtered, [key, ledger]) => {
    if (isDirectInteractionLedger(ledger) || hasCurrentShares(ledger)) {
      filtered.set(key, ledger)
    }

    return filtered
  }, new Map<string, FamilyPnlLedger>())
}

function applyRealization(
  ledger: FamilyPnlLedger,
  totalShares: bigint,
  totalAssets: bigint,
  stakingShares: bigint,
  vaultShares: bigint,
  timestamp: number
): {
  realizedPnlAssets: bigint
  knownShares: bigint
  unknownShares: bigint
  knownProceedsAssets: bigint
  knownCostBasisAssets: bigint
  consumedVaultShares: bigint
  consumedStakedShares: bigint
} {
  const consumedStaked = consumeFromLocation(ledger, 'staked', stakingShares)
  const consumedVault = consumeFromLocation(ledger, 'vault', vaultShares)
  const consumedLots = [...consumedStaked.consumedLots, ...consumedVault.consumedLots]
  const knownLots = consumedLots.filter((lot) => lot.costBasis !== null)
  const unknownLots = consumedLots.filter((lot) => lot.costBasis === null)
  const knownShares = sumShares(knownLots)
  const knownCostBasis = sumKnownCostBasis(knownLots)
  const knownProceeds = totalShares === ZERO ? ZERO : (totalAssets * knownShares) / totalShares
  const unknownShares = consumedStaked.consumedShares + consumedVault.consumedShares - knownShares
  const unknownProceeds = totalShares === ZERO ? ZERO : (totalAssets * unknownShares) / totalShares

  if (knownShares > ZERO) {
    ledger.realizedEntries.push({
      timestamp,
      proceedsAssets: knownProceeds,
      basisAssets: knownCostBasis,
      pnlAssets: knownProceeds - knownCostBasis,
      consumedLots: knownLots
    })
  }

  if (unknownShares > ZERO) {
    ledger.withdrawalsWithUnknownCostBasis += 1
    ledger.unknownWithdrawalEntries.push({
      timestamp,
      shares: unknownShares,
      proceedsAssets: unknownProceeds,
      consumedLots: unknownLots
    })
  }

  if (consumedStaked.consumedShares + consumedVault.consumedShares < totalShares) {
    ledger.unmatchedTransferOutCount += 1
    ledger.unmatchedTransferOutShares += totalShares - (consumedStaked.consumedShares + consumedVault.consumedShares)
  }

  return {
    realizedPnlAssets: knownShares > ZERO ? knownProceeds - knownCostBasis : ZERO,
    knownShares,
    unknownShares,
    knownProceedsAssets: knownProceeds,
    knownCostBasisAssets: knownCostBasis,
    consumedVaultShares: consumedVault.consumedShares,
    consumedStakedShares: consumedStaked.consumedShares
  }
}

function buildJournalView(parts: {
  acquiredToVault: bigint
  acquiredToStaked: bigint
  vaultRealizeShares: bigint
  stakingRealizeShares: bigint
  stakeShares: bigint
  unstakeShares: bigint
  rewardInVaultShares: bigint
  rewardInStakedShares: bigint
  unknownInVaultShares: bigint
  unknownInStakedShares: bigint
  transferOutVaultShares: bigint
  transferOutStakedShares: bigint
}): string {
  const labels: string[] = []

  if (parts.acquiredToVault > ZERO) labels.push('deposit->vault')
  if (parts.acquiredToStaked > ZERO) labels.push('deposit->staked')
  if (parts.vaultRealizeShares > ZERO) labels.push('withdraw<-vault')
  if (parts.stakingRealizeShares > ZERO) labels.push('withdraw<-staked')
  if (parts.stakeShares > ZERO) labels.push('stake')
  if (parts.unstakeShares > ZERO) labels.push('unstake')
  if (parts.rewardInVaultShares > ZERO) labels.push('reward_in_vault')
  if (parts.rewardInStakedShares > ZERO) labels.push('reward_in_staked')
  if (parts.unknownInVaultShares > ZERO) labels.push('transfer_in_vault_unknown')
  if (parts.unknownInStakedShares > ZERO) labels.push('transfer_in_staked_unknown')
  if (parts.transferOutVaultShares > ZERO) labels.push('transfer_out_vault')
  if (parts.transferOutStakedShares > ZERO) labels.push('transfer_out_staked')

  return labels.length > 0 ? labels.join(' + ') : 'no_position_change'
}

function addAcquisitionLots(
  ledger: FamilyPnlLedger,
  totalShares: bigint,
  totalAssets: bigint,
  stakedShares: bigint,
  vaultShares: bigint,
  timestamp: number
): void {
  if (totalShares === ZERO) {
    return
  }

  const stakedAssets = (totalAssets * stakedShares) / totalShares
  const vaultAssets = (totalAssets * vaultShares) / totalShares

  addLotsToLocation(ledger, 'staked', [createLot(stakedShares, stakedAssets, timestamp)])
  addLotsToLocation(ledger, 'vault', [createLot(vaultShares, vaultAssets, timestamp)])
}

function redistributeLotsToTargetShares(lots: TLot[], targetShares: bigint): TLot[] {
  const totalShares = sumShares(lots)

  if (totalShares === ZERO || targetShares === ZERO) {
    return []
  }

  let allocatedShares = ZERO

  return lots.reduce<TLot[]>((redistributed, lot, index) => {
    const shares =
      index === lots.length - 1 ? targetShares - allocatedShares : (targetShares * lot.shares) / totalShares

    allocatedShares += shares

    if (shares > ZERO) {
      redistributed.push(createLot(shares, lot.costBasis, lot.acquiredAt))
    }

    return redistributed
  }, [])
}

function handleUnknownTransferIn(
  ledger: FamilyPnlLedger,
  location: TLocation,
  shares: bigint,
  timestamp: number
): void {
  if (shares === ZERO) {
    return
  }

  ledger.eventCounts.externalTransfersIn += 1
  ledger.unknownCostBasisTransferInCount += 1
  ledger.unknownCostBasisTransferInShares += shares
  ledger.unknownTransferInEntries.push({
    timestamp,
    shares,
    location
  })
  addLotsToLocation(ledger, location, [createLot(shares, null, timestamp)])
}

function handleRewardTransferIn(
  ledger: FamilyPnlLedger,
  location: TLocation,
  shares: bigint,
  timestamp: number,
  distributor: string
): void {
  if (shares === ZERO) {
    return
  }

  ledger.eventCounts.rewardTransfersIn += 1
  ledger.rewardTransferInEntries.push({
    timestamp,
    shares,
    location,
    distributor
  })
  addLotsToLocation(ledger, location, [createLot(shares, ZERO, timestamp)])
}

function getRecognizedRewardTransferIns(
  txFamilyEvents: TRawPnlEvent[],
  userAddress: string,
  familyVaultAddress: string,
  stakingVaultAddress: string | null
): FamilyPnlLedger['rewardTransferInEntries'] {
  return txFamilyEvents.flatMap((event) => {
    if (
      event.kind !== 'transfer' ||
      !event.scopes.address ||
      event.receiver !== userAddress ||
      !isKnownZeroBasisRewardDistribution(event.chainId, event.sender, event.vaultAddress)
    ) {
      return []
    }

    if (event.vaultAddress === familyVaultAddress) {
      return [
        {
          timestamp: event.blockTimestamp,
          shares: event.shares,
          location: 'vault' as const,
          distributor: event.sender
        }
      ]
    }

    if (stakingVaultAddress !== null && event.vaultAddress === stakingVaultAddress) {
      return [
        {
          timestamp: event.blockTimestamp,
          shares: event.shares,
          location: 'staked' as const,
          distributor: event.sender
        }
      ]
    }

    return []
  })
}

function allocateRecognizedRewardTransferIns(
  rewardEntries: FamilyPnlLedger['rewardTransferInEntries'],
  availableVaultShares: bigint,
  availableStakedShares: bigint
): {
  allocatedEntries: FamilyPnlLedger['rewardTransferInEntries']
  rewardInVaultShares: bigint
  rewardInStakedShares: bigint
} {
  let remainingVaultShares = availableVaultShares
  let remainingStakedShares = availableStakedShares
  const allocatedEntries: FamilyPnlLedger['rewardTransferInEntries'] = []

  rewardEntries.forEach((entry) => {
    const availableShares = entry.location === 'vault' ? remainingVaultShares : remainingStakedShares
    const allocatedShares = minBigInt(entry.shares, availableShares)

    if (allocatedShares === ZERO) {
      return
    }

    allocatedEntries.push({
      ...entry,
      shares: allocatedShares
    })

    if (entry.location === 'vault') {
      remainingVaultShares -= allocatedShares
      return
    }

    remainingStakedShares -= allocatedShares
  })

  return {
    allocatedEntries,
    rewardInVaultShares: availableVaultShares - remainingVaultShares,
    rewardInStakedShares: availableStakedShares - remainingStakedShares
  }
}

function handleExternalTransferOut(ledger: FamilyPnlLedger, location: TLocation, shares: bigint): void {
  if (shares === ZERO) {
    return
  }

  ledger.eventCounts.externalTransfersOut += 1

  const consumed = consumeFromLocation(ledger, location, shares)

  if (consumed.consumedShares < shares) {
    ledger.unmatchedTransferOutCount += 1
    ledger.unmatchedTransferOutShares += shares - consumed.consumedShares
  }
}

function detectKnownMigratorCrossFamilyRollover(
  txEvents: TRawPnlEvent[],
  userAddress: string
): TDetectedKnownMigration | null {
  const txFamilyGroups = groupTransactionEventsByFamily(txEvents)
  const sourceFamilyCandidates = txFamilyGroups.filter((familyEvents) => {
    const addressTransfersToMigrator = familyEvents.filter(
      (event): event is Extract<TRawPnlEvent, { kind: 'transfer' }> =>
        event.kind === 'transfer' &&
        event.scopes.address &&
        event.sender === userAddress &&
        KNOWN_VAULT_ROLLOVER_INTERMEDIARIES.has(event.receiver)
    )

    if (addressTransfersToMigrator.length === 0) {
      return false
    }

    if (
      familyEvents.some((event) => event.scopes.address && (event.kind === 'deposit' || event.kind === 'withdrawal'))
    ) {
      return false
    }

    const migratorAddress = addressTransfersToMigrator[0]?.receiver ?? null

    if (migratorAddress === null || addressTransfersToMigrator.some((event) => event.receiver !== migratorAddress)) {
      return false
    }

    const burnedShares = sumEventShares(
      familyEvents.filter(
        (event): event is Extract<TRawPnlEvent, { kind: 'transfer' }> =>
          event.kind === 'transfer' && event.sender === migratorAddress && event.receiver === ZERO_ADDRESS
      )
    )

    return burnedShares > ZERO && burnedShares === sumEventShares(addressTransfersToMigrator)
  })
  const destinationFamilyCandidates = txFamilyGroups.filter((familyEvents) => {
    const addressDeposits = familyEvents.filter(
      (event): event is Extract<TRawPnlEvent, { kind: 'deposit' }> =>
        event.kind === 'deposit' && event.scopes.address && event.owner === userAddress
    )

    if (addressDeposits.length === 0) {
      return false
    }

    const mintedShares = sumEventShares(
      familyEvents.filter(
        (event): event is Extract<TRawPnlEvent, { kind: 'transfer' }> =>
          event.kind === 'transfer' &&
          event.scopes.address &&
          event.sender === ZERO_ADDRESS &&
          event.receiver === userAddress
      )
    )

    return mintedShares > ZERO
  })
  const sourceFamilyEvents = sourceFamilyCandidates[0]
  const destinationFamilyEvents = destinationFamilyCandidates[0]

  if (
    sourceFamilyCandidates.length !== 1 ||
    destinationFamilyCandidates.length !== 1 ||
    !sourceFamilyEvents ||
    !destinationFamilyEvents
  ) {
    return null
  }

  const sourceFamilyVaultAddress = sourceFamilyEvents[0]?.familyVaultAddress
  const destinationFamilyVaultAddress = destinationFamilyEvents[0]?.familyVaultAddress
  const chainId = sourceFamilyEvents[0]?.chainId

  if (
    !sourceFamilyVaultAddress ||
    !destinationFamilyVaultAddress ||
    chainId === undefined ||
    destinationFamilyEvents[0]?.chainId !== chainId ||
    sourceFamilyVaultAddress === destinationFamilyVaultAddress
  ) {
    return null
  }

  const sourceTransfersToMigrator = sourceFamilyEvents.filter(
    (event): event is Extract<TRawPnlEvent, { kind: 'transfer' }> =>
      event.kind === 'transfer' &&
      event.scopes.address &&
      event.sender === userAddress &&
      KNOWN_VAULT_ROLLOVER_INTERMEDIARIES.has(event.receiver)
  )
  const destinationDeposits = destinationFamilyEvents.filter(
    (event): event is Extract<TRawPnlEvent, { kind: 'deposit' }> =>
      event.kind === 'deposit' && event.scopes.address && event.owner === userAddress
  )
  const destinationMintsToUser = destinationFamilyEvents.filter(
    (event): event is Extract<TRawPnlEvent, { kind: 'transfer' }> =>
      event.kind === 'transfer' &&
      event.scopes.address &&
      event.sender === ZERO_ADDRESS &&
      event.receiver === userAddress
  )
  const sourceTransferShares = sumEventShares(sourceTransfersToMigrator)
  const destinationMintedShares = sumEventShares(destinationMintsToUser)
  const destinationDepositShares =
    destinationMintedShares > ZERO ? destinationMintedShares : sumEventShares(destinationDeposits)
  const destinationDepositAssets = sumEventAssets(destinationDeposits)

  if (sourceTransferShares === ZERO || destinationDepositShares === ZERO || destinationDepositAssets === ZERO) {
    return null
  }

  return {
    chainId,
    sourceFamilyVaultAddress,
    destinationFamilyVaultAddress,
    transactionHash: sourceFamilyEvents[0]?.transactionHash ?? destinationFamilyEvents[0]?.transactionHash ?? '',
    blockTimestamp: sourceFamilyEvents[0]?.blockTimestamp ?? destinationFamilyEvents[0]?.blockTimestamp ?? 0,
    sourceTransferShares,
    destinationDepositShares,
    destinationDepositAssets,
    sourceUnderlyingWithdrawCount: 0,
    sourceUnderlyingWithdrawAssets: ZERO,
    destinationUnderlyingDepositCount: 0,
    destinationUnderlyingDepositAssets: ZERO
  }
}

function detectKnownCompatibleAssetVaultCrossFamilyRollover(
  txEvents: TRawPnlEvent[],
  userAddress: string,
  vaultMetadata: Map<string, VaultMetadata>
): TDetectedKnownMigration | null {
  const txFamilyGroups = groupTransactionEventsByFamily(txEvents)
  const candidates = txFamilyGroups.flatMap((outerFamilyEvents) => {
    const outerFamilyVaultAddress = outerFamilyEvents[0]?.familyVaultAddress
    const chainId = outerFamilyEvents[0]?.chainId

    if (!outerFamilyVaultAddress || chainId === undefined) {
      return []
    }

    const outerMetadata = vaultMetadata.get(toVaultKey(chainId, outerFamilyVaultAddress))

    if (!outerMetadata) {
      return []
    }

    const innerFamilyVaultAddress = outerMetadata.token.address.toLowerCase()

    if (!isKnownCompatibleAssetVaultRollover(chainId, outerFamilyVaultAddress, innerFamilyVaultAddress)) {
      return []
    }

    const innerFamilyEvents = txFamilyGroups.find(
      (familyEvents) =>
        familyEvents[0]?.chainId === chainId && familyEvents[0]?.familyVaultAddress === innerFamilyVaultAddress
    )

    if (!innerFamilyEvents) {
      return []
    }

    const destinationDeposits = outerFamilyEvents.filter(
      (event): event is Extract<TRawPnlEvent, { kind: 'deposit' }> =>
        event.kind === 'deposit' && event.scopes.address && event.owner === userAddress
    )
    const destinationMintsToUser = outerFamilyEvents.filter(
      (event): event is Extract<TRawPnlEvent, { kind: 'transfer' }> =>
        event.kind === 'transfer' &&
        event.scopes.address &&
        event.sender === ZERO_ADDRESS &&
        event.receiver === userAddress
    )
    const sourceTransfersToOuterVault = innerFamilyEvents.filter(
      (event): event is Extract<TRawPnlEvent, { kind: 'transfer' }> =>
        event.kind === 'transfer' &&
        event.scopes.address &&
        event.sender === userAddress &&
        event.receiver === outerFamilyVaultAddress
    )
    const sourceTransferShares = sumEventShares(sourceTransfersToOuterVault)
    const destinationDepositAssets = sumEventAssets(destinationDeposits)
    const destinationMintedShares = sumEventShares(destinationMintsToUser)
    const destinationDepositShares =
      destinationMintedShares > ZERO ? destinationMintedShares : sumEventShares(destinationDeposits)

    if (
      sourceTransferShares > ZERO &&
      destinationDepositShares > ZERO &&
      destinationDepositAssets > ZERO &&
      destinationDepositAssets === sourceTransferShares
    ) {
      return [
        {
          chainId,
          sourceFamilyVaultAddress: innerFamilyVaultAddress,
          destinationFamilyVaultAddress: outerFamilyVaultAddress,
          transactionHash: innerFamilyEvents[0]?.transactionHash ?? outerFamilyEvents[0]?.transactionHash ?? '',
          blockTimestamp: innerFamilyEvents[0]?.blockTimestamp ?? outerFamilyEvents[0]?.blockTimestamp ?? 0,
          sourceTransferShares,
          destinationDepositShares,
          destinationDepositAssets,
          sourceUnderlyingWithdrawCount: 0,
          sourceUnderlyingWithdrawAssets: ZERO,
          destinationUnderlyingDepositCount: destinationDeposits.length,
          destinationUnderlyingDepositAssets: destinationDepositAssets
        }
      ]
    }

    const sourceWithdrawals = outerFamilyEvents.filter(
      (event): event is Extract<TRawPnlEvent, { kind: 'withdrawal' }> =>
        event.kind === 'withdrawal' && event.scopes.address && event.owner === userAddress
    )
    const sourceBurnedShares = sumEventShares(
      outerFamilyEvents.filter(
        (event): event is Extract<TRawPnlEvent, { kind: 'transfer' }> =>
          event.kind === 'transfer' &&
          event.scopes.address &&
          event.sender === userAddress &&
          event.receiver === ZERO_ADDRESS
      )
    )
    const destinationTransfersFromOuterVault = innerFamilyEvents.filter(
      (event): event is Extract<TRawPnlEvent, { kind: 'transfer' }> =>
        event.kind === 'transfer' &&
        event.scopes.address &&
        event.sender === outerFamilyVaultAddress &&
        event.receiver === userAddress
    )
    const sourceWithdrawShares = sumEventShares(sourceWithdrawals)
    const sourceWithdrawAssets = sumEventAssets(sourceWithdrawals)
    const destinationTransferShares = sumEventShares(destinationTransfersFromOuterVault)

    if (
      sourceWithdrawShares > ZERO &&
      sourceWithdrawAssets > ZERO &&
      destinationTransferShares > ZERO &&
      sourceWithdrawAssets === destinationTransferShares &&
      (sourceBurnedShares === ZERO || sourceBurnedShares === sourceWithdrawShares)
    ) {
      return [
        {
          chainId,
          sourceFamilyVaultAddress: outerFamilyVaultAddress,
          destinationFamilyVaultAddress: innerFamilyVaultAddress,
          transactionHash: outerFamilyEvents[0]?.transactionHash ?? innerFamilyEvents[0]?.transactionHash ?? '',
          blockTimestamp: outerFamilyEvents[0]?.blockTimestamp ?? innerFamilyEvents[0]?.blockTimestamp ?? 0,
          sourceTransferShares: sourceWithdrawShares,
          destinationDepositShares: destinationTransferShares,
          destinationDepositAssets: destinationTransferShares,
          sourceUnderlyingWithdrawCount: sourceWithdrawals.length,
          sourceUnderlyingWithdrawAssets: sourceWithdrawAssets,
          destinationUnderlyingDepositCount: 0,
          destinationUnderlyingDepositAssets: ZERO
        }
      ]
    }

    return []
  })

  return candidates.length === 1 ? candidates[0] : null
}

function detectKnownCrossFamilyRollover(
  txEvents: TRawPnlEvent[],
  userAddress: string,
  vaultMetadata: Map<string, VaultMetadata>
): TDetectedKnownMigration | null {
  return (
    detectKnownMigratorCrossFamilyRollover(txEvents, userAddress) ??
    detectKnownCompatibleAssetVaultCrossFamilyRollover(txEvents, userAddress, vaultMetadata)
  )
}

function processKnownCrossFamilyRollover(
  ledgers: Map<string, FamilyPnlLedger>,
  txEvents: TRawPnlEvent[],
  userAddress: string,
  vaultMetadata: Map<string, VaultMetadata>
): Set<string> {
  const migration = detectKnownCrossFamilyRollover(txEvents, userAddress, vaultMetadata)

  if (!migration) {
    return new Set()
  }

  const sourceLedger = getOrCreateLedger(ledgers, migration.chainId, migration.sourceFamilyVaultAddress)
  const destinationLedger = getOrCreateLedger(ledgers, migration.chainId, migration.destinationFamilyVaultAddress)
  const sourceFamilyEvents = txEvents.filter((event) => event.familyVaultAddress === migration.sourceFamilyVaultAddress)
  const destinationFamilyEvents = txEvents.filter(
    (event) => event.familyVaultAddress === migration.destinationFamilyVaultAddress
  )
  const sourceShouldLog = shouldLogLotTransactions(sourceLedger, migration.transactionHash)
  const destinationShouldLog = shouldLogLotTransactions(destinationLedger, migration.transactionHash)
  const includeDetailedLotLogs = shouldIncludeDetailedLotLogs()
  const sourceVaultLotsBefore = sourceShouldLog ? cloneLots(sourceLedger.vaultLots) : []
  const sourceStakedLotsBefore = sourceShouldLog ? cloneLots(sourceLedger.stakedLots) : []
  const destinationVaultLotsBefore = destinationShouldLog ? cloneLots(destinationLedger.vaultLots) : []
  const destinationStakedLotsBefore = destinationShouldLog ? cloneLots(destinationLedger.stakedLots) : []

  sourceLedger.eventCounts.migrationsOut += 1
  destinationLedger.eventCounts.migrationsIn += 1
  sourceLedger.totalWithdrawnAssets += migration.sourceUnderlyingWithdrawAssets
  sourceLedger.eventCounts.underlyingWithdrawals += migration.sourceUnderlyingWithdrawCount
  destinationLedger.totalDepositedAssets += migration.destinationUnderlyingDepositAssets
  destinationLedger.eventCounts.underlyingDeposits += migration.destinationUnderlyingDepositCount

  const sourceConsumed = consumeFromLocation(sourceLedger, 'vault', migration.sourceTransferShares)
  const knownSourceLots = sourceConsumed.consumedLots.filter((lot) => lot.costBasis !== null)
  const knownSourceShares = sumShares(knownSourceLots)
  const knownDestinationShares =
    migration.sourceTransferShares === ZERO
      ? ZERO
      : (migration.destinationDepositShares * knownSourceShares) / migration.sourceTransferShares
  const rolledLots = redistributeLotsToTargetShares(knownSourceLots, knownDestinationShares)
  const rolledShares = sumShares(rolledLots)
  const unknownDestinationShares = migration.destinationDepositShares - rolledShares
  const unmatchedSourceShares = migration.sourceTransferShares - sourceConsumed.consumedShares

  addLotsToLocation(destinationLedger, 'vault', rolledLots)

  if (unknownDestinationShares > ZERO) {
    destinationLedger.unknownCostBasisTransferInCount += 1
    destinationLedger.unknownCostBasisTransferInShares += unknownDestinationShares
    destinationLedger.unknownTransferInEntries.push({
      timestamp: migration.blockTimestamp,
      shares: unknownDestinationShares,
      location: 'vault'
    })
    addLotsToLocation(destinationLedger, 'vault', [createLot(unknownDestinationShares, null, migration.blockTimestamp)])
  }

  if (unmatchedSourceShares > ZERO) {
    sourceLedger.unmatchedTransferOutCount += 1
    sourceLedger.unmatchedTransferOutShares += unmatchedSourceShares
  }

  sourceLedger.debugJournal.push({
    timestamp: migration.blockTimestamp,
    txHash: migration.transactionHash,
    familyVaultAddress: migration.sourceFamilyVaultAddress,
    stakingVaultAddress: sourceLedger.stakingVaultAddress,
    view: 'migrate_out',
    hasAddressActivity: true,
    rawEvents: countTxEventsByKind(sourceFamilyEvents),
    depositShares: ZERO.toString(),
    depositAssets: ZERO.toString(),
    withdrawShares: ZERO.toString(),
    withdrawAssets: ZERO.toString(),
    stakeShares: ZERO.toString(),
    unstakeShares: ZERO.toString(),
    rewardInVaultShares: ZERO.toString(),
    rewardInStakedShares: ZERO.toString(),
    unknownInVaultShares: ZERO.toString(),
    unknownInStakedShares: ZERO.toString(),
    transferOutVaultShares: migration.sourceTransferShares.toString(),
    transferOutStakedShares: ZERO.toString(),
    realizedKnownShares: ZERO.toString(),
    realizedProceedsAssets: ZERO.toString(),
    realizedBasisAssets: ZERO.toString(),
    realizedPnlAssets: ZERO.toString(),
    vaultLotsBefore: summarizeLots(sourceVaultLotsBefore),
    stakedLotsBefore: summarizeLots(sourceStakedLotsBefore),
    vaultLotsAfter: summarizeLots(sourceLedger.vaultLots),
    stakedLotsAfter: summarizeLots(sourceLedger.stakedLots)
  })

  destinationLedger.debugJournal.push({
    timestamp: migration.blockTimestamp,
    txHash: migration.transactionHash,
    familyVaultAddress: migration.destinationFamilyVaultAddress,
    stakingVaultAddress: destinationLedger.stakingVaultAddress,
    view: 'migrate_in->vault',
    hasAddressActivity: true,
    rawEvents: countTxEventsByKind(destinationFamilyEvents),
    depositShares: migration.destinationDepositShares.toString(),
    depositAssets: migration.destinationDepositAssets.toString(),
    withdrawShares: ZERO.toString(),
    withdrawAssets: ZERO.toString(),
    stakeShares: ZERO.toString(),
    unstakeShares: ZERO.toString(),
    rewardInVaultShares: ZERO.toString(),
    rewardInStakedShares: ZERO.toString(),
    unknownInVaultShares: unknownDestinationShares.toString(),
    unknownInStakedShares: ZERO.toString(),
    transferOutVaultShares: ZERO.toString(),
    transferOutStakedShares: ZERO.toString(),
    realizedKnownShares: ZERO.toString(),
    realizedProceedsAssets: ZERO.toString(),
    realizedBasisAssets: ZERO.toString(),
    realizedPnlAssets: ZERO.toString(),
    vaultLotsBefore: summarizeLots(destinationVaultLotsBefore),
    stakedLotsBefore: summarizeLots(destinationStakedLotsBefore),
    vaultLotsAfter: summarizeLots(destinationLedger.vaultLots),
    stakedLotsAfter: summarizeLots(destinationLedger.stakedLots)
  })

  if (sourceShouldLog) {
    debugLog('pnl-lots', 'processed family transaction', {
      chainId: migration.chainId,
      familyVaultAddress: migration.sourceFamilyVaultAddress,
      stakingVaultAddress: sourceLedger.stakingVaultAddress,
      transactionHash: migration.transactionHash,
      blockTimestamp: migration.blockTimestamp,
      view: 'migrate_out',
      sourceTransferShares: migration.sourceTransferShares.toString(),
      knownRolledSourceShares: knownSourceShares.toString(),
      unmatchedSourceShares: unmatchedSourceShares.toString(),
      vaultLotsBefore: summarizeLots(sourceVaultLotsBefore),
      stakedLotsBefore: summarizeLots(sourceStakedLotsBefore),
      vaultLotsAfter: summarizeLots(sourceLedger.vaultLots),
      stakedLotsAfter: summarizeLots(sourceLedger.stakedLots),
      events: includeDetailedLotLogs ? sourceFamilyEvents.map(serializeRawEvent) : undefined,
      vaultLotEntriesBefore: includeDetailedLotLogs ? serializeLots(sourceVaultLotsBefore) : undefined,
      stakedLotEntriesBefore: includeDetailedLotLogs ? serializeLots(sourceStakedLotsBefore) : undefined,
      vaultLotEntriesAfter: includeDetailedLotLogs ? serializeLots(sourceLedger.vaultLots) : undefined,
      stakedLotEntriesAfter: includeDetailedLotLogs ? serializeLots(sourceLedger.stakedLots) : undefined
    })
  }

  if (destinationShouldLog) {
    debugLog('pnl-lots', 'processed family transaction', {
      chainId: migration.chainId,
      familyVaultAddress: migration.destinationFamilyVaultAddress,
      stakingVaultAddress: destinationLedger.stakingVaultAddress,
      transactionHash: migration.transactionHash,
      blockTimestamp: migration.blockTimestamp,
      view: 'migrate_in->vault',
      sourceFamilyVaultAddress: migration.sourceFamilyVaultAddress,
      destinationDepositShares: migration.destinationDepositShares.toString(),
      destinationDepositAssets: migration.destinationDepositAssets.toString(),
      rolledKnownShares: rolledShares.toString(),
      rolledKnownCostBasisAssets: sumKnownCostBasis(rolledLots).toString(),
      unknownDestinationShares: unknownDestinationShares.toString(),
      vaultLotsBefore: summarizeLots(destinationVaultLotsBefore),
      stakedLotsBefore: summarizeLots(destinationStakedLotsBefore),
      vaultLotsAfter: summarizeLots(destinationLedger.vaultLots),
      stakedLotsAfter: summarizeLots(destinationLedger.stakedLots),
      events: includeDetailedLotLogs ? destinationFamilyEvents.map(serializeRawEvent) : undefined,
      vaultLotEntriesBefore: includeDetailedLotLogs ? serializeLots(destinationVaultLotsBefore) : undefined,
      stakedLotEntriesBefore: includeDetailedLotLogs ? serializeLots(destinationStakedLotsBefore) : undefined,
      vaultLotEntriesAfter: includeDetailedLotLogs ? serializeLots(destinationLedger.vaultLots) : undefined,
      stakedLotEntriesAfter: includeDetailedLotLogs ? serializeLots(destinationLedger.stakedLots) : undefined
    })
  }

  return new Set([
    toVaultKey(migration.chainId, migration.sourceFamilyVaultAddress),
    toVaultKey(migration.chainId, migration.destinationFamilyVaultAddress)
  ])
}

function isSameVaultRolloverTransaction(parts: {
  txFamilyEvents: TRawPnlEvent[]
  txUnderlyingDeposits: Array<Extract<TRawPnlEvent, { kind: 'deposit' }>>
  txUnderlyingWithdrawals: Array<Extract<TRawPnlEvent, { kind: 'withdrawal' }>>
  familyVaultAddress: string
  totalUnderlyingDepositAssets: bigint
  totalUnderlyingWithdrawAssets: bigint
  stakingDelta: bigint
}): boolean {
  return (
    parts.txFamilyEvents.length >= 4 &&
    parts.txFamilyEvents.every((event) => event.vaultAddress === parts.familyVaultAddress) &&
    parts.txUnderlyingDeposits.length === 1 &&
    parts.txUnderlyingWithdrawals.length === 1 &&
    parts.totalUnderlyingDepositAssets > ZERO &&
    parts.totalUnderlyingDepositAssets === parts.totalUnderlyingWithdrawAssets &&
    parts.stakingDelta === ZERO
  )
}

function processFamilyTransaction(ledger: FamilyPnlLedger, txFamilyEvents: TRawPnlEvent[], userAddress: string): void {
  const familyVaultAddress = ledger.vaultAddress
  const stakingVaultAddress = ledger.stakingVaultAddress
  const transactionHash = txFamilyEvents[0]?.transactionHash ?? ''
  const shouldLogTransactionLots = shouldLogLotTransactions(ledger, transactionHash)
  const includeDetailedLotLogs = shouldIncludeDetailedLotLogs()
  const vaultLotsBefore = shouldLogTransactionLots ? cloneLots(ledger.vaultLots) : []
  const stakedLotsBefore = shouldLogTransactionLots ? cloneLots(ledger.stakedLots) : []
  const familyHasAddressActivity = hasAddressScopedFamilyActivity(
    txFamilyEvents,
    familyVaultAddress,
    stakingVaultAddress
  )
  const txUnderlyingDeposits = txFamilyEvents.filter(
    (event): event is Extract<TRawPnlEvent, { kind: 'deposit' }> =>
      event.kind === 'deposit' &&
      event.vaultAddress === familyVaultAddress &&
      shouldIncludeFamilyVaultAssetEvent(event, familyHasAddressActivity)
  )
  const txUnderlyingWithdrawals = txFamilyEvents.filter(
    (event): event is Extract<TRawPnlEvent, { kind: 'withdrawal' }> =>
      event.kind === 'withdrawal' &&
      event.vaultAddress === familyVaultAddress &&
      shouldIncludeFamilyVaultAssetEvent(event, familyHasAddressActivity)
  )
  const underlyingDelta = calculateUserContractDelta(txFamilyEvents, userAddress, familyVaultAddress)
  const stakingDelta =
    stakingVaultAddress === null ? ZERO : calculateUserContractDelta(txFamilyEvents, userAddress, stakingVaultAddress)
  const totalUnderlyingDepositShares = sumEventShares(txUnderlyingDeposits)
  const totalUnderlyingDepositAssets = sumEventAssets(txUnderlyingDeposits)
  const totalUnderlyingWithdrawShares = sumEventShares(txUnderlyingWithdrawals)
  const totalUnderlyingWithdrawAssets = sumEventAssets(txUnderlyingWithdrawals)

  if (
    isSameVaultRolloverTransaction({
      txFamilyEvents,
      txUnderlyingDeposits,
      txUnderlyingWithdrawals,
      familyVaultAddress,
      totalUnderlyingDepositAssets,
      totalUnderlyingWithdrawAssets,
      stakingDelta
    })
  ) {
    const vaultConsumed = consumeLots(ledger.vaultLots, totalUnderlyingWithdrawShares)
    const stakedConsumed = consumeLots(ledger.stakedLots, ZERO)
    const consumedShares = vaultConsumed.consumedShares + stakedConsumed.consumedShares

    if (consumedShares === totalUnderlyingWithdrawShares) {
      const rolledLots = redistributeLotsToTargetShares(vaultConsumed.consumedLots, totalUnderlyingDepositShares)

      ledger.vaultLots = [...vaultConsumed.nextLots, ...rolledLots]

      ledger.debugJournal.push({
        timestamp: txFamilyEvents[0]?.blockTimestamp ?? 0,
        txHash: transactionHash,
        familyVaultAddress,
        stakingVaultAddress,
        view: 'same_vault_rollover->vault',
        hasAddressActivity: familyHasAddressActivity,
        rawEvents: countTxEventsByKind(txFamilyEvents),
        depositShares: totalUnderlyingDepositShares.toString(),
        depositAssets: totalUnderlyingDepositAssets.toString(),
        withdrawShares: totalUnderlyingWithdrawShares.toString(),
        withdrawAssets: totalUnderlyingWithdrawAssets.toString(),
        stakeShares: ZERO.toString(),
        unstakeShares: ZERO.toString(),
        rewardInVaultShares: ZERO.toString(),
        rewardInStakedShares: ZERO.toString(),
        unknownInVaultShares: ZERO.toString(),
        unknownInStakedShares: ZERO.toString(),
        transferOutVaultShares: ZERO.toString(),
        transferOutStakedShares: ZERO.toString(),
        realizedKnownShares: ZERO.toString(),
        realizedProceedsAssets: ZERO.toString(),
        realizedBasisAssets: ZERO.toString(),
        realizedPnlAssets: ZERO.toString(),
        vaultLotsBefore: summarizeLots(vaultLotsBefore),
        stakedLotsBefore: summarizeLots(stakedLotsBefore),
        vaultLotsAfter: summarizeLots(ledger.vaultLots),
        stakedLotsAfter: summarizeLots(ledger.stakedLots)
      })

      if (shouldLogTransactionLots) {
        debugLog('pnl-lots', 'processed family transaction', {
          chainId: ledger.chainId,
          familyVaultAddress,
          stakingVaultAddress,
          transactionHash,
          blockTimestamp: txFamilyEvents[0]?.blockTimestamp ?? null,
          familyHasAddressActivity,
          eventCount: txFamilyEvents.length,
          view: 'same_vault_rollover->vault',
          totalUnderlyingDepositShares: totalUnderlyingDepositShares.toString(),
          totalUnderlyingDepositAssets: totalUnderlyingDepositAssets.toString(),
          totalUnderlyingWithdrawShares: totalUnderlyingWithdrawShares.toString(),
          totalUnderlyingWithdrawAssets: totalUnderlyingWithdrawAssets.toString(),
          rolledLotCount: rolledLots.length,
          rolledKnownCostBasisAssets: sumKnownCostBasis(rolledLots.filter((lot) => lot.costBasis !== null)).toString(),
          vaultLotsBefore: summarizeLots(vaultLotsBefore),
          stakedLotsBefore: summarizeLots(stakedLotsBefore),
          vaultLotsAfter: summarizeLots(ledger.vaultLots),
          stakedLotsAfter: summarizeLots(ledger.stakedLots),
          events: includeDetailedLotLogs ? txFamilyEvents.map(serializeRawEvent) : undefined,
          vaultLotEntriesBefore: includeDetailedLotLogs ? serializeLots(vaultLotsBefore) : undefined,
          stakedLotEntriesBefore: includeDetailedLotLogs ? serializeLots(stakedLotsBefore) : undefined,
          vaultLotEntriesAfter: includeDetailedLotLogs ? serializeLots(ledger.vaultLots) : undefined,
          stakedLotEntriesAfter: includeDetailedLotLogs ? serializeLots(ledger.stakedLots) : undefined
        })
      }

      return
    }
  }

  ledger.totalDepositedAssets += totalUnderlyingDepositAssets
  ledger.totalWithdrawnAssets += totalUnderlyingWithdrawAssets
  ledger.eventCounts.underlyingDeposits += txUnderlyingDeposits.length
  ledger.eventCounts.underlyingWithdrawals += txUnderlyingWithdrawals.length

  const stakingRealizeShares = minBigInt(negativeBigIntMagnitude(stakingDelta), totalUnderlyingWithdrawShares)
  const vaultRealizeShares = totalUnderlyingWithdrawShares - stakingRealizeShares

  const realization = applyRealization(
    ledger,
    totalUnderlyingWithdrawShares,
    totalUnderlyingWithdrawAssets,
    stakingRealizeShares,
    vaultRealizeShares,
    txFamilyEvents[0]?.blockTimestamp ?? 0
  )

  const acquiredToStaked = minBigInt(positiveBigInt(stakingDelta), totalUnderlyingDepositShares)
  const acquiredToVault = minBigInt(positiveBigInt(underlyingDelta), totalUnderlyingDepositShares - acquiredToStaked)

  addAcquisitionLots(
    ledger,
    totalUnderlyingDepositShares,
    totalUnderlyingDepositAssets,
    acquiredToStaked,
    acquiredToVault,
    txFamilyEvents[0]?.blockTimestamp ?? 0
  )

  const remainingUnderlyingDelta = underlyingDelta - acquiredToVault + vaultRealizeShares
  const remainingStakingDelta = stakingDelta - acquiredToStaked + stakingRealizeShares
  const stakeShares = minBigInt(
    negativeBigIntMagnitude(remainingUnderlyingDelta),
    positiveBigInt(remainingStakingDelta)
  )
  const remainingUnderlyingAfterWrap = remainingUnderlyingDelta + stakeShares
  const remainingStakingAfterWrap = remainingStakingDelta - stakeShares
  const unstakeShares = minBigInt(
    negativeBigIntMagnitude(remainingStakingAfterWrap),
    positiveBigInt(remainingUnderlyingAfterWrap)
  )
  const finalUnderlyingDelta = remainingUnderlyingAfterWrap - unstakeShares
  const finalStakingDelta = remainingStakingAfterWrap + unstakeShares
  const rewardAllocation = allocateRecognizedRewardTransferIns(
    getRecognizedRewardTransferIns(txFamilyEvents, userAddress, familyVaultAddress, stakingVaultAddress),
    positiveBigInt(finalUnderlyingDelta),
    positiveBigInt(finalStakingDelta)
  )
  const rewardInVaultShares = rewardAllocation.rewardInVaultShares
  const rewardInStakedShares = rewardAllocation.rewardInStakedShares
  const unknownInVaultShares = positiveBigInt(finalUnderlyingDelta) - rewardInVaultShares
  const unknownInStakedShares = positiveBigInt(finalStakingDelta) - rewardInStakedShares
  const transferOutVaultShares = negativeBigIntMagnitude(finalUnderlyingDelta)
  const transferOutStakedShares = negativeBigIntMagnitude(finalStakingDelta)

  if (stakeShares > ZERO) {
    ledger.eventCounts.stakes += 1
    moveBetweenLocations(ledger, 'vault', 'staked', stakeShares)
  }

  if (unstakeShares > ZERO) {
    ledger.eventCounts.unstakes += 1
    moveBetweenLocations(ledger, 'staked', 'vault', unstakeShares)
  }

  rewardAllocation.allocatedEntries.forEach((entry) => {
    handleRewardTransferIn(ledger, entry.location, entry.shares, entry.timestamp, entry.distributor)
  })
  handleUnknownTransferIn(ledger, 'vault', unknownInVaultShares, txFamilyEvents[0]?.blockTimestamp ?? 0)
  handleUnknownTransferIn(ledger, 'staked', unknownInStakedShares, txFamilyEvents[0]?.blockTimestamp ?? 0)
  handleExternalTransferOut(ledger, 'vault', transferOutVaultShares)
  handleExternalTransferOut(ledger, 'staked', transferOutStakedShares)

  ledger.debugJournal.push({
    timestamp: txFamilyEvents[0]?.blockTimestamp ?? 0,
    txHash: transactionHash,
    familyVaultAddress,
    stakingVaultAddress,
    view: buildJournalView({
      acquiredToVault,
      acquiredToStaked,
      vaultRealizeShares,
      stakingRealizeShares,
      stakeShares,
      unstakeShares,
      rewardInVaultShares,
      rewardInStakedShares,
      unknownInVaultShares,
      unknownInStakedShares,
      transferOutVaultShares,
      transferOutStakedShares
    }),
    hasAddressActivity: familyHasAddressActivity,
    rawEvents: countTxEventsByKind(txFamilyEvents),
    depositShares: totalUnderlyingDepositShares.toString(),
    depositAssets: totalUnderlyingDepositAssets.toString(),
    withdrawShares: totalUnderlyingWithdrawShares.toString(),
    withdrawAssets: totalUnderlyingWithdrawAssets.toString(),
    stakeShares: stakeShares.toString(),
    unstakeShares: unstakeShares.toString(),
    rewardInVaultShares: rewardInVaultShares.toString(),
    rewardInStakedShares: rewardInStakedShares.toString(),
    unknownInVaultShares: unknownInVaultShares.toString(),
    unknownInStakedShares: unknownInStakedShares.toString(),
    transferOutVaultShares: transferOutVaultShares.toString(),
    transferOutStakedShares: transferOutStakedShares.toString(),
    realizedKnownShares: realization.knownShares.toString(),
    realizedProceedsAssets: realization.knownProceedsAssets.toString(),
    realizedBasisAssets: realization.knownCostBasisAssets.toString(),
    realizedPnlAssets: realization.realizedPnlAssets.toString(),
    vaultLotsBefore: summarizeLots(vaultLotsBefore),
    stakedLotsBefore: summarizeLots(stakedLotsBefore),
    vaultLotsAfter: summarizeLots(ledger.vaultLots),
    stakedLotsAfter: summarizeLots(ledger.stakedLots)
  })

  if (shouldLogTransactionLots) {
    debugLog('pnl-lots', 'processed family transaction', {
      chainId: ledger.chainId,
      familyVaultAddress,
      stakingVaultAddress,
      transactionHash,
      blockTimestamp: txFamilyEvents[0]?.blockTimestamp ?? null,
      familyHasAddressActivity,
      eventCount: txFamilyEvents.length,
      underlyingDelta: underlyingDelta.toString(),
      stakingDelta: stakingDelta.toString(),
      totalUnderlyingDepositShares: totalUnderlyingDepositShares.toString(),
      totalUnderlyingDepositAssets: totalUnderlyingDepositAssets.toString(),
      totalUnderlyingWithdrawShares: totalUnderlyingWithdrawShares.toString(),
      totalUnderlyingWithdrawAssets: totalUnderlyingWithdrawAssets.toString(),
      acquiredToVault: acquiredToVault.toString(),
      acquiredToStaked: acquiredToStaked.toString(),
      vaultRealizeShares: vaultRealizeShares.toString(),
      stakingRealizeShares: stakingRealizeShares.toString(),
      stakeShares: stakeShares.toString(),
      unstakeShares: unstakeShares.toString(),
      rewardInVaultShares: rewardInVaultShares.toString(),
      rewardInStakedShares: rewardInStakedShares.toString(),
      finalUnderlyingDelta: finalUnderlyingDelta.toString(),
      finalStakingDelta: finalStakingDelta.toString(),
      realizedKnownShares: realization.knownShares.toString(),
      realizedProceedsAssets: realization.knownProceedsAssets.toString(),
      realizedBasisAssets: realization.knownCostBasisAssets.toString(),
      realizedPnlAssets: realization.realizedPnlAssets.toString(),
      vaultLotsBefore: summarizeLots(vaultLotsBefore),
      stakedLotsBefore: summarizeLots(stakedLotsBefore),
      vaultLotsAfter: summarizeLots(ledger.vaultLots),
      stakedLotsAfter: summarizeLots(ledger.stakedLots),
      events: includeDetailedLotLogs ? txFamilyEvents.map(serializeRawEvent) : undefined,
      vaultLotEntriesBefore: includeDetailedLotLogs ? serializeLots(vaultLotsBefore) : undefined,
      stakedLotEntriesBefore: includeDetailedLotLogs ? serializeLots(stakedLotsBefore) : undefined,
      vaultLotEntriesAfter: includeDetailedLotLogs ? serializeLots(ledger.vaultLots) : undefined,
      stakedLotEntriesAfter: includeDetailedLotLogs ? serializeLots(ledger.stakedLots) : undefined
    })
  }
}

export function processRawPnlEvents(
  events: TRawPnlEvent[],
  userAddress: string,
  vaultMetadata: Map<string, VaultMetadata> = new Map<string, VaultMetadata>()
): Map<string, FamilyPnlLedger> {
  const ledgers = new Map<string, FamilyPnlLedger>()
  const userAddressLower = userAddress.toLowerCase()

  // Process transactions in two passes:
  // 1. detect cross-family migrations that should carry basis across vaults
  // 2. interpret the remaining per-family activity as deposits, withdrawals, stakes, unstakes, or transfers
  groupEventsByTransaction(events).forEach((txEvents) => {
    const handledFamilyKeys = processKnownCrossFamilyRollover(ledgers, txEvents, userAddressLower, vaultMetadata)

    groupTransactionEventsByFamily(txEvents).forEach((txFamilyEvents) => {
      const familyVaultAddress = txFamilyEvents[0]?.familyVaultAddress
      const chainId = txFamilyEvents[0]?.chainId

      if (!familyVaultAddress || chainId === undefined) {
        return
      }

      if (handledFamilyKeys.has(toVaultKey(chainId, familyVaultAddress))) {
        return
      }

      const ledger = getOrCreateLedger(ledgers, chainId, familyVaultAddress)
      processFamilyTransaction(ledger, txFamilyEvents, userAddressLower)
    })
  })

  return Array.from(ledgers.entries()).reduce<Map<string, FamilyPnlLedger>>((filtered, [key, ledger]) => {
    if (!isLedgerEmpty(ledger)) {
      filtered.set(key, ledger)
    }

    return filtered
  }, new Map<string, FamilyPnlLedger>())
}

async function computeHoldingsPnLArtifacts(
  userAddress: string,
  version: VaultVersion,
  unknownTransferInPnlMode: UnknownTransferInPnlMode,
  fetchType: HoldingsEventFetchType,
  paginationMode: HoldingsEventPaginationMode
): Promise<TPnlComputationArtifacts> {
  debugLog('pnl', 'starting holdings pnl calculation', { version, unknownTransferInPnlMode, fetchType, paginationMode })
  const rawContext = await fetchRawUserPnlEvents(userAddress, 'all', undefined, fetchType, paginationMode)
  debugLog('pnl', 'loaded raw pnl event context', {
    addressDeposits: rawContext.addressEvents.deposits.length,
    addressWithdrawals: rawContext.addressEvents.withdrawals.length,
    addressTransfersIn: rawContext.addressEvents.transfersIn.length,
    addressTransfersOut: rawContext.addressEvents.transfersOut.length,
    txDeposits: rawContext.transactionEvents.deposits.length,
    txWithdrawals: rawContext.transactionEvents.withdrawals.length,
    txTransfers: rawContext.transactionEvents.transfers.length
  })
  const rawEvents = await enrichRawPnlEventsWithCowTradeAcquisitions(buildRawPnlEvents(rawContext), userAddress)
  const rawVaultIdentifiers = Array.from(
    rawEvents.reduce<Map<string, { chainId: number; vaultAddress: string }>>((identifiers, event) => {
      const key = toVaultKey(event.chainId, event.familyVaultAddress)

      if (!identifiers.has(key)) {
        identifiers.set(key, {
          chainId: event.chainId,
          vaultAddress: event.familyVaultAddress
        })
      }

      return identifiers
    }, new Map<string, { chainId: number; vaultAddress: string }>())
  ).map(([, identifier]) => identifier)
  const resolvedVaultMetadata = await fetchMultipleVaultsMetadata(rawVaultIdentifiers)
  const debugTxLedgerKeys = getDebugTxLedgerKeys(rawEvents)
  const rawLedgers = processRawPnlEvents(rawEvents, userAddress, resolvedVaultMetadata)
  const directInteractionLedgers = filterDirectInteractionLedgers(rawLedgers)
  const ledgers = filterRelevantHoldingsLedgers(rawLedgers)
  const vaults = Array.from(ledgers.values())
  const currentTimestamp = Math.floor(Date.now() / 1000)
  debugLog('pnl', 'processed raw pnl events into ledgers', {
    rawLedgers: rawLedgers.size,
    directInteractionLedgers: directInteractionLedgers.size,
    relevantHoldingsLedgers: ledgers.size,
    currentTimestamp
  })

  if (vaults.length === 0) {
    debugLog('pnl', 'no pnl ledgers produced for address')
    return {
      userAddress,
      version,
      unknownTransferInPnlMode,
      currentTimestamp,
      vaults: [],
      vaultMetadata: new Map<string, VaultMetadata>(),
      ppsData: new Map<string, Map<number, number>>(),
      priceData: new Map<string, Map<number, number>>(),
      debugTxLedgerKeys
    }
  }

  const filteredVaults = filterVaultsByAuthoritativeVersion(vaults, resolvedVaultMetadata, version)
  const filteredVaultIdentifiers = filteredVaults.map((vault) => ({
    chainId: vault.chainId,
    vaultAddress: vault.vaultAddress
  }))
  const vaultMetadata = filteredVaultIdentifiers.reduce<Map<string, VaultMetadata>>((filtered, vault) => {
    const key = toVaultKey(vault.chainId, vault.vaultAddress)
    const metadata = resolvedVaultMetadata.get(key)
    if (metadata) {
      filtered.set(key, metadata)
    }
    return filtered
  }, new Map<string, VaultMetadata>())

  if (version !== 'all') {
    debugLog('pnl', 'filtered pnl ledgers by authoritative vault version', {
      requestedVersion: version,
      ledgersBefore: vaults.length,
      ledgersAfter: filteredVaults.length,
      metadataResolved: resolvedVaultMetadata.size
    })
  }

  if (filteredVaults.length === 0) {
    debugLog('pnl', 'no pnl ledgers matched requested version after authoritative vault filtering', {
      requestedVersion: version,
      ledgersBefore: vaults.length
    })
    return {
      userAddress,
      version,
      unknownTransferInPnlMode,
      currentTimestamp,
      vaults: [],
      vaultMetadata,
      ppsData: new Map<string, Map<number, number>>(),
      priceData: new Map<string, Map<number, number>>(),
      debugTxLedgerKeys
    }
  }

  const ppsData = await fetchMultipleVaultsPPS(filteredVaultIdentifiers)
  debugLog('pnl', 'resolved vault metadata and PPS', {
    vaults: filteredVaultIdentifiers.length,
    metadataResolved: vaultMetadata.size,
    ppsResolved: ppsData.size,
    emptyPpsTimelines: Array.from(ppsData.values()).filter((timeline) => timeline.size === 0).length
  })
  const historicalPriceLedgers = filteredVaults.filter((vault) => !isCurrentTransferOnlyHoldingsLedger(vault))
  const timestamps = [
    ...new Set([
      currentTimestamp,
      ...historicalPriceLedgers.flatMap((vault) => vault.realizedEntries.map((entry) => entry.timestamp)),
      ...historicalPriceLedgers.flatMap((vault) =>
        [...vault.vaultLots, ...vault.stakedLots]
          .map((lot) => lot.acquiredAt)
          .filter((timestamp): timestamp is number => timestamp !== undefined)
      ),
      ...historicalPriceLedgers.flatMap((vault) =>
        vault.realizedEntries.flatMap((entry) =>
          entry.consumedLots
            .map((lot) => lot.acquiredAt)
            .filter((timestamp): timestamp is number => timestamp !== undefined)
        )
      ),
      ...historicalPriceLedgers.flatMap((vault) => vault.unknownTransferInEntries.map((entry) => entry.timestamp)),
      ...historicalPriceLedgers.flatMap((vault) => vault.unknownWithdrawalEntries.map((entry) => entry.timestamp)),
      ...historicalPriceLedgers.flatMap((vault) =>
        vault.unknownWithdrawalEntries.flatMap((entry) =>
          entry.consumedLots
            .map((lot) => lot.acquiredAt)
            .filter((timestamp): timestamp is number => timestamp !== undefined)
        )
      )
    ])
  ].sort((a, b) => a - b)
  const seenTokens = new Set<string>()
  const tokens = filteredVaultIdentifiers.reduce<Array<{ chainId: number; address: string }>>((allTokens, vault) => {
    const metadata = vaultMetadata.get(toVaultKey(vault.chainId, vault.vaultAddress))

    if (!metadata) {
      return allTokens
    }

    const tokenKey = `${metadata.chainId}:${metadata.token.address.toLowerCase()}`

    if (seenTokens.has(tokenKey)) {
      return allTokens
    }

    seenTokens.add(tokenKey)
    allTokens.push({
      chainId: metadata.chainId,
      address: metadata.token.address
    })
    return allTokens
  }, [])
  const priceData = await fetchHistoricalPrices(tokens, timestamps)
  debugLog('pnl', 'resolved token prices for pnl', {
    tokens: tokens.length,
    timestamps: timestamps.length,
    priceKeys: priceData.size
  })

  return {
    userAddress,
    version,
    unknownTransferInPnlMode,
    currentTimestamp,
    vaults: filteredVaults,
    vaultMetadata,
    ppsData,
    priceData,
    debugTxLedgerKeys
  }
}

function materializeHoldingsPnLVault(vault: FamilyPnlLedger, artifacts: TPnlComputationArtifacts): HoldingsPnLVault {
  const { currentTimestamp, debugTxLedgerKeys, priceData, ppsData, unknownTransferInPnlMode, vaultMetadata } = artifacts
  const vaultKey = toVaultKey(vault.chainId, vault.vaultAddress)
  const metadata = vaultMetadata.get(vaultKey) ?? null
  const ppsMap = ppsData.get(vaultKey)
  const pricePerShare = ppsMap ? getPPS(ppsMap, currentTimestamp) : null
  const priceKey = metadata ? `${getChainPrefix(vault.chainId)}:${metadata.token.address.toLowerCase()}` : null
  const tokenPriceMap = priceKey ? priceData.get(priceKey) : null
  const tokenPrice = tokenPriceMap ? getPriceAtTimestamp(tokenPriceMap, currentTimestamp) : 0
  const resolvedPricePerShare = pricePerShare ?? 0
  const vaultSharesRaw = sumShares(vault.vaultLots)
  const stakedSharesRaw = sumShares(vault.stakedLots)
  const totalSharesRaw = vaultSharesRaw + stakedSharesRaw
  const knownLots = [...vault.vaultLots, ...vault.stakedLots].filter((lot) => lot.costBasis !== null)
  const unknownLots = [...vault.vaultLots, ...vault.stakedLots].filter((lot) => lot.costBasis === null)
  const knownSharesRaw = sumShares(knownLots)
  const unknownSharesRaw = sumShares(unknownLots)

  if (!metadata) {
    if (shouldLogFinalLots(vault, debugTxLedgerKeys)) {
      const includeDetailedLotLogs = shouldIncludeDetailedLotLogs()
      debugTable(
        'pnl-journal',
        `family transaction journal ${vault.vaultAddress}${vault.stakingVaultAddress ? ` (staking ${vault.stakingVaultAddress})` : ''}`,
        serializeJournalRows(vault.debugJournal)
      )
      debugLog('pnl-lots', 'final family lots missing metadata', {
        chainId: vault.chainId,
        familyVaultAddress: vault.vaultAddress,
        stakingVaultAddress: vault.stakingVaultAddress,
        status: 'missing_metadata',
        vaultLots: summarizeLots(vault.vaultLots),
        stakedLots: summarizeLots(vault.stakedLots),
        vaultLotEntries: includeDetailedLotLogs ? serializeLots(vault.vaultLots) : undefined,
        stakedLotEntries: includeDetailedLotLogs ? serializeLots(vault.stakedLots) : undefined,
        realizedEntries: vault.realizedEntries.map((entry) => ({
          timestamp: entry.timestamp,
          proceedsAssets: entry.proceedsAssets.toString(),
          basisAssets: entry.basisAssets.toString(),
          pnlAssets: entry.pnlAssets.toString()
        })),
        unknownCostBasisTransferInShares: vault.unknownCostBasisTransferInShares.toString(),
        unmatchedTransferOutShares: vault.unmatchedTransferOutShares.toString()
      })
    }

    return createMissingMetadataPnlVault(vault, unknownTransferInPnlMode, tokenPrice, resolvedPricePerShare)
  }

  const vaultSharesFormatted = formatAmount(vaultSharesRaw, metadata.decimals)
  const stakedSharesFormatted = formatAmount(stakedSharesRaw, metadata.decimals)
  const sharesFormatted = formatAmount(totalSharesRaw, metadata.decimals)
  const knownCostBasisUnderlying = formatAmount(sumKnownCostBasis(knownLots), metadata.token.decimals)
  const vaultUnderlying = vaultSharesFormatted * resolvedPricePerShare
  const stakedUnderlying = stakedSharesFormatted * resolvedPricePerShare
  const currentUnderlying = vaultUnderlying + stakedUnderlying
  const currentKnownUnderlying = formatAmount(knownSharesRaw, metadata.decimals) * resolvedPricePerShare
  const currentUnknownUnderlying = formatAmount(unknownSharesRaw, metadata.decimals) * resolvedPricePerShare
  const vaultValueUsd = vaultUnderlying * tokenPrice
  const stakedValueUsd = stakedUnderlying * tokenPrice
  const currentValueUsd = vaultValueUsd + stakedValueUsd
  const isTransferOnlyHoldingsLedger = isCurrentTransferOnlyHoldingsLedger(vault)

  if (isTransferOnlyHoldingsLedger) {
    const status = pricePerShare === null ? 'missing_pps' : tokenPrice > 0 ? 'ok' : 'missing_price'
    const lightweightValuation =
      unknownTransferInPnlMode === 'strict'
        ? {
            unknownCostBasisValueUsd: currentUnknownUnderlying * tokenPrice,
            windfallPnlUsd: 0,
            realizedPnlUnderlying: 0,
            realizedPnlUsd: 0,
            unrealizedPnlUnderlying: 0,
            unrealizedPnlUsd: 0
          }
        : unknownTransferInPnlMode === 'zero_basis'
          ? {
              unknownCostBasisValueUsd: 0,
              windfallPnlUsd: 0,
              realizedPnlUnderlying: 0,
              realizedPnlUsd: 0,
              unrealizedPnlUnderlying: currentUnknownUnderlying,
              unrealizedPnlUsd: currentValueUsd
            }
          : {
              unknownCostBasisValueUsd: 0,
              windfallPnlUsd: currentValueUsd,
              realizedPnlUnderlying: 0,
              realizedPnlUsd: 0,
              unrealizedPnlUnderlying: 0,
              unrealizedPnlUsd: 0
            }

    return {
      chainId: vault.chainId,
      vaultAddress: vault.vaultAddress,
      stakingVaultAddress: vault.stakingVaultAddress,
      status,
      costBasisStatus: 'partial',
      unknownTransferInPnlMode,
      shares: totalSharesRaw.toString(),
      sharesFormatted,
      vaultShares: vaultSharesRaw.toString(),
      vaultSharesFormatted,
      stakedShares: stakedSharesRaw.toString(),
      stakedSharesFormatted,
      knownCostBasisShares: knownSharesRaw.toString(),
      unknownCostBasisShares: unknownSharesRaw.toString(),
      pricePerShare: resolvedPricePerShare,
      tokenPrice,
      currentUnderlying,
      vaultUnderlying,
      stakedUnderlying,
      currentKnownUnderlying,
      currentUnknownUnderlying,
      knownCostBasisUnderlying,
      knownCostBasisUsd: 0,
      currentValueUsd,
      vaultValueUsd,
      stakedValueUsd,
      unknownCostBasisValueUsd: lightweightValuation.unknownCostBasisValueUsd,
      windfallPnlUsd: lightweightValuation.windfallPnlUsd,
      realizedPnlUnderlying: lightweightValuation.realizedPnlUnderlying,
      realizedPnlUsd: lightweightValuation.realizedPnlUsd,
      unrealizedPnlUnderlying: lightweightValuation.unrealizedPnlUnderlying,
      unrealizedPnlUsd: lightweightValuation.unrealizedPnlUsd,
      totalPnlUsd: lightweightValuation.realizedPnlUsd + lightweightValuation.unrealizedPnlUsd,
      totalEconomicGainUsd:
        lightweightValuation.realizedPnlUsd +
        lightweightValuation.unrealizedPnlUsd +
        lightweightValuation.windfallPnlUsd,
      totalDepositedUnderlying: formatAmount(vault.totalDepositedAssets, metadata.token.decimals),
      totalWithdrawnUnderlying: formatAmount(vault.totalWithdrawnAssets, metadata.token.decimals),
      eventCounts: toHoldingsPnlEventCounts(vault),
      metadata: {
        symbol: metadata.token.symbol,
        decimals: metadata.decimals,
        assetDecimals: metadata.token.decimals,
        tokenAddress: metadata.token.address,
        category: metadata.category
      }
    }
  }

  const knownCostBasisUsd = getKnownLotsCostBasisUsd(knownLots, metadata.token.decimals, tokenPriceMap, tokenPrice)
  const baseRealizedPnlUnderlying = vault.realizedEntries.reduce(
    (total, entry) => total + formatAmount(entry.pnlAssets, metadata.token.decimals),
    0
  )
  const baseRealizedPnlUsd = vault.realizedEntries.reduce((total, entry) => {
    const realizedTokenPrice = tokenPriceMap ? getPriceAtTimestamp(tokenPriceMap, entry.timestamp) : 0
    const proceedsUsd = formatAmount(entry.proceedsAssets, metadata.token.decimals) * realizedTokenPrice
    const basisUsd = getKnownLotsCostBasisUsd(entry.consumedLots, metadata.token.decimals, tokenPriceMap, tokenPrice)
    return total + (proceedsUsd - basisUsd)
  }, 0)
  const baseUnrealizedPnlUnderlying = pricePerShare === null ? 0 : currentKnownUnderlying - knownCostBasisUnderlying
  const baseUnrealizedPnlUsd = currentKnownUnderlying * tokenPrice - knownCostBasisUsd
  const valuationState = applyUnknownTransferInModeAdjustment({
    unknownTransferInPnlMode,
    vault,
    unknownLots,
    metadata,
    ppsMap,
    tokenPriceMap,
    tokenPrice,
    currentTimestamp,
    resolvedPricePerShare,
    currentUnknownUnderlying,
    baseRealizedPnlUnderlying,
    baseRealizedPnlUsd,
    baseUnrealizedPnlUnderlying,
    baseUnrealizedPnlUsd
  })
  const costBasisStatus =
    vault.unknownCostBasisTransferInCount === 0 &&
    vault.withdrawalsWithUnknownCostBasis === 0 &&
    vault.unmatchedTransferOutShares === ZERO
      ? 'complete'
      : 'partial'
  const status = pricePerShare === null ? 'missing_pps' : tokenPrice > 0 ? 'ok' : 'missing_price'

  if (shouldLogFinalLots(vault, debugTxLedgerKeys)) {
    const includeDetailedLotLogs = shouldIncludeDetailedLotLogs()
    debugTable(
      'pnl-journal',
      `family transaction journal ${vault.vaultAddress}${vault.stakingVaultAddress ? ` (staking ${vault.stakingVaultAddress})` : ''}`,
      serializeJournalRows(vault.debugJournal, metadata.decimals, metadata.token.decimals)
    )
    debugLog('pnl-lots', 'final family lots', {
      chainId: vault.chainId,
      familyVaultAddress: vault.vaultAddress,
      stakingVaultAddress: vault.stakingVaultAddress,
      status,
      costBasisStatus,
      symbol: metadata.token.symbol,
      shareDecimals: metadata.decimals,
      assetDecimals: metadata.token.decimals,
      vaultLots: summarizeLots(vault.vaultLots),
      stakedLots: summarizeLots(vault.stakedLots),
      vaultLotEntries: includeDetailedLotLogs
        ? serializeLots(vault.vaultLots, metadata.decimals, metadata.token.decimals)
        : undefined,
      stakedLotEntries: includeDetailedLotLogs
        ? serializeLots(vault.stakedLots, metadata.decimals, metadata.token.decimals)
        : undefined,
      realizedEntries: vault.realizedEntries.map((entry) => ({
        timestamp: entry.timestamp,
        proceedsAssets: entry.proceedsAssets.toString(),
        basisAssets: entry.basisAssets.toString(),
        pnlAssets: entry.pnlAssets.toString(),
        pnlAssetsFormatted: formatAmount(entry.pnlAssets, metadata.token.decimals)
      })),
      unknownCostBasisTransferInShares: vault.unknownCostBasisTransferInShares.toString(),
      unmatchedTransferOutShares: vault.unmatchedTransferOutShares.toString()
    })
  }

  return {
    chainId: vault.chainId,
    vaultAddress: vault.vaultAddress,
    stakingVaultAddress: vault.stakingVaultAddress,
    status,
    costBasisStatus,
    unknownTransferInPnlMode,
    shares: totalSharesRaw.toString(),
    sharesFormatted,
    vaultShares: vaultSharesRaw.toString(),
    vaultSharesFormatted,
    stakedShares: stakedSharesRaw.toString(),
    stakedSharesFormatted,
    knownCostBasisShares: knownSharesRaw.toString(),
    unknownCostBasisShares: unknownSharesRaw.toString(),
    pricePerShare: resolvedPricePerShare,
    tokenPrice,
    currentUnderlying,
    vaultUnderlying,
    stakedUnderlying,
    currentKnownUnderlying,
    currentUnknownUnderlying,
    knownCostBasisUnderlying,
    knownCostBasisUsd,
    currentValueUsd,
    vaultValueUsd,
    stakedValueUsd,
    unknownCostBasisValueUsd: valuationState.unknownCostBasisValueUsd,
    windfallPnlUsd: valuationState.windfallPnlUsd,
    realizedPnlUnderlying: valuationState.realizedPnlUnderlying,
    realizedPnlUsd: valuationState.realizedPnlUsd,
    unrealizedPnlUnderlying: valuationState.unrealizedPnlUnderlying,
    unrealizedPnlUsd: valuationState.unrealizedPnlUsd,
    totalPnlUsd: valuationState.realizedPnlUsd + valuationState.unrealizedPnlUsd,
    totalEconomicGainUsd:
      valuationState.realizedPnlUsd + valuationState.unrealizedPnlUsd + valuationState.windfallPnlUsd,
    totalDepositedUnderlying: formatAmount(vault.totalDepositedAssets, metadata.token.decimals),
    totalWithdrawnUnderlying: formatAmount(vault.totalWithdrawnAssets, metadata.token.decimals),
    eventCounts: toHoldingsPnlEventCounts(vault),
    metadata: {
      symbol: metadata.token.symbol,
      decimals: metadata.decimals,
      assetDecimals: metadata.token.decimals,
      tokenAddress: metadata.token.address,
      category: metadata.category
    }
  }
}

function materializeHoldingsPnLVaults(artifacts: TPnlComputationArtifacts): HoldingsPnLVault[] {
  const pnlVaults = artifacts.vaults
    .map((vault) => materializeHoldingsPnLVault(vault, artifacts))
    .sort((a, b) => b.currentValueUsd - a.currentValueUsd)

  debugLog('pnl', 'materialized pnl vault rows', {
    vaults: pnlVaults.length,
    missingMetadata: pnlVaults.filter((vault) => vault.status === 'missing_metadata').length,
    missingPps: pnlVaults.filter((vault) => vault.status === 'missing_pps').length,
    missingPrice: pnlVaults.filter((vault) => vault.status === 'missing_price').length,
    partialCostBasis: pnlVaults.filter((vault) => vault.costBasisStatus === 'partial').length
  })

  return pnlVaults
}

function materializeHoldingsPnLDrilldownVault(
  vault: FamilyPnlLedger,
  artifacts: TPnlComputationArtifacts
): HoldingsPnLDrilldownVault {
  const baseVault = materializeHoldingsPnLVault(vault, artifacts)
  const metadata = artifacts.vaultMetadata.get(toVaultKey(vault.chainId, vault.vaultAddress)) ?? null

  if (!metadata) {
    return {
      ...baseVault,
      currentLots: {
        vault: vault.vaultLots.map((lot, index) => ({
          index,
          shares: lot.shares.toString(),
          sharesFormatted: 0,
          costBasis: lot.costBasis?.toString() ?? null,
          costBasisFormatted: null,
          acquiredAt: lot.acquiredAt ?? null,
          costBasisUsd: null,
          pricePerShareAtAcquisition: 0,
          tokenPriceAtAcquisition: 0,
          currentUnderlying: 0,
          currentValueUsd: 0
        })),
        staked: vault.stakedLots.map((lot, index) => ({
          index,
          shares: lot.shares.toString(),
          sharesFormatted: 0,
          costBasis: lot.costBasis?.toString() ?? null,
          costBasisFormatted: null,
          acquiredAt: lot.acquiredAt ?? null,
          costBasisUsd: null,
          pricePerShareAtAcquisition: 0,
          tokenPriceAtAcquisition: 0,
          currentUnderlying: 0,
          currentValueUsd: 0
        }))
      },
      realizedEntries: [],
      rewardTransferInEntries: [],
      unknownTransferInEntries: [],
      unknownWithdrawalEntries: [],
      journal: []
    }
  }

  const vaultKey = toVaultKey(vault.chainId, vault.vaultAddress)
  const ppsMap = artifacts.ppsData.get(vaultKey)
  const priceKey = `${getChainPrefix(vault.chainId)}:${metadata.token.address.toLowerCase()}`
  const tokenPriceMap = artifacts.priceData.get(priceKey) ?? null

  return {
    ...baseVault,
    currentLots: {
      vault: vault.vaultLots.map((lot, index) =>
        serializeLotForResponse({
          lot,
          index,
          shareDecimals: metadata.decimals,
          assetDecimals: metadata.token.decimals,
          resolvedPricePerShare: baseVault.pricePerShare,
          currentTokenPrice: baseVault.tokenPrice,
          ppsMap,
          tokenPriceMap
        })
      ),
      staked: vault.stakedLots.map((lot, index) =>
        serializeLotForResponse({
          lot,
          index,
          shareDecimals: metadata.decimals,
          assetDecimals: metadata.token.decimals,
          resolvedPricePerShare: baseVault.pricePerShare,
          currentTokenPrice: baseVault.tokenPrice,
          ppsMap,
          tokenPriceMap
        })
      )
    },
    realizedEntries: vault.realizedEntries.map((entry) =>
      serializeRealizedEntryForResponse({
        entry,
        shareDecimals: metadata.decimals,
        assetDecimals: metadata.token.decimals,
        currentTokenPrice: baseVault.tokenPrice,
        tokenPriceMap,
        resolvedPricePerShare: baseVault.pricePerShare,
        ppsMap
      })
    ),
    rewardTransferInEntries: vault.rewardTransferInEntries.map((entry) =>
      serializeRewardTransferInEntryForResponse({
        entry,
        shareDecimals: metadata.decimals,
        currentTokenPrice: baseVault.tokenPrice,
        resolvedPricePerShare: baseVault.pricePerShare,
        ppsMap,
        tokenPriceMap
      })
    ),
    unknownTransferInEntries: vault.unknownTransferInEntries.map((entry) =>
      serializeUnknownTransferInEntryForResponse({
        entry,
        shareDecimals: metadata.decimals,
        currentTokenPrice: baseVault.tokenPrice,
        resolvedPricePerShare: baseVault.pricePerShare,
        ppsMap,
        tokenPriceMap
      })
    ),
    unknownWithdrawalEntries: vault.unknownWithdrawalEntries.map((entry) =>
      serializeUnknownWithdrawalEntryForResponse({
        entry,
        shareDecimals: metadata.decimals,
        assetDecimals: metadata.token.decimals,
        currentTokenPrice: baseVault.tokenPrice,
        tokenPriceMap,
        resolvedPricePerShare: baseVault.pricePerShare,
        ppsMap
      })
    ),
    journal: vault.debugJournal.map((row) =>
      serializeJournalEntryForResponse({
        row,
        shareDecimals: metadata.decimals,
        assetDecimals: metadata.token.decimals
      })
    )
  }
}

export async function getHoldingsPnL(
  userAddress: string,
  version: VaultVersion = 'all',
  unknownTransferInPnlMode: UnknownTransferInPnlMode = 'windfall',
  fetchType: HoldingsEventFetchType = 'seq',
  paginationMode: HoldingsEventPaginationMode = 'paged'
): Promise<HoldingsPnLResponse> {
  const artifacts = await computeHoldingsPnLArtifacts(
    userAddress,
    version,
    unknownTransferInPnlMode,
    fetchType,
    paginationMode
  )

  if (artifacts.vaults.length === 0) {
    return createEmptyHoldingsPnlResponse(userAddress, version, unknownTransferInPnlMode)
  }

  const pnlVaults = materializeHoldingsPnLVaults(artifacts)
  const summary = summarizePnlVaults(pnlVaults)
  debugLog('pnl', 'completed holdings pnl calculation', {
    unknownTransferInPnlMode,
    totalVaults: summary.totalVaults,
    totalCurrentValueUsd: summary.totalCurrentValueUsd,
    totalWindfallPnlUsd: summary.totalWindfallPnlUsd,
    totalRealizedPnlUsd: summary.totalRealizedPnlUsd,
    totalUnrealizedPnlUsd: summary.totalUnrealizedPnlUsd,
    totalPnlUsd: summary.totalPnlUsd,
    totalEconomicGainUsd: summary.totalEconomicGainUsd,
    isComplete: summary.isComplete
  })

  return {
    address: userAddress,
    version,
    unknownTransferInPnlMode,
    generatedAt: new Date().toISOString(),
    summary,
    vaults: pnlVaults
  }
}

export async function getHoldingsPnLDrilldown(
  userAddress: string,
  version: VaultVersion = 'all',
  unknownTransferInPnlMode: UnknownTransferInPnlMode = 'windfall',
  fetchType: HoldingsEventFetchType = 'seq',
  paginationMode: HoldingsEventPaginationMode = 'paged',
  vaultFilter?: string | null
): Promise<HoldingsPnLDrilldownResponse> {
  const artifacts = await computeHoldingsPnLArtifacts(
    userAddress,
    version,
    unknownTransferInPnlMode,
    fetchType,
    paginationMode
  )

  if (artifacts.vaults.length === 0) {
    return {
      ...createEmptyHoldingsPnlResponse(userAddress, version, unknownTransferInPnlMode),
      vaults: []
    }
  }

  const filteredVaults =
    vaultFilter === undefined || vaultFilter === null
      ? artifacts.vaults
      : artifacts.vaults.filter(
          (vault) =>
            vault.vaultAddress === vaultFilter.toLowerCase() || vault.stakingVaultAddress === vaultFilter.toLowerCase()
        )

  const drilldownVaults = filteredVaults
    .map((vault) => materializeHoldingsPnLDrilldownVault(vault, artifacts))
    .sort((a, b) => b.currentValueUsd - a.currentValueUsd)
  const summary = summarizePnlVaults(drilldownVaults)

  debugLog('pnl', 'completed holdings pnl drilldown calculation', {
    unknownTransferInPnlMode,
    vaultFilter: vaultFilter?.toLowerCase() ?? null,
    totalVaults: summary.totalVaults,
    totalCurrentValueUsd: summary.totalCurrentValueUsd,
    totalPnlUsd: summary.totalPnlUsd,
    totalEconomicGainUsd: summary.totalEconomicGainUsd
  })

  return {
    address: userAddress,
    version,
    unknownTransferInPnlMode,
    generatedAt: new Date().toISOString(),
    summary,
    vaults: drilldownVaults
  }
}
