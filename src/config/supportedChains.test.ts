import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Chain } from 'viem'

describe('supportedChains exports', () => {
  afterEach(() => {
    vi.resetModules()
    vi.doUnmock('./tenderly')
  })

  it('keeps app chains canonical while wallet chains can use execution IDs', async () => {
    vi.doMock('./tenderly', () => ({
      supportedCanonicalChains: [{ id: 1, name: 'Ethereum' } satisfies Partial<Chain> as Chain],
      supportedExecutionChains: [{ id: 73571, name: 'Ethereum Tenderly' } satisfies Partial<Chain> as Chain]
    }))

    const module = await import('./supportedChains')

    expect(module.supportedChains.map((chain) => chain.id)).toEqual([1])
    expect(module.supportedAppChains.map((chain) => chain.id)).toEqual([1])
    expect(module.supportedWalletChains.map((chain) => chain.id)).toEqual([73571])
  })
})
