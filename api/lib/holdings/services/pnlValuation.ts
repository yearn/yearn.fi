import type { VaultMetadata } from '../types'
import { getPriceAtTimestamp } from './defillama'
import type { HoldingsPnlEventScope, VaultVersion } from './graphql'
import { getPPS } from './kong'
import { estimateAssetsFromShares, formatAmount, sumShares } from './pnlShared'
import type {
  FamilyPnlLedger,
  HoldingsPnLCategoryBreakdown,
  HoldingsPnLResponse,
  HoldingsPnLVault,
  TLot,
  TPnlComputationState,
  UnknownTransferInPnlMode
} from './pnlTypes'

function createEmptyCategoryBreakdown(): HoldingsPnLCategoryBreakdown {
  return {
    totalPnlUsd: 0,
    totalEconomicGainUsd: 0
  }
}

export function toHoldingsPnlEventCounts(vault: FamilyPnlLedger): HoldingsPnLVault['eventCounts'] {
  return {
    underlyingDeposits: vault.eventCounts.underlyingDeposits,
    underlyingWithdrawals: vault.eventCounts.underlyingWithdrawals,
    stakes: vault.eventCounts.stakes,
    unstakes: vault.eventCounts.unstakes,
    rewardTransfersIn: vault.eventCounts.rewardTransfersIn,
    externalTransfersIn: vault.eventCounts.externalTransfersIn,
    externalTransfersOut: vault.eventCounts.externalTransfersOut,
    migrationsIn: vault.eventCounts.migrationsIn,
    migrationsOut: vault.eventCounts.migrationsOut,
    unknownCostBasisTransfersIn: vault.unknownCostBasisTransferInCount,
    withdrawalsWithUnknownCostBasis: vault.withdrawalsWithUnknownCostBasis
  }
}

export function createEmptyHoldingsPnlResponse(
  address: string,
  version: VaultVersion,
  unknownTransferInPnlMode: UnknownTransferInPnlMode,
  eventScope: HoldingsPnlEventScope = 'full'
): HoldingsPnLResponse {
  return {
    address,
    version,
    unknownTransferInPnlMode,
    eventScope,
    generatedAt: new Date().toISOString(),
    summary: {
      totalVaults: 0,
      completeVaults: 0,
      partialVaults: 0,
      totalCurrentValueUsd: 0,
      totalUnknownCostBasisValueUsd: 0,
      totalWindfallPnlUsd: 0,
      totalRealizedPnlUsd: 0,
      totalUnrealizedPnlUsd: 0,
      totalPnlUsd: 0,
      totalEconomicGainUsd: 0,
      byCategory: {
        stable: createEmptyCategoryBreakdown(),
        volatile: createEmptyCategoryBreakdown()
      },
      isComplete: true
    },
    vaults: []
  }
}

export function summarizePnlVaults(vaults: HoldingsPnLVault[]): HoldingsPnLResponse['summary'] {
  return vaults.reduce(
    (totals, vault) => {
      const category = vault.metadata?.category ?? 'volatile'

      return {
        totalVaults: totals.totalVaults + 1,
        completeVaults: totals.completeVaults + (vault.costBasisStatus === 'complete' ? 1 : 0),
        partialVaults: totals.partialVaults + (vault.costBasisStatus === 'partial' ? 1 : 0),
        totalCurrentValueUsd: totals.totalCurrentValueUsd + vault.currentValueUsd,
        totalUnknownCostBasisValueUsd: totals.totalUnknownCostBasisValueUsd + vault.unknownCostBasisValueUsd,
        totalWindfallPnlUsd: totals.totalWindfallPnlUsd + vault.windfallPnlUsd,
        totalRealizedPnlUsd: totals.totalRealizedPnlUsd + vault.realizedPnlUsd,
        totalUnrealizedPnlUsd: totals.totalUnrealizedPnlUsd + vault.unrealizedPnlUsd,
        totalPnlUsd: totals.totalPnlUsd + vault.totalPnlUsd,
        totalEconomicGainUsd: totals.totalEconomicGainUsd + vault.totalEconomicGainUsd,
        byCategory: {
          stable: {
            totalPnlUsd: totals.byCategory.stable.totalPnlUsd + (category === 'stable' ? vault.totalPnlUsd : 0),
            totalEconomicGainUsd:
              totals.byCategory.stable.totalEconomicGainUsd + (category === 'stable' ? vault.totalEconomicGainUsd : 0)
          },
          volatile: {
            totalPnlUsd: totals.byCategory.volatile.totalPnlUsd + (category === 'volatile' ? vault.totalPnlUsd : 0),
            totalEconomicGainUsd:
              totals.byCategory.volatile.totalEconomicGainUsd +
              (category === 'volatile' ? vault.totalEconomicGainUsd : 0)
          }
        },
        isComplete: totals.isComplete && vault.costBasisStatus === 'complete'
      }
    },
    {
      totalVaults: 0,
      completeVaults: 0,
      partialVaults: 0,
      totalCurrentValueUsd: 0,
      totalUnknownCostBasisValueUsd: 0,
      totalWindfallPnlUsd: 0,
      totalRealizedPnlUsd: 0,
      totalUnrealizedPnlUsd: 0,
      totalPnlUsd: 0,
      totalEconomicGainUsd: 0,
      byCategory: {
        stable: createEmptyCategoryBreakdown(),
        volatile: createEmptyCategoryBreakdown()
      },
      isComplete: true
    }
  )
}

function getEstimatedUnknownUnderlyingAtReceipt(
  shares: bigint,
  timestamp: number,
  shareDecimals: number,
  ppsMap: Map<number, number> | undefined,
  fallbackPricePerShare: number
): number {
  const receiptPricePerShare =
    timestamp > 0
      ? ppsMap
        ? (getPPS(ppsMap, timestamp) ?? fallbackPricePerShare)
        : fallbackPricePerShare
      : fallbackPricePerShare

  return formatAmount(shares, shareDecimals) * receiptPricePerShare
}

function getTokenPriceForTimestamp(
  tokenPriceMap: Map<number, number> | null,
  timestamp: number,
  fallbackTokenPrice: number,
  normalizeTimestamp?: (timestamp: number) => number
): number {
  const priceTimestamp = normalizeTimestamp ? normalizeTimestamp(timestamp) : timestamp

  if (timestamp <= 0 || !tokenPriceMap) {
    return fallbackTokenPrice
  }

  return normalizeTimestamp
    ? (tokenPriceMap.get(priceTimestamp) ?? 0)
    : getPriceAtTimestamp(tokenPriceMap, priceTimestamp)
}

function getPricePerShareForTimestamp(
  ppsMap: Map<number, number> | undefined,
  timestamp: number,
  fallbackPricePerShare: number
): number {
  return ppsMap ? (getPPS(ppsMap, timestamp) ?? fallbackPricePerShare) : fallbackPricePerShare
}

function getUnknownWithdrawalProceedsAssets(
  entry: FamilyPnlLedger['unknownWithdrawalEntries'][number],
  shareDecimals: number,
  assetDecimals: number,
  ppsMap: Map<number, number> | undefined,
  fallbackPricePerShare: number
): bigint {
  if (entry.proceedsShares === undefined) {
    return entry.proceedsAssets
  }

  return estimateAssetsFromShares(
    entry.proceedsShares,
    shareDecimals,
    assetDecimals,
    getPricePerShareForTimestamp(ppsMap, entry.timestamp, fallbackPricePerShare)
  )
}

// Missing metadata is a hard stop for valuation, but we still surface the ledger so the caller
// can see that shares exist and that the accounting path reached this family.
export function createMissingMetadataPnlVault(
  vault: FamilyPnlLedger,
  unknownTransferInPnlMode: UnknownTransferInPnlMode,
  tokenPrice: number,
  resolvedPricePerShare: number
): HoldingsPnLVault {
  const vaultSharesRaw = sumShares(vault.vaultLots)
  const stakedSharesRaw = sumShares(vault.stakedLots)
  const totalSharesRaw = vaultSharesRaw + stakedSharesRaw
  const knownLots = [...vault.vaultLots, ...vault.stakedLots].filter((lot) => lot.costBasis !== null)
  const unknownLots = [...vault.vaultLots, ...vault.stakedLots].filter((lot) => lot.costBasis === null)

  return {
    chainId: vault.chainId,
    vaultAddress: vault.vaultAddress,
    stakingVaultAddress: vault.stakingVaultAddress,
    status: 'missing_metadata',
    costBasisStatus: 'partial',
    unknownTransferInPnlMode,
    shares: totalSharesRaw.toString(),
    sharesFormatted: 0,
    vaultShares: vaultSharesRaw.toString(),
    vaultSharesFormatted: 0,
    stakedShares: stakedSharesRaw.toString(),
    stakedSharesFormatted: 0,
    knownCostBasisShares: sumShares(knownLots).toString(),
    unknownCostBasisShares: sumShares(unknownLots).toString(),
    pricePerShare: resolvedPricePerShare,
    tokenPrice,
    currentUnderlying: 0,
    vaultUnderlying: 0,
    stakedUnderlying: 0,
    currentKnownUnderlying: 0,
    currentUnknownUnderlying: 0,
    knownCostBasisUnderlying: 0,
    knownCostBasisUsd: 0,
    currentValueUsd: 0,
    vaultValueUsd: 0,
    stakedValueUsd: 0,
    unknownCostBasisValueUsd: 0,
    windfallPnlUsd: 0,
    realizedPnlUnderlying: 0,
    realizedPnlUsd: 0,
    unrealizedPnlUnderlying: 0,
    unrealizedPnlUsd: 0,
    totalPnlUsd: 0,
    totalEconomicGainUsd: 0,
    totalDepositedUnderlying: 0,
    totalWithdrawnUnderlying: 0,
    eventCounts: toHoldingsPnlEventCounts(vault),
    metadata: null
  }
}

// Unknown transfer-ins are the main heuristic branch in the whole pipeline.
// We keep the strict / zero-basis / receipt-price / windfall behavior isolated here
// so the materialization step reads as "compute known PnL, then apply the chosen unknown-lot policy".
export function applyUnknownTransferInModeAdjustment(args: {
  unknownTransferInPnlMode: UnknownTransferInPnlMode
  vault: FamilyPnlLedger
  unknownLots: TLot[]
  metadata: VaultMetadata
  ppsMap: Map<number, number> | undefined
  tokenPriceMap: Map<number, number> | null
  tokenPrice: number
  currentTimestamp: number
  resolvedPricePerShare: number
  currentUnknownUnderlying: number
  baseRealizedPnlUnderlying: number
  baseRealizedPnlUsd: number
  baseUnrealizedPnlUnderlying: number
  baseUnrealizedPnlUsd: number
  normalizePriceTimestamp?: (timestamp: number) => number
}): TPnlComputationState {
  const {
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
    baseUnrealizedPnlUsd,
    normalizePriceTimestamp
  } = args

  const state: TPnlComputationState = {
    unknownCostBasisValueUsd: unknownTransferInPnlMode === 'strict' ? currentUnknownUnderlying * tokenPrice : 0,
    windfallPnlUsd: 0,
    realizedPnlUnderlying: baseRealizedPnlUnderlying,
    realizedPnlUsd: baseRealizedPnlUsd,
    unrealizedPnlUnderlying: baseUnrealizedPnlUnderlying,
    unrealizedPnlUsd: baseUnrealizedPnlUsd
  }

  if (unknownTransferInPnlMode === 'strict') {
    return state
  }

  const unknownRealizedProceedsUnderlying = vault.unknownWithdrawalEntries.reduce(
    (total, entry) =>
      total +
      formatAmount(
        getUnknownWithdrawalProceedsAssets(
          entry,
          metadata.decimals,
          metadata.token.decimals,
          ppsMap,
          resolvedPricePerShare
        ),
        metadata.token.decimals
      ),
    0
  )
  const unknownRealizedProceedsUsd = vault.unknownWithdrawalEntries.reduce((total, entry) => {
    const realizedTokenPrice = getTokenPriceForTimestamp(
      tokenPriceMap,
      entry.timestamp,
      tokenPrice,
      normalizePriceTimestamp
    )
    const proceedsAssets = getUnknownWithdrawalProceedsAssets(
      entry,
      metadata.decimals,
      metadata.token.decimals,
      ppsMap,
      resolvedPricePerShare
    )
    return total + formatAmount(proceedsAssets, metadata.token.decimals) * realizedTokenPrice
  }, 0)

  if (unknownTransferInPnlMode === 'zero_basis') {
    return {
      ...state,
      realizedPnlUnderlying: state.realizedPnlUnderlying + unknownRealizedProceedsUnderlying,
      realizedPnlUsd: state.realizedPnlUsd + unknownRealizedProceedsUsd,
      unrealizedPnlUnderlying: state.unrealizedPnlUnderlying + currentUnknownUnderlying,
      unrealizedPnlUsd: state.unrealizedPnlUsd + currentUnknownUnderlying * tokenPrice
    }
  }

  const currentUnknownReceiptValueUsd = unknownLots.reduce((total, lot) => {
    const receiptUnderlying = getEstimatedUnknownUnderlyingAtReceipt(
      lot.shares,
      lot.acquiredAt ?? currentTimestamp,
      metadata.decimals,
      ppsMap,
      resolvedPricePerShare
    )
    const receiptTokenPrice = getTokenPriceForTimestamp(
      tokenPriceMap,
      lot.acquiredAt ?? currentTimestamp,
      tokenPrice,
      normalizePriceTimestamp
    )
    return total + receiptUnderlying * receiptTokenPrice
  }, 0)
  const realizedUnknownReceiptValueUsd = vault.unknownWithdrawalEntries.reduce((total, entry) => {
    return (
      total +
      entry.consumedLots.reduce((entryTotal, lot) => {
        const receiptUnderlying = getEstimatedUnknownUnderlyingAtReceipt(
          lot.shares,
          lot.acquiredAt ?? entry.timestamp,
          metadata.decimals,
          ppsMap,
          resolvedPricePerShare
        )
        const receiptTokenPrice = getTokenPriceForTimestamp(
          tokenPriceMap,
          lot.acquiredAt ?? entry.timestamp,
          tokenPrice,
          normalizePriceTimestamp
        )
        return entryTotal + receiptUnderlying * receiptTokenPrice
      }, 0)
    )
  }, 0)
  const unknownRealizedMarketPnlUsd = unknownRealizedProceedsUsd - realizedUnknownReceiptValueUsd
  const unknownCurrentMarketPnlUsd = currentUnknownUnderlying * tokenPrice - currentUnknownReceiptValueUsd

  if (unknownTransferInPnlMode === 'receipt_price') {
    return {
      ...state,
      realizedPnlUnderlying:
        state.realizedPnlUnderlying + (tokenPrice > 0 ? unknownRealizedMarketPnlUsd / tokenPrice : 0),
      realizedPnlUsd: state.realizedPnlUsd + unknownRealizedMarketPnlUsd,
      unrealizedPnlUnderlying:
        state.unrealizedPnlUnderlying + (tokenPrice > 0 ? unknownCurrentMarketPnlUsd / tokenPrice : 0),
      unrealizedPnlUsd: state.unrealizedPnlUsd + unknownCurrentMarketPnlUsd
    }
  }

  return {
    ...state,
    windfallPnlUsd: currentUnknownReceiptValueUsd + realizedUnknownReceiptValueUsd,
    realizedPnlUnderlying:
      state.realizedPnlUnderlying + (tokenPrice > 0 ? unknownRealizedMarketPnlUsd / tokenPrice : 0),
    realizedPnlUsd: state.realizedPnlUsd + unknownRealizedMarketPnlUsd,
    unrealizedPnlUnderlying:
      state.unrealizedPnlUnderlying + (tokenPrice > 0 ? unknownCurrentMarketPnlUsd / tokenPrice : 0),
    unrealizedPnlUsd: state.unrealizedPnlUsd + unknownCurrentMarketPnlUsd
  }
}
