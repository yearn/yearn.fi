import { describe, expect, it } from 'vitest'
import type { VaultWidgetToken } from '../types'
import { getTokenReferenceKey, getTokenSelectorChainIds, getTokenSelectorTokens } from './tokenSelector'

const bold: VaultWidgetToken = {
  address: '0x1111111111111111111111111111111111111111',
  chainId: 1,
  decimals: 18,
  name: 'Liquity BOLD',
  symbol: 'BOLD'
}
const usdc: VaultWidgetToken = {
  address: '0x2222222222222222222222222222222222222222',
  chainId: 1,
  decimals: 6,
  name: 'USD Coin',
  symbol: 'USDC'
}
const optimismUsdc: VaultWidgetToken = {
  ...usdc,
  address: '0x3333333333333333333333333333333333333333',
  chainId: 10
}
const tokens = [bold, usdc, optimismUsdc]

describe('token selector', () => {
  it('creates chain-qualified case-insensitive token keys', () => {
    expect(getTokenReferenceKey({ chainId: 1, address: bold.address.toUpperCase() as `0x${string}` })).toBe(
      `1:${bold.address}`
    )
  })

  it('derives available chains in configured token order', () => {
    expect(getTokenSelectorChainIds(tokens)).toEqual([1, 10])
  })

  it('shows only configured default assets in configured order', () => {
    expect(
      getTokenSelectorTokens({
        tokens,
        chainId: 1,
        searchText: '',
        defaultTokens: [usdc]
      })
    ).toEqual([usdc])
  })

  it('searches all route-capable assets, including assets hidden from the default list', () => {
    expect(
      getTokenSelectorTokens({
        tokens,
        chainId: 1,
        searchText: 'liquity',
        defaultTokens: [usdc]
      })
    ).toEqual([bold])
  })
})
