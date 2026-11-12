import type { TTransactionRecord } from '@yearn/vault-widget/lifecycle/model'
import { expiredTransactionIds, TRANSACTION_RETENTION_MS } from '@yearn/vault-widget/lifecycle/retention'
import { describe, expect, it } from 'vitest'

const now = TRANSACTION_RETENTION_MS + 1000
const record = (overrides: Partial<TTransactionRecord> = {}): TTransactionRecord =>
  ({
    id: 'one',
    flowId: 'flow',
    owner: '0x1111111111111111111111111111111111111111',
    createdAt: 1,
    settlement: 'same-chain',
    refresh: 'success',
    source: { receipt: { status: 'success' }, observedAt: 1000 },
    ...overrides
  }) as TTransactionRecord
const bridge = {
  provider: 'enso',
  destinationChainId: 10,
  protocols: ['ccip'],
  coverage: 'incomplete',
  legs: []
} as const

describe('seven-day lifecycle retention', () => {
  it('expires exactly seven days after completion, not submission', () => {
    expect([...expiredTransactionIds([record()], now - 1)]).toEqual([])
    expect([...expiredTransactionIds([record()], now)]).toEqual(['one'])
    expect([...expiredTransactionIds([record({ source: { ...record().source!, observedAt: now } })], now)]).toEqual([])
  })
  it.each([
    { source: undefined },
    { source: { ...record().source!, observedAt: Number.NaN } },
    { source: { ...record().source!, observedAt: Number.POSITIVE_INFINITY } },
    { milestoneRefresh: { source: { status: 'pending' } } },
    { conflict: 'conflicting receipt' },
    { refresh: 'pending' },
    { settlement: bridge },
    { settlement: bridge, destination: { outcome: 'unknown', authority: 'overall', observedAt: 1000 } },
    {
      settlement: bridge,
      destination: { outcome: 'failed', authority: 'overall', observedAt: 1000, funds: 'refund-pending' }
    },
    { sequence: { index: 0, count: 2, label: 'Approve' } }
  ] as Partial<TTransactionRecord>[])('retains unresolved work %j', (change) => {
    expect([...expiredTransactionIds([record(change)], now)]).toEqual([])
  })
  it('retains the whole sequence until its final receipt is seven days old', () => {
    const approval = record({ sequence: { index: 0, count: 2, label: 'Approve' } })
    const final = record({
      id: 'two',
      sequence: { index: 1, count: 2, label: 'Deposit' },
      source: { ...record().source!, observedAt: 1001 }
    })
    expect([...expiredTransactionIds([approval, final], now)]).toEqual([])
    expect([...expiredTransactionIds([approval, final], now + 1)]).toEqual(['one', 'two'])
  })
  it('expires delivered and refunded bridges but retains unresolved recovery', () => {
    const destination = { outcome: 'failed', authority: 'overall', observedAt: 1000, funds: 'refunded' } as const
    expect([...expiredTransactionIds([record({ settlement: bridge, destination })], now)]).toEqual(['one'])
    expect([
      ...expiredTransactionIds(
        [record({ settlement: bridge, destination: { ...destination, outcome: 'delivered', funds: 'delivered' } })],
        now
      )
    ]).toEqual(['one'])
  })
  it('permits cleanup of a sequence stopped by a confirmed failed approval', () => {
    const failed = record({
      sequence: { index: 0, count: 2, label: 'Approve' },
      source: { ...record().source!, receipt: { ...record().source!.receipt, status: 'reverted' } }
    })
    expect([...expiredTransactionIds([failed], now)]).toEqual(['one'])
  })
})
