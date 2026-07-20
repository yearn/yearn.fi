import type { TKongVaultInput } from '@pages/vaults/domain/kongVaultSelectors'
import { YVUSD_CHAIN_ID, YVUSD_LOCKED_ADDRESS, YVUSD_UNLOCKED_ADDRESS } from '@pages/vaults/utils/yvUsd'
import { describe, expect, it } from 'vitest'
import { hasYvUsdPortfolioHoldings, resolveYvUsdFollowOnSuggestionVault } from './usePortfolioModel.helpers'

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

describe('resolveYvUsdFollowOnSuggestionVault', () => {
  const lockedVault = { chainId: YVUSD_CHAIN_ID, address: YVUSD_LOCKED_ADDRESS } as unknown as TKongVaultInput
  const unlockedVault = { chainId: YVUSD_CHAIN_ID, address: YVUSD_UNLOCKED_ADDRESS } as unknown as TKongVaultInput
  const daiVault = {
    chainId: YVUSD_CHAIN_ID,
    address: '0x0000000000000000000000000000000000000001'
  } as unknown as TKongVaultInput

  it('uses unlocked yvUSD when locked yvUSD is already pinned', () => {
    expect(
      resolveYvUsdFollowOnSuggestionVault({
        pinnedVault: lockedVault,
        candidateVault: lockedVault,
        unlockedVault
      })
    ).toBe(unlockedVault)
  })

  it('keeps non-yvUSD suggestions unchanged', () => {
    expect(
      resolveYvUsdFollowOnSuggestionVault({
        pinnedVault: lockedVault,
        candidateVault: daiVault,
        unlockedVault
      })
    ).toBe(daiVault)
  })
})
