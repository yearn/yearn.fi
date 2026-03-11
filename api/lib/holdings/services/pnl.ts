import { formatUnits } from 'viem'
import type { DepositEvent, TransferEvent, UserEvents, WithdrawEvent } from '../types'
import { fetchHistoricalPrices, getChainPrefix, getPriceAtTimestamp } from './defillama'
import { fetchUserEvents, type VaultVersion } from './graphql'
import { fetchMultipleVaultsPPS, getPPS } from './kong'
import { fetchMultipleVaultsMetadata } from './vaults'

const ZERO = 0n

type TPnlEvent =
  | {
      kind: 'deposit'
      id: string
      vaultAddress: string
      chainId: number
      blockNumber: number
      blockTimestamp: number
      logIndex: number
      transactionHash: string
      shares: bigint
      assets: bigint
    }
  | {
      kind: 'withdrawal'
      id: string
      vaultAddress: string
      chainId: number
      blockNumber: number
      blockTimestamp: number
      logIndex: number
      transactionHash: string
      shares: bigint
      assets: bigint
    }
  | {
      kind: 'transferIn'
      id: string
      vaultAddress: string
      chainId: number
      blockNumber: number
      blockTimestamp: number
      logIndex: number
      transactionHash: string
      shares: bigint
      sender: string
    }
  | {
      kind: 'transferOut'
      id: string
      vaultAddress: string
      chainId: number
      blockNumber: number
      blockTimestamp: number
      logIndex: number
      transactionHash: string
      shares: bigint
      receiver: string
    }

type TCostLot = {
  shares: bigint
  costBasis: bigint | null
}

type TWithdrawalSource = {
  remainingShares: bigint
  remainingAssets: bigint
}

type TTransferSource = {
  vaultKey: string
  remainingLots: TCostLot[]
}

type TRealizedEntry = {
  timestamp: number
  pnlAssets: bigint
}

export interface VaultPnlLedger {
  vaultAddress: string
  chainId: number
  lots: TCostLot[]
  depositCount: number
  withdrawalCount: number
  transferInCount: number
  transferOutCount: number
  totalDepositedAssets: bigint
  totalWithdrawnAssets: bigint
  unmatchedTransferInCount: number
  unmatchedTransferInShares: bigint
  unmatchedTransferOutCount: number
  unmatchedTransferOutShares: bigint
  withdrawalsWithUnknownCostBasis: number
  realizedEntries: TRealizedEntry[]
}

export interface HoldingsPnLVault {
  chainId: number
  vaultAddress: string
  status: 'ok' | 'missing_metadata' | 'missing_price'
  costBasisStatus: 'complete' | 'partial'
  shares: string
  sharesFormatted: number
  knownCostBasisShares: string
  unknownCostBasisShares: string
  pricePerShare: number
  tokenPrice: number
  currentValueUsd: number
  unknownCostBasisValueUsd: number
  realizedPnlUnderlying: number
  realizedPnlUsd: number
  unrealizedPnlUnderlying: number
  unrealizedPnlUsd: number
  totalPnlUsd: number
  totalDepositedUnderlying: number
  totalWithdrawnUnderlying: number
  eventCounts: {
    deposits: number
    withdrawals: number
    transfersIn: number
    transfersOut: number
    unknownCostBasisTransfersIn: number
    unmatchedTransfersOut: number
    withdrawalsWithUnknownCostBasis: number
  }
  metadata: {
    symbol: string
    decimals: number
    tokenAddress: string
  } | null
}

export interface HoldingsPnLResponse {
  address: string
  version: VaultVersion
  generatedAt: string
  summary: {
    totalVaults: number
    completeVaults: number
    partialVaults: number
    totalCurrentValueUsd: number
    totalUnknownCostBasisValueUsd: number
    totalRealizedPnlUsd: number
    totalUnrealizedPnlUsd: number
    totalPnlUsd: number
    isComplete: boolean
  }
  vaults: HoldingsPnLVault[]
}

function toVaultKey(chainId: number, vaultAddress: string): string {
  return `${chainId}:${vaultAddress.toLowerCase()}`
}

function lowerCaseAddress(address: string): string {
  return address.toLowerCase()
}

function minBigInt(a: bigint, b: bigint): bigint {
  return a < b ? a : b
}

function formatAmount(value: bigint, decimals: number): number {
  const absoluteValue = value < ZERO ? -value : value
  const sign = value < ZERO ? -1 : 1
  return sign * parseFloat(formatUnits(absoluteValue, decimals))
}

function sumShares(lots: TCostLot[]): bigint {
  return lots.reduce((total, lot) => total + lot.shares, ZERO)
}

function sumKnownCostBasis(lots: TCostLot[]): bigint {
  return lots.reduce((total, lot) => total + (lot.costBasis ?? ZERO), ZERO)
}

function getOrCreateLedger(
  ledgers: Map<string, VaultPnlLedger>,
  chainId: number,
  vaultAddress: string
): VaultPnlLedger {
  const vaultKey = toVaultKey(chainId, vaultAddress)
  const existing = ledgers.get(vaultKey)

  if (existing) {
    return existing
  }

  const ledger: VaultPnlLedger = {
    vaultAddress: lowerCaseAddress(vaultAddress),
    chainId,
    lots: [],
    depositCount: 0,
    withdrawalCount: 0,
    transferInCount: 0,
    transferOutCount: 0,
    totalDepositedAssets: ZERO,
    totalWithdrawnAssets: ZERO,
    unmatchedTransferInCount: 0,
    unmatchedTransferInShares: ZERO,
    unmatchedTransferOutCount: 0,
    unmatchedTransferOutShares: ZERO,
    withdrawalsWithUnknownCostBasis: 0,
    realizedEntries: []
  }

  ledgers.set(vaultKey, ledger)

  return ledger
}

function addLotsToLedger(ledger: VaultPnlLedger, lots: TCostLot[]): void {
  lots
    .filter((lot) => lot.shares > ZERO)
    .forEach((lot) => {
      ledger.lots.push(lot)
    })
}

function consumeLots(
  lots: TCostLot[],
  targetShares: bigint
): { nextLots: TCostLot[]; consumedLots: TCostLot[]; consumedShares: bigint } {
  const remaining = { value: targetShares }
  const nextLots: TCostLot[] = []
  const consumedLots: TCostLot[] = []

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

    consumedLots.push({
      shares: consumedShares,
      costBasis: consumedCostBasis
    })

    if (remainingShares > ZERO) {
      nextLots.push({
        shares: remainingShares,
        costBasis: remainingCostBasis
      })
    }

    remaining.value -= consumedShares
  })

  return {
    nextLots,
    consumedLots: consumedLots.filter((lot) => lot.shares > ZERO),
    consumedShares: targetShares - remaining.value
  }
}

function takeFromWithdrawalSources(
  sources: TWithdrawalSource[],
  targetShares: bigint
): { lots: TCostLot[]; matchedShares: bigint } {
  const remaining = { value: targetShares }
  const matchedLots: TCostLot[] = []

  sources.forEach((source) => {
    if (remaining.value === ZERO || source.remainingShares === ZERO) {
      return
    }

    const matchedShares = minBigInt(source.remainingShares, remaining.value)
    const matchedAssets = (source.remainingAssets * matchedShares) / source.remainingShares

    source.remainingShares -= matchedShares
    source.remainingAssets -= matchedAssets
    remaining.value -= matchedShares

    matchedLots.push({
      shares: matchedShares,
      costBasis: matchedAssets
    })
  })

  return {
    lots: matchedLots.filter((lot) => lot.shares > ZERO),
    matchedShares: targetShares - remaining.value
  }
}

function takeFromTransferSources(
  sources: TTransferSource[],
  targetShares: bigint
): { lots: TCostLot[]; matchedShares: bigint } {
  const remaining = { value: targetShares }
  const matchedLots: TCostLot[] = []

  sources.forEach((source) => {
    if (remaining.value === ZERO || sumShares(source.remainingLots) === ZERO) {
      return
    }

    const consumed = consumeLots(source.remainingLots, remaining.value)
    source.remainingLots = consumed.nextLots
    remaining.value -= consumed.consumedShares

    consumed.consumedLots.forEach((lot) => {
      matchedLots.push(lot)
    })
  })

  return {
    lots: matchedLots.filter((lot) => lot.shares > ZERO),
    matchedShares: targetShares - remaining.value
  }
}

function compareEvents(a: TPnlEvent, b: TPnlEvent): number {
  return (
    a.blockTimestamp - b.blockTimestamp ||
    a.blockNumber - b.blockNumber ||
    a.logIndex - b.logIndex ||
    a.id.localeCompare(b.id)
  )
}

function normalizeDeposit(event: DepositEvent): TPnlEvent {
  return {
    kind: 'deposit',
    id: event.id,
    vaultAddress: lowerCaseAddress(event.vaultAddress),
    chainId: event.chainId,
    blockNumber: event.blockNumber,
    blockTimestamp: event.blockTimestamp,
    logIndex: event.logIndex,
    transactionHash: event.transactionHash,
    shares: BigInt(event.shares),
    assets: BigInt(event.assets)
  }
}

function normalizeWithdrawal(event: WithdrawEvent): TPnlEvent {
  return {
    kind: 'withdrawal',
    id: event.id,
    vaultAddress: lowerCaseAddress(event.vaultAddress),
    chainId: event.chainId,
    blockNumber: event.blockNumber,
    blockTimestamp: event.blockTimestamp,
    logIndex: event.logIndex,
    transactionHash: event.transactionHash,
    shares: BigInt(event.shares),
    assets: BigInt(event.assets)
  }
}

function normalizeTransferIn(event: TransferEvent): TPnlEvent {
  return {
    kind: 'transferIn',
    id: event.id,
    vaultAddress: lowerCaseAddress(event.vaultAddress),
    chainId: event.chainId,
    blockNumber: event.blockNumber,
    blockTimestamp: event.blockTimestamp,
    logIndex: event.logIndex,
    transactionHash: event.transactionHash,
    shares: BigInt(event.value),
    sender: lowerCaseAddress(event.sender)
  }
}

function normalizeTransferOut(event: TransferEvent): TPnlEvent {
  return {
    kind: 'transferOut',
    id: event.id,
    vaultAddress: lowerCaseAddress(event.vaultAddress),
    chainId: event.chainId,
    blockNumber: event.blockNumber,
    blockTimestamp: event.blockTimestamp,
    logIndex: event.logIndex,
    transactionHash: event.transactionHash,
    shares: BigInt(event.value),
    receiver: lowerCaseAddress(event.receiver)
  }
}

export function buildPnlEvents(events: UserEvents): TPnlEvent[] {
  return [
    ...events.deposits.map(normalizeDeposit),
    ...events.withdrawals.map(normalizeWithdrawal),
    ...events.transfersIn.map(normalizeTransferIn),
    ...events.transfersOut.map(normalizeTransferOut)
  ].sort(compareEvents)
}

function groupEventsByTransaction(events: TPnlEvent[]): TPnlEvent[][] {
  const grouped = events.reduce<Map<string, TPnlEvent[]>>((groups, event) => {
    const transactionKey = `${event.chainId}:${event.transactionHash}`
    const bucket = groups.get(transactionKey) ?? []
    bucket.push(event)
    groups.set(transactionKey, bucket)
    return groups
  }, new Map())

  return Array.from(grouped.values()).map((txEvents) => txEvents.sort(compareEvents))
}

export function processPnlEvents(events: TPnlEvent[]): Map<string, VaultPnlLedger> {
  const ledgers = new Map<string, VaultPnlLedger>()

  groupEventsByTransaction(events).forEach((txEvents) => {
    const withdrawalSources = txEvents.reduce<Map<string, TWithdrawalSource[]>>((sources, event) => {
      if (event.kind !== 'withdrawal') {
        return sources
      }

      const txSources = sources.get(event.vaultAddress) ?? []
      txSources.push({
        remainingShares: event.shares,
        remainingAssets: event.assets
      })
      sources.set(event.vaultAddress, txSources)
      return sources
    }, new Map())
    const transferSources = new Map<string, TTransferSource[]>()

    txEvents.forEach((event) => {
      const ledger = getOrCreateLedger(ledgers, event.chainId, event.vaultAddress)

      if (event.kind === 'deposit') {
        ledger.depositCount += 1
        ledger.totalDepositedAssets += event.assets
        addLotsToLedger(ledger, [{ shares: event.shares, costBasis: event.assets }])
        return
      }

      if (event.kind === 'withdrawal') {
        ledger.withdrawalCount += 1
        ledger.totalWithdrawnAssets += event.assets

        const consumed = consumeLots(ledger.lots, event.shares)
        const knownLots = consumed.consumedLots.filter((lot) => lot.costBasis !== null)
        const knownShares = sumShares(knownLots)
        const knownCostBasis = sumKnownCostBasis(knownLots)
        const knownProceeds = event.shares === ZERO ? ZERO : (event.assets * knownShares) / event.shares
        const unknownShares = consumed.consumedShares - knownShares

        ledger.lots = consumed.nextLots

        if (knownShares > ZERO) {
          ledger.realizedEntries.push({
            timestamp: event.blockTimestamp,
            pnlAssets: knownProceeds - knownCostBasis
          })
        }

        if (unknownShares > ZERO) {
          ledger.withdrawalsWithUnknownCostBasis += 1
        }
        return
      }

      if (event.kind === 'transferOut') {
        ledger.transferOutCount += 1

        const consumed = consumeLots(ledger.lots, event.shares)
        ledger.lots = consumed.nextLots

        const txSources = transferSources.get(event.receiver) ?? []
        txSources.push({
          vaultKey: toVaultKey(event.chainId, event.vaultAddress),
          remainingLots: consumed.consumedLots
        })
        transferSources.set(event.receiver, txSources)
        return
      }

      ledger.transferInCount += 1

      const matchedFromWithdrawals = takeFromWithdrawalSources(withdrawalSources.get(event.sender) ?? [], event.shares)
      const sharesAfterWithdrawals = event.shares - matchedFromWithdrawals.matchedShares
      const matchedFromTransfers = takeFromTransferSources(
        transferSources.get(event.sender) ?? [],
        sharesAfterWithdrawals
      )
      const unmatchedShares = sharesAfterWithdrawals - matchedFromTransfers.matchedShares

      addLotsToLedger(ledger, [...matchedFromWithdrawals.lots, ...matchedFromTransfers.lots])

      if (unmatchedShares > ZERO) {
        ledger.unmatchedTransferInCount += 1
        ledger.unmatchedTransferInShares += unmatchedShares
        addLotsToLedger(ledger, [{ shares: unmatchedShares, costBasis: null }])
      }
    })

    Array.from(transferSources.values())
      .flat()
      .forEach((source) => {
        const remainingShares = sumShares(source.remainingLots)

        if (remainingShares === ZERO) {
          return
        }

        const sourceLedger = ledgers.get(source.vaultKey)

        if (!sourceLedger) {
          return
        }

        sourceLedger.unmatchedTransferOutCount += 1
        sourceLedger.unmatchedTransferOutShares += remainingShares
      })
  })

  return ledgers
}

export async function getHoldingsPnL(userAddress: string, version: VaultVersion = 'all'): Promise<HoldingsPnLResponse> {
  const events = await fetchUserEvents(userAddress, version)
  const ledgers = processPnlEvents(buildPnlEvents(events))
  const vaults = Array.from(ledgers.values())
  const currentTimestamp = Math.floor(Date.now() / 1000)

  if (vaults.length === 0) {
    return {
      address: userAddress,
      version,
      generatedAt: new Date().toISOString(),
      summary: {
        totalVaults: 0,
        completeVaults: 0,
        partialVaults: 0,
        totalCurrentValueUsd: 0,
        totalUnknownCostBasisValueUsd: 0,
        totalRealizedPnlUsd: 0,
        totalUnrealizedPnlUsd: 0,
        totalPnlUsd: 0,
        isComplete: true
      },
      vaults: []
    }
  }

  const vaultIdentifiers = vaults.map((vault) => ({
    chainId: vault.chainId,
    vaultAddress: vault.vaultAddress
  }))
  const vaultMetadata = await fetchMultipleVaultsMetadata(vaultIdentifiers)
  const ppsData = await fetchMultipleVaultsPPS(vaultIdentifiers)

  const timestamps = [
    ...new Set([currentTimestamp, ...vaults.flatMap((vault) => vault.realizedEntries.map((entry) => entry.timestamp))])
  ].sort((a, b) => a - b)

  const seenTokens = new Set<string>()
  const tokens = vaultIdentifiers.reduce<Array<{ chainId: number; address: string }>>((allTokens, vault) => {
    const vaultKey = toVaultKey(vault.chainId, vault.vaultAddress)
    const metadata = vaultMetadata.get(vaultKey)

    if (!metadata) {
      return allTokens
    }

    const tokenKey = `${metadata.chainId}:${lowerCaseAddress(metadata.token.address)}`

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

  const pnlVaults = vaults
    .map<HoldingsPnLVault>((vault) => {
      const vaultKey = toVaultKey(vault.chainId, vault.vaultAddress)
      const metadata = vaultMetadata.get(vaultKey) ?? null
      const ppsMap = ppsData.get(vaultKey)
      const pricePerShare = ppsMap ? getPPS(ppsMap, currentTimestamp) : 1
      const priceKey = metadata ? `${getChainPrefix(vault.chainId)}:${lowerCaseAddress(metadata.token.address)}` : null
      const tokenPriceMap = priceKey ? priceData.get(priceKey) : null
      const tokenPrice = tokenPriceMap ? getPriceAtTimestamp(tokenPriceMap, currentTimestamp) : 0
      const totalShares = sumShares(vault.lots)
      const knownLots = vault.lots.filter((lot) => lot.costBasis !== null)
      const unknownLots = vault.lots.filter((lot) => lot.costBasis === null)
      const knownShares = sumShares(knownLots)
      const unknownShares = sumShares(unknownLots)

      if (!metadata) {
        return {
          chainId: vault.chainId,
          vaultAddress: vault.vaultAddress,
          status: 'missing_metadata',
          costBasisStatus: 'partial',
          shares: totalShares.toString(),
          sharesFormatted: 0,
          knownCostBasisShares: knownShares.toString(),
          unknownCostBasisShares: unknownShares.toString(),
          pricePerShare,
          tokenPrice,
          currentValueUsd: 0,
          unknownCostBasisValueUsd: 0,
          realizedPnlUnderlying: 0,
          realizedPnlUsd: 0,
          unrealizedPnlUnderlying: 0,
          unrealizedPnlUsd: 0,
          totalPnlUsd: 0,
          totalDepositedUnderlying: 0,
          totalWithdrawnUnderlying: 0,
          eventCounts: {
            deposits: vault.depositCount,
            withdrawals: vault.withdrawalCount,
            transfersIn: vault.transferInCount,
            transfersOut: vault.transferOutCount,
            unknownCostBasisTransfersIn: vault.unmatchedTransferInCount,
            unmatchedTransfersOut: vault.unmatchedTransferOutCount,
            withdrawalsWithUnknownCostBasis: vault.withdrawalsWithUnknownCostBasis
          },
          metadata: null
        }
      }

      const sharesFormatted = formatAmount(totalShares, metadata.decimals)
      const knownSharesFormatted = formatAmount(knownShares, metadata.decimals)
      const unknownSharesFormatted = formatAmount(unknownShares, metadata.decimals)
      const knownCostBasisUnderlying = formatAmount(sumKnownCostBasis(knownLots), metadata.token.decimals)
      const currentKnownUnderlying = knownSharesFormatted * pricePerShare
      const currentUnknownUnderlying = unknownSharesFormatted * pricePerShare
      const currentValueUsd = (currentKnownUnderlying + currentUnknownUnderlying) * tokenPrice
      const unknownCostBasisValueUsd = currentUnknownUnderlying * tokenPrice
      const realizedPnlUnderlying = vault.realizedEntries.reduce(
        (total, entry) => total + formatAmount(entry.pnlAssets, metadata.token.decimals),
        0
      )
      const realizedPnlUsd = vault.realizedEntries.reduce((total, entry) => {
        const realizedTokenPrice = tokenPriceMap ? getPriceAtTimestamp(tokenPriceMap, entry.timestamp) : 0
        return total + formatAmount(entry.pnlAssets, metadata.token.decimals) * realizedTokenPrice
      }, 0)
      const unrealizedPnlUnderlying = currentKnownUnderlying - knownCostBasisUnderlying
      const unrealizedPnlUsd = unrealizedPnlUnderlying * tokenPrice
      const costBasisStatus =
        vault.unmatchedTransferInCount === 0 &&
        vault.unmatchedTransferOutCount === 0 &&
        vault.withdrawalsWithUnknownCostBasis === 0
          ? 'complete'
          : 'partial'

      return {
        chainId: vault.chainId,
        vaultAddress: vault.vaultAddress,
        status: tokenPrice > 0 ? 'ok' : 'missing_price',
        costBasisStatus,
        shares: totalShares.toString(),
        sharesFormatted,
        knownCostBasisShares: knownShares.toString(),
        unknownCostBasisShares: unknownShares.toString(),
        pricePerShare,
        tokenPrice,
        currentValueUsd,
        unknownCostBasisValueUsd,
        realizedPnlUnderlying,
        realizedPnlUsd,
        unrealizedPnlUnderlying,
        unrealizedPnlUsd,
        totalPnlUsd: realizedPnlUsd + unrealizedPnlUsd,
        totalDepositedUnderlying: formatAmount(vault.totalDepositedAssets, metadata.token.decimals),
        totalWithdrawnUnderlying: formatAmount(vault.totalWithdrawnAssets, metadata.token.decimals),
        eventCounts: {
          deposits: vault.depositCount,
          withdrawals: vault.withdrawalCount,
          transfersIn: vault.transferInCount,
          transfersOut: vault.transferOutCount,
          unknownCostBasisTransfersIn: vault.unmatchedTransferInCount,
          unmatchedTransfersOut: vault.unmatchedTransferOutCount,
          withdrawalsWithUnknownCostBasis: vault.withdrawalsWithUnknownCostBasis
        },
        metadata: {
          symbol: metadata.token.symbol,
          decimals: metadata.decimals,
          tokenAddress: metadata.token.address
        }
      }
    })
    .sort((a, b) => b.currentValueUsd - a.currentValueUsd)

  const summary = pnlVaults.reduce(
    (totals, vault) => ({
      totalVaults: totals.totalVaults + 1,
      completeVaults: totals.completeVaults + (vault.costBasisStatus === 'complete' ? 1 : 0),
      partialVaults: totals.partialVaults + (vault.costBasisStatus === 'partial' ? 1 : 0),
      totalCurrentValueUsd: totals.totalCurrentValueUsd + vault.currentValueUsd,
      totalUnknownCostBasisValueUsd: totals.totalUnknownCostBasisValueUsd + vault.unknownCostBasisValueUsd,
      totalRealizedPnlUsd: totals.totalRealizedPnlUsd + vault.realizedPnlUsd,
      totalUnrealizedPnlUsd: totals.totalUnrealizedPnlUsd + vault.unrealizedPnlUsd,
      totalPnlUsd: totals.totalPnlUsd + vault.totalPnlUsd,
      isComplete: totals.isComplete && vault.costBasisStatus === 'complete'
    }),
    {
      totalVaults: 0,
      completeVaults: 0,
      partialVaults: 0,
      totalCurrentValueUsd: 0,
      totalUnknownCostBasisValueUsd: 0,
      totalRealizedPnlUsd: 0,
      totalUnrealizedPnlUsd: 0,
      totalPnlUsd: 0,
      isComplete: true
    }
  )

  return {
    address: userAddress,
    version,
    generatedAt: new Date().toISOString(),
    summary,
    vaults: pnlVaults
  }
}
