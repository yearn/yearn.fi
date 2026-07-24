import { describe, expect, it } from 'vitest'
import type { VaultWidgetQuote, VaultWidgetToken } from '../types'
import { buildTransactionPlan } from './transactionPlan'

const token: VaultWidgetToken = {
  address: '0x1111111111111111111111111111111111111111',
  chainId: 1,
  decimals: 18,
  symbol: 'TEST',
  requiresApprovalReset: true
}

const quote: VaultWidgetQuote = {
  adapterId: 'test',
  amountIn: 10n,
  expectedOut: 9n,
  minExpectedOut: 8n,
  positionAmount: 9n,
  approval: {
    amount: 10n,
    spender: '0x2222222222222222222222222222222222222222',
    token,
    resetBeforeApproval: true
  },
  transaction: {
    chainId: 1,
    data: '0x1234',
    to: '0x3333333333333333333333333333333333333333'
  }
}

describe('buildTransactionPlan', () => {
  it('includes chain switch, reset, approval, execution, and refresh', () => {
    expect(
      buildTransactionPlan({
        allowance: 1n,
        connectedChainId: 10,
        mode: 'deposit',
        quote
      }).steps.map((step) => step.kind)
    ).toEqual(['switch-chain', 'reset-approval', 'approve', 'execute', 'refresh'])
  })

  it('skips approval steps when allowance is sufficient', () => {
    expect(
      buildTransactionPlan({
        allowance: 10n,
        connectedChainId: 1,
        mode: 'deposit',
        quote
      }).steps.map((step) => step.kind)
    ).toEqual(['execute', 'refresh'])
  })
})
