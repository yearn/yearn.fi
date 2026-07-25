import { describe, expect, it, vi } from 'vitest'
import {
  createBudgetedTenderlyFetch,
  createTenderlyRpcBudget,
  extractJsonRpcMethods,
  parseTenderlyQaSelection,
  revertTenderlySnapshot,
  shouldRunTenderlyQaFlow
} from './tenderly-qa-control'

describe('Tenderly QA selection', () => {
  it('lists flows without requiring a budget', () => {
    const selection = parseTenderlyQaSelection(['--list'])

    expect(selection.list).toBe(true)
    expect(selection.flowIds).toContain('yvusd-direct')
  })

  it('requires an explicit suite or flow before execution', () => {
    expect(() => parseTenderlyQaSelection([])).toThrow('Select Tenderly QA work')
    expect(() => parseTenderlyQaSelection(['--max-rpc-methods', '30'])).toThrow('Select Tenderly QA work')
  })

  it('requires a budget for selected work', () => {
    expect(() => parseTenderlyQaSelection(['--flow', 'yvusd-direct'])).toThrow('--max-rpc-methods')
  })

  it('supports repeated, deduplicated flow selections', () => {
    const selection = parseTenderlyQaSelection([
      '--flow',
      'yvusd-direct',
      '--flow',
      'yvusd-direct',
      '--max-rpc-methods',
      '30'
    ])

    expect(selection.list).toBe(false)
    if (selection.list) return
    expect(selection.flowIds).toEqual(['yvusd-direct'])
    expect(shouldRunTenderlyQaFlow(selection, 'yvusd-direct')).toBe(true)
    expect(shouldRunTenderlyQaFlow(selection, 'yvbtc')).toBe(false)
  })

  it('keeps suite and flow selection mutually exclusive', () => {
    expect(() =>
      parseTenderlyQaSelection(['--suite', 'smoke', '--flow', 'yvusd-direct', '--max-rpc-methods', '30'])
    ).toThrow('either --suite or --flow')
  })
})

describe('Tenderly RPC budget', () => {
  it('fails cleanup when Tenderly rejects a snapshot revert', async () => {
    const rpcRequest = vi.fn(async () => false)

    await expect(
      revertTenderlySnapshot({
        chain: 'optimism',
        rpcRequest,
        snapshotId: '0x1'
      })
    ).rejects.toThrow('Unable to revert the optimism Tenderly QA snapshot')
    expect(rpcRequest).toHaveBeenCalledWith('evm_revert', ['0x1'])
  })

  it('extracts single and batched JSON-RPC methods', () => {
    expect(extractJsonRpcMethods(JSON.stringify({ method: 'eth_chainId' }))).toEqual(['eth_chainId'])
    expect(
      extractJsonRpcMethods(JSON.stringify([{ method: 'eth_call' }, { method: 'eth_getTransactionReceipt' }]))
    ).toEqual(['eth_call', 'eth_getTransactionReceipt'])
  })

  it('blocks unknown methods before invoking fetch', async () => {
    const fetchFn = vi.fn<typeof fetch>()
    const budget = createTenderlyRpcBudget({
      allowedMethods: new Set(['eth_chainId']),
      maxRpcMethods: 4
    })
    const budgetedFetch = createBudgetedTenderlyFetch({ budget, chain: 'ethereum', fetchFn })

    await expect(
      budgetedFetch('https://rpc.invalid', {
        body: JSON.stringify({ method: 'eth_unknown' }),
        method: 'POST'
      })
    ).rejects.toThrow('blocked before network I/O')
    expect(fetchFn).not.toHaveBeenCalled()
  })

  it('reserves cleanup capacity and blocks overflow before fetch', async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(new Response('{}'))
    const budget = createTenderlyRpcBudget({
      allowedMethods: new Set(['eth_call', 'evm_revert', 'evm_snapshot']),
      maxRpcMethods: 2
    })
    const budgetedFetch = createBudgetedTenderlyFetch({ budget, chain: 'ethereum', fetchFn })

    budget.reserveCleanup('ethereum')
    await budgetedFetch('https://rpc.invalid', {
      body: JSON.stringify({ method: 'evm_snapshot' }),
      method: 'POST'
    })
    await expect(
      budgetedFetch('https://rpc.invalid', {
        body: JSON.stringify({ method: 'eth_call' }),
        method: 'POST'
      })
    ).rejects.toThrow('budget exhausted before network I/O')
    await budgetedFetch('https://rpc.invalid', {
      body: JSON.stringify({ method: 'evm_revert' }),
      method: 'POST'
    })

    expect(fetchFn).toHaveBeenCalledTimes(2)
    expect(budget.summary()).toMatchObject({
      totalRpcMethods: 2,
      outstandingCleanupReservations: 0
    })
    expect(() => budget.assertAllCleanupsConsumed()).not.toThrow()
  })

  it('accounts for batched calls against the method budget', async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(new Response('{}'))
    const budget = createTenderlyRpcBudget({
      allowedMethods: new Set(['eth_call']),
      maxRpcMethods: 2
    })
    const budgetedFetch = createBudgetedTenderlyFetch({ budget, chain: 'ethereum', fetchFn })

    await budgetedFetch('https://rpc.invalid', {
      body: JSON.stringify([{ method: 'eth_call' }, { method: 'eth_call' }]),
      method: 'POST'
    })
    await expect(
      budgetedFetch('https://rpc.invalid', {
        body: JSON.stringify({ method: 'eth_call' }),
        method: 'POST'
      })
    ).rejects.toThrow('budget exhausted before network I/O')

    expect(budget.summary().totalRpcMethods).toBe(2)
  })

  it('counts repeated polling or retry attempts and blocks them at the same hard limit', async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(new Response('{}'))
    const budget = createTenderlyRpcBudget({
      allowedMethods: new Set(['eth_getTransactionReceipt']),
      maxRpcMethods: 1
    })
    const budgetedFetch = createBudgetedTenderlyFetch({ budget, chain: 'ethereum', fetchFn })
    const receiptRequest = {
      body: JSON.stringify({ method: 'eth_getTransactionReceipt' }),
      method: 'POST'
    }

    await budgetedFetch('https://rpc.invalid', receiptRequest)
    await expect(budgetedFetch('https://rpc.invalid', receiptRequest)).rejects.toThrow(
      'budget exhausted before network I/O'
    )

    expect(fetchFn).toHaveBeenCalledTimes(1)
  })

  it('fails when cleanup reservations remain', () => {
    const budget = createTenderlyRpcBudget({ maxRpcMethods: 3 })
    budget.reserveCleanup('ethereum')

    expect(() => budget.assertAllCleanupsConsumed()).toThrow('unconsumed snapshot cleanup')
  })
})
