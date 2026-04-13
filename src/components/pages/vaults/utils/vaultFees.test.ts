import type { TKongVaultInput } from '@pages/vaults/domain/kongVaultSelectors'
import {
  formatFeeStructureLabel,
  getFeeStructureKeyFromFees,
  getVaultFeeStructureKey
} from '@pages/vaults/utils/vaultFees'
import { describe, expect, it } from 'vitest'

describe('vaultFees', () => {
  it('derives a stable fee key from normalized fee values', () => {
    expect(getFeeStructureKeyFromFees({ management: 0, performance: 0.1 })).toBe('0:1000')
  })

  it('rounds fee values to the nearest basis point', () => {
    expect(getFeeStructureKeyFromFees({ management: 0.03375, performance: 0.1 })).toBe('338:1000')
  })

  it('formats the fee label with shared percentage formatting', () => {
    expect(formatFeeStructureLabel({ management: 0.03375, performance: 0.1 })).toBe('Fees: 3.38% | 10%')
  })

  it('derives the fee key from a list-shape vault payload', () => {
    const vault = {
      chainID: 1,
      address: '0x0000000000000000000000000000000000000001',
      name: 'USDC yVault',
      symbol: 'yvUSDC',
      category: 'Stablecoin',
      kind: 'Single Strategy',
      token: {
        address: '0x0000000000000000000000000000000000000002',
        name: 'USD Coin',
        symbol: 'USDC',
        decimals: 6
      },
      fees: {
        managementFee: 0,
        performanceFee: 0.1
      },
      performance: {
        estimated: {
          type: 'estimated',
          apr: 0.05,
          apy: 0.051
        }
      },
      pricePerShare: '1000000'
    } as unknown as TKongVaultInput

    expect(getVaultFeeStructureKey(vault)).toBe('0:1000')
  })
})
