import { mainnet } from 'viem/chains'
import { afterEach, describe, expect, it, vi } from 'vitest'

describe('getNetwork', () => {
  afterEach(() => {
    vi.resetModules()
    vi.doUnmock('@/config/tenderly')
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
})
