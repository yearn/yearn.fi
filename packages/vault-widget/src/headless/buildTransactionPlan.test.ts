import { decodeFunctionData, erc20Abi } from 'viem'
import { describe, expect, it } from 'vitest'
import { buildTransactionPlan } from './buildTransactionPlan'
import type { VaultWidgetApprovalToken, VaultWidgetTransactionIntent } from './types'

const token: VaultWidgetApprovalToken = {
  address: '0x1111111111111111111111111111111111111111',
  chainId: 1,
  symbol: 'TEST'
}

const intent: VaultWidgetTransactionIntent = {
  id: 'deposit:test-route:10',
  mode: 'deposit',
  approvals: [
    {
      token,
      spender: '0x2222222222222222222222222222222222222222',
      amount: 10n,
      resetBeforeApproval: true
    }
  ],
  calls: [
    {
      id: 'deposit',
      label: 'Deposit',
      request: {
        chainId: 1,
        to: '0x3333333333333333333333333333333333333333',
        data: '0x1234',
        value: 7n
      }
    }
  ]
}

function expectUniqueStepIds(plan: ReturnType<typeof buildTransactionPlan>): void {
  const stepIds = plan.steps.map(({ id }) => id)
  expect(new Set(stepIds).size).toBe(stepIds.length)
}

describe('buildTransactionPlan', () => {
  it('uses the caller intent ID and plans switch, reset, approval, execution, and refresh', () => {
    const plan = buildTransactionPlan({
      intent,
      allowances: [1n],
      connectedChainId: 10
    })

    expect(plan.id).toBe(intent.id)
    expect(plan.steps.map(({ id, kind }) => [id, kind])).toEqual([
      ['switch-chain-1-0', 'switch-chain'],
      ['reset-approval-0', 'reset-approval'],
      ['approve-0', 'approve'],
      ['deposit', 'execute'],
      ['refresh', 'refresh']
    ])
    expect(plan.steps[3]).toMatchObject({
      kind: 'execute',
      request: intent.calls[0]?.request
    })
  })

  it('skips approvals when allowance is sufficient', () => {
    const plan = buildTransactionPlan({
      intent,
      allowances: [10n],
      connectedChainId: 1
    })

    expect(plan.steps.map(({ kind }) => kind)).toEqual(['execute', 'refresh'])
  })

  it('treats a missing allowance as zero and does not add an unnecessary reset', () => {
    const plan = buildTransactionPlan({ intent, connectedChainId: 1 })

    expect(plan.steps.map(({ kind }) => kind)).toEqual(['approve', 'execute', 'refresh'])
    const approvalStep = plan.steps[0]
    expect(approvalStep?.kind).toBe('approve')
    if (approvalStep?.kind !== 'approve') throw new Error('Expected an approval step')
    expect(decodeFunctionData({ abi: erc20Abi, data: approvalStep.request.data })).toEqual({
      functionName: 'approve',
      args: [intent.approvals?.[0]?.spender, 10n]
    })
  })

  it('preserves call order and creates unique indexed switches when returning to a chain', () => {
    const calls = [
      intent.calls[0]!,
      {
        id: 'bridge-action',
        label: 'Bridge action',
        request: {
          chainId: 10,
          to: '0x4444444444444444444444444444444444444444' as const,
          data: '0x5678' as const
        }
      },
      {
        id: 'finalize',
        label: 'Finalize',
        request: {
          chainId: 1,
          to: '0x5555555555555555555555555555555555555555' as const,
          data: '0x9abc' as const
        }
      }
    ]
    const plan = buildTransactionPlan({
      intent: { ...intent, approvals: [], calls },
      connectedChainId: 1
    })

    expect(plan.steps.map(({ id, kind }) => [id, kind])).toEqual([
      ['deposit', 'execute'],
      ['switch-chain-10-0', 'switch-chain'],
      ['bridge-action', 'execute'],
      ['switch-chain-1-1', 'switch-chain'],
      ['finalize', 'execute'],
      ['refresh', 'refresh']
    ])
    expect(plan.steps[0]).toMatchObject({ kind: 'execute', request: calls[0]?.request })
    expect(plan.steps[2]).toMatchObject({ kind: 'execute', request: calls[1]?.request })
    expect(plan.steps[4]).toMatchObject({ kind: 'execute', request: calls[2]?.request })
    expectUniqueStepIds(plan)
  })

  it('batches same-chain approvals and calls into one Safe proposal', () => {
    const plan = buildTransactionPlan({
      intent,
      allowances: [1n],
      walletType: 'safe'
    })

    expect(plan.steps.map(({ id, kind }) => [id, kind])).toEqual([
      ['safe-proposal-1-0', 'safe-proposal'],
      ['refresh', 'refresh']
    ])
    expect(plan.steps[0]).toMatchObject({
      kind: 'safe-proposal',
      chainId: 1,
      requests: [expect.any(Object), expect.any(Object), intent.calls[0]?.request]
    })
  })

  it('rejects multi-chain Safe plans because a Safe connection is fixed to one chain', () => {
    const calls: VaultWidgetTransactionIntent['calls'] = [
      intent.calls[0]!,
      {
        id: 'chain-ten',
        label: 'Chain ten',
        request: {
          chainId: 10,
          to: '0x4444444444444444444444444444444444444444',
          data: '0x5678'
        }
      },
      {
        id: 'chain-one-again',
        label: 'Chain one again',
        request: {
          chainId: 1,
          to: '0x5555555555555555555555555555555555555555',
          data: '0x9abc'
        }
      }
    ]
    expect(() =>
      buildTransactionPlan({
        intent: { ...intent, approvals: [], calls },
        walletType: 'safe'
      })
    ).toThrow('Safe transaction plans must use a single chain')
  })
})
