import type { Address, Hash, Hex, PublicClient } from 'viem'
import type { Config } from 'wagmi'
import type {
  EnsoBridgeStatusProvider,
  EnsoQuoteProvider,
  VaultWidgetActivity,
  VaultWidgetConfig,
  VaultWidgetExecutionStep,
  VaultWidgetTransactionRequest,
  VaultWidgetWalletType
} from '../types'
import type { VaultWidgetDiscoveredReward } from './rewards'

export type VaultWidgetSettings = {
  autoStake: boolean
  maxLossBps: number
  slippagePercent: number
  solver: string
}

export type VaultWidgetSettingsStore = {
  hasStored?: (setting: keyof VaultWidgetSettings) => boolean
  read: () => VaultWidgetSettings
  write: (settings: VaultWidgetSettings) => void
  subscribe?: (listener: () => void) => () => void
}

export type VaultWidgetActivityStore = {
  list: (account?: Address) => Promise<readonly VaultWidgetActivity[]>
  add: (activity: VaultWidgetActivity) => Promise<number>
  update: (id: number, activity: Partial<VaultWidgetActivity>) => Promise<void>
  remove: (id: number) => Promise<void>
}

export type VaultWidgetConfigResolver = {
  resolve: (chainId: number, vaultAddress: Address, signal?: AbortSignal) => Promise<VaultWidgetConfig>
}

export type VaultWidgetRewardDiscoveryService = {
  discover: (params: {
    account: Address
    config: VaultWidgetConfig
    publicClient: PublicClient
    signal?: AbortSignal
  }) => Promise<readonly VaultWidgetDiscoveredReward[]>
}

export type VaultWidgetExecutionContext = {
  account: Address
  config: Config
  request: VaultWidgetTransactionRequest
  step: VaultWidgetExecutionStep
}

export type VaultWidgetWalletContext = {
  account: Address
  config: Config
}

export type VaultWidgetSafeProposalContext = VaultWidgetWalletContext & {
  chainId: number
  requests: readonly VaultWidgetTransactionRequest[]
  step: VaultWidgetExecutionStep
}

export type VaultWidgetExecutionService = {
  getWalletType?: (context: VaultWidgetWalletContext) => Promise<VaultWidgetWalletType>
  execute: (context: VaultWidgetExecutionContext) => Promise<Hash>
  waitForReceipt: (config: Config, chainId: number, hash: Hash) => Promise<void>
  proposeSafeBatch?: (context: VaultWidgetSafeProposalContext) => Promise<Hex>
  waitForSafeExecution?: (config: Config, chainId: number, proposalId: Hex) => Promise<Hash>
}

export type VaultWidgetServices = {
  activityStore: VaultWidgetActivityStore
  configResolver: VaultWidgetConfigResolver
  enso?: EnsoQuoteProvider
  ensoBridge?: EnsoBridgeStatusProvider
  execution: VaultWidgetExecutionService
  rewards: VaultWidgetRewardDiscoveryService
  settings: VaultWidgetSettingsStore
}
