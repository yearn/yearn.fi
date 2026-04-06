import type { TAddress } from './address'

export type TTenderlyConfiguredChainStatus = {
  canonicalChainId: number
  canonicalChainName: string
  executionChainId: number
  hasAdminRpc: boolean
}

export type TTenderlyPanelStatus = {
  isTenderlyModeEnabled: boolean
  configuredChains: TTenderlyConfiguredChainStatus[]
}

export type TTenderlySnapshotKind = 'baseline' | 'snapshot'
export type TTenderlySnapshotRecordStatus = 'valid' | 'invalid'

export type TTenderlySnapshotRecord = {
  snapshotId: string
  canonicalChainId: number
  executionChainId: number
  label: string
  createdAt: string
  kind: TTenderlySnapshotKind
  lastKnownStatus: TTenderlySnapshotRecordStatus
}

export type TTenderlySnapshotRequest = {
  canonicalChainId: number
  label?: string
  isBaseline?: boolean
}

export type TTenderlyRevertRequest = {
  canonicalChainId: number
  snapshotId: string
}

export type TTenderlyRevertResponse = {
  success: boolean
  revertedSnapshotId: string
}

export type TTenderlyIncreaseTimeRequest = {
  canonicalChainId: number
  seconds: number
  mineBlock?: boolean
}

export type TTenderlyIncreaseTimeResponse = {
  timeResult: unknown
  mineResult?: unknown
}

export type TTenderlyFundAssetKind = 'native' | 'erc20'
export type TTenderlyFundTokenType = 'asset' | 'vault' | 'staking'

export type TTenderlyFundableAsset = {
  chainId: number
  address: TAddress
  name: string
  symbol: string
  decimals: number
  assetKind: TTenderlyFundAssetKind
  tokenType: TTenderlyFundTokenType
  logoURI?: string
}

export type TTenderlyFundRequest = {
  canonicalChainId: number
  walletAddress: TAddress
  assetKind: TTenderlyFundAssetKind
  tokenAddress?: TAddress
  symbol: string
  decimals: number
  amount: string
  mode?: 'set' | 'add'
}

export type TTenderlyFundResponse = {
  method: string
  result: unknown
}
