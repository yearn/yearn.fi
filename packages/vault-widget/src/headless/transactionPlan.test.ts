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

  it('preserves ordered execution calls and switches chains between them', () => {
    const plan = buildTransactionPlan({
      allowance: 0n,
      connectedChainId: 10,
      mode: 'withdraw',
      quote: {
        ...quote,
        approval: undefined,
        transactions: [
          {
            id: 'unstake',
            label: 'Unstake',
            transaction: {
              chainId: 10,
              data: '0x1234',
              to: '0x4444444444444444444444444444444444444444'
            }
          },
          {
            id: 'withdraw',
            label: 'Withdraw',
            transaction: quote.transaction
          }
        ]
      }
    })

    expect(plan.steps.map((step) => [step.kind, step.label])).toEqual([
      ['execute', 'Unstake'],
      ['switch-chain', 'Switch to chain 1'],
      ['execute', 'Withdraw'],
      ['refresh', 'Refresh balances']
    ])
  })

  it('batches same-chain approvals and execution into one Safe proposal', () => {
    const plan = buildTransactionPlan({
      allowance: 1n,
      connectedChainId: 10,
      mode: 'deposit',
      quote,
      walletType: 'safe'
    })

    expect(plan.walletType).toBe('safe')
    expect(plan.steps.map((step) => step.kind)).toEqual(['safe-proposal', 'refresh'])
    expect(plan.steps[0]?.requests).toHaveLength(3)
  })

  it('creates one Safe proposal per contiguous execution chain', () => {
    const plan = buildTransactionPlan({
      allowance: 0n,
      mode: 'withdraw',
      quote: {
        ...quote,
        approval: undefined,
        transactions: [
          {
            id: 'unstake',
            label: 'Unstake',
            transaction: {
              chainId: 10,
              data: '0x1234',
              to: '0x4444444444444444444444444444444444444444'
            }
          },
          {
            id: 'withdraw',
            label: 'Withdraw',
            transaction: quote.transaction
          }
        ]
      },
      walletType: 'safe'
    })

    expect(plan.steps.map((step) => [step.kind, step.chainId])).toEqual([
      ['safe-proposal', 10],
      ['safe-proposal', 1],
      ['refresh', undefined]
    ])
  })

  it('tracks destination completion after a cross-chain route executes', () => {
    const plan = buildTransactionPlan({
      allowance: 10n,
      connectedChainId: 1,
      mode: 'deposit',
      quote: {
        ...quote,
        bridge: {
          destinationChainId: 8453,
          protocol: 'stargate',
          sourceChainId: 1
        },
        isCrossChain: true
      }
    })

    expect(plan.steps.map((step) => step.kind)).toEqual(['execute', 'wait-cross-chain', 'refresh'])
    expect(plan.steps[1]?.bridge).toEqual({
      destinationChainId: 8453,
      protocol: 'stargate',
      sourceChainId: 1
    })
  })
})
