import type { Chain } from 'viem'
import { parseLocalForkChains, type TLocalForkChain, type TLocalForkEnv } from '@/config/localFork'
import { env } from '@/env'
import { canonicalChains, type TCanonicalChainId } from './chainDefinitions'

const LOCAL_FORK_MODE_STORAGE_KEY = 'dev-local-fork-mode-enabled'

type TTenderlyChainConfig = TLocalForkChain<TCanonicalChainId>

export type TTenderlyRuntime = {
  isEnabled: boolean
  configuredByCanonicalId: Readonly<Record<number, TTenderlyChainConfig>>
  configuredCanonicalChainIds: readonly TCanonicalChainId[]
  canonicalToExecutionChainId: ReadonlyMap<number, number>
  executionToCanonicalChainId: ReadonlyMap<number, TCanonicalChainId>
}

// Legacy localhost fork support is intentionally limited to 1337.
// The older 5402 alias is retired unless we explicitly revive that workflow.
const LOCAL_EXECUTION_CHAIN_ALIASES = new Map<number, TCanonicalChainId>([[1337, 1]])

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
    name: `${chain.name} Local Fork`,
    blockExplorers:
      config.explorerUri && chain.blockExplorers
        ? {
            ...chain.blockExplorers,
            default: {
              name: `${chain.name} Local Fork Explorer`,
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

export function parseTenderlyRuntime(env: TLocalForkEnv): TTenderlyRuntime {
  const configuredChains = parseLocalForkChains(env, canonicalChains)

  if (configuredChains.length === 0) {
    return {
      isEnabled: false,
      configuredByCanonicalId: {},
      configuredCanonicalChainIds: [],
      canonicalToExecutionChainId: new Map(),
      executionToCanonicalChainId: new Map()
    }
  }

  const executionToCanonicalChainId = configuredChains.reduce<Map<number, TCanonicalChainId>>((accumulator, chain) => {
    const existingCanonicalChainId = accumulator.get(chain.executionChainId)
    if (existingCanonicalChainId !== undefined) {
      throw new Error(
        `Duplicate local fork execution chain ID ${chain.executionChainId} configured for canonical chains ${existingCanonicalChainId} and ${chain.canonicalChainId}`
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
    return window.localStorage.getItem(LOCAL_FORK_MODE_STORAGE_KEY)
  } catch {
    return undefined
  }
}

const disabledTenderlyRuntime = parseTenderlyRuntime({})
export const tenderlyConfiguredRuntime = env.DEV ? parseTenderlyRuntime(env) : disabledTenderlyRuntime
export const tenderlyRuntime = resolveInitialTenderlyModeEnabled({
  isConfigured: tenderlyConfiguredRuntime.isEnabled,
  canToggle: env.DEV,
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
  return env.DEV && tenderlyConfiguredRuntime.isEnabled
}

export function persistTenderlyModeEnabled(value: boolean): void {
  if (typeof window === 'undefined' || !canToggleTenderlyMode()) {
    return
  }

  try {
    window.localStorage.setItem(LOCAL_FORK_MODE_STORAGE_KEY, value ? 'true' : 'false')
  } catch {
    // If storage is unavailable, the app will stay on the current mode after reload.
  }
}

export function resolveConnectedTenderlyExecutionChainForRuntime(
  runtime: TTenderlyRuntime,
  chainId: number | undefined
): { canonicalChainId: TCanonicalChainId; executionChainId: number; canonicalChainName: string } | undefined {
  const canonicalChainId = resolveConnectedCanonicalChainIdForRuntime(runtime, chainId)
  if (canonicalChainId === undefined) {
    return undefined
  }

  const executionChainId = resolveExecutionChainIdForRuntime(runtime, canonicalChainId)
  if (
    executionChainId === undefined ||
    executionChainId === canonicalChainId ||
    !Number.isInteger(chainId) ||
    chainId !== executionChainId
  ) {
    return undefined
  }

  return {
    canonicalChainId,
    executionChainId,
    canonicalChainName:
      canonicalChains.find((chain) => chain.id === canonicalChainId)?.name || `chain ${canonicalChainId}`
  }
}

export function resolveConnectedTenderlyExecutionChain(
  chainId: number | undefined
): { canonicalChainId: TCanonicalChainId; executionChainId: number; canonicalChainName: string } | undefined {
  return resolveConnectedTenderlyExecutionChainForRuntime(tenderlyRuntime, chainId)
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
