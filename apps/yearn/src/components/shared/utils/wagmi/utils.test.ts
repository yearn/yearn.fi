import { mainnet } from 'viem/chains'
import { afterEach, describe, expect, it, vi } from 'vitest'

describe('getNetwork', () => {
  afterEach(() => {
    vi.resetModules()
    vi.doUnmock('@/config/tenderly')
    vi.doUnmock('@/env')
  })

  it('leaves the default block explorer empty for Tenderly execution chains without explicit explorer URIs', async () => {
    vi.doMock('@/config/tenderly', () => ({
      resolveExecutionChainId: (chainId?: number) => chainId,
      resolveTenderlyExplorerUriForExecutionChainId: () => undefined,
      resolveTenderlyRpcUriForExecutionChainId: (chainId?: number) =>
        chainId === 73571 ? 'https://rpc.tenderly.ethereum.example' : undefined,
      supportedChainLookup: [{ ...mainnet, id: 73571, name: 'Ethereum Tenderly', blockExplorers: undefined }]
    }))

    const { getNetwork } = await import('./utils')

    expect(getNetwork(73571).defaultBlockExplorer).toBe('')
  })
  it('keeps Tenderly ahead of shared RPC overrides and uses the map for new canonical chains', async () => {
    vi.doMock('@/env', () => ({
      env: {
        NEXT_PUBLIC_CHAIN_RPC_URLS:
          '{"4663":"https://robinhood.override.example","1":"https://ethereum.override.example"}',
        NEXT_PUBLIC_RPC_URI_FOR_4663: 'https://legacy.example'
      }
    }))
    vi.doMock('@/config/tenderly', () => ({
      resolveTenderlyExplorerUriForExecutionChainId: () => undefined,
      resolveTenderlyRpcUriForExecutionChainId: (id: number) => (id === 1 ? 'https://fork.example' : undefined),
      supportedChainLookup: []
    }))
    const { getRpcUriFor } = await import('./utils')
    expect(getRpcUriFor(4663)).toBe('https://robinhood.override.example')
    expect(getRpcUriFor(1)).toBe('https://fork.example')
  })
})
