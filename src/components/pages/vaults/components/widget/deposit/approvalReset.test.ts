import type { Address } from 'viem'
import { describe, expect, it } from 'vitest'
import { shouldBlockDepositApprovalForAllowanceReset } from './approvalReset'

const USDT = '0xdAC17F958D2ee523a2206206994597C13D831ec7' as Address
const DAI = '0x6B175474E89094C44Da98b954EedeAC495271d0F' as Address

describe('shouldBlockDepositApprovalForAllowanceReset', () => {
  it('blocks mainnet USDT approvals when allowance is non-zero but insufficient', () => {
    expect(
      shouldBlockDepositApprovalForAllowanceReset({
        depositToken: USDT,
        currentAllowance: 100n,
        requiredAmount: 200n,
        needsApproval: true
      })
    ).toBe(true)
  })

  it('does not block if the current allowance is zero or already sufficient', () => {
    expect(
      shouldBlockDepositApprovalForAllowanceReset({
        depositToken: USDT,
        currentAllowance: 0n,
        requiredAmount: 200n,
        needsApproval: true
      })
    ).toBe(false)

    expect(
      shouldBlockDepositApprovalForAllowanceReset({
        depositToken: USDT,
        currentAllowance: 200n,
        requiredAmount: 200n,
        needsApproval: false
      })
    ).toBe(false)
  })

  it('does not block standard approval tokens', () => {
    expect(
      shouldBlockDepositApprovalForAllowanceReset({
        depositToken: DAI,
        currentAllowance: 100n,
        requiredAmount: 200n,
        needsApproval: true
      })
    ).toBe(false)
  })
})
