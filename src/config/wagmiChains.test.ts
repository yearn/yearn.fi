import { describe, expect, it } from 'vitest'
import type { Chain } from 'viem'
import { base, mainnet } from 'viem/chains'
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

  it('keeps canonical non-mainnet chains alongside Tenderly execution chains', () => {
    const tenderlyBase = { ...base, id: 84531, name: 'Base Tenderly' } as Chain

    expect(getWagmiConfigChains([tenderlyBase], [base]).map((chain) => chain.id)).toEqual([84531, 8453, 1])
  })

  it('drops Tenderly-overridden canonical mainnet in favor of the real mainnet entry', () => {
    const tenderlyMainnet = {
      ...mainnet,
      rpcUrls: { ...mainnet.rpcUrls, default: { http: ['https://rpc.tenderly.example'] } }
    } as Chain

    expect(getWagmiConfigChains([], [tenderlyMainnet]).map((chain) => chain.id)).toEqual([1])
    expect(getWagmiConfigChains([], [tenderlyMainnet])[0].rpcUrls.default.http[0]).toBe(mainnet.rpcUrls.default.http[0])
  })
})
