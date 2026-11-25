import { describe, expect, it, vi } from 'vitest'
import {
  getSupportedCanonicalChainsForRuntime,
  getSupportedChainLookupForRuntime,
  getSupportedExecutionChainsForRuntime,
  isConnectedToExecutionChainForRuntime,
  parseTenderlyRuntime,
  resolveCanonicalChainIdForRuntime,
  resolveConnectedCanonicalChainIdForRuntime,
  resolveConnectedTenderlyExecutionChainForRuntime,
  resolveExecutionChainIdForRuntime,
  resolveInitialTenderlyModeEnabled,
  resolveTenderlyExplorerUriForExecutionChainIdForRuntime,
  resolveTenderlyRpcUriForExecutionChainIdForRuntime
} from '@/config/localForkRuntime'
import { canonicalChains } from './chainDefinitions'

describe('parseTenderlyRuntime', () => {
  it('returns the canonical chain set when local fork mode is disabled', () => {
    const runtime = parseTenderlyRuntime({})
    const canonicalChainIds = canonicalChains.map((chain) => chain.id)

    expect(runtime.isEnabled).toBe(false)
    expect(getSupportedCanonicalChainsForRuntime(runtime).map((chain) => chain.id)).toEqual(canonicalChainIds)
    expect(resolveExecutionChainIdForRuntime(runtime, 1)).toBe(1)
    expect(resolveExecutionChainIdForRuntime(runtime, 1337)).toBe(1337)
    expect(resolveCanonicalChainIdForRuntime(runtime, 1337)).toBe(1)
    expect(resolveConnectedCanonicalChainIdForRuntime(runtime, 1337)).toBe(1)
    expect(resolveConnectedCanonicalChainIdForRuntime(runtime, 1)).toBe(1)
    expect(isConnectedToExecutionChainForRuntime(runtime, 1, 1)).toBe(true)
  })

  it('ignores legacy Tenderly variables', () => {
    const runtime = parseTenderlyRuntime({
      NEXT_PUBLIC_TENDERLY_MODE: 'true',
      NEXT_PUBLIC_TENDERLY_CHAIN_ID_FOR_1: '73571',
      NEXT_PUBLIC_TENDERLY_RPC_URI_FOR_1: 'http://127.0.0.1:8547'
    })

    expect(runtime.isEnabled).toBe(false)
    expect(resolveExecutionChainIdForRuntime(runtime, 1)).toBe(1)
  })

  it.each([
    { environment: 'development', isEnabled: true, executionChainId: 73571 },
    { environment: 'production', isEnabled: false, executionChainId: 1 }
  ] as const)('uses local fork configuration only in development ($environment)', async (scenario) => {
    vi.stubEnv('NODE_ENV', scenario.environment)
    vi.stubEnv('NEXT_PUBLIC_LOCAL_FORK_MODE', 'true')
    vi.stubEnv('NEXT_PUBLIC_LOCAL_FORK_CHAIN_ID_FOR_1', '73571')
    vi.stubEnv('NEXT_PUBLIC_LOCAL_FORK_RPC_URI_FOR_1', 'http://127.0.0.1:8547')
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (key: string) => (key === 'dev-tenderly-mode-enabled' ? 'false' : null)
      }
    })
    vi.resetModules()

    try {
      const { canToggleTenderlyMode, isTenderlyModeConfigured, isTenderlyModeEnabled, resolveExecutionChainId } =
        await import('@/config/localForkRuntime')

      expect(isTenderlyModeConfigured()).toBe(scenario.isEnabled)
      expect(isTenderlyModeEnabled()).toBe(scenario.isEnabled)
      expect(canToggleTenderlyMode()).toBe(scenario.isEnabled)
      expect(resolveExecutionChainId(1)).toBe(scenario.executionChainId)
    } finally {
      vi.unstubAllEnvs()
      vi.unstubAllGlobals()
      vi.resetModules()
    }
  })

  it('requires a loopback RPC for local forks', () => {
    expect(() =>
      parseTenderlyRuntime({
        NEXT_PUBLIC_LOCAL_FORK_MODE: 'true',
        NEXT_PUBLIC_LOCAL_FORK_CHAIN_ID_FOR_1: '73571',
        NEXT_PUBLIC_LOCAL_FORK_RPC_URI_FOR_1: 'https://rpc.example.com'
      })
    ).toThrow('Local fork RPC for chain 1 must use localhost')
  })

  it('requires both chain id and rpc uri when a local fork is configured', () => {
    expect(() =>
      parseTenderlyRuntime({
        NEXT_PUBLIC_LOCAL_FORK_MODE: 'true',
        NEXT_PUBLIC_LOCAL_FORK_CHAIN_ID_FOR_1: '73571'
      })
    ).toThrow(/requires both NEXT_PUBLIC_LOCAL_FORK_CHAIN_ID_FOR_1 and NEXT_PUBLIC_LOCAL_FORK_RPC_URI_FOR_1/)
  })

  it('rejects duplicate local fork execution chain IDs', () => {
    expect(() =>
      parseTenderlyRuntime({
        NEXT_PUBLIC_LOCAL_FORK_MODE: 'true',
        NEXT_PUBLIC_LOCAL_FORK_CHAIN_ID_FOR_1: '73571',
        NEXT_PUBLIC_LOCAL_FORK_RPC_URI_FOR_1: 'http://127.0.0.1:8547/',
        NEXT_PUBLIC_LOCAL_FORK_CHAIN_ID_FOR_10: '73571',
        NEXT_PUBLIC_LOCAL_FORK_RPC_URI_FOR_10: 'http://127.0.0.1:8548/'
      })
    ).toThrow(/Duplicate local fork execution chain ID 73571 configured for canonical chains 1 and 10/)
  })

  it('filters canonical chains and resolves execution chain ids from runtime config', () => {
    const runtime = parseTenderlyRuntime({
      NEXT_PUBLIC_LOCAL_FORK_MODE: 'true',
      NEXT_PUBLIC_LOCAL_FORK_CHAIN_ID_FOR_1: '73571',
      NEXT_PUBLIC_LOCAL_FORK_RPC_URI_FOR_1: 'http://127.0.0.1:8547/',
      NEXT_PUBLIC_LOCAL_FORK_EXPLORER_URI_FOR_1: 'http://127.0.0.1:5100',
      NEXT_PUBLIC_LOCAL_FORK_CHAIN_ID_FOR_10: '73572',
      NEXT_PUBLIC_LOCAL_FORK_RPC_URI_FOR_10: 'http://127.0.0.1:8548/'
    })

    const supportedCanonicalChains = getSupportedCanonicalChainsForRuntime(runtime)
    const supportedExecutionChains = getSupportedExecutionChainsForRuntime(runtime, supportedCanonicalChains)
    const supportedLookupChains = getSupportedChainLookupForRuntime(
      runtime,
      supportedCanonicalChains,
      supportedExecutionChains
    )

    expect(runtime.configuredCanonicalChainIds).toEqual([1, 10])
    expect(supportedCanonicalChains.map((chain) => chain.id)).toEqual([1, 10])
    expect(supportedCanonicalChains[0].rpcUrls.default.http[0]).toBe('http://127.0.0.1:8547/')
    expect(supportedCanonicalChains[0].blockExplorers?.default.url).toBe('http://127.0.0.1:5100')

    expect(supportedExecutionChains.map((chain) => chain.id)).toEqual([73571, 73572])
    expect(supportedExecutionChains[0].name).toBe('Ethereum Local Fork')
    expect(supportedExecutionChains[0].testnet).toBe(true)

    expect(supportedLookupChains.map((chain) => chain.id)).toEqual([1, 10, 73571, 73572])

    expect(resolveExecutionChainIdForRuntime(runtime, 1)).toBe(73571)
    expect(resolveExecutionChainIdForRuntime(runtime, 73571)).toBe(73571)
    expect(resolveExecutionChainIdForRuntime(runtime, 1337)).toBe(1337)
    expect(resolveExecutionChainIdForRuntime(runtime, 8453)).toBeUndefined()

    expect(resolveCanonicalChainIdForRuntime(runtime, 1)).toBe(1)
    expect(resolveCanonicalChainIdForRuntime(runtime, 73571)).toBe(1)
    expect(resolveCanonicalChainIdForRuntime(runtime, 1337)).toBe(1)
    expect(resolveConnectedCanonicalChainIdForRuntime(runtime, 73571)).toBe(1)
    expect(resolveConnectedCanonicalChainIdForRuntime(runtime, 1337)).toBe(1)
    expect(resolveConnectedCanonicalChainIdForRuntime(runtime, 1)).toBe(1)
    expect(resolveTenderlyRpcUriForExecutionChainIdForRuntime(runtime, 73571)).toBe('http://127.0.0.1:8547/')
    expect(resolveTenderlyExplorerUriForExecutionChainIdForRuntime(runtime, 73571)).toBe('http://127.0.0.1:5100')
    expect(resolveTenderlyRpcUriForExecutionChainIdForRuntime(runtime, 1)).toBeUndefined()
    expect(isConnectedToExecutionChainForRuntime(runtime, 1, 1)).toBe(false)
    expect(isConnectedToExecutionChainForRuntime(runtime, 73571, 1)).toBe(true)
    expect(isConnectedToExecutionChainForRuntime(runtime, 1, 73571)).toBe(false)
    expect(isConnectedToExecutionChainForRuntime(runtime, 73571, 73571)).toBe(true)
  })

  it('does not reuse canonical explorers for execution chains without explicit local fork explorer URIs', () => {
    const runtime = parseTenderlyRuntime({
      NEXT_PUBLIC_LOCAL_FORK_MODE: 'true',
      NEXT_PUBLIC_LOCAL_FORK_CHAIN_ID_FOR_1: '73571',
      NEXT_PUBLIC_LOCAL_FORK_RPC_URI_FOR_1: 'http://127.0.0.1:8547/'
    })
    const supportedCanonicalChains = getSupportedCanonicalChainsForRuntime(runtime)
    const supportedExecutionChains = getSupportedExecutionChainsForRuntime(runtime, supportedCanonicalChains)

    expect(supportedCanonicalChains[0].blockExplorers?.default.url).toBeTruthy()
    expect(supportedExecutionChains[0].id).toBe(73571)
    expect(supportedExecutionChains[0].blockExplorers).toBeUndefined()
    expect(resolveTenderlyExplorerUriForExecutionChainIdForRuntime(runtime, 73571)).toBeUndefined()
  })
})

describe('resolveInitialTenderlyModeEnabled', () => {
  it('disables local fork mode when the feature is not configured', () => {
    expect(
      resolveInitialTenderlyModeEnabled({
        isConfigured: false,
        canToggle: true,
        storedPreference: 'true'
      })
    ).toBe(false)
  })

  it('defaults to enabled when local toggling is available and no preference is stored', () => {
    expect(
      resolveInitialTenderlyModeEnabled({
        isConfigured: true,
        canToggle: true,
        storedPreference: null
      })
    ).toBe(true)
  })

  it('respects an explicit disabled local preference', () => {
    expect(
      resolveInitialTenderlyModeEnabled({
        isConfigured: true,
        canToggle: true,
        storedPreference: 'false'
      })
    ).toBe(false)
  })

  it('ignores stored preferences when local toggling is not available', () => {
    expect(
      resolveInitialTenderlyModeEnabled({
        isConfigured: true,
        canToggle: false,
        storedPreference: 'false'
      })
    ).toBe(true)
  })

  it('identifies connected local fork execution chains that should be switched off before disabling', () => {
    const runtime = parseTenderlyRuntime({
      NEXT_PUBLIC_LOCAL_FORK_MODE: 'true',
      NEXT_PUBLIC_LOCAL_FORK_CHAIN_ID_FOR_1: '73571',
      NEXT_PUBLIC_LOCAL_FORK_RPC_URI_FOR_1: 'http://127.0.0.1:8547/'
    })

    expect(resolveConnectedTenderlyExecutionChainForRuntime(runtime, 73571)).toEqual({
      canonicalChainId: 1,
      executionChainId: 73571,
      canonicalChainName: 'Ethereum'
    })
  })

  it('does not flag canonical chains as local fork execution chains', () => {
    const runtime = parseTenderlyRuntime({
      NEXT_PUBLIC_LOCAL_FORK_MODE: 'true',
      NEXT_PUBLIC_LOCAL_FORK_CHAIN_ID_FOR_1: '73571',
      NEXT_PUBLIC_LOCAL_FORK_RPC_URI_FOR_1: 'http://127.0.0.1:8547/'
    })

    expect(resolveConnectedTenderlyExecutionChainForRuntime(runtime, 1)).toBeUndefined()
  })
})
