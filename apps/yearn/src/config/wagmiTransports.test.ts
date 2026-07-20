import { base, mainnet } from 'viem/chains'
import { afterEach, describe, expect, it, vi } from 'vitest'

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

    expect(getTransportRpcUrlsForChain(mainnet)).toEqual([mainnet.rpcUrls.default.http[0]])
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

    expect(getTransportRpcUrlsForChain(base)[0]).toBe('https://rpc.tenderly.base.example')
  })
})
