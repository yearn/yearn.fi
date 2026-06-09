import { YVUSD_CHAIN_ID, YVUSD_LOCKED_ADDRESS, YVUSD_UNLOCKED_ADDRESS } from '@pages/vaults/utils/yvUsd'
import { describe, expect, it } from 'vitest'
import { hasYvUsdPortfolioHoldings } from './usePortfolioModel.helpers'

const getVaultKey = (address: string): string => `${YVUSD_CHAIN_ID}_${address}`

describe('hasYvUsdPortfolioHoldings', () => {
  it('detects unlocked yvUSD holdings', () => {
    expect(hasYvUsdPortfolioHoldings(new Set([getVaultKey(YVUSD_UNLOCKED_ADDRESS)]))).toBe(true)
  })

  it('detects locked yvUSD holdings', () => {
    expect(hasYvUsdPortfolioHoldings(new Set([getVaultKey(YVUSD_LOCKED_ADDRESS)]))).toBe(true)
  })

  it('ignores unrelated vault holdings', () => {
    expect(hasYvUsdPortfolioHoldings(new Set([getVaultKey('0x0000000000000000000000000000000000000001')]))).toBe(false)
  })
})
