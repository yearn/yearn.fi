import type { Address } from 'viem'
import { describe, expect, it } from 'vitest'
import { requiresAllowanceResetForApproval } from './approve'

const USDT = '0xdAC17F958D2ee523a2206206994597C13D831ec7' as Address
const DAI = '0x6B175474E89094C44Da98b954EedeAC495271d0F' as Address

describe('requiresAllowanceResetForApproval', () => {
  it('requires a reset for nonzero insufficient mainnet USDT allowance', () => {
    expect(requiresAllowanceResetForApproval({ tokenAddress: USDT, currentAllowance: 1n, requiredAmount: 2n })).toBe(
      true
    )
  })

  it('does not require a reset for zero or sufficient allowance', () => {
    expect(requiresAllowanceResetForApproval({ tokenAddress: USDT, currentAllowance: 0n, requiredAmount: 2n })).toBe(
      false
    )
    expect(requiresAllowanceResetForApproval({ tokenAddress: USDT, currentAllowance: 2n, requiredAmount: 2n })).toBe(
      false
    )
  })

  it('does not require a reset for standard approval tokens', () => {
    expect(requiresAllowanceResetForApproval({ tokenAddress: DAI, currentAllowance: 1n, requiredAmount: 2n })).toBe(
      false
    )
  })
})
