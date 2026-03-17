import type { VaultVersion } from './graphql'

export type TLocation = 'wallet' | 'staked'

export type TLot = {
  shares: bigint
  costBasis: bigint | null
  acquiredAt?: number
}

export type TRealizedEntry = {
  timestamp: number
  pnlAssets: bigint
}

export type TUnknownTransferInEntry = {
  timestamp: number
  shares: bigint
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
    tokenAddress: string
  } | null
}

export interface HoldingsPnLResponse {
  address: string
  version: VaultVersion
  unknownTransferInPnlMode: UnknownTransferInPnlMode
  generatedAt: string
  summary: {
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
  vaults: HoldingsPnLVault[]
}

export type TPnlComputationState = {
  unknownCostBasisValueUsd: number
  windfallPnlUsd: number
  realizedPnlUnderlying: number
  realizedPnlUsd: number
  unrealizedPnlUnderlying: number
  unrealizedPnlUsd: number
}
