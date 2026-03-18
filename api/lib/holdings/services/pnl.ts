import type { DepositEvent, TransferEvent, WithdrawEvent } from '../types'
import { debugLog, debugTable, getHoldingsDebugFilters } from './debug'
import { fetchHistoricalPrices, getChainPrefix, getPriceAtTimestamp } from './defillama'
import { fetchRawUserPnlEvents, type RawPnlEventContext, type VaultVersion } from './graphql'
import { fetchMultipleVaultsPPS, getPPS } from './kong'
import {
  formatAmount,
  KNOWN_VAULT_MIGRATORS,
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

export type { HoldingsPnLResponse, HoldingsPnLVault, UnknownTransferInPnlMode } from './pnlTypes'

import type {
  FamilyPnlLedger,
  HoldingsPnLResponse,
  HoldingsPnLVault,
  TLocation,
  TLot,
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

function summarizeLots(lots: TLot[]): {
  lotCount: number
  totalShares: string
  knownShares: string
  unknownShares: string
  totalKnownCostBasis: string
} {
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
    wrap: shareDecimals === undefined ? row.wrapShares : formatAmount(BigInt(row.wrapShares), shareDecimals),
    unwrap: shareDecimals === undefined ? row.unwrapShares : formatAmount(BigInt(row.unwrapShares), shareDecimals),
    unkWallet:
      shareDecimals === undefined
        ? row.unknownInWalletShares
        : formatAmount(BigInt(row.unknownInWalletShares), shareDecimals),
    unkStaked:
      shareDecimals === undefined
        ? row.unknownInStakedShares
        : formatAmount(BigInt(row.unknownInStakedShares), shareDecimals),
    outWallet:
      shareDecimals === undefined
        ? row.transferOutWalletShares
        : formatAmount(BigInt(row.transferOutWalletShares), shareDecimals),
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
    walletLots: [],
    stakedLots: [],
    totalDepositedAssets: ZERO,
    totalWithdrawnAssets: ZERO,
    unknownCostBasisTransferInCount: 0,
    unknownCostBasisTransferInShares: ZERO,
    withdrawalsWithUnknownCostBasis: 0,
    unmatchedTransferOutCount: 0,
    unmatchedTransferOutShares: ZERO,
    realizedEntries: [],
    unknownTransferInEntries: [],
    unknownWithdrawalEntries: [],
    debugJournal: [],
    eventCounts: {
      underlyingDeposits: 0,
      underlyingWithdrawals: 0,
      stakingWraps: 0,
      stakingUnwraps: 0,
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
  return location === 'wallet' ? ledger.walletLots : ledger.stakedLots
}

function setLocationLots(ledger: FamilyPnlLedger, location: TLocation, lots: TLot[]): void {
  if (location === 'wallet') {
    ledger.walletLots = lots
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
    sumShares(ledger.walletLots) === ZERO &&
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

type TDetectedKnownMigration = {
  chainId: number
  sourceFamilyVaultAddress: string
  destinationFamilyVaultAddress: string
  transactionHash: string
  blockTimestamp: number
  sourceTransferShares: bigint
  destinationDepositShares: bigint
  destinationDepositAssets: bigint
}

export function filterDirectInteractionLedgers(ledgers: Map<string, FamilyPnlLedger>): Map<string, FamilyPnlLedger> {
  return Array.from(ledgers.entries()).reduce<Map<string, FamilyPnlLedger>>((filtered, [key, ledger]) => {
    if (isDirectInteractionLedger(ledger)) {
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
  walletShares: bigint,
  timestamp: number
): {
  realizedPnlAssets: bigint
  knownShares: bigint
  unknownShares: bigint
  knownProceedsAssets: bigint
  knownCostBasisAssets: bigint
  consumedWalletShares: bigint
  consumedStakedShares: bigint
} {
  const consumedStaked = consumeFromLocation(ledger, 'staked', stakingShares)
  const consumedWallet = consumeFromLocation(ledger, 'wallet', walletShares)
  const consumedLots = [...consumedStaked.consumedLots, ...consumedWallet.consumedLots]
  const knownLots = consumedLots.filter((lot) => lot.costBasis !== null)
  const unknownLots = consumedLots.filter((lot) => lot.costBasis === null)
  const knownShares = sumShares(knownLots)
  const knownCostBasis = sumKnownCostBasis(knownLots)
  const knownProceeds = totalShares === ZERO ? ZERO : (totalAssets * knownShares) / totalShares
  const unknownShares = consumedStaked.consumedShares + consumedWallet.consumedShares - knownShares
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

  if (consumedStaked.consumedShares + consumedWallet.consumedShares < totalShares) {
    ledger.unmatchedTransferOutCount += 1
    ledger.unmatchedTransferOutShares += totalShares - (consumedStaked.consumedShares + consumedWallet.consumedShares)
  }

  return {
    realizedPnlAssets: knownShares > ZERO ? knownProceeds - knownCostBasis : ZERO,
    knownShares,
    unknownShares,
    knownProceedsAssets: knownProceeds,
    knownCostBasisAssets: knownCostBasis,
    consumedWalletShares: consumedWallet.consumedShares,
    consumedStakedShares: consumedStaked.consumedShares
  }
}

function buildJournalView(parts: {
  acquiredToWallet: bigint
  acquiredToStaked: bigint
  walletRealizeShares: bigint
  stakingRealizeShares: bigint
  wrapShares: bigint
  unwrapShares: bigint
  unknownInWalletShares: bigint
  unknownInStakedShares: bigint
  transferOutWalletShares: bigint
  transferOutStakedShares: bigint
}): string {
  const labels: string[] = []

  if (parts.acquiredToWallet > ZERO) labels.push('deposit->wallet')
  if (parts.acquiredToStaked > ZERO) labels.push('deposit->staked')
  if (parts.walletRealizeShares > ZERO) labels.push('withdraw<-wallet')
  if (parts.stakingRealizeShares > ZERO) labels.push('withdraw<-staked')
  if (parts.wrapShares > ZERO) labels.push('wrap')
  if (parts.unwrapShares > ZERO) labels.push('unwrap')
  if (parts.unknownInWalletShares > ZERO) labels.push('transfer_in_wallet_unknown')
  if (parts.unknownInStakedShares > ZERO) labels.push('transfer_in_staked_unknown')
  if (parts.transferOutWalletShares > ZERO) labels.push('transfer_out_wallet')
  if (parts.transferOutStakedShares > ZERO) labels.push('transfer_out_staked')

  return labels.length > 0 ? labels.join(' + ') : 'no_position_change'
}

function addAcquisitionLots(
  ledger: FamilyPnlLedger,
  totalShares: bigint,
  totalAssets: bigint,
  stakedShares: bigint,
  walletShares: bigint,
  timestamp: number
): void {
  if (totalShares === ZERO) {
    return
  }

  const stakedAssets = (totalAssets * stakedShares) / totalShares
  const walletAssets = (totalAssets * walletShares) / totalShares

  addLotsToLocation(ledger, 'staked', [createLot(stakedShares, stakedAssets, timestamp)])
  addLotsToLocation(ledger, 'wallet', [createLot(walletShares, walletAssets, timestamp)])
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
    shares
  })
  addLotsToLocation(ledger, location, [createLot(shares, null, timestamp)])
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

  if (txFamilyGroups.length !== 2) {
    return null
  }

  const sourceFamilyEvents = txFamilyGroups.find((familyEvents) => {
    const addressTransfersToMigrator = familyEvents.filter(
      (event): event is Extract<TRawPnlEvent, { kind: 'transfer' }> =>
        event.kind === 'transfer' &&
        event.scopes.address &&
        event.sender === userAddress &&
        KNOWN_VAULT_MIGRATORS.has(event.receiver)
    )

    if (addressTransfersToMigrator.length === 0) {
      return false
    }

    if (familyEvents.some((event) => event.kind === 'deposit' || event.kind === 'withdrawal')) {
      return false
    }

    const migratorAddress = addressTransfersToMigrator[0]?.receiver ?? null

    if (migratorAddress === null) {
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
  const destinationFamilyEvents = txFamilyGroups.find((familyEvents) => {
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

    return mintedShares > ZERO && mintedShares === sumEventShares(addressDeposits)
  })

  if (!sourceFamilyEvents || !destinationFamilyEvents) {
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
      KNOWN_VAULT_MIGRATORS.has(event.receiver)
  )
  const destinationDeposits = destinationFamilyEvents.filter(
    (event): event is Extract<TRawPnlEvent, { kind: 'deposit' }> =>
      event.kind === 'deposit' && event.scopes.address && event.owner === userAddress
  )
  const sourceTransferShares = sumEventShares(sourceTransfersToMigrator)
  const destinationDepositShares = sumEventShares(destinationDeposits)
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
    destinationDepositAssets
  }
}

function processKnownMigratorCrossFamilyRollover(
  ledgers: Map<string, FamilyPnlLedger>,
  txEvents: TRawPnlEvent[],
  userAddress: string
): Set<string> {
  const migration = detectKnownMigratorCrossFamilyRollover(txEvents, userAddress)

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
  const sourceWalletLotsBefore = sourceShouldLog ? cloneLots(sourceLedger.walletLots) : []
  const sourceStakedLotsBefore = sourceShouldLog ? cloneLots(sourceLedger.stakedLots) : []
  const destinationWalletLotsBefore = destinationShouldLog ? cloneLots(destinationLedger.walletLots) : []
  const destinationStakedLotsBefore = destinationShouldLog ? cloneLots(destinationLedger.stakedLots) : []

  sourceLedger.eventCounts.migrationsOut += 1
  destinationLedger.eventCounts.migrationsIn += 1

  const sourceConsumed = consumeFromLocation(sourceLedger, 'wallet', migration.sourceTransferShares)
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

  addLotsToLocation(destinationLedger, 'wallet', rolledLots)

  if (unknownDestinationShares > ZERO) {
    destinationLedger.unknownCostBasisTransferInCount += 1
    destinationLedger.unknownCostBasisTransferInShares += unknownDestinationShares
    destinationLedger.unknownTransferInEntries.push({
      timestamp: migration.blockTimestamp,
      shares: unknownDestinationShares
    })
    addLotsToLocation(destinationLedger, 'wallet', [
      createLot(unknownDestinationShares, null, migration.blockTimestamp)
    ])
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
    wrapShares: ZERO.toString(),
    unwrapShares: ZERO.toString(),
    unknownInWalletShares: ZERO.toString(),
    unknownInStakedShares: ZERO.toString(),
    transferOutWalletShares: migration.sourceTransferShares.toString(),
    transferOutStakedShares: ZERO.toString(),
    realizedKnownShares: ZERO.toString(),
    realizedProceedsAssets: ZERO.toString(),
    realizedBasisAssets: ZERO.toString(),
    realizedPnlAssets: ZERO.toString()
  })

  destinationLedger.debugJournal.push({
    timestamp: migration.blockTimestamp,
    txHash: migration.transactionHash,
    familyVaultAddress: migration.destinationFamilyVaultAddress,
    stakingVaultAddress: destinationLedger.stakingVaultAddress,
    view: 'migrate_in->wallet',
    hasAddressActivity: true,
    rawEvents: countTxEventsByKind(destinationFamilyEvents),
    depositShares: migration.destinationDepositShares.toString(),
    depositAssets: migration.destinationDepositAssets.toString(),
    withdrawShares: ZERO.toString(),
    withdrawAssets: ZERO.toString(),
    wrapShares: ZERO.toString(),
    unwrapShares: ZERO.toString(),
    unknownInWalletShares: unknownDestinationShares.toString(),
    unknownInStakedShares: ZERO.toString(),
    transferOutWalletShares: ZERO.toString(),
    transferOutStakedShares: ZERO.toString(),
    realizedKnownShares: ZERO.toString(),
    realizedProceedsAssets: ZERO.toString(),
    realizedBasisAssets: ZERO.toString(),
    realizedPnlAssets: ZERO.toString()
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
      walletLotsBefore: summarizeLots(sourceWalletLotsBefore),
      stakedLotsBefore: summarizeLots(sourceStakedLotsBefore),
      walletLotsAfter: summarizeLots(sourceLedger.walletLots),
      stakedLotsAfter: summarizeLots(sourceLedger.stakedLots),
      events: includeDetailedLotLogs ? sourceFamilyEvents.map(serializeRawEvent) : undefined,
      walletLotEntriesBefore: includeDetailedLotLogs ? serializeLots(sourceWalletLotsBefore) : undefined,
      stakedLotEntriesBefore: includeDetailedLotLogs ? serializeLots(sourceStakedLotsBefore) : undefined,
      walletLotEntriesAfter: includeDetailedLotLogs ? serializeLots(sourceLedger.walletLots) : undefined,
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
      view: 'migrate_in->wallet',
      sourceFamilyVaultAddress: migration.sourceFamilyVaultAddress,
      destinationDepositShares: migration.destinationDepositShares.toString(),
      destinationDepositAssets: migration.destinationDepositAssets.toString(),
      rolledKnownShares: rolledShares.toString(),
      rolledKnownCostBasisAssets: sumKnownCostBasis(rolledLots).toString(),
      unknownDestinationShares: unknownDestinationShares.toString(),
      walletLotsBefore: summarizeLots(destinationWalletLotsBefore),
      stakedLotsBefore: summarizeLots(destinationStakedLotsBefore),
      walletLotsAfter: summarizeLots(destinationLedger.walletLots),
      stakedLotsAfter: summarizeLots(destinationLedger.stakedLots),
      events: includeDetailedLotLogs ? destinationFamilyEvents.map(serializeRawEvent) : undefined,
      walletLotEntriesBefore: includeDetailedLotLogs ? serializeLots(destinationWalletLotsBefore) : undefined,
      stakedLotEntriesBefore: includeDetailedLotLogs ? serializeLots(destinationStakedLotsBefore) : undefined,
      walletLotEntriesAfter: includeDetailedLotLogs ? serializeLots(destinationLedger.walletLots) : undefined,
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
  const walletLotsBefore = shouldLogTransactionLots ? cloneLots(ledger.walletLots) : []
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
    const walletConsumed = consumeLots(ledger.walletLots, totalUnderlyingWithdrawShares)
    const stakedConsumed = consumeLots(ledger.stakedLots, ZERO)
    const consumedShares = walletConsumed.consumedShares + stakedConsumed.consumedShares

    if (consumedShares === totalUnderlyingWithdrawShares) {
      const rolledLots = redistributeLotsToTargetShares(walletConsumed.consumedLots, totalUnderlyingDepositShares)

      ledger.walletLots = [...walletConsumed.nextLots, ...rolledLots]

      ledger.debugJournal.push({
        timestamp: txFamilyEvents[0]?.blockTimestamp ?? 0,
        txHash: transactionHash,
        familyVaultAddress,
        stakingVaultAddress,
        view: 'same_vault_rollover->wallet',
        hasAddressActivity: familyHasAddressActivity,
        rawEvents: countTxEventsByKind(txFamilyEvents),
        depositShares: totalUnderlyingDepositShares.toString(),
        depositAssets: totalUnderlyingDepositAssets.toString(),
        withdrawShares: totalUnderlyingWithdrawShares.toString(),
        withdrawAssets: totalUnderlyingWithdrawAssets.toString(),
        wrapShares: ZERO.toString(),
        unwrapShares: ZERO.toString(),
        unknownInWalletShares: ZERO.toString(),
        unknownInStakedShares: ZERO.toString(),
        transferOutWalletShares: ZERO.toString(),
        transferOutStakedShares: ZERO.toString(),
        realizedKnownShares: ZERO.toString(),
        realizedProceedsAssets: ZERO.toString(),
        realizedBasisAssets: ZERO.toString(),
        realizedPnlAssets: ZERO.toString()
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
          view: 'same_vault_rollover->wallet',
          totalUnderlyingDepositShares: totalUnderlyingDepositShares.toString(),
          totalUnderlyingDepositAssets: totalUnderlyingDepositAssets.toString(),
          totalUnderlyingWithdrawShares: totalUnderlyingWithdrawShares.toString(),
          totalUnderlyingWithdrawAssets: totalUnderlyingWithdrawAssets.toString(),
          rolledLotCount: rolledLots.length,
          rolledKnownCostBasisAssets: sumKnownCostBasis(rolledLots.filter((lot) => lot.costBasis !== null)).toString(),
          walletLotsBefore: summarizeLots(walletLotsBefore),
          stakedLotsBefore: summarizeLots(stakedLotsBefore),
          walletLotsAfter: summarizeLots(ledger.walletLots),
          stakedLotsAfter: summarizeLots(ledger.stakedLots),
          events: includeDetailedLotLogs ? txFamilyEvents.map(serializeRawEvent) : undefined,
          walletLotEntriesBefore: includeDetailedLotLogs ? serializeLots(walletLotsBefore) : undefined,
          stakedLotEntriesBefore: includeDetailedLotLogs ? serializeLots(stakedLotsBefore) : undefined,
          walletLotEntriesAfter: includeDetailedLotLogs ? serializeLots(ledger.walletLots) : undefined,
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
  const walletRealizeShares = totalUnderlyingWithdrawShares - stakingRealizeShares

  const realization = applyRealization(
    ledger,
    totalUnderlyingWithdrawShares,
    totalUnderlyingWithdrawAssets,
    stakingRealizeShares,
    walletRealizeShares,
    txFamilyEvents[0]?.blockTimestamp ?? 0
  )

  const acquiredToStaked = minBigInt(positiveBigInt(stakingDelta), totalUnderlyingDepositShares)
  const acquiredToWallet = minBigInt(positiveBigInt(underlyingDelta), totalUnderlyingDepositShares - acquiredToStaked)

  addAcquisitionLots(
    ledger,
    totalUnderlyingDepositShares,
    totalUnderlyingDepositAssets,
    acquiredToStaked,
    acquiredToWallet,
    txFamilyEvents[0]?.blockTimestamp ?? 0
  )

  const remainingUnderlyingDelta = underlyingDelta - acquiredToWallet + walletRealizeShares
  const remainingStakingDelta = stakingDelta - acquiredToStaked + stakingRealizeShares
  const wrapShares = minBigInt(negativeBigIntMagnitude(remainingUnderlyingDelta), positiveBigInt(remainingStakingDelta))
  const remainingUnderlyingAfterWrap = remainingUnderlyingDelta + wrapShares
  const remainingStakingAfterWrap = remainingStakingDelta - wrapShares
  const unwrapShares = minBigInt(
    negativeBigIntMagnitude(remainingStakingAfterWrap),
    positiveBigInt(remainingUnderlyingAfterWrap)
  )
  const finalUnderlyingDelta = remainingUnderlyingAfterWrap - unwrapShares
  const finalStakingDelta = remainingStakingAfterWrap + unwrapShares
  const unknownInWalletShares = positiveBigInt(finalUnderlyingDelta)
  const unknownInStakedShares = positiveBigInt(finalStakingDelta)
  const transferOutWalletShares = negativeBigIntMagnitude(finalUnderlyingDelta)
  const transferOutStakedShares = negativeBigIntMagnitude(finalStakingDelta)

  if (wrapShares > ZERO) {
    ledger.eventCounts.stakingWraps += 1
    moveBetweenLocations(ledger, 'wallet', 'staked', wrapShares)
  }

  if (unwrapShares > ZERO) {
    ledger.eventCounts.stakingUnwraps += 1
    moveBetweenLocations(ledger, 'staked', 'wallet', unwrapShares)
  }

  handleUnknownTransferIn(ledger, 'wallet', unknownInWalletShares, txFamilyEvents[0]?.blockTimestamp ?? 0)
  handleUnknownTransferIn(ledger, 'staked', unknownInStakedShares, txFamilyEvents[0]?.blockTimestamp ?? 0)
  handleExternalTransferOut(ledger, 'wallet', transferOutWalletShares)
  handleExternalTransferOut(ledger, 'staked', transferOutStakedShares)

  ledger.debugJournal.push({
    timestamp: txFamilyEvents[0]?.blockTimestamp ?? 0,
    txHash: transactionHash,
    familyVaultAddress,
    stakingVaultAddress,
    view: buildJournalView({
      acquiredToWallet,
      acquiredToStaked,
      walletRealizeShares,
      stakingRealizeShares,
      wrapShares,
      unwrapShares,
      unknownInWalletShares,
      unknownInStakedShares,
      transferOutWalletShares,
      transferOutStakedShares
    }),
    hasAddressActivity: familyHasAddressActivity,
    rawEvents: countTxEventsByKind(txFamilyEvents),
    depositShares: totalUnderlyingDepositShares.toString(),
    depositAssets: totalUnderlyingDepositAssets.toString(),
    withdrawShares: totalUnderlyingWithdrawShares.toString(),
    withdrawAssets: totalUnderlyingWithdrawAssets.toString(),
    wrapShares: wrapShares.toString(),
    unwrapShares: unwrapShares.toString(),
    unknownInWalletShares: unknownInWalletShares.toString(),
    unknownInStakedShares: unknownInStakedShares.toString(),
    transferOutWalletShares: transferOutWalletShares.toString(),
    transferOutStakedShares: transferOutStakedShares.toString(),
    realizedKnownShares: realization.knownShares.toString(),
    realizedProceedsAssets: realization.knownProceedsAssets.toString(),
    realizedBasisAssets: realization.knownCostBasisAssets.toString(),
    realizedPnlAssets: realization.realizedPnlAssets.toString()
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
      acquiredToWallet: acquiredToWallet.toString(),
      acquiredToStaked: acquiredToStaked.toString(),
      walletRealizeShares: walletRealizeShares.toString(),
      stakingRealizeShares: stakingRealizeShares.toString(),
      wrapShares: wrapShares.toString(),
      unwrapShares: unwrapShares.toString(),
      finalUnderlyingDelta: finalUnderlyingDelta.toString(),
      finalStakingDelta: finalStakingDelta.toString(),
      realizedKnownShares: realization.knownShares.toString(),
      realizedProceedsAssets: realization.knownProceedsAssets.toString(),
      realizedBasisAssets: realization.knownCostBasisAssets.toString(),
      realizedPnlAssets: realization.realizedPnlAssets.toString(),
      walletLotsBefore: summarizeLots(walletLotsBefore),
      stakedLotsBefore: summarizeLots(stakedLotsBefore),
      walletLotsAfter: summarizeLots(ledger.walletLots),
      stakedLotsAfter: summarizeLots(ledger.stakedLots),
      events: includeDetailedLotLogs ? txFamilyEvents.map(serializeRawEvent) : undefined,
      walletLotEntriesBefore: includeDetailedLotLogs ? serializeLots(walletLotsBefore) : undefined,
      stakedLotEntriesBefore: includeDetailedLotLogs ? serializeLots(stakedLotsBefore) : undefined,
      walletLotEntriesAfter: includeDetailedLotLogs ? serializeLots(ledger.walletLots) : undefined,
      stakedLotEntriesAfter: includeDetailedLotLogs ? serializeLots(ledger.stakedLots) : undefined
    })
  }
}

export function processRawPnlEvents(events: TRawPnlEvent[], userAddress: string): Map<string, FamilyPnlLedger> {
  const ledgers = new Map<string, FamilyPnlLedger>()
  const userAddressLower = userAddress.toLowerCase()

  // Process transactions in two passes:
  // 1. detect cross-family migrations that should carry basis across vaults
  // 2. interpret the remaining per-family activity as deposits, withdrawals, wraps, unwraps, or transfers
  groupEventsByTransaction(events).forEach((txEvents) => {
    const handledFamilyKeys = processKnownMigratorCrossFamilyRollover(ledgers, txEvents, userAddressLower)

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

export async function getHoldingsPnL(
  userAddress: string,
  version: VaultVersion = 'all',
  unknownTransferInPnlMode: UnknownTransferInPnlMode = 'windfall'
): Promise<HoldingsPnLResponse> {
  debugLog('pnl', 'starting holdings pnl calculation', { version, unknownTransferInPnlMode })
  const rawContext = await fetchRawUserPnlEvents(userAddress, version)
  debugLog('pnl', 'loaded raw pnl event context', {
    addressDeposits: rawContext.addressEvents.deposits.length,
    addressWithdrawals: rawContext.addressEvents.withdrawals.length,
    addressTransfersIn: rawContext.addressEvents.transfersIn.length,
    addressTransfersOut: rawContext.addressEvents.transfersOut.length,
    txDeposits: rawContext.transactionEvents.deposits.length,
    txWithdrawals: rawContext.transactionEvents.withdrawals.length,
    txTransfers: rawContext.transactionEvents.transfers.length
  })
  const rawEvents = buildRawPnlEvents(rawContext)
  const debugTxLedgerKeys = getDebugTxLedgerKeys(rawEvents)
  const rawLedgers = processRawPnlEvents(rawEvents, userAddress)
  const ledgers = filterDirectInteractionLedgers(rawLedgers)
  const vaults = Array.from(ledgers.values())
  const currentTimestamp = Math.floor(Date.now() / 1000)
  debugLog('pnl', 'processed raw pnl events into ledgers', {
    rawLedgers: rawLedgers.size,
    directInteractionLedgers: ledgers.size,
    currentTimestamp
  })

  if (vaults.length === 0) {
    debugLog('pnl', 'no pnl ledgers produced for address')
    return createEmptyHoldingsPnlResponse(userAddress, version, unknownTransferInPnlMode)
  }

  const vaultIdentifiers = vaults.map((vault) => ({
    chainId: vault.chainId,
    vaultAddress: vault.vaultAddress
  }))
  const vaultMetadata = await fetchMultipleVaultsMetadata(vaultIdentifiers)
  const ppsData = await fetchMultipleVaultsPPS(vaultIdentifiers)
  debugLog('pnl', 'resolved vault metadata and PPS', {
    vaults: vaultIdentifiers.length,
    metadataResolved: vaultMetadata.size,
    ppsResolved: ppsData.size,
    emptyPpsTimelines: Array.from(ppsData.values()).filter((timeline) => timeline.size === 0).length
  })
  const timestamps = [
    ...new Set([
      currentTimestamp,
      ...vaults.flatMap((vault) => vault.realizedEntries.map((entry) => entry.timestamp)),
      ...vaults.flatMap((vault) =>
        [...vault.walletLots, ...vault.stakedLots]
          .map((lot) => lot.acquiredAt)
          .filter((timestamp): timestamp is number => timestamp !== undefined)
      ),
      ...vaults.flatMap((vault) =>
        vault.realizedEntries.flatMap((entry) =>
          entry.consumedLots
            .map((lot) => lot.acquiredAt)
            .filter((timestamp): timestamp is number => timestamp !== undefined)
        )
      ),
      ...vaults.flatMap((vault) => vault.unknownTransferInEntries.map((entry) => entry.timestamp)),
      ...vaults.flatMap((vault) => vault.unknownWithdrawalEntries.map((entry) => entry.timestamp)),
      ...vaults.flatMap((vault) =>
        vault.unknownWithdrawalEntries.flatMap((entry) =>
          entry.consumedLots
            .map((lot) => lot.acquiredAt)
            .filter((timestamp): timestamp is number => timestamp !== undefined)
        )
      )
    ])
  ].sort((a, b) => a - b)
  const seenTokens = new Set<string>()
  const tokens = vaultIdentifiers.reduce<Array<{ chainId: number; address: string }>>((allTokens, vault) => {
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

  const pnlVaults = vaults
    .map<HoldingsPnLVault>((vault) => {
      const vaultKey = toVaultKey(vault.chainId, vault.vaultAddress)
      const metadata = vaultMetadata.get(vaultKey) ?? null
      const ppsMap = ppsData.get(vaultKey)
      const pricePerShare = ppsMap ? getPPS(ppsMap, currentTimestamp) : null
      const priceKey = metadata ? `${getChainPrefix(vault.chainId)}:${metadata.token.address.toLowerCase()}` : null
      const tokenPriceMap = priceKey ? priceData.get(priceKey) : null
      const tokenPrice = tokenPriceMap ? getPriceAtTimestamp(tokenPriceMap, currentTimestamp) : 0
      const resolvedPricePerShare = pricePerShare ?? 0
      const walletSharesRaw = sumShares(vault.walletLots)
      const stakedSharesRaw = sumShares(vault.stakedLots)
      const totalSharesRaw = walletSharesRaw + stakedSharesRaw
      const knownLots = [...vault.walletLots, ...vault.stakedLots].filter((lot) => lot.costBasis !== null)
      const unknownLots = [...vault.walletLots, ...vault.stakedLots].filter((lot) => lot.costBasis === null)
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
            walletLots: summarizeLots(vault.walletLots),
            stakedLots: summarizeLots(vault.stakedLots),
            walletLotEntries: includeDetailedLotLogs ? serializeLots(vault.walletLots) : undefined,
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

      const walletSharesFormatted = formatAmount(walletSharesRaw, metadata.decimals)
      const stakedSharesFormatted = formatAmount(stakedSharesRaw, metadata.decimals)
      const sharesFormatted = formatAmount(totalSharesRaw, metadata.decimals)
      const knownCostBasisUnderlying = formatAmount(sumKnownCostBasis(knownLots), metadata.token.decimals)
      const currentWalletUnderlying = walletSharesFormatted * resolvedPricePerShare
      const currentStakedUnderlying = stakedSharesFormatted * resolvedPricePerShare
      const currentKnownUnderlying = formatAmount(knownSharesRaw, metadata.decimals) * resolvedPricePerShare
      const currentUnknownUnderlying = formatAmount(unknownSharesRaw, metadata.decimals) * resolvedPricePerShare
      const walletValueUsd = currentWalletUnderlying * tokenPrice
      const stakedValueUsd = currentStakedUnderlying * tokenPrice
      const knownCostBasisUsd = getKnownLotsCostBasisUsd(knownLots, metadata.token.decimals, tokenPriceMap, tokenPrice)
      const baseRealizedPnlUnderlying = vault.realizedEntries.reduce(
        (total, entry) => total + formatAmount(entry.pnlAssets, metadata.token.decimals),
        0
      )
      const baseRealizedPnlUsd = vault.realizedEntries.reduce((total, entry) => {
        const realizedTokenPrice = tokenPriceMap ? getPriceAtTimestamp(tokenPriceMap, entry.timestamp) : 0
        const proceedsUsd = formatAmount(entry.proceedsAssets, metadata.token.decimals) * realizedTokenPrice
        const basisUsd = getKnownLotsCostBasisUsd(
          entry.consumedLots,
          metadata.token.decimals,
          tokenPriceMap,
          tokenPrice
        )
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
          walletLots: summarizeLots(vault.walletLots),
          stakedLots: summarizeLots(vault.stakedLots),
          walletLotEntries: includeDetailedLotLogs
            ? serializeLots(vault.walletLots, metadata.decimals, metadata.token.decimals)
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
        walletShares: walletSharesRaw.toString(),
        walletSharesFormatted,
        stakedShares: stakedSharesRaw.toString(),
        stakedSharesFormatted,
        knownCostBasisShares: knownSharesRaw.toString(),
        unknownCostBasisShares: unknownSharesRaw.toString(),
        pricePerShare: resolvedPricePerShare,
        tokenPrice,
        currentValueUsd: walletValueUsd + stakedValueUsd,
        walletValueUsd,
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
          tokenAddress: metadata.token.address
        }
      }
    })
    .sort((a, b) => b.currentValueUsd - a.currentValueUsd)
  debugLog('pnl', 'materialized pnl vault rows', {
    vaults: pnlVaults.length,
    missingMetadata: pnlVaults.filter((vault) => vault.status === 'missing_metadata').length,
    missingPps: pnlVaults.filter((vault) => vault.status === 'missing_pps').length,
    missingPrice: pnlVaults.filter((vault) => vault.status === 'missing_price').length,
    partialCostBasis: pnlVaults.filter((vault) => vault.costBasisStatus === 'partial').length
  })

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
