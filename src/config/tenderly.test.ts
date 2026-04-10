import { describe, expect, it } from 'vitest'
import { canonicalChains } from './chainDefinitions'
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
} from './tenderly'

describe('parseTenderlyRuntime', () => {
  it('returns the canonical chain set when Tenderly mode is disabled', () => {
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

  it('requires both chain id and rpc uri when a Tenderly chain is configured', () => {
    expect(() =>
      parseTenderlyRuntime({
        VITE_TENDERLY_MODE: 'true',
        VITE_TENDERLY_CHAIN_ID_FOR_1: '73571'
      })
    ).toThrow(/requires both VITE_TENDERLY_CHAIN_ID_FOR_1 and VITE_TENDERLY_RPC_URI_FOR_1/)
  })

  it('rejects duplicate Tenderly execution chain ids', () => {
    expect(() =>
      parseTenderlyRuntime({
        VITE_TENDERLY_MODE: 'true',
        VITE_TENDERLY_CHAIN_ID_FOR_1: '73571',
        VITE_TENDERLY_RPC_URI_FOR_1: 'https://rpc.tenderly.ethereum.example',
        VITE_TENDERLY_CHAIN_ID_FOR_10: '73571',
        VITE_TENDERLY_RPC_URI_FOR_10: 'https://rpc.tenderly.optimism.example'
      })
    ).toThrow(/Duplicate Tenderly execution chain ID 73571 configured for canonical chains 1 and 10/)
  })

  it('filters canonical chains and resolves execution chain ids from runtime config', () => {
    const runtime = parseTenderlyRuntime({
      VITE_TENDERLY_MODE: 'true',
      VITE_TENDERLY_CHAIN_ID_FOR_1: '73571',
      VITE_TENDERLY_RPC_URI_FOR_1: 'https://rpc.tenderly.ethereum.example',
      VITE_TENDERLY_EXPLORER_URI_FOR_1: 'https://explorer.tenderly.ethereum.example',
      VITE_TENDERLY_CHAIN_ID_FOR_10: '73572',
      VITE_TENDERLY_RPC_URI_FOR_10: 'https://rpc.tenderly.optimism.example'
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
    expect(supportedCanonicalChains[0].rpcUrls.default.http[0]).toBe('https://rpc.tenderly.ethereum.example')
    expect(supportedCanonicalChains[0].blockExplorers?.default.url).toBe('https://explorer.tenderly.ethereum.example')

    expect(supportedExecutionChains.map((chain) => chain.id)).toEqual([73571, 73572])
    expect(supportedExecutionChains[0].name).toContain('Tenderly')
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
    expect(resolveTenderlyRpcUriForExecutionChainIdForRuntime(runtime, 73571)).toBe(
      'https://rpc.tenderly.ethereum.example'
    )
    expect(resolveTenderlyExplorerUriForExecutionChainIdForRuntime(runtime, 73571)).toBe(
      'https://explorer.tenderly.ethereum.example'
    )
    expect(resolveTenderlyRpcUriForExecutionChainIdForRuntime(runtime, 1)).toBeUndefined()
    expect(isConnectedToExecutionChainForRuntime(runtime, 1, 1)).toBe(false)
    expect(isConnectedToExecutionChainForRuntime(runtime, 73571, 1)).toBe(true)
    expect(isConnectedToExecutionChainForRuntime(runtime, 1, 73571)).toBe(false)
    expect(isConnectedToExecutionChainForRuntime(runtime, 73571, 73571)).toBe(true)
  })

  it('does not reuse canonical explorers for execution chains without explicit Tenderly explorer URIs', () => {
    const runtime = parseTenderlyRuntime({
      VITE_TENDERLY_MODE: 'true',
      VITE_TENDERLY_CHAIN_ID_FOR_1: '73571',
      VITE_TENDERLY_RPC_URI_FOR_1: 'https://rpc.tenderly.ethereum.example'
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
  it('disables Tenderly when the feature is not configured', () => {
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

  it('identifies connected Tenderly execution chains that should be switched off before disabling', () => {
    const runtime = parseTenderlyRuntime({
      VITE_TENDERLY_MODE: 'true',
      VITE_TENDERLY_CHAIN_ID_FOR_1: '73571',
      VITE_TENDERLY_RPC_URI_FOR_1: 'https://rpc.tenderly.ethereum.example'
    })

    expect(resolveConnectedTenderlyExecutionChainForRuntime(runtime, 73571)).toEqual({
      canonicalChainId: 1,
      executionChainId: 73571,
      canonicalChainName: 'Ethereum'
    })
  })

  it('does not flag canonical chains as Tenderly execution chains', () => {
    const runtime = parseTenderlyRuntime({
      VITE_TENDERLY_MODE: 'true',
      VITE_TENDERLY_CHAIN_ID_FOR_1: '73571',
      VITE_TENDERLY_RPC_URI_FOR_1: 'https://rpc.tenderly.ethereum.example'
    })

    expect(resolveConnectedTenderlyExecutionChainForRuntime(runtime, 1)).toBeUndefined()
  })
})
