import type { Chain } from 'viem'
import { canonicalChains, type TCanonicalChainId } from './chainDefinitions'

type TEnvValue = boolean | string | undefined

type TTenderlyEnv = Record<string, TEnvValue>

const TENDERLY_MODE_STORAGE_KEY = 'dev-tenderly-mode-enabled'
const LOOPBACK_HOSTNAMES = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1', '[::1]'])

export type TTenderlyChainConfig = {
  canonicalChainId: TCanonicalChainId
  executionChainId: number
  rpcUri: string
  explorerUri?: string
}

export type TTenderlyRuntime = {
  isEnabled: boolean
  configuredByCanonicalId: Readonly<Record<number, TTenderlyChainConfig>>
  configuredCanonicalChainIds: readonly TCanonicalChainId[]
  canonicalToExecutionChainId: ReadonlyMap<number, number>
  executionToCanonicalChainId: ReadonlyMap<number, TCanonicalChainId>
}

function isLoopbackHostname(hostname: string | undefined): boolean {
  if (!hostname) {
    return false
  }

  return LOOPBACK_HOSTNAMES.has(hostname.trim().toLowerCase())
}

function canToggleTenderlyModeForRuntime({ isDev, hostname }: { isDev: boolean; hostname?: string }): boolean {
  return isDev || isLoopbackHostname(hostname)
}

// Legacy localhost fork support is intentionally limited to 1337.
// The older 5402 alias is retired unless we explicitly revive that workflow.
const LOCAL_EXECUTION_CHAIN_ALIASES = new Map<number, TCanonicalChainId>([[1337, 1]])

function readEnvString(value: TEnvValue): string {
  if (typeof value === 'string') {
    return value.trim()
  }

  if (typeof value === 'boolean') {
    return value ? 'true' : 'false'
  }

  return ''
}

function isTruthyEnvValue(value: TEnvValue): boolean {
  return ['1', 'on', 'true', 'yes'].includes(readEnvString(value).toLowerCase())
}

function withTenderlyOverrides(chain: Chain, config?: TTenderlyChainConfig): Chain {
  if (!config) {
    return chain
  }

  const defaultHttp = [config.rpcUri, ...(chain.rpcUrls.default?.http || [])].filter(Boolean)
  const publicHttp = [config.rpcUri, ...(chain.rpcUrls.public?.http || chain.rpcUrls.default?.http || [])].filter(
    Boolean
  )

  return {
    ...chain,
    rpcUrls: {
      ...chain.rpcUrls,
      default: {
        ...chain.rpcUrls.default,
        http: [...new Set(defaultHttp)]
      },
      public: {
        ...chain.rpcUrls.public,
        http: [...new Set(publicHttp)]
      }
    },
    blockExplorers:
      config.explorerUri && chain.blockExplorers
        ? {
            ...chain.blockExplorers,
            default: {
              ...chain.blockExplorers.default,
              url: config.explorerUri
            }
          }
        : chain.blockExplorers
  }
}

function buildExecutionChain(chain: Chain, config: TTenderlyChainConfig): Chain {
  return {
    ...withTenderlyOverrides(chain, config),
    id: config.executionChainId,
    name: `${chain.name} Tenderly`,
    blockExplorers:
      config.explorerUri && chain.blockExplorers
        ? {
            ...chain.blockExplorers,
            default: {
              name: `${chain.name} Tenderly Explorer`,
              url: config.explorerUri
            }
          }
        : undefined,
    testnet: true
  }
}

export function resolveInitialTenderlyModeEnabled({
  isConfigured,
  canToggle,
  storedPreference
}: {
  isConfigured: boolean
  canToggle: boolean
  storedPreference?: string | null
}): boolean {
  if (!isConfigured) {
    return false
  }

  if (!canToggle) {
    return true
  }

  return storedPreference !== 'false'
}

export function parseTenderlyRuntime(env: TTenderlyEnv): TTenderlyRuntime {
  const isEnabled = isTruthyEnvValue(env.VITE_TENDERLY_MODE)

  if (!isEnabled) {
    return {
      isEnabled: false,
      configuredByCanonicalId: {},
      configuredCanonicalChainIds: [],
      canonicalToExecutionChainId: new Map(),
      executionToCanonicalChainId: new Map()
    }
  }

  const configuredChains = canonicalChains.reduce<TTenderlyChainConfig[]>((accumulator, chain) => {
    const rawExecutionChainId = readEnvString(env[`VITE_TENDERLY_CHAIN_ID_FOR_${chain.id}`])
    const rawRpcUri = readEnvString(env[`VITE_TENDERLY_RPC_URI_FOR_${chain.id}`])
    const rawExplorerUri = readEnvString(env[`VITE_TENDERLY_EXPLORER_URI_FOR_${chain.id}`])
    const hasAnyConfig = Boolean(rawExecutionChainId || rawRpcUri || rawExplorerUri)

    if (!hasAnyConfig) {
      return accumulator
    }

    if (!rawExecutionChainId || !rawRpcUri) {
      throw new Error(
        `Tenderly chain ${chain.id} requires both VITE_TENDERLY_CHAIN_ID_FOR_${chain.id} and VITE_TENDERLY_RPC_URI_FOR_${chain.id}`
      )
    }

    const executionChainId = Number(rawExecutionChainId)
    if (!Number.isInteger(executionChainId) || executionChainId <= 0) {
      throw new Error(`Invalid Tenderly execution chain ID for canonical chain ${chain.id}: ${rawExecutionChainId}`)
    }

    accumulator.push({
      canonicalChainId: chain.id,
      executionChainId,
      rpcUri: rawRpcUri,
      explorerUri: rawExplorerUri || undefined
    })

    return accumulator
  }, [])

  if (configuredChains.length === 0) {
    throw new Error('Tenderly mode is enabled but no Tenderly execution chains are configured')
  }

  const executionToCanonicalChainId = configuredChains.reduce<Map<number, TCanonicalChainId>>((accumulator, chain) => {
    const existingCanonicalChainId = accumulator.get(chain.executionChainId)
    if (existingCanonicalChainId !== undefined) {
      throw new Error(
        `Duplicate Tenderly execution chain ID ${chain.executionChainId} configured for canonical chains ${existingCanonicalChainId} and ${chain.canonicalChainId}`
      )
    }

    accumulator.set(chain.executionChainId, chain.canonicalChainId)
    return accumulator
  }, new Map())

  const configuredByCanonicalId = configuredChains.reduce<Record<number, TTenderlyChainConfig>>(
    (accumulator, chain) => {
      accumulator[chain.canonicalChainId] = chain
      return accumulator
    },
    {}
  )

  return {
    isEnabled: true,
    configuredByCanonicalId,
    configuredCanonicalChainIds: configuredChains.map((chain) => chain.canonicalChainId),
    canonicalToExecutionChainId: new Map(
      configuredChains.map((chain) => [chain.canonicalChainId, chain.executionChainId])
    ),
    executionToCanonicalChainId
  }
}

function readStoredTenderlyModePreference(): string | null | undefined {
  if (typeof window === 'undefined') {
    return undefined
  }

  try {
    return window.localStorage.getItem(TENDERLY_MODE_STORAGE_KEY)
  } catch {
    return undefined
  }
}

const disabledTenderlyRuntime = parseTenderlyRuntime({})
const tenderlyModeCanToggle = canToggleTenderlyModeForRuntime({
  isDev: import.meta.env.DEV,
  hostname: typeof window === 'undefined' ? undefined : window.location.hostname
})

export const tenderlyConfiguredRuntime = parseTenderlyRuntime(import.meta.env)
export const tenderlyRuntime = resolveInitialTenderlyModeEnabled({
  isConfigured: tenderlyConfiguredRuntime.isEnabled,
  canToggle: tenderlyModeCanToggle,
  storedPreference: readStoredTenderlyModePreference()
})
  ? tenderlyConfiguredRuntime
  : disabledTenderlyRuntime

export function getSupportedCanonicalChainsForRuntime(runtime: TTenderlyRuntime): readonly Chain[] {
  return runtime.isEnabled
    ? canonicalChains
        .filter((chain) => chain.id in runtime.configuredByCanonicalId)
        .map((chain) => withTenderlyOverrides(chain, runtime.configuredByCanonicalId[chain.id]))
    : canonicalChains
}

export function getSupportedExecutionChainsForRuntime(
  runtime: TTenderlyRuntime,
  canonicalChainSet: readonly Chain[] = getSupportedCanonicalChainsForRuntime(runtime)
): readonly Chain[] {
  return runtime.isEnabled
    ? canonicalChainSet.map((chain) =>
        buildExecutionChain(chain, runtime.configuredByCanonicalId[chain.id] as TTenderlyChainConfig)
      )
    : canonicalChainSet
}

export function getSupportedChainLookupForRuntime(
  runtime: TTenderlyRuntime,
  canonicalChainSet: readonly Chain[] = getSupportedCanonicalChainsForRuntime(runtime),
  executionChainSet: readonly Chain[] = getSupportedExecutionChainsForRuntime(runtime, canonicalChainSet)
): readonly Chain[] {
  return [
    ...canonicalChainSet,
    ...executionChainSet.filter((chain) => !canonicalChainSet.some((canonicalChain) => canonicalChain.id === chain.id))
  ]
}

export const supportedCanonicalChains: readonly Chain[] = getSupportedCanonicalChainsForRuntime(tenderlyRuntime)

export const supportedExecutionChains: readonly Chain[] = getSupportedExecutionChainsForRuntime(
  tenderlyRuntime,
  supportedCanonicalChains
)

export const supportedChainLookup: readonly Chain[] = getSupportedChainLookupForRuntime(
  tenderlyRuntime,
  supportedCanonicalChains,
  supportedExecutionChains
)

export function isTenderlyModeEnabled(): boolean {
  return tenderlyRuntime.isEnabled
}

export function isTenderlyModeConfigured(): boolean {
  return tenderlyConfiguredRuntime.isEnabled
}

export function canToggleTenderlyMode(): boolean {
  return tenderlyModeCanToggle && tenderlyConfiguredRuntime.isEnabled
}

export function persistTenderlyModeEnabled(value: boolean): void {
  if (typeof window === 'undefined' || !canToggleTenderlyMode()) {
    return
  }

  try {
    window.localStorage.setItem(TENDERLY_MODE_STORAGE_KEY, value ? 'true' : 'false')
  } catch {
    // If storage is unavailable, the app will stay on the current mode after reload.
  }
}

export function getTenderlyBackedCanonicalChainIds(): readonly TCanonicalChainId[] {
  return tenderlyRuntime.configuredCanonicalChainIds
}

export function isCanonicalChainEnabled(chainId: number): chainId is TCanonicalChainId {
  return supportedCanonicalChains.some((chain) => chain.id === chainId)
}

export function getCanonicalChain(chainId: number): Chain | undefined {
  return supportedCanonicalChains.find((chain) => chain.id === chainId)
}

function isCanonicalChainEnabledForRuntime(runtime: TTenderlyRuntime, chainId: number): chainId is TCanonicalChainId {
  return getSupportedCanonicalChainsForRuntime(runtime).some((chain) => chain.id === chainId)
}

function resolveLocalExecutionCanonicalAliasForRuntime(
  runtime: TTenderlyRuntime,
  chainId: number
): TCanonicalChainId | undefined {
  const canonicalChainId = LOCAL_EXECUTION_CHAIN_ALIASES.get(chainId)
  if (canonicalChainId === undefined) {
    return undefined
  }

  return isCanonicalChainEnabledForRuntime(runtime, canonicalChainId) ? canonicalChainId : undefined
}

export function resolveCanonicalChainIdForRuntime(
  runtime: TTenderlyRuntime,
  chainId: number | undefined
): TCanonicalChainId | undefined {
  if (!Number.isInteger(chainId)) {
    return undefined
  }

  const executionChainId = runtime.executionToCanonicalChainId.get(chainId as number)
  if (executionChainId !== undefined) {
    return executionChainId
  }

  const localExecutionAlias = resolveLocalExecutionCanonicalAliasForRuntime(runtime, chainId as number)
  if (localExecutionAlias !== undefined) {
    return localExecutionAlias
  }

  if (isCanonicalChainEnabledForRuntime(runtime, chainId as number)) {
    return chainId as TCanonicalChainId
  }

  return undefined
}

export function resolveCanonicalChainId(chainId: number | undefined): TCanonicalChainId | undefined {
  return resolveCanonicalChainIdForRuntime(tenderlyRuntime, chainId)
}

export function resolveConnectedCanonicalChainIdForRuntime(
  runtime: TTenderlyRuntime,
  chainId: number | undefined
): TCanonicalChainId | undefined {
  if (!Number.isInteger(chainId)) {
    return undefined
  }

  const localExecutionAlias = resolveLocalExecutionCanonicalAliasForRuntime(runtime, chainId as number)
  if (localExecutionAlias !== undefined) {
    return localExecutionAlias
  }

  if (runtime.isEnabled) {
    const canonicalChainId = runtime.executionToCanonicalChainId.get(chainId as number)
    if (canonicalChainId !== undefined) {
      return canonicalChainId
    }

    return isCanonicalChainEnabledForRuntime(runtime, chainId as number) ? (chainId as TCanonicalChainId) : undefined
  }

  return isCanonicalChainEnabledForRuntime(runtime, chainId as number) ? (chainId as TCanonicalChainId) : undefined
}

export function resolveConnectedCanonicalChainId(chainId: number | undefined): TCanonicalChainId | undefined {
  return resolveConnectedCanonicalChainIdForRuntime(tenderlyRuntime, chainId)
}

export function resolveExecutionChainIdForRuntime(
  runtime: TTenderlyRuntime,
  chainId: number | undefined
): number | undefined {
  if (!Number.isInteger(chainId)) {
    return undefined
  }

  const normalizedChainId = chainId as number

  if (resolveLocalExecutionCanonicalAliasForRuntime(runtime, normalizedChainId) !== undefined) {
    return normalizedChainId
  }

  if (runtime.executionToCanonicalChainId.has(normalizedChainId)) {
    return normalizedChainId
  }

  if (runtime.isEnabled) {
    return runtime.canonicalToExecutionChainId.get(normalizedChainId)
  }

  return isCanonicalChainEnabledForRuntime(runtime, normalizedChainId) ? normalizedChainId : undefined
}

export function resolveExecutionChainId(chainId: number | undefined): number | undefined {
  return resolveExecutionChainIdForRuntime(tenderlyRuntime, chainId)
}

export function isConnectedToExecutionChainForRuntime(
  runtime: TTenderlyRuntime,
  connectedChainId: number | undefined,
  targetChainId: number | undefined
): boolean {
  if (!Number.isInteger(connectedChainId)) {
    return false
  }

  const requiredExecutionChainId = resolveExecutionChainIdForRuntime(runtime, targetChainId)
  if (requiredExecutionChainId === undefined) {
    return false
  }

  return connectedChainId === requiredExecutionChainId
}

export function isConnectedToExecutionChain(
  connectedChainId: number | undefined,
  targetChainId: number | undefined
): boolean {
  return isConnectedToExecutionChainForRuntime(tenderlyRuntime, connectedChainId, targetChainId)
}

export function resolveTenderlyRpcUriForExecutionChainIdForRuntime(
  runtime: TTenderlyRuntime,
  chainId: number | undefined
): string | undefined {
  if (!Number.isInteger(chainId)) {
    return undefined
  }

  const canonicalChainId = runtime.executionToCanonicalChainId.get(chainId as number)
  if (canonicalChainId === undefined) {
    return undefined
  }

  return runtime.configuredByCanonicalId[canonicalChainId]?.rpcUri
}

export function resolveTenderlyRpcUriForExecutionChainId(chainId: number | undefined): string | undefined {
  return resolveTenderlyRpcUriForExecutionChainIdForRuntime(tenderlyRuntime, chainId)
}

export function resolveTenderlyExplorerUriForExecutionChainIdForRuntime(
  runtime: TTenderlyRuntime,
  chainId: number | undefined
): string | undefined {
  if (!Number.isInteger(chainId)) {
    return undefined
  }

  const canonicalChainId = runtime.executionToCanonicalChainId.get(chainId as number)
  if (canonicalChainId === undefined) {
    return undefined
  }

  return runtime.configuredByCanonicalId[canonicalChainId]?.explorerUri
}

export function resolveTenderlyExplorerUriForExecutionChainId(chainId: number | undefined): string | undefined {
  return resolveTenderlyExplorerUriForExecutionChainIdForRuntime(tenderlyRuntime, chainId)
}
