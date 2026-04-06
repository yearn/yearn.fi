import type { VaultVersion } from './graphql'

export type TLocation = 'vault' | 'staked'

export type TLot = {
  shares: bigint
  costBasis: bigint | null
  acquiredAt?: number
}

export type TLotSummary = {
  lotCount: number
  totalShares: string
  knownShares: string
  unknownShares: string
  totalKnownCostBasis: string
}

export type TRealizedEntry = {
  timestamp: number
  proceedsAssets: bigint
  basisAssets: bigint
  pnlAssets: bigint
  consumedLots: TLot[]
}

export type TUnknownTransferInEntry = {
  timestamp: number
  shares: bigint
  location: TLocation
}

export type TRewardTransferInEntry = {
  timestamp: number
  shares: bigint
  location: TLocation
  distributor: string
}

export type TUnknownWithdrawalEntry = {
  timestamp: number
  shares: bigint
  proceedsAssets: bigint
  consumedLots: TLot[]
}

export type UnknownTransferInPnlMode = 'strict' | 'zero_basis' | 'windfall'

export type TPnlDebugJournalRow = {
  timestamp: number
  txHash: string
  familyVaultAddress: string
  stakingVaultAddress: string | null
  view: string
  hasAddressActivity: boolean
  rawEvents: string
  depositShares: string
  depositAssets: string
  withdrawShares: string
  withdrawAssets: string
  stakeShares: string
  unstakeShares: string
  rewardInVaultShares: string
  rewardInStakedShares: string
  unknownInVaultShares: string
  unknownInStakedShares: string
  transferOutVaultShares: string
  transferOutStakedShares: string
  realizedKnownShares: string
  realizedProceedsAssets: string
  realizedBasisAssets: string
  realizedPnlAssets: string
  vaultLotsBefore: TLotSummary
  stakedLotsBefore: TLotSummary
  vaultLotsAfter: TLotSummary
  stakedLotsAfter: TLotSummary
}

export type TRawScopes = {
  address: boolean
  tx: boolean
}

export type TRawPnlEvent =
  | {
      kind: 'deposit'
      id: string
      chainId: number
      vaultAddress: string
      familyVaultAddress: string
      isStakingVault: boolean
      blockNumber: number
      blockTimestamp: number
      logIndex: number
      transactionHash: string
      transactionFrom: string
      owner: string
      sender: string
      shares: bigint
      assets: bigint
      scopes: TRawScopes
    }
  | {
      kind: 'withdrawal'
      id: string
      chainId: number
      vaultAddress: string
      familyVaultAddress: string
      isStakingVault: boolean
      blockNumber: number
      blockTimestamp: number
      logIndex: number
      transactionHash: string
      transactionFrom: string
      owner: string
      shares: bigint
      assets: bigint
      scopes: TRawScopes
    }
  | {
      kind: 'transfer'
      id: string
      chainId: number
      vaultAddress: string
      familyVaultAddress: string
      isStakingVault: boolean
      blockNumber: number
      blockTimestamp: number
      logIndex: number
      transactionHash: string
      transactionFrom: string
      sender: string
      receiver: string
      shares: bigint
      scopes: TRawScopes
    }

export interface FamilyPnlLedger {
  chainId: number
  vaultAddress: string
  stakingVaultAddress: string | null
  vaultLots: TLot[]
  stakedLots: TLot[]
  totalDepositedAssets: bigint
  totalWithdrawnAssets: bigint
  unknownCostBasisTransferInCount: number
  unknownCostBasisTransferInShares: bigint
  withdrawalsWithUnknownCostBasis: number
  unmatchedTransferOutCount: number
  unmatchedTransferOutShares: bigint
  realizedEntries: TRealizedEntry[]
  rewardTransferInEntries: TRewardTransferInEntry[]
  unknownTransferInEntries: TUnknownTransferInEntry[]
  unknownWithdrawalEntries: TUnknownWithdrawalEntry[]
  debugJournal: TPnlDebugJournalRow[]
  eventCounts: {
    underlyingDeposits: number
    underlyingWithdrawals: number
    stakes: number
    unstakes: number
    rewardTransfersIn: number
    externalTransfersIn: number
    externalTransfersOut: number
    migrationsIn: number
    migrationsOut: number
  }
}

export interface HoldingsPnLVault {
  chainId: number
  vaultAddress: string
  stakingVaultAddress: string | null
  status: 'ok' | 'missing_metadata' | 'missing_price' | 'missing_pps'
  costBasisStatus: 'complete' | 'partial'
  unknownTransferInPnlMode: UnknownTransferInPnlMode
  shares: string
  sharesFormatted: number
  vaultShares: string
  vaultSharesFormatted: number
  stakedShares: string
  stakedSharesFormatted: number
  knownCostBasisShares: string
  unknownCostBasisShares: string
  pricePerShare: number
  tokenPrice: number
  currentUnderlying: number
  vaultUnderlying: number
  stakedUnderlying: number
  currentKnownUnderlying: number
  currentUnknownUnderlying: number
  knownCostBasisUnderlying: number
  knownCostBasisUsd: number
  currentValueUsd: number
  vaultValueUsd: number
  stakedValueUsd: number
  unknownCostBasisValueUsd: number
  windfallPnlUsd: number
  realizedPnlUnderlying: number
  realizedPnlUsd: number
  unrealizedPnlUnderlying: number
  unrealizedPnlUsd: number
  totalPnlUsd: number
  totalEconomicGainUsd: number
  totalDepositedUnderlying: number
  totalWithdrawnUnderlying: number
  eventCounts: {
    underlyingDeposits: number
    underlyingWithdrawals: number
    stakes: number
    unstakes: number
    rewardTransfersIn: number
    externalTransfersIn: number
    externalTransfersOut: number
    migrationsIn: number
    migrationsOut: number
    unknownCostBasisTransfersIn: number
    withdrawalsWithUnknownCostBasis: number
  }
  metadata: {
    symbol: string
    decimals: number
    assetDecimals: number
    tokenAddress: string
    category: 'stable' | 'volatile'
  } | null
}

export interface HoldingsPnLCategoryBreakdown {
  totalPnlUsd: number
  totalEconomicGainUsd: number
}

export type THoldingsPnlSummary = {
  totalVaults: number
  completeVaults: number
  partialVaults: number
  totalCurrentValueUsd: number
  totalUnknownCostBasisValueUsd: number
  totalWindfallPnlUsd: number
  totalRealizedPnlUsd: number
  totalUnrealizedPnlUsd: number
  totalPnlUsd: number
  totalEconomicGainUsd: number
  byCategory: {
    stable: HoldingsPnLCategoryBreakdown
    volatile: HoldingsPnLCategoryBreakdown
  }
  isComplete: boolean
}

export type THoldingsPnlLot = {
  index: number
  shares: string
  sharesFormatted: number
  costBasis: string | null
  costBasisFormatted: number | null
  acquiredAt: number | null
  costBasisUsd: number | null
  pricePerShareAtAcquisition: number
  tokenPriceAtAcquisition: number
  currentUnderlying: number
  currentValueUsd: number
}

export type THoldingsPnlRealizedEntry = {
  timestamp: number
  proceedsAssets: string
  proceedsUnderlying: number
  proceedsUsd: number
  basisAssets: string
  basisUnderlying: number
  basisUsd: number
  pnlAssets: string
  pnlUnderlying: number
  pnlUsd: number
  consumedLots: THoldingsPnlLot[]
}

export type THoldingsPnlUnknownTransferInEntry = {
  timestamp: number
  location: TLocation
  shares: string
  sharesFormatted: number
  pricePerShareAtReceipt: number
  tokenPriceAtReceipt: number
  receiptUnderlying: number
  receiptValueUsd: number
}

export type THoldingsPnlRewardTransferInEntry = {
  timestamp: number
  location: TLocation
  distributor: string
  shares: string
  sharesFormatted: number
  pricePerShareAtReceipt: number
  tokenPriceAtReceipt: number
  receiptUnderlying: number
  receiptValueUsd: number
}

export type THoldingsPnlUnknownWithdrawalEntry = {
  timestamp: number
  shares: string
  sharesFormatted: number
  proceedsAssets: string
  proceedsUnderlying: number
  proceedsUsd: number
  consumedLots: THoldingsPnlLot[]
}

export type THoldingsPnlJournalLotSummary = TLotSummary & {
  totalSharesFormatted: number
  knownSharesFormatted: number
  unknownSharesFormatted: number
  totalKnownCostBasisFormatted: number
}

export type THoldingsPnlJournalEntry = {
  timestamp: number
  txHash: string
  view: string
  hasAddressActivity: boolean
  rawEvents: string
  depositShares: string
  depositSharesFormatted: number
  depositAssets: string
  depositAssetsFormatted: number
  withdrawShares: string
  withdrawSharesFormatted: number
  withdrawAssets: string
  withdrawAssetsFormatted: number
  stakeShares: string
  stakeSharesFormatted: number
  unstakeShares: string
  unstakeSharesFormatted: number
  rewardInVaultShares: string
  rewardInVaultSharesFormatted: number
  rewardInStakedShares: string
  rewardInStakedSharesFormatted: number
  unknownInVaultShares: string
  unknownInVaultSharesFormatted: number
  unknownInStakedShares: string
  unknownInStakedSharesFormatted: number
  transferOutVaultShares: string
  transferOutVaultSharesFormatted: number
  transferOutStakedShares: string
  transferOutStakedSharesFormatted: number
  realizedKnownShares: string
  realizedKnownSharesFormatted: number
  realizedProceedsAssets: string
  realizedProceedsAssetsFormatted: number
  realizedBasisAssets: string
  realizedBasisAssetsFormatted: number
  realizedPnlAssets: string
  realizedPnlAssetsFormatted: number
  vaultLotsBefore: THoldingsPnlJournalLotSummary
  stakedLotsBefore: THoldingsPnlJournalLotSummary
  vaultLotsAfter: THoldingsPnlJournalLotSummary
  stakedLotsAfter: THoldingsPnlJournalLotSummary
}

export interface HoldingsPnLDrilldownVault extends HoldingsPnLVault {
  currentLots: {
    vault: THoldingsPnlLot[]
    staked: THoldingsPnlLot[]
  }
  realizedEntries: THoldingsPnlRealizedEntry[]
  rewardTransferInEntries: THoldingsPnlRewardTransferInEntry[]
  unknownTransferInEntries: THoldingsPnlUnknownTransferInEntry[]
  unknownWithdrawalEntries: THoldingsPnlUnknownWithdrawalEntry[]
  journal: THoldingsPnlJournalEntry[]
}

export interface HoldingsPnLResponse {
  address: string
  version: VaultVersion
  unknownTransferInPnlMode: UnknownTransferInPnlMode
  generatedAt: string
  summary: THoldingsPnlSummary
  vaults: HoldingsPnLVault[]
}

export interface HoldingsPnLDrilldownResponse {
  address: string
  version: VaultVersion
  unknownTransferInPnlMode: UnknownTransferInPnlMode
  generatedAt: string
  summary: THoldingsPnlSummary
  vaults: HoldingsPnLDrilldownVault[]
}

export type TPnlComputationState = {
  unknownCostBasisValueUsd: number
  windfallPnlUsd: number
  realizedPnlUnderlying: number
  realizedPnlUsd: number
  unrealizedPnlUnderlying: number
  unrealizedPnlUsd: number
}
