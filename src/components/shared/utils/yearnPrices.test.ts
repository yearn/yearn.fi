import { describe, expect, it } from 'vitest'
import { ARB_WETH_TOKEN_ADDRESS, ETH_TOKEN_ADDRESS, WETH_TOKEN_ADDRESS, ZERO_ADDRESS } from './constants'
import { toAddress } from './tools.address'
import { buildYearnPricesSpotKeys, normalizeYearnPricesSpotResponse } from './yearnPrices'

describe('yearnPrices spot helpers', () => {
  it('builds normalized spot keys and maps native tokens to wrapped assets', () => {
    const usdc = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'
    const mixedCaseUsdc = `0x${usdc.slice(2).toUpperCase()}`

    expect(
      buildYearnPricesSpotKeys([
        { address: usdc, chainID: 1 },
        { address: mixedCaseUsdc, chainID: 1 },
        { address: ETH_TOKEN_ADDRESS, chainID: 1 },
        { address: ETH_TOKEN_ADDRESS, chainID: 42161 },
        { address: ZERO_ADDRESS, chainID: 1 },
        { address: usdc, chainID: 999999 }
      ])
    ).toEqual([
      `arbitrum:${ARB_WETH_TOKEN_ADDRESS.toLowerCase()}`,
      `ethereum:${usdc}`,
      `ethereum:${WETH_TOKEN_ADDRESS.toLowerCase()}`
    ])
  })

  it('normalizes positive spot response prices into chain/address maps', () => {
    const usdc = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'
    const normalized = normalizeYearnPricesSpotResponse({
      coins: {
        [`ethereum:${usdc}`]: {
          prices: [{ timestamp: 1719878399, price: 1.01, confidence: 0.99, source: 'enso' }]
        },
        'ethereum:0x0000000000000000000000000000000000000001': {
          prices: [{ timestamp: 1719878399, price: 0, confidence: 0.99 }]
        }
      }
    })

    expect(normalized).toEqual({
      1: {
        [toAddress(usdc)]: 1.01
      }
    })
  })
})
