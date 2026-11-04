import type { Chain } from 'viem'
import { base, mainnet, robinhood } from 'viem/chains'
import { describe, expect, it } from 'vitest'
import { getWagmiConfigChains } from './wagmiChains'

describe('getWagmiConfigChains', () => {
  it('keeps the real canonical mainnet when ethereum is part of the supported canonical set', () => {
    const tenderlyMainnet = { ...mainnet, id: 73571, name: 'Tenderly Mainnet' } as Chain
    const canonicalMainnet = {
      ...mainnet,
      rpcUrls: { ...mainnet.rpcUrls, default: { http: ['https://rpc.tenderly.ethereum.example'] } }
    } as Chain

    expect(getWagmiConfigChains([tenderlyMainnet], [canonicalMainnet]).map((chain) => chain.id)).toEqual([73571, 1])
    expect(getWagmiConfigChains([tenderlyMainnet], [canonicalMainnet])[1].rpcUrls.default.http[0]).toBe(
      mainnet.rpcUrls.default.http[0]
    )
  })

  it('does not duplicate canonical mainnet when it is already configured', () => {
    const tenderlyMainnet = { ...mainnet, id: 73571, name: 'Tenderly Mainnet' } as Chain

    expect(getWagmiConfigChains([mainnet, tenderlyMainnet]).map((chain) => chain.id)).toEqual([1, 73571])
  })

  it('keeps canonical non-mainnet chains alongside Tenderly execution chains', () => {
    const tenderlyBase = { ...base, id: 84531, name: 'Base Tenderly' } as Chain

    expect(getWagmiConfigChains([tenderlyBase], [base]).map((chain) => chain.id)).toEqual([84531, 8453])
  })

  it('keeps Robinhood available alongside its Tenderly execution chain', () => {
    const tenderlyRobinhood = { ...robinhood, id: 14663, name: 'Robinhood Tenderly' } as Chain
    expect(getWagmiConfigChains([tenderlyRobinhood], [robinhood]).map((chain) => chain.id)).toEqual([14663, 4663])
  })

  it('drops Tenderly-overridden canonical mainnet in favor of the real mainnet entry', () => {
    const tenderlyMainnet = {
      ...mainnet,
      rpcUrls: { ...mainnet.rpcUrls, default: { http: ['https://rpc.tenderly.example'] } }
    } as Chain

    expect(getWagmiConfigChains([], [tenderlyMainnet]).map((chain) => chain.id)).toEqual([1])
    expect(getWagmiConfigChains([], [tenderlyMainnet])[0].rpcUrls.default.http[0]).toBe(mainnet.rpcUrls.default.http[0])
  })

  it('does not advertise canonical mainnet when ethereum is not part of the supported canonical set', () => {
    const tenderlyBase = { ...base, id: 84531, name: 'Base Tenderly' } as Chain

    expect(getWagmiConfigChains([tenderlyBase], [base]).some((chain) => chain.id === mainnet.id)).toBe(false)
  })
})
