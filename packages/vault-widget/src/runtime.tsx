'use client'

import { createContext, type ReactElement, type ReactNode, useContext, useMemo } from 'react'
import type { Address, Hash, TransactionReceipt } from 'viem'
import type { VaultWidgetExecutionAdapter } from './headless/types'

export type { VaultWidgetExecutionAdapter } from './headless/types'

export type VaultWidgetTokenReference = {
  address: Address
  chainId: number
}

export type VaultWidgetToken = VaultWidgetTokenReference & {
  balanceRaw: bigint
  decimals: number
  logoUri?: string
  name: string
  symbol: string
  usdValue?: number
}

export type VaultWidgetCatalogVault = {
  address: Address
  assetAddress: Address
  chainId: number
  hidden?: boolean
  stakingAddress?: Address
}

export type VaultWidgetChain = {
  blockExplorerUrl?: string
  iconUrl?: string
  id: number
  name: string
}

export type VaultWidgetSafeTransactionStatus =
  | 'awaiting-confirmations'
  | 'awaiting-execution'
  | 'cancelled'
  | 'failed'
  | 'success'

export type VaultWidgetSafeTransactionDetails = {
  executionTxHash?: Hash
  safeTxHash: Hash
  status: VaultWidgetSafeTransactionStatus
}

export type VaultWidgetNotificationId = number | string
export type VaultWidgetBridgeProtocol = 'stargate' | 'ccip' | 'relay'
export type VaultWidgetBridgeStatus = 'pending' | 'inflight' | 'delivered' | 'failed' | 'unknown'
export type VaultWidgetBridgeTrackingState = 'active' | 'unavailable'

export type VaultWidgetNotificationInput = {
  amount: string
  executionChainId?: number
  fromAddress: Address
  fromChainId: number
  fromSymbol: string
  toAddress?: Address
  toAmount?: string
  toChainId?: number
  toSymbol?: string
  type: string
  bridgeProtocol?: VaultWidgetBridgeProtocol
}

export type VaultWidgetNotificationStatus = 'error' | 'pending' | 'submitted' | 'success'

export type VaultWidgetNotificationUpdate = {
  awaitingExecution?: boolean
  id: VaultWidgetNotificationId
  receipt?: TransactionReceipt
  status?: VaultWidgetNotificationStatus
  txHash?: Hash
  bridgeStatus?: VaultWidgetBridgeStatus
}

export type VaultWidgetTrackedNotification = {
  id: VaultWidgetNotificationId
  status: VaultWidgetNotificationStatus
  awaitingExecution?: boolean
  bridgeStatus?: VaultWidgetBridgeStatus
  bridgeTrackingState?: VaultWidgetBridgeTrackingState
  bridgeError?: string
  destinationTxHash?: Hash
}

export type VaultWidgetAnalyticsProperties = Record<string, boolean | null | number | string | undefined>

export type VaultWidgetWalletRuntime = {
  address?: Address
  chainId?: number
  connected: boolean
  connecting: boolean
  getToken: (token: VaultWidgetTokenReference) => VaultWidgetToken | undefined
  hasCompletedLoad: boolean
  isLoading: boolean
  open: () => Promise<void> | void
  refresh: (tokens?: readonly VaultWidgetTokenReference[]) => Promise<unknown>
  tokensByChain: Readonly<Record<number, Readonly<Record<string, VaultWidgetToken>>>>
}

export type VaultWidgetSettingsRuntime = {
  autoStake: boolean
  setAutoStake: (enabled: boolean) => void
  setSlippagePercent: (slippage: number) => void
  slippagePercent: number
}

export type VaultWidgetCatalogRuntime = {
  enableTokenList: () => void
  isLoading: boolean
  knownVaults: readonly VaultWidgetCatalogVault[]
  tokenListsByChain: Readonly<Record<number, Readonly<Record<string, VaultWidgetToken>>>>
}

export type VaultWidgetPricesRuntime = {
  getUsdPrice: (token: VaultWidgetTokenReference) => number
  spotPriceEndpoint?: string
}

export type VaultWidgetRoutingRuntime = {
  ensoRouteEndpoint?: string
  isEnsoEnabled: (context: { chainId: number; vaultAddress?: Address }) => boolean
}

export type VaultWidgetChainsRuntime = {
  getChain: (chainId: number) => VaultWidgetChain | undefined
  isConnectedToExecutionChain: (connectedChainId: number | undefined, targetChainId: number | undefined) => boolean
  resolveCanonicalChainId: (chainId: number | undefined) => number | undefined
  resolveExecutionChainId: (chainId: number | undefined) => number | undefined
}

export type VaultWidgetNotificationsRuntime = {
  create: (notification: VaultWidgetNotificationInput) => Promise<VaultWidgetNotificationId | undefined>
  update: (notification: VaultWidgetNotificationUpdate) => Promise<void>
  get: (id: VaultWidgetNotificationId | undefined) => VaultWidgetTrackedNotification | undefined
}

export type VaultWidgetAnalyticsRuntime = {
  track: (event: string, properties?: VaultWidgetAnalyticsProperties) => void
}

export type VaultWidgetSafeRuntime = {
  getTransactionDetails: (safeTxHash: Hash) => Promise<VaultWidgetSafeTransactionDetails | undefined>
  isSafe: boolean
}

export type VaultWidgetAssetsRuntime = {
  baseUri: string
  getChainLogoUrl: (chainId: number) => string | undefined
  getTokenLogoUrl: (token: VaultWidgetTokenReference & { size?: 32 | 128 }) => string | undefined
  isDevelopment: boolean
}

export type VaultWidgetRuntime = {
  analytics: VaultWidgetAnalyticsRuntime
  assets: VaultWidgetAssetsRuntime
  catalog: VaultWidgetCatalogRuntime
  chains: VaultWidgetChainsRuntime
  execution: VaultWidgetExecutionAdapter
  notifications: VaultWidgetNotificationsRuntime
  prices: VaultWidgetPricesRuntime
  routing: VaultWidgetRoutingRuntime
  safe: VaultWidgetSafeRuntime
  settings: VaultWidgetSettingsRuntime
  wallet: VaultWidgetWalletRuntime
}

/**
 * Host-owned integrations. Every field is optional so constrained presets can
 * provide only the services they use. Missing services resolve to safe,
 * disconnected defaults.
 */
export type VaultWidgetRuntimeOverrides = {
  analytics?: Partial<VaultWidgetAnalyticsRuntime>
  assets?: Partial<VaultWidgetAssetsRuntime>
  catalog?: Partial<VaultWidgetCatalogRuntime>
  chains?: Partial<VaultWidgetChainsRuntime>
  execution?: Partial<VaultWidgetExecutionAdapter>
  notifications?: Partial<VaultWidgetNotificationsRuntime>
  prices?: Partial<VaultWidgetPricesRuntime>
  routing?: Partial<VaultWidgetRoutingRuntime>
  safe?: Partial<VaultWidgetSafeRuntime>
  settings?: Partial<VaultWidgetSettingsRuntime>
  wallet?: Partial<VaultWidgetWalletRuntime>
}

export type VaultWidgetRuntimeProviderProps = {
  children?: ReactNode
  value?: VaultWidgetRuntimeOverrides
}

const EMPTY_TOKENS_BY_CHAIN: VaultWidgetWalletRuntime['tokensByChain'] = Object.freeze({})
const EMPTY_VAULTS: readonly VaultWidgetCatalogVault[] = Object.freeze([])

const noop = (): void => undefined
const noopAsync = (): Promise<void> => Promise.resolve()
const noopRefresh = (): Promise<unknown> => Promise.resolve(undefined)
const createNoopNotification = (): Promise<undefined> => Promise.resolve(undefined)
const getNoNotification = (): undefined => undefined
const getNoopSafeTransactionDetails = (): Promise<undefined> => Promise.resolve(undefined)
const getNoToken = (): undefined => undefined
const getZeroPrice = (): number => 0
const getNoChain = (): undefined => undefined
const getNoAssetUrl = (): undefined => undefined
const isEnsoDisabled = (): boolean => false
const rejectUnavailableExecution = (): Promise<never> =>
  Promise.reject(new Error('Vault widget transaction execution is not configured'))
const resolveSameChain = (chainId: number | undefined): number | undefined => chainId
const isSameExecutionChain = (connectedChainId: number | undefined, targetChainId: number | undefined): boolean =>
  targetChainId !== undefined && connectedChainId === targetChainId

export const DEFAULT_VAULT_WIDGET_RUNTIME: VaultWidgetRuntime = Object.freeze({
  analytics: Object.freeze({ track: noop }),
  assets: Object.freeze({
    baseUri: '',
    getChainLogoUrl: getNoAssetUrl,
    getTokenLogoUrl: getNoAssetUrl,
    isDevelopment: false
  }),
  catalog: Object.freeze({
    enableTokenList: noop,
    isLoading: false,
    knownVaults: EMPTY_VAULTS,
    tokenListsByChain: EMPTY_TOKENS_BY_CHAIN
  }),
  chains: Object.freeze({
    getChain: getNoChain,
    isConnectedToExecutionChain: isSameExecutionChain,
    resolveCanonicalChainId: resolveSameChain,
    resolveExecutionChainId: resolveSameChain
  }),
  execution: Object.freeze({
    execute: rejectUnavailableExecution,
    switchChain: rejectUnavailableExecution,
    waitForReceipt: rejectUnavailableExecution
  }),
  notifications: Object.freeze({
    create: createNoopNotification,
    update: noopAsync,
    get: getNoNotification
  }),
  prices: Object.freeze({
    getUsdPrice: getZeroPrice,
    spotPriceEndpoint: undefined
  }),
  routing: Object.freeze({
    ensoRouteEndpoint: undefined,
    isEnsoEnabled: isEnsoDisabled
  }),
  safe: Object.freeze({
    getTransactionDetails: getNoopSafeTransactionDetails,
    isSafe: false
  }),
  settings: Object.freeze({
    autoStake: false,
    setAutoStake: noop,
    setSlippagePercent: noop,
    slippagePercent: 0.5
  }),
  wallet: Object.freeze({
    address: undefined,
    chainId: undefined,
    connected: false,
    connecting: false,
    getToken: getNoToken,
    hasCompletedLoad: true,
    isLoading: false,
    open: noop,
    refresh: noopRefresh,
    tokensByChain: EMPTY_TOKENS_BY_CHAIN
  })
})

/**
 * True only when a host replaced every EOA execution method. Comparing the
 * resolved runtime methods keeps the marker false for partial overrides while
 * allowing nested providers to inherit a complete parent adapter.
 */
export function isVaultWidgetExecutionConfigured(runtime: Pick<VaultWidgetRuntime, 'execution'>): boolean {
  return (
    runtime.execution.execute !== DEFAULT_VAULT_WIDGET_RUNTIME.execution.execute &&
    runtime.execution.switchChain !== DEFAULT_VAULT_WIDGET_RUNTIME.execution.switchChain &&
    runtime.execution.waitForReceipt !== DEFAULT_VAULT_WIDGET_RUNTIME.execution.waitForReceipt
  )
}

function getTokenLogoUrl(baseUri: string): VaultWidgetAssetsRuntime['getTokenLogoUrl'] {
  return ({ address, chainId, size = 32 }) =>
    baseUri ? `${baseUri}/tokens/${chainId}/${address.toLowerCase()}/logo-${size}.png` : undefined
}

function getChainLogoUrl(baseUri: string): VaultWidgetAssetsRuntime['getChainLogoUrl'] {
  return (chainId) => (baseUri ? `${baseUri}/chains/${chainId}/logo.svg` : undefined)
}

export function createVaultWidgetRuntime(overrides: VaultWidgetRuntimeOverrides = {}): VaultWidgetRuntime {
  const assetsBaseUri = (overrides.assets?.baseUri ?? DEFAULT_VAULT_WIDGET_RUNTIME.assets.baseUri).replace(/\/+$/, '')
  const resolveExecutionChainId =
    overrides.chains?.resolveExecutionChainId ?? DEFAULT_VAULT_WIDGET_RUNTIME.chains.resolveExecutionChainId

  return {
    analytics: {
      track: overrides.analytics?.track ?? DEFAULT_VAULT_WIDGET_RUNTIME.analytics.track
    },
    assets: {
      baseUri: assetsBaseUri,
      getChainLogoUrl: overrides.assets?.getChainLogoUrl ?? getChainLogoUrl(assetsBaseUri),
      getTokenLogoUrl: overrides.assets?.getTokenLogoUrl ?? getTokenLogoUrl(assetsBaseUri),
      isDevelopment: overrides.assets?.isDevelopment ?? DEFAULT_VAULT_WIDGET_RUNTIME.assets.isDevelopment
    },
    catalog: {
      enableTokenList: overrides.catalog?.enableTokenList ?? DEFAULT_VAULT_WIDGET_RUNTIME.catalog.enableTokenList,
      isLoading: overrides.catalog?.isLoading ?? DEFAULT_VAULT_WIDGET_RUNTIME.catalog.isLoading,
      knownVaults: overrides.catalog?.knownVaults ?? DEFAULT_VAULT_WIDGET_RUNTIME.catalog.knownVaults,
      tokenListsByChain: overrides.catalog?.tokenListsByChain ?? DEFAULT_VAULT_WIDGET_RUNTIME.catalog.tokenListsByChain
    },
    chains: {
      getChain: overrides.chains?.getChain ?? DEFAULT_VAULT_WIDGET_RUNTIME.chains.getChain,
      isConnectedToExecutionChain:
        overrides.chains?.isConnectedToExecutionChain ??
        ((connectedChainId, targetChainId) => {
          const executionChainId = resolveExecutionChainId(targetChainId)
          return executionChainId !== undefined && connectedChainId === executionChainId
        }),
      resolveCanonicalChainId:
        overrides.chains?.resolveCanonicalChainId ?? DEFAULT_VAULT_WIDGET_RUNTIME.chains.resolveCanonicalChainId,
      resolveExecutionChainId
    },
    execution: {
      ...DEFAULT_VAULT_WIDGET_RUNTIME.execution,
      ...overrides.execution
    },
    notifications: {
      create: overrides.notifications?.create ?? DEFAULT_VAULT_WIDGET_RUNTIME.notifications.create,
      update: overrides.notifications?.update ?? DEFAULT_VAULT_WIDGET_RUNTIME.notifications.update,
      get: overrides.notifications?.get ?? DEFAULT_VAULT_WIDGET_RUNTIME.notifications.get
    },
    prices: {
      getUsdPrice: overrides.prices?.getUsdPrice ?? DEFAULT_VAULT_WIDGET_RUNTIME.prices.getUsdPrice,
      spotPriceEndpoint: overrides.prices?.spotPriceEndpoint ?? DEFAULT_VAULT_WIDGET_RUNTIME.prices.spotPriceEndpoint
    },
    routing: {
      ensoRouteEndpoint: overrides.routing?.ensoRouteEndpoint ?? DEFAULT_VAULT_WIDGET_RUNTIME.routing.ensoRouteEndpoint,
      isEnsoEnabled: overrides.routing?.isEnsoEnabled ?? DEFAULT_VAULT_WIDGET_RUNTIME.routing.isEnsoEnabled
    },
    safe: {
      getTransactionDetails:
        overrides.safe?.getTransactionDetails ?? DEFAULT_VAULT_WIDGET_RUNTIME.safe.getTransactionDetails,
      isSafe: overrides.safe?.isSafe ?? DEFAULT_VAULT_WIDGET_RUNTIME.safe.isSafe
    },
    settings: {
      autoStake: overrides.settings?.autoStake ?? DEFAULT_VAULT_WIDGET_RUNTIME.settings.autoStake,
      setAutoStake: overrides.settings?.setAutoStake ?? DEFAULT_VAULT_WIDGET_RUNTIME.settings.setAutoStake,
      setSlippagePercent:
        overrides.settings?.setSlippagePercent ?? DEFAULT_VAULT_WIDGET_RUNTIME.settings.setSlippagePercent,
      slippagePercent: overrides.settings?.slippagePercent ?? DEFAULT_VAULT_WIDGET_RUNTIME.settings.slippagePercent
    },
    wallet: {
      address: overrides.wallet?.address ?? DEFAULT_VAULT_WIDGET_RUNTIME.wallet.address,
      chainId: overrides.wallet?.chainId ?? DEFAULT_VAULT_WIDGET_RUNTIME.wallet.chainId,
      connected: overrides.wallet?.connected ?? DEFAULT_VAULT_WIDGET_RUNTIME.wallet.connected,
      connecting: overrides.wallet?.connecting ?? DEFAULT_VAULT_WIDGET_RUNTIME.wallet.connecting,
      getToken: overrides.wallet?.getToken ?? DEFAULT_VAULT_WIDGET_RUNTIME.wallet.getToken,
      hasCompletedLoad: overrides.wallet?.hasCompletedLoad ?? DEFAULT_VAULT_WIDGET_RUNTIME.wallet.hasCompletedLoad,
      isLoading: overrides.wallet?.isLoading ?? DEFAULT_VAULT_WIDGET_RUNTIME.wallet.isLoading,
      open: overrides.wallet?.open ?? DEFAULT_VAULT_WIDGET_RUNTIME.wallet.open,
      refresh: overrides.wallet?.refresh ?? DEFAULT_VAULT_WIDGET_RUNTIME.wallet.refresh,
      tokensByChain: overrides.wallet?.tokensByChain ?? DEFAULT_VAULT_WIDGET_RUNTIME.wallet.tokensByChain
    }
  }
}

type VaultWidgetRuntimeContextValue = {
  overrides: VaultWidgetRuntimeOverrides
  runtime: VaultWidgetRuntime
}

const VaultWidgetRuntimeContext = createContext<VaultWidgetRuntimeContextValue | undefined>(undefined)

export function VaultWidgetRuntimeProvider({ children, value = {} }: VaultWidgetRuntimeProviderProps): ReactElement {
  const parent = useContext(VaultWidgetRuntimeContext)
  const effectiveOverrides = useMemo<VaultWidgetRuntimeOverrides>(() => {
    if (!parent) {
      return value
    }

    return {
      analytics: { ...parent.runtime.analytics, ...value.analytics },
      assets: { ...parent.runtime.assets, ...value.assets },
      catalog: { ...parent.runtime.catalog, ...value.catalog },
      chains: { ...parent.runtime.chains, ...value.chains },
      execution: { ...parent.runtime.execution, ...value.execution },
      notifications: { ...parent.runtime.notifications, ...value.notifications },
      prices: { ...parent.runtime.prices, ...value.prices },
      routing: { ...parent.runtime.routing, ...value.routing },
      safe: { ...parent.runtime.safe, ...value.safe },
      settings: { ...parent.runtime.settings, ...value.settings },
      wallet: { ...parent.runtime.wallet, ...value.wallet }
    }
  }, [parent, value])
  const runtime = useMemo(() => createVaultWidgetRuntime(effectiveOverrides), [effectiveOverrides])
  const contextValue = useMemo(() => ({ overrides: effectiveOverrides, runtime }), [effectiveOverrides, runtime])

  return <VaultWidgetRuntimeContext.Provider value={contextValue}>{children}</VaultWidgetRuntimeContext.Provider>
}

/** Returns a complete runtime, using disconnected defaults outside a provider. */
export function useVaultWidgetRuntime(): VaultWidgetRuntime {
  return useContext(VaultWidgetRuntimeContext)?.runtime ?? DEFAULT_VAULT_WIDGET_RUNTIME
}

/**
 * Compatibility hook for callers that still fall back to host contexts when
 * no widget provider is mounted. New package code should use
 * useVaultWidgetRuntime instead.
 */
export function useVaultWidgetRuntimeOverrides(): VaultWidgetRuntimeOverrides | undefined {
  return useContext(VaultWidgetRuntimeContext)?.overrides
}
