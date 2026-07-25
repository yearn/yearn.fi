import { base, mainnet } from 'viem/chains'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { TTenderlyRuntime } from './tenderly'

const disabledTenderlyRuntime = {
  canonicalToExecutionChainId: new Map(),
  configuredByCanonicalId: {},
  configuredCanonicalChainIds: [],
  executionToCanonicalChainId: new Map(),
  isEnabled: false
} satisfies TTenderlyRuntime

describe('getTransportRpcUrlsForChain', () => {
  afterEach(() => {
    vi.resetModules()
    vi.doUnmock('@shared/utils/wagmi')
  })

  it('preserves the real mainnet transport for the canonical wagmi mainnet chain', async () => {
    vi.doMock('@shared/utils/wagmi', () => ({
      getNetwork: (chainId: number) => ({
        defaultRPC: chainId === 1 ? 'https://rpc.tenderly.ethereum.example' : ''
      }),
      getRpcUriFor: () => '',
      registerConfig: () => undefined
    }))

    const { getTransportRpcUrlsForChain } = await import('./wagmiTransports')

    expect(getTransportRpcUrlsForChain(mainnet, disabledTenderlyRuntime)).toEqual([mainnet.rpcUrls.default.http[0]])
  })

  it('keeps the indexed Tenderly transport for non-mainnet chains', async () => {
    vi.doMock('@shared/utils/wagmi', () => ({
      getNetwork: (chainId: number) => ({
        defaultRPC: chainId === base.id ? 'https://rpc.tenderly.base.example' : ''
      }),
      getRpcUriFor: () => '',
      registerConfig: () => undefined
    }))

    const { getTransportRpcUrlsForChain } = await import('./wagmiTransports')

    expect(getTransportRpcUrlsForChain(base, disabledTenderlyRuntime)[0]).toBe('https://rpc.tenderly.base.example')
  })

  it('prioritizes the configured VNet while Tenderly mode is enabled', async () => {
    vi.doMock('@shared/utils/wagmi', () => ({
      getNetwork: () => ({ defaultRPC: 'https://public-mainnet.example' }),
      getRpcUriFor: () => '',
      registerConfig: () => undefined
    }))

    const { getTransportRpcUrlsForChain } = await import('./wagmiTransports')
    const runtime = {
      canonicalToExecutionChainId: new Map([[1, 123_456]]),
      configuredByCanonicalId: {
        1: {
          canonicalChainId: 1,
          executionChainId: 123_456,
          rpcUri: 'https://rpc.tenderly.example'
        }
      },
      configuredCanonicalChainIds: [1],
      executionToCanonicalChainId: new Map([[123_456, 1]]),
      isEnabled: true
    } satisfies TTenderlyRuntime

    expect(getTransportRpcUrlsForChain(mainnet, runtime)[0]).toBe('https://rpc.tenderly.example')
  })
})
