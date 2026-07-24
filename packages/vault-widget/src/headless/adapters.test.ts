import { describe, expect, it } from 'vitest'
import type { VaultWidgetToken } from '../types'
import { createEnsoAdapter, createErc4626Adapter, createYBoldAdapter } from './adapters'

const asset: VaultWidgetToken = {
  address: '0x1111111111111111111111111111111111111111',
  chainId: 1,
  decimals: 18,
  symbol: 'ASSET'
}
const positionToken: VaultWidgetToken = {
  address: '0x2222222222222222222222222222222222222222',
  chainId: 1,
  decimals: 18,
  symbol: 'POSITION'
}
const routeToken: VaultWidgetToken = {
  address: '0x3333333333333333333333333333333333333333',
  chainId: 1,
  decimals: 6,
  symbol: 'ROUTE'
}
const vault = '0x4444444444444444444444444444444444444444'
const zapper = '0x5555555555555555555555555555555555555555'
const router = '0x6666666666666666666666666666666666666666'

describe('adapter approval targets', () => {
  it('resolves ERC-4626 deposit approval without a quote', () => {
    const adapter = createErc4626Adapter({ asset, vaultAddress: vault })
    expect(adapter.getApprovalTarget?.({ chainId: 1, mode: 'deposit', selectedToken: asset })).toEqual({
      spender: vault,
      token: asset
    })
    expect(adapter.getApprovalTarget?.({ chainId: 1, mode: 'withdraw', selectedToken: asset })).toBeUndefined()
  })

  it('resolves yBOLD withdrawal approval without a quote', () => {
    const adapter = createYBoldAdapter({
      asset,
      positionToken,
      stakingAbi: [],
      zapperAbi: [],
      zapperAddress: zapper
    })
    expect(adapter.getApprovalTarget?.({ chainId: 1, mode: 'withdraw', selectedToken: asset })).toEqual({
      spender: zapper,
      token: positionToken
    })
  })

  it('resolves Enso route-token approval without a quote', () => {
    const adapter = createEnsoAdapter({
      asset,
      destinationChainId: 1,
      positionToken,
      provider: {
        getRoute: async () => {
          throw new Error('not called')
        }
      },
      routerByChain: { 1: router }
    })
    expect(adapter.getApprovalTarget?.({ chainId: 1, mode: 'deposit', selectedToken: routeToken })).toEqual({
      spender: router,
      token: routeToken
    })
  })
})
