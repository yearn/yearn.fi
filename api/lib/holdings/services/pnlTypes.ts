import type { VaultVersion } from './graphql'

export type TLocation = 'wallet' | 'staked'

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
  wrapShares: string
  unwrapShares: string
  unknownInWalletShares: string
  unknownInStakedShares: string
  transferOutWalletShares: string
  transferOutStakedShares: string
  realizedKnownShares: string
  realizedProceedsAssets: string
  realizedBasisAssets: string
  realizedPnlAssets: string
  walletLotsBefore: TLotSummary
  stakedLotsBefore: TLotSummary
  walletLotsAfter: TLotSummary
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
  walletLots: TLot[]
  stakedLots: TLot[]
  totalDepositedAssets: bigint
  totalWithdrawnAssets: bigint
  unknownCostBasisTransferInCount: number
  unknownCostBasisTransferInShares: bigint
  withdrawalsWithUnknownCostBasis: number
  unmatchedTransferOutCount: number
  unmatchedTransferOutShares: bigint
  realizedEntries: TRealizedEntry[]
  unknownTransferInEntries: TUnknownTransferInEntry[]
  unknownWithdrawalEntries: TUnknownWithdrawalEntry[]
  debugJournal: TPnlDebugJournalRow[]
  eventCounts: {
    underlyingDeposits: number
    underlyingWithdrawals: number
    stakingWraps: number
    stakingUnwraps: number
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
  walletShares: string
  walletSharesFormatted: number
  stakedShares: string
  stakedSharesFormatted: number
  knownCostBasisShares: string
  unknownCostBasisShares: string
  pricePerShare: number
  tokenPrice: number
  currentUnderlying: number
  walletUnderlying: number
  stakedUnderlying: number
  currentKnownUnderlying: number
  currentUnknownUnderlying: number
  knownCostBasisUnderlying: number
  knownCostBasisUsd: number
  currentValueUsd: number
  walletValueUsd: number
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
    stakingWraps: number
    stakingUnwraps: number
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
  } | null
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
  wrapShares: string
  wrapSharesFormatted: number
  unwrapShares: string
  unwrapSharesFormatted: number
  unknownInWalletShares: string
  unknownInWalletSharesFormatted: number
  unknownInStakedShares: string
  unknownInStakedSharesFormatted: number
  transferOutWalletShares: string
  transferOutWalletSharesFormatted: number
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
  walletLotsBefore: THoldingsPnlJournalLotSummary
  stakedLotsBefore: THoldingsPnlJournalLotSummary
  walletLotsAfter: THoldingsPnlJournalLotSummary
  stakedLotsAfter: THoldingsPnlJournalLotSummary
}

export interface HoldingsPnLDrilldownVault extends HoldingsPnLVault {
  currentLots: {
    wallet: THoldingsPnlLot[]
    staked: THoldingsPnlLot[]
  }
  realizedEntries: THoldingsPnlRealizedEntry[]
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
