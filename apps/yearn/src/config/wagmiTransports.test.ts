import { base, mainnet } from 'viem/chains'
import { afterEach, describe, expect, it, vi } from 'vitest'

describe('getTransportRpcUrlsForChain', () => {
  afterEach(() => {
    vi.resetModules()
    vi.doUnmock('@shared/utils/wagmi')
    vi.doUnmock('@/config/localForkRuntime')
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
  it('uses only the configured local Anvil RPC for the execution chain', async () => {
    const chain = { ...mainnet, id: 694202 }
    const rpcUri = 'http://127.0.0.1:8547/'
    vi.doMock('@/config/localForkRuntime', () => ({
      resolveTenderlyRpcUriForExecutionChainId: (chainId: number) => (chainId === chain.id ? rpcUri : undefined)
    }))
    vi.doMock('@shared/utils/wagmi', () => ({
      getNetwork: () => ({ defaultRPC: 'https://public-rpc.example' }),
      getRpcUriFor: () => '',
      registerConfig: () => undefined
    }))

    const { buildTransports } = await import('@/config/wagmiTransports')
    const transport = buildTransports([chain])[chain.id]({ chain })

    expect(transport.config.type).toBe('http')
    expect(transport.value?.url).toBe(rpcUri)
  })
})
