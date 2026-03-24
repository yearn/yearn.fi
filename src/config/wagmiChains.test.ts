import { describe, expect, it } from 'vitest'
import type { Chain } from 'viem'
import { mainnet } from 'viem/chains'
import { getWagmiConfigChains } from './wagmiChains'

describe('getWagmiConfigChains', () => {
  it('adds canonical mainnet when the configured chains omit it', () => {
    const tenderlyMainnet = { ...mainnet, id: 73571, name: 'Tenderly Mainnet' } as Chain

    expect(getWagmiConfigChains([tenderlyMainnet]).map((chain) => chain.id)).toEqual([73571, 1])
  })

  it('does not duplicate canonical mainnet when it is already configured', () => {
    const tenderlyMainnet = { ...mainnet, id: 73571, name: 'Tenderly Mainnet' } as Chain

    expect(getWagmiConfigChains([mainnet, tenderlyMainnet]).map((chain) => chain.id)).toEqual([1, 73571])
  })
})
