import type { Address, Hash } from 'viem'
import type { Config } from 'wagmi'
import type {
  EnsoQuoteProvider,
  VaultWidgetActivity,
  VaultWidgetConfig,
  VaultWidgetExecutionStep,
  VaultWidgetTransactionRequest
} from '../types'

export type VaultWidgetSettings = {
  autoStake: boolean
  maxLossBps: number
  slippagePercent: number
  solver: string
}

export type VaultWidgetSettingsStore = {
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

export type VaultWidgetExecutionContext = {
  account: Address
  config: Config
  request: VaultWidgetTransactionRequest
  step: VaultWidgetExecutionStep
}

export type VaultWidgetExecutionService = {
  execute: (context: VaultWidgetExecutionContext) => Promise<Hash>
  waitForReceipt: (config: Config, chainId: number, hash: Hash) => Promise<void>
}

export type VaultWidgetServices = {
  activityStore: VaultWidgetActivityStore
  configResolver: VaultWidgetConfigResolver
  enso?: EnsoQuoteProvider
  execution: VaultWidgetExecutionService
  settings: VaultWidgetSettingsStore
}
