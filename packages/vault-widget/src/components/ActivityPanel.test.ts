import { describe, expect, it } from 'vitest'
import type { VaultWidgetActivity, VaultWidgetConfig } from '../types'
import { getNextWalletTabIndex, getVaultWidgetActivityAmountLabel } from './ActivityPanel'

describe('ActivityPanel helpers', () => {
  it('supports wrapping arrow-key and boundary tab navigation', () => {
    expect(getNextWalletTabIndex('ArrowRight', 1, 2)).toBe(0)
    expect(getNextWalletTabIndex('ArrowLeft', 0, 2)).toBe(1)
    expect(getNextWalletTabIndex('Home', 1, 2)).toBe(0)
    expect(getNextWalletTabIndex('End', 0, 2)).toBe(1)
    expect(getNextWalletTabIndex('Enter', 0, 2)).toBeUndefined()
  })

  it('labels persisted activity with its configured token', () => {
    const token = {
      address: '0x1111111111111111111111111111111111111111',
      chainId: 1,
      decimals: 6,
      symbol: 'USDC'
    } as const
    const config = {
      depositTokens: [token],
      infoPositionSources: [],
      positionSources: [],
      positionToken: token,
      rewards: { tokens: [] },
      withdrawTokens: []
    } as unknown as VaultWidgetConfig
    const activity = {
      amount: '12.5',
      tokenIn: token.address
    } as unknown as VaultWidgetActivity

    expect(getVaultWidgetActivityAmountLabel(activity, config)).toBe('12.5 USDC')
  })
})
