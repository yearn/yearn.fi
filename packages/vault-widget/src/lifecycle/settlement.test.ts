import { buildTransactionPlan } from '@yearn/vault-widget/headless'
import {
  createTransactionLifecycle,
  reduceTransaction,
  selectTransaction,
  settlementOutcome,
  type TSettlementEvidence,
  type TSettlementRequirement,
  type TTransactionRecord
} from '@yearn/vault-widget/lifecycle'
import type { TransactionReceipt } from 'viem'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const owner = '0x1111111111111111111111111111111111111111' as const
const hash = `0x${'a'.repeat(64)}` as const
const receipt = { transactionHash: hash, status: 'success', blockHash: hash, blockNumber: 10n } as TransactionReceipt
const requirement: TSettlementRequirement = {
  provider: 'enso',
  destinationChainId: 10,
  protocols: ['future-bridge'],
  coverage: 'incomplete',
  legs: []
}
const record = (): TTransactionRecord => ({
  version: 1,
  id: 'one',
  flowId: 'flow',
  attemptId: 'attempt',
  stepId: 'deposit',
  intentKey: 'deposit:10',
  owner,
  createdAt: 1,
  revision: 0,
  request: { chainId: 1, to: owner, data: '0x1234', value: '10' },
  original: { canonicalChainId: 1, executionChainId: 1, hash },
  effective: { canonicalChainId: 1, executionChainId: 1, hash },
  settlement: requirement,
  confirmations: 2,
  refresh: 'idle'
})
const source = () => reduceTransaction(record(), { kind: 'receipt', result: { receipt }, observedAt: 2 })
const evidence = (outcome: TSettlementEvidence['outcome'], observedAt = 3): TSettlementEvidence => ({
  outcome,
  authority: 'overall',
  observedAt
})
const apply = (record: TTransactionRecord, value: TSettlementEvidence) =>
  reduceTransaction(record, { kind: 'settlement', evidence: value })

describe('destination evidence', () => {
  it('cannot complete before source confirmation, and source confirmation cannot complete a bridge', () => {
    expect(() => apply(record(), evidence('delivered'))).toThrow('source confirmation')
    expect(selectTransaction(source())).toMatchObject({ outcome: 'pending', label: 'Settling destination' })
  })
  it('requires no destination hash for authoritative overall delivery, and retains a complete source link', () => {
    expect(selectTransaction(apply(source(), evidence('delivered')))).toMatchObject({
      outcome: 'success',
      reference: record().original
    })
  })
  it('does not treat empty or incomplete partial coverage as delivery', () => {
    expect(
      settlementOutcome(
        { ...requirement, coverage: 'complete' },
        { ...evidence('delivered'), authority: 'partial', legs: [] }
      )
    ).toBe('unknown')
    expect(
      settlementOutcome(
        { ...requirement, coverage: 'complete', legs: [{ id: 'a', protocol: 'future-bridge' }] },
        { ...evidence('delivered'), authority: 'partial', legs: [{ id: 'a', outcome: 'delivered' }] }
      )
    ).toBe('unknown')
  })
  it('requires every known leg and its callback before accepting partial delivery', () => {
    const required = {
      ...requirement,
      coverage: 'complete' as const,
      legs: [
        { id: 'a', protocol: 'one' },
        { id: 'b', protocol: 'two' }
      ]
    }
    const first = apply(
      { ...source(), settlement: required },
      { ...evidence('pending'), authority: 'partial', legs: [{ id: 'a', outcome: 'delivered', callback: 'success' }] }
    )
    expect(selectTransaction(first).outcome).toBe('unknown')
    const next = apply(first, {
      ...evidence('pending', 4),
      authority: 'partial',
      legs: [{ id: 'b', outcome: 'delivered', callback: 'success' }]
    })
    expect(selectTransaction(next).outcome).toBe('success')
  })
  it('keeps delivered evidence through stale pending observations and reports conflicting terminal evidence', () => {
    const delivered = apply(source(), evidence('delivered', 10))
    expect(selectTransaction(apply(delivered, evidence('pending', 2))).outcome).toBe('success')
    expect(selectTransaction(apply(delivered, evidence('pending', 11))).outcome).toBe('success')
    expect(selectTransaction(apply(delivered, evidence('failed', 12))).outcome).toBe('unknown')
  })
  it('rejects mismatched destination networks and incomplete explorer references', () => {
    expect(() =>
      apply(source(), {
        ...evidence('delivered'),
        destination: { canonicalChainId: 8453, executionChainId: 8453, hash }
      })
    ).toThrow('network')
    expect(() =>
      apply(source(), { ...evidence('delivered'), destination: { canonicalChainId: 10, executionChainId: 10 } })
    ).toThrow('reference')
  })
  it('does not relabel a refunded action as success', () => {
    const refunded = apply(source(), { ...evidence('failed'), funds: 'refunded', refund: record().original })
    expect(selectTransaction(refunded)).toMatchObject({
      outcome: 'error',
      label: 'Cross-chain action failed; funds refunded',
      refund: record().original
    })
  })
  it('keeps manual action unresolved and source failure terminal', () => {
    expect(selectTransaction(apply(source(), evidence('manual'))).outcome).toBe('unknown')
    const failed = reduceTransaction(record(), {
      kind: 'receipt',
      result: { receipt: { ...receipt, status: 'reverted' } },
      observedAt: 2
    })
    expect(() => apply(failed, evidence('delivered'))).toThrow()
    expect(selectTransaction(failed).outcome).toBe('error')
  })
})

const stops: (() => void)[] = []
beforeEach(() => vi.useFakeTimers())
afterEach(() => {
  stops.splice(0).forEach((stop) => {
    stop()
  })
  vi.clearAllTimers()
  vi.useRealTimers()
  vi.restoreAllMocks()
})
function host(saved: TTransactionRecord[] = [], beforeStart?: () => Promise<void>) {
  const receipts = { resolve: (_: { receipt: TransactionReceipt }) => {} }
  const execute = vi.fn().mockResolvedValue(hash)
  const observeSettlement = vi.fn().mockResolvedValue(evidence('pending'))
  const refresh = vi.fn().mockResolvedValue(undefined)
  const storage = new Map(saved.map((record) => [record.id, record]))
  const service = createTransactionLifecycle({
    execution: () => ({
      execute,
      switchChain: vi.fn(),
      waitForReceipt: () =>
        new Promise((resolve) => {
          receipts.resolve = resolve
        })
    }),
    wallet: () => ({ address: owner, chainId: 1 }),
    executionChainId: (chain) => chain,
    refresh,
    observeSettlement,
    settlementIntervalMs: 10,
    beforeStart,
    persistence: {
      load: async () => [...storage.values()],
      apply: async (record, observation) => {
        const next = observation ? reduceTransaction(storage.get(record.id) ?? record, observation) : record
        storage.set(record.id, next)
        return next
      }
    }
  })
  stops.push(service.connect())
  const start = () =>
    service.start({
      commandId: crypto.randomUUID(),
      owner,
      settlement: requirement,
      plan: buildTransactionPlan({
        connectedChainId: 1,
        intent: {
          id: 'deposit:10',
          mode: 'deposit',
          calls: [{ id: 'deposit', label: 'Deposit', request: { chainId: 1, to: owner, data: '0x1234', value: 10n } }]
        }
      })
    })
  return { service, receipts, execute, observeSettlement, refresh, storage, start }
}
describe('provider-owned settlement', () => {
  it('waits for the admitted receipt, survives closing, and refreshes source and destination independently', async () => {
    const f = host()
    const id = f.start()
    await vi.advanceTimersByTimeAsync(20)
    expect(f.observeSettlement).not.toHaveBeenCalled()
    f.service.pause(id)
    f.receipts.resolve({ receipt })
    await vi.advanceTimersByTimeAsync(20)
    expect(f.refresh).toHaveBeenCalledWith(expect.objectContaining({ source: expect.anything() }), 'source')
    expect(selectTransaction(f.service.getSnapshot().records[0]).outcome).toBe('pending')
    f.observeSettlement.mockResolvedValue(evidence('delivered', Date.now()))
    await vi.advanceTimersByTimeAsync(20)
    expect(selectTransaction(f.service.getSnapshot().records[0]).outcome).toBe('success')
    expect(f.execute).toHaveBeenCalledTimes(1)
    expect(f.refresh).toHaveBeenCalledTimes(2)
  })
  it('adopts a saved unsettled bridge without submitting, even after source success', async () => {
    const f = host([source()])
    await vi.advanceTimersByTimeAsync(0)
    f.start()
    await vi.advanceTimersByTimeAsync(20)
    expect(f.execute).not.toHaveBeenCalled()
    expect(f.observeSettlement).toHaveBeenCalled()
  })
  it('polls never-checked and then least-recently checked records fairly, including failures', async () => {
    const f = host([source(), { ...source(), id: 'two', flowId: 'two', intentKey: 'two' }])
    f.observeSettlement.mockRejectedValue(new Error('Temporary upstream outage'))
    await vi.advanceTimersByTimeAsync(35)
    expect(f.observeSettlement.mock.calls.slice(0, 4).map(([record]) => record.id)).toEqual([
      'one',
      'two',
      'one',
      'two'
    ])
    expect(f.service.getSnapshot().records.every((record) => selectTransaction(record).outcome === 'unknown')).toBe(
      true
    )
  })
  it('keeps recovery observation after failure and refreshes an observed refund without success', async () => {
    const failed = apply(source(), { ...evidence('failed'), funds: 'refund-pending' })
    const f = host([failed])
    f.observeSettlement.mockResolvedValue({
      ...evidence('failed', Date.now()),
      funds: 'refunded',
      refund: record().original
    })
    await vi.advanceTimersByTimeAsync(20)
    expect(selectTransaction(f.service.getSnapshot().records[0]).outcome).toBe('error')
    expect(f.refresh).toHaveBeenCalledWith(expect.anything(), 'refund')
    expect(f.observeSettlement).toHaveBeenCalledTimes(1)
  })
})

it('does not request the wallet when a host recovery guard rejects', async () => {
  const f = host([], async () => {
    throw new Error('Earlier bridge unresolved')
  })
  f.start()
  await vi.advanceTimersByTimeAsync(20)
  expect(f.execute).not.toHaveBeenCalled()
  expect(f.service.getSnapshot().flows[0]).toMatchObject({ phase: 'blocked', error: 'Earlier bridge unresolved' })
})
it('pauses an expired observation budget and allows explicit rechecking', async () => {
  const f = host([{ ...source(), settlementTracking: { expiresAt: 1 } }])
  await vi.advanceTimersByTimeAsync(20)
  expect(f.observeSettlement).not.toHaveBeenCalled()
  expect(f.service.getSnapshot().records[0].settlementTracking?.paused).toBe(true)
  f.service.recheck('one')
  await vi.advanceTimersByTimeAsync(20)
  expect(f.observeSettlement).toHaveBeenCalled()
})
it('does not let stalled refresh hold destination delivery pending', async () => {
  const f = host()
  f.refresh.mockImplementation(() => new Promise(() => undefined))
  f.observeSettlement.mockResolvedValue(evidence('delivered', Date.now()))
  f.start()
  await vi.advanceTimersByTimeAsync(0)
  f.receipts.resolve({ receipt })
  await vi.advanceTimersByTimeAsync(20)
  expect(selectTransaction(f.service.getSnapshot().records[0]).outcome).toBe('success')
})
