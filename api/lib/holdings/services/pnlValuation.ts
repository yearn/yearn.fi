import type { VaultMetadata } from '../types'
import { getPriceAtTimestamp } from './defillama'
import type { VaultVersion } from './graphql'
import { getPPS } from './kong'
import { formatAmount, sumShares } from './pnlShared'
import type {
  FamilyPnlLedger,
  HoldingsPnLResponse,
  HoldingsPnLVault,
  TLot,
  TPnlComputationState,
  UnknownTransferInPnlMode
} from './pnlTypes'

export function toHoldingsPnlEventCounts(vault: FamilyPnlLedger): HoldingsPnLVault['eventCounts'] {
  return {
    underlyingDeposits: vault.eventCounts.underlyingDeposits,
    underlyingWithdrawals: vault.eventCounts.underlyingWithdrawals,
    stakingWraps: vault.eventCounts.stakingWraps,
    stakingUnwraps: vault.eventCounts.stakingUnwraps,
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
  unknownTransferInPnlMode: UnknownTransferInPnlMode
): HoldingsPnLResponse {
  return {
    address,
    version,
    unknownTransferInPnlMode,
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
      isComplete: true
    },
    vaults: []
  }
}

export function summarizePnlVaults(vaults: HoldingsPnLVault[]): HoldingsPnLResponse['summary'] {
  return vaults.reduce(
    (totals, vault) => ({
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
      isComplete: totals.isComplete && vault.costBasisStatus === 'complete'
    }),
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
  fallbackTokenPrice: number
): number {
  return timestamp > 0
    ? tokenPriceMap
      ? getPriceAtTimestamp(tokenPriceMap, timestamp)
      : fallbackTokenPrice
    : fallbackTokenPrice
}

// Missing metadata is a hard stop for valuation, but we still surface the ledger so the caller
// can see that shares exist and that the accounting path reached this family.
export function createMissingMetadataPnlVault(
  vault: FamilyPnlLedger,
  unknownTransferInPnlMode: UnknownTransferInPnlMode,
  tokenPrice: number,
  resolvedPricePerShare: number
): HoldingsPnLVault {
  const walletSharesRaw = sumShares(vault.walletLots)
  const stakedSharesRaw = sumShares(vault.stakedLots)
  const totalSharesRaw = walletSharesRaw + stakedSharesRaw
  const knownLots = [...vault.walletLots, ...vault.stakedLots].filter((lot) => lot.costBasis !== null)
  const unknownLots = [...vault.walletLots, ...vault.stakedLots].filter((lot) => lot.costBasis === null)

  return {
    chainId: vault.chainId,
    vaultAddress: vault.vaultAddress,
    stakingVaultAddress: vault.stakingVaultAddress,
    status: 'missing_metadata',
    costBasisStatus: 'partial',
    unknownTransferInPnlMode,
    shares: totalSharesRaw.toString(),
    sharesFormatted: 0,
    walletShares: walletSharesRaw.toString(),
    walletSharesFormatted: 0,
    stakedShares: stakedSharesRaw.toString(),
    stakedSharesFormatted: 0,
    knownCostBasisShares: sumShares(knownLots).toString(),
    unknownCostBasisShares: sumShares(unknownLots).toString(),
    pricePerShare: resolvedPricePerShare,
    tokenPrice,
    currentValueUsd: 0,
    walletValueUsd: 0,
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
// We keep the strict / zero-basis / windfall behavior isolated here so the materialization
// step reads as "compute known PnL, then apply the chosen unknown-lot policy".
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
    baseUnrealizedPnlUsd
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
    (total, entry) => total + formatAmount(entry.proceedsAssets, metadata.token.decimals),
    0
  )
  const unknownRealizedProceedsUsd = vault.unknownWithdrawalEntries.reduce((total, entry) => {
    const realizedTokenPrice = getTokenPriceForTimestamp(tokenPriceMap, entry.timestamp, tokenPrice)
    return total + formatAmount(entry.proceedsAssets, metadata.token.decimals) * realizedTokenPrice
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
    const receiptTokenPrice = getTokenPriceForTimestamp(tokenPriceMap, lot.acquiredAt ?? currentTimestamp, tokenPrice)
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
          tokenPrice
        )
        return entryTotal + receiptUnderlying * receiptTokenPrice
      }, 0)
    )
  }, 0)
  const unknownRealizedMarketPnlUsd = unknownRealizedProceedsUsd - realizedUnknownReceiptValueUsd
  const unknownCurrentMarketPnlUsd = currentUnknownUnderlying * tokenPrice - currentUnknownReceiptValueUsd

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
