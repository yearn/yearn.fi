import {
  buildTransactionPlan,
  type VaultWidgetExecutionAdapter,
  VaultWidgetPreparationError
} from '@yearn/vault-widget/headless'
import {
  createTransactionLifecycle,
  reduceTransaction,
  selectTransaction,
  type TTransactionPersistence,
  type TTransactionRecord
} from '@yearn/vault-widget/lifecycle'
import type { TransactionReceipt } from 'viem'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const owner = '0x1111111111111111111111111111111111111111' as const
const to = '0x2222222222222222222222222222222222222222' as const
const hash = `0x${'a'.repeat(64)}` as const
const replacementHash = `0x${'b'.repeat(64)}` as const
const receipt = {
  transactionHash: hash,
  status: 'success',
  blockNumber: 10n,
  blockHash: `0x${'c'.repeat(64)}`
} as TransactionReceipt
const makePlan = () =>
  buildTransactionPlan({
    connectedChainId: 1,
    intent: {
      id: 'deposit:10',
      mode: 'deposit',
      calls: [{ id: 'deposit', label: 'Deposit', request: { chainId: 1, to, data: '0x1234', value: 10n } }]
    }
  })
const deferred = <T>() => {
  const state: { resolve?: (value: T) => void; reject?: (reason: unknown) => void } = {}
  const promise = new Promise<T>((resolve, reject) => {
    state.resolve = resolve
    state.reject = reject
  })
  return { promise, resolve: (value: T) => state.resolve!(value), reject: (error: unknown) => state.reject!(error) }
}
const settle = () => vi.advanceTimersByTimeAsync(0)
function fixture(persistence?: TTransactionPersistence) {
  const gate = deferred<{ receipt: TransactionReceipt }>()
  const execute = vi.fn().mockResolvedValue(hash)
  const adapter: VaultWidgetExecutionAdapter = {
    execute,
    switchChain: vi.fn(),
    waitForReceipt: vi.fn().mockReturnValue(gate.promise)
  }
  const refresh = vi.fn().mockResolvedValue(undefined)
  const wallet = { address: owner as `0x${string}`, chainId: 1001 }
  const service = createTransactionLifecycle({
    execution: () => adapter,
    executionChainId: () => 1001,
    wallet: () => wallet,
    persistence,
    refresh,
    now: () => 100
  })
  const disconnect = service.connect()
  return {
    service,
    disconnect,
    gate,
    adapter,
    execute,
    refresh,
    wallet,
    start: (commandId = 'one') =>
      service.start({
        commandId,
        owner,
        plan: makePlan(),
        display: { amount: '10', fromAddress: owner, fromChainId: 1, fromSymbol: 'ETH', type: 'deposit' }
      })
  }
}

describe('provider-owned transaction lifecycle', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  })
  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('runs one wallet call and one observer through duplicate starts, then derives success before refresh', async () => {
    const f = fixture()
    const refresh = deferred<void>()
    f.refresh.mockReturnValue(refresh.promise)
    expect(f.start()).toBe('one')
    expect(f.start()).toBe('one')
    expect(f.start('another-click')).toBe('one')
    await settle()
    expect(f.execute).toHaveBeenCalledTimes(1)
    expect(f.adapter.waitForReceipt).toHaveBeenCalledTimes(1)
    const record = f.service.getSnapshot().records[0]
    expect(record.original).toEqual({ canonicalChainId: 1, executionChainId: 1001, hash })
    expect(f.adapter.waitForReceipt).toHaveBeenCalledWith({
      chainId: 1,
      executionChainId: 1001,
      hash,
      confirmations: 1
    })
    f.gate.resolve({ receipt })
    await settle()
    expect(selectTransaction(f.service.getSnapshot().records[0]).outcome).toBe('success')
    expect(f.service.getSnapshot().records[0].refresh).toBe('pending')
    refresh.resolve()
    await settle()
    expect(f.service.getSnapshot().records[0].refresh).toBe('success')
    f.disconnect()
  })

  it('freezes the submitted request and display even if the form changes while the wallet is open', async () => {
    const f = fixture()
    const walletGate = deferred<`0x${string}`>()
    f.execute.mockReturnValue(walletGate.promise)
    const plan = makePlan()
    const display = { amount: '10', fromAddress: owner, fromChainId: 1, fromSymbol: 'ETH', type: 'deposit' }
    f.service.start({ commandId: 'one', owner, plan, display })
    await settle()
    plan.intent.calls[0].request.data = '0x5678'
    display.amount = '900'
    walletGate.resolve(hash)
    await settle()
    expect(f.service.getSnapshot().records[0]).toMatchObject({
      request: { data: '0x1234', value: '10' },
      display: { amount: '10' }
    })
    f.disconnect()
  })

  it('adopts a late wallet result after the overlay closes without another send', async () => {
    const f = fixture()
    const walletGate = deferred<`0x${string}`>()
    f.execute.mockReturnValue(walletGate.promise)
    f.start()
    await settle()
    f.service.pause('one')
    walletGate.resolve(hash)
    await settle()
    expect(f.service.getSnapshot().records).toHaveLength(1)
    expect(f.start('reopen')).toBe('one')
    f.gate.resolve({ receipt })
    await settle()
    expect(selectTransaction(f.service.getSnapshot().records[0]).outcome).toBe('success')
    expect(f.execute).toHaveBeenCalledTimes(1)
    f.disconnect()
  })

  it.each(['close', 'account', 'network'])(
    'prevents a wallet request when %s changes during preparation',
    async (change) => {
      const f = fixture()
      const validation = deferred<void>()
      f.service.start({ commandId: 'one', owner, plan: makePlan(), validate: () => validation.promise })
      if (change === 'close') f.service.pause('one')
      if (change === 'account') f.wallet.address = to
      if (change === 'network') f.wallet.chainId = 2
      validation.resolve()
      await settle()
      expect(f.execute).not.toHaveBeenCalled()
      expect(f.service.getSnapshot().flows[0].phase).toBe('blocked')
      f.disconnect()
    }
  )

  it.each(['reject', 'stall'])(
    'keeps a submitted reference and observes it when persistence %s occurs',
    async (failure) => {
      const persistence: TTransactionPersistence = {
        load: vi.fn().mockResolvedValue([]),
        apply: vi
          .fn()
          .mockImplementation(() =>
            failure === 'reject' ? Promise.reject(new Error('disk')) : new Promise(() => undefined)
          )
      }
      const f = fixture(persistence)
      f.start()
      await settle()
      expect(f.service.getSnapshot().records[0].original.hash).toBe(hash)
      expect(f.adapter.waitForReceipt).toHaveBeenCalledTimes(1)
      f.gate.resolve({ receipt })
      await settle()
      expect(selectTransaction(f.service.getSnapshot().records[0]).outcome).toBe('success')
      await vi.advanceTimersByTimeAsync(5_001)
      expect(f.service.getSnapshot().records[0].storageError).toBeTruthy()
      expect(f.execute).toHaveBeenCalledTimes(1)
      f.disconnect()
    }
  )

  it('retains success through a timed-out refresh and retries only refresh', async () => {
    const f = fixture()
    f.refresh.mockReturnValue(new Promise(() => undefined))
    f.start()
    await settle()
    f.gate.resolve({ receipt })
    await settle()
    await vi.advanceTimersByTimeAsync(10_001)
    const record = f.service.getSnapshot().records[0]
    expect(selectTransaction(record).outcome).toBe('success')
    expect(record.refresh).toBe('error')
    f.refresh.mockResolvedValue(undefined)
    f.service.refresh(record.id)
    await settle()
    expect(f.service.getSnapshot().records[0].refresh).toBe('success')
    expect(f.execute).toHaveBeenCalledTimes(1)
    f.disconnect()
  })

  it('recovers an observation outage under the same record without sending again', async () => {
    const f = fixture()
    vi.mocked(f.adapter.waitForReceipt)
      .mockRejectedValueOnce(new Error('RPC offline'))
      .mockResolvedValueOnce({ receipt })
    f.start()
    await settle()
    expect(selectTransaction(f.service.getSnapshot().records[0]).outcome).toBe('unknown')
    await vi.advanceTimersByTimeAsync(10_001)
    expect(selectTransaction(f.service.getSnapshot().records[0]).outcome).toBe('success')
    expect(f.execute).toHaveBeenCalledTimes(1)
    f.disconnect()
  })

  it('does not create history on wallet rejection or offer a resend on an ambiguous response', async () => {
    const f = fixture()
    f.execute.mockRejectedValueOnce({ code: 4001 }).mockRejectedValueOnce(new Error('wallet disconnected'))
    f.start()
    await settle()
    expect(f.service.getSnapshot().flows[0].phase).toBe('rejected')
    expect(f.service.getSnapshot().records).toHaveLength(0)
    f.start('retry')
    await settle()
    expect(f.service.getSnapshot().flows.at(-1)?.phase).toBe('unknown')
    expect(f.start('third')).toBe('retry')
    expect(f.execute).toHaveBeenCalledTimes(2)
    f.disconnect()
  })

  it('resumes persisted records without a wallet call and rejects stale hydration regression', async () => {
    const original = fixture()
    original.start()
    await settle()
    const pending = original.service.getSnapshot().records[0]
    original.disconnect()
    const load = vi.fn().mockResolvedValue([pending])
    const apply = vi.fn().mockImplementation(async (record: TTransactionRecord) => record)
    const f = fixture({ load, apply })
    await settle()
    expect(f.execute).not.toHaveBeenCalled()
    expect(f.adapter.waitForReceipt).toHaveBeenCalledTimes(1)
    f.gate.resolve({ receipt })
    await settle()
    expect(selectTransaction(f.service.getSnapshot().records[0]).outcome).toBe('success')
    expect(
      reduceTransaction(f.service.getSnapshot().records[0], { kind: 'tracking-error', message: 'old outage' }).source
    ).toBeDefined()
    f.disconnect()
  })

  it('adopts an unfinished intent loaded while the user is starting it, without a second wallet request', async () => {
    const previous = fixture()
    previous.start()
    await settle()
    const saved = previous.service.getSnapshot().records[0]
    previous.disconnect()
    const hydration = deferred<readonly TTransactionRecord[]>()
    const next = fixture({ load: () => hydration.promise, apply: async (record) => record })
    next.start('after-reload')
    await settle()
    expect(next.execute).not.toHaveBeenCalled()
    hydration.resolve([saved])
    await settle()
    expect(next.execute).not.toHaveBeenCalled()
    expect(next.service.getSnapshot().flows.find((flow) => flow.id === 'after-reload')?.recordId).toBe(saved.id)
    next.gate.resolve({ receipt })
    await settle()
    expect(selectTransaction(next.service.getSnapshot().records[0]).outcome).toBe('success')
    next.disconnect()
  })

  it.each(['reject', 'stall'])(
    'blocks submission after initial history %s and adopts the saved intent on recovery',
    async (failure) => {
      const previous = fixture()
      previous.start()
      await settle()
      const saved = previous.service.getSnapshot().records[0]
      previous.disconnect()
      const load = vi
        .fn()
        .mockImplementationOnce(() =>
          failure === 'reject' ? Promise.reject(new Error('offline')) : new Promise(() => undefined)
        )
        .mockResolvedValue([saved])
      const f = fixture({ load, apply: async (record) => record })
      f.start('after-reload')
      await vi.advanceTimersByTimeAsync(5_001)
      expect(f.service.getSnapshot().history).toBe('unavailable')
      expect(f.execute).not.toHaveBeenCalled()
      expect(f.start('duplicate-click')).toBe('after-reload')
      await vi.advanceTimersByTimeAsync(10_001)
      expect(f.service.getSnapshot().history).toBe('ready')
      expect(f.service.getSnapshot().flows.find((flow) => flow.id === 'after-reload')?.recordId).toBe(saved.id)
      expect(f.execute).not.toHaveBeenCalled()
      expect(f.adapter.waitForReceipt).toHaveBeenCalledTimes(1)
      f.disconnect()
    }
  )

  it.each(['close', 'account', 'network'])(
    'rechecks %s after failed history recovers with no saved intent',
    async (change) => {
      const load = vi.fn().mockRejectedValue(new Error('offline'))
      const f = fixture({ load, apply: async (record) => record })
      f.start()
      await settle()
      await vi.advanceTimersByTimeAsync(20_001)
      expect(f.execute).not.toHaveBeenCalled()
      if (change === 'close') f.service.pause('one')
      if (change === 'account') f.wallet.address = to
      if (change === 'network') f.wallet.chainId = 2
      load.mockResolvedValue([])
      f.service.recheckHistory()
      await settle()
      expect(f.service.getSnapshot().history).toBe('ready')
      expect(f.service.getSnapshot().flows[0].phase).toBe('blocked')
      expect(f.execute).not.toHaveBeenCalled()
      f.disconnect()
    }
  )

  it('ignores a disconnected hydration result until the current connection recovers', async () => {
    const stale = deferred<readonly TTransactionRecord[]>()
    const load = vi.fn().mockReturnValueOnce(stale.promise).mockRejectedValue(new Error('offline'))
    const f = fixture({ load, apply: async (record) => record })
    f.start()
    f.disconnect()
    const disconnect = f.service.connect()
    await settle()
    stale.resolve([])
    await settle()
    expect(f.service.getSnapshot().history).toBe('unavailable')
    expect(f.execute).not.toHaveBeenCalled()
    load.mockResolvedValue([])
    f.service.recheckHistory()
    await settle()
    expect(f.execute).toHaveBeenCalledTimes(1)
    disconnect()
  })

  it('merges persisted conflicts into existing and fresh tabs without letting stale clean snapshots erase them', async () => {
    const previous = fixture()
    previous.start()
    await settle()
    previous.gate.resolve({ receipt })
    await settle()
    const confirmed = previous.service.getSnapshot().records[0]
    previous.disconnect()
    const conflicted = reduceTransaction(confirmed, {
      kind: 'receipt',
      result: { receipt: { ...receipt, status: 'reverted' } },
      observedAt: 200
    })
    const subscription: { notify?: () => void } = {}
    const load = vi.fn().mockResolvedValue([{ ...confirmed, revision: 100 }])
    const persistence: TTransactionPersistence = {
      load,
      apply: async (record) => record,
      subscribe: (notify) => {
        subscription.notify = notify
        return () => undefined
      }
    }
    const existing = fixture(persistence)
    await settle()
    expect(selectTransaction(existing.service.getSnapshot().records[0]).outcome).toBe('success')
    load.mockResolvedValue([conflicted])
    subscription.notify!()
    await settle()
    const fresh = fixture({ load, apply: async (record) => record })
    await settle()
    expect(selectTransaction(existing.service.getSnapshot().records[0]).outcome).toBe('unknown')
    expect(selectTransaction(fresh.service.getSnapshot().records[0]).outcome).toBe('unknown')
    load.mockResolvedValue([{ ...confirmed, revision: 200 }])
    subscription.notify!()
    fresh.service.recheckHistory()
    await settle()
    expect(selectTransaction(existing.service.getSnapshot().records[0]).outcome).toBe('unknown')
    expect(selectTransaction(fresh.service.getSnapshot().records[0]).outcome).toBe('unknown')
    expect(existing.service.getSnapshot().records[0].source).toEqual(confirmed.source)
    expect(existing.execute).not.toHaveBeenCalled()
    existing.disconnect()
    fresh.disconnect()
  })

  it('does not retry a failed refresh on cross-tab storage notifications; explicit retry keeps the route refresh', async () => {
    const subscription: { notify?: () => void } = {}
    const saved: { record?: TTransactionRecord } = {}
    const f = fixture({
      load: async () => (saved.record ? [saved.record] : []),
      apply: async (record) => {
        saved.record = record
        return record
      },
      subscribe: (notify) => {
        subscription.notify = notify
        return () => undefined
      }
    })
    const routeRefresh = vi.fn().mockRejectedValueOnce(new Error('balances offline')).mockResolvedValue(undefined)
    f.service.start({ commandId: 'one', owner, plan: makePlan(), refresh: routeRefresh })
    await settle()
    f.gate.resolve({ receipt })
    await settle()
    expect(f.service.getSnapshot().records[0].refresh).toBe('error')
    subscription.notify!()
    await settle()
    expect(routeRefresh).toHaveBeenCalledTimes(1)
    f.service.refresh(f.service.getSnapshot().records[0].id)
    await settle()
    expect(routeRefresh).toHaveBeenCalledTimes(2)
    expect(f.refresh).not.toHaveBeenCalled()
    expect(f.execute).toHaveBeenCalledTimes(1)
    f.disconnect()
  })

  it('reduces receipt evidence idempotently, rejects unrelated hashes, and retains conflicting evidence', async () => {
    const f = fixture()
    f.start()
    await settle()
    const pending = f.service.getSnapshot().records[0]
    expect(() =>
      reduceTransaction(pending, {
        kind: 'receipt',
        result: { receipt: { ...receipt, transactionHash: replacementHash } },
        observedAt: 1
      })
    ).toThrow('does not match')
    const observation = { kind: 'receipt' as const, result: { receipt: { ...receipt } }, observedAt: 1 }
    const confirmed = reduceTransaction(pending, observation)
    expect(reduceTransaction(confirmed, observation)).toBe(confirmed)
    observation.result.receipt.status = 'reverted'
    expect(confirmed.source?.receipt.status).toBe('success')
    const conflict = reduceTransaction(confirmed, observation)
    expect(conflict.source).toBe(confirmed.source)
    expect(selectTransaction(conflict).outcome).toBe('unknown')
    const refreshed = reduceTransaction(confirmed, { kind: 'refresh', status: 'success' })
    expect(reduceTransaction(refreshed, { kind: 'refresh', status: 'error', message: 'late worker' })).toBe(refreshed)
    f.disconnect()
  })

  it.each(['repriced', 'cancelled', 'replaced'] as const)('retains replacement evidence for %s', async (reason) => {
    const f = fixture()
    vi.mocked(f.adapter.waitForReceipt).mockResolvedValue({
      receipt: { ...receipt, transactionHash: replacementHash },
      replacement: { reason, replacedHash: hash }
    })
    f.start()
    await settle()
    const record = f.service.getSnapshot().records[0]
    expect(record.original.hash).toBe(hash)
    expect(record.effective.hash).toBe(replacementHash)
    expect(selectTransaction(record).outcome).toBe(reason === 'repriced' ? 'success' : 'error')
    expect(f.refresh).toHaveBeenCalledTimes(reason === 'repriced' ? 1 : 0)
    f.disconnect()
  })
})

describe('sequential EOA lifecycle', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  })
  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })
  const plan = () =>
    buildTransactionPlan({
      connectedChainId: 1,
      intent: {
        ...makePlan().intent,
        approvals: [{ token: { address: to, chainId: 1, symbol: 'Token' }, spender: owner, amount: 10n }]
      }
    })
  const setup = (persistence?: TTransactionPersistence) => {
    const f = fixture(persistence)
    f.execute.mockReset().mockResolvedValueOnce(hash).mockResolvedValue(replacementHash)
    const final = deferred<{ receipt: TransactionReceipt }>()
    vi.mocked(f.adapter.waitForReceipt)
      .mockReset()
      .mockImplementation(({ hash: submitted }) => (submitted === hash ? f.gate.promise : final.promise))
    const start = (commandId = 'sequence') =>
      f.service.start({
        commandId,
        owner,
        plan: plan(),
        display: { type: 'deposit', amount: '10', fromAddress: owner, fromChainId: 1, fromSymbol: 'Token' },
        displayByStep: {
          'approve-0': { type: 'approve', amount: '10', fromAddress: owner, fromChainId: 1, fromSymbol: 'Token' }
        }
      })
    return { ...f, start, final }
  }

  it('requests each step once, only after the earlier source receipt, with separate frozen records', async () => {
    const f = setup()
    const finalRefresh = deferred<void>()
    f.refresh.mockImplementation((record: TTransactionRecord) =>
      record.stepId === 'approve-0' ? finalRefresh.promise : Promise.resolve()
    )
    f.start()
    await settle()
    expect(f.execute).toHaveBeenCalledTimes(1)
    expect(f.service.getSnapshot().records[0]).toMatchObject({
      stepId: 'approve-0',
      display: { type: 'approve' },
      sequence: { index: 0, count: 2 }
    })
    // A duplicate start in the receipt-publication/next-step boundary must reuse the active runner.
    const duplicateIds: string[] = []
    const unsubscribe = f.service.subscribe(() => {
      if (f.service.getSnapshot().records[0]?.source) duplicateIds.push(f.start('duplicate'))
    })
    f.gate.resolve({ receipt })
    await settle()
    expect(new Set(duplicateIds)).toEqual(new Set(['sequence']))
    expect(f.execute).toHaveBeenCalledTimes(2)
    expect(f.service.getSnapshot().records.map((record) => [record.stepId, record.display?.type])).toEqual([
      ['approve-0', 'approve'],
      ['deposit', 'deposit']
    ])
    expect(f.service.getSnapshot().flows[0]).toMatchObject({ phase: 'pending', stepIndex: 1, stepCount: 2 })
    unsubscribe()
    f.final.resolve({ receipt: { ...receipt, transactionHash: replacementHash } })
    await settle()
    expect(f.service.getSnapshot().flows[0].phase).toBe('success')
    finalRefresh.resolve()
    f.disconnect()
  })

  it.each(['close', 'account', 'network'])(
    'keeps observing but requires explicit continuation after %s before another wallet request',
    async (change) => {
      const f = setup()
      f.start()
      await settle()
      if (change === 'close') f.service.pause('sequence')
      if (change === 'account') f.wallet.address = to
      if (change === 'network') f.wallet.chainId = 2
      f.gate.resolve({ receipt })
      await settle()
      expect(f.execute).toHaveBeenCalledTimes(1)
      expect(f.service.getSnapshot().flows[0]).toMatchObject({ phase: 'paused', stepId: 'deposit' })
      expect(f.start('reopen')).toBe('sequence')
      await settle()
      expect(f.execute).toHaveBeenCalledTimes(1)
      if (change !== 'close') {
        f.service.continue('sequence')
        await settle()
        expect(f.execute).toHaveBeenCalledTimes(1)
      }
      f.wallet.address = owner
      f.wallet.chainId = 1001
      f.service.continue('sequence')
      f.service.continue('sequence')
      await settle()
      expect(f.execute).toHaveBeenCalledTimes(2)
      f.final.resolve({ receipt: { ...receipt, transactionHash: replacementHash } })
      await settle()
      f.disconnect()
    }
  )

  it('retains a late approval hash after close and pauses the deposit', async () => {
    const f = setup()
    const wallet = deferred<typeof hash>()
    f.execute.mockReturnValueOnce(wallet.promise)
    f.start()
    await settle()
    f.service.pause('sequence')
    wallet.resolve(hash)
    await settle()
    expect(f.service.getSnapshot().records[0].original.hash).toBe(hash)
    f.gate.resolve({ receipt })
    await settle()
    expect(f.service.getSnapshot().flows[0].phase).toBe('paused')
    expect(f.execute).toHaveBeenCalledTimes(1)
    f.disconnect()
  })

  it.each(['revert', 'cancelled', 'replaced', 'outage'])(
    'never advances an approval with %s evidence',
    async (failure) => {
      const f = setup()
      f.start()
      await settle()
      if (failure === 'outage') f.gate.reject(new Error('RPC unavailable'))
      else if (failure === 'revert') f.gate.resolve({ receipt: { ...receipt, status: 'reverted' } })
      else
        f.gate.resolve({
          receipt: { ...receipt, transactionHash: replacementHash },
          replacement: { reason: failure, replacedHash: hash }
        } as { receipt: TransactionReceipt })
      await settle()
      expect(f.execute).toHaveBeenCalledTimes(1)
      expect(f.service.getSnapshot().records).toHaveLength(1)
      expect(f.service.getSnapshot().flows[0].phase).not.toBe('success')
      f.disconnect()
    }
  )

  it('does not repeat approval if deposit preparation fails', async () => {
    const f = setup()
    // The first send must succeed; model the adapter rejecting the second fresh simulation.
    f.execute
      .mockReset()
      .mockResolvedValueOnce(hash)
      .mockRejectedValue(new VaultWidgetPreparationError(new Error('Simulation failed')))
    f.start()
    await settle()
    f.gate.resolve({ receipt })
    await settle()
    expect(f.service.getSnapshot().records).toHaveLength(1)
    expect(selectTransaction(f.service.getSnapshot().records[0]).outcome).toBe('success')
    expect(f.service.getSnapshot().flows[0]).toMatchObject({ phase: 'blocked', stepId: 'deposit' })
    expect(f.execute).toHaveBeenCalledTimes(2)
    f.disconnect()
  })

  it('recovers a saved pending approval without sending another approval or automatically depositing', async () => {
    const saved: TTransactionRecord[] = []
    const persistence: TTransactionPersistence = {
      load: async () => saved,
      apply: async (record, observation) => {
        const next = observation
          ? reduceTransaction(saved.find((item) => item.id === record.id) ?? record, observation)
          : record
        saved.splice(0, saved.length, ...saved.filter((item) => item.id !== next.id), next)
        return next
      }
    }
    const first = setup(persistence)
    first.start()
    await settle()
    first.disconnect()
    const recovered = setup(persistence)
    recovered.start('review-again')
    await settle()
    expect(recovered.execute).not.toHaveBeenCalled()
    recovered.gate.resolve({ receipt })
    await settle()
    expect(recovered.execute).not.toHaveBeenCalled()
    expect(recovered.service.getSnapshot().records[0]).toMatchObject({ sequence: { index: 0, count: 2 } })
    recovered.disconnect()
  })

  it('loads the latest step for a flow regardless of persistence row order', async () => {
    const f = setup()
    f.start()
    await settle()
    f.gate.resolve({ receipt })
    await settle()
    const saved = [...f.service.getSnapshot().records].reverse()
    f.disconnect()
    const recovered = setup({ load: async () => saved, apply: async (record) => record })
    await settle()
    expect(recovered.service.getSnapshot().flows[0]).toMatchObject({ stepId: 'deposit', recordId: saved[0].id })
    expect(recovered.execute).not.toHaveBeenCalled()
    recovered.disconnect()
  })
  it('holds one intent lease across approval and deposit, including a paused sequence', async () => {
    const locks = new Set<string>()
    const coordinate = async (key: string, task: () => Promise<void>) => {
      if (locks.has(key)) return
      locks.add(key)
      try {
        await task()
      } finally {
        locks.delete(key)
      }
    }
    const f = setup()
    const makeService = () =>
      createTransactionLifecycle({
        execution: () => f.adapter,
        wallet: () => f.wallet,
        executionChainId: () => 1001,
        coordinate
      })
    const first = makeService()
    const second = makeService()
    const stopFirst = first.connect()
    const stopSecond = second.connect()
    first.start({ commandId: 'first', owner, plan: plan() })
    await settle()
    first.pause('first')
    f.gate.resolve({ receipt })
    await settle()
    expect(first.getSnapshot().flows[0].phase).toBe('paused')
    second.start({ commandId: 'second', owner, plan: plan() })
    await settle()
    expect(second.getSnapshot().flows[0]).toMatchObject({ phase: 'blocked' })
    expect(f.execute).toHaveBeenCalledTimes(1)
    first.continue('first')
    await settle()
    expect(f.execute).toHaveBeenCalledTimes(2)
    f.final.resolve({ receipt: { ...receipt, transactionHash: replacementHash } })
    await settle()
    expect(locks.size).toBe(0)
    stopFirst()
    stopSecond()
    f.disconnect()
  })
  it('blocks continuation if the confirmed approval later receives conflicting evidence', async () => {
    const load = vi.fn().mockResolvedValue([])
    const f = setup({ load, apply: async (record) => record })
    f.start()
    await settle()
    f.service.pause('sequence')
    f.gate.resolve({ receipt })
    await settle()
    load.mockResolvedValue([{ ...f.service.getSnapshot().records[0], conflict: 'Conflicting receipt evidence' }])
    f.service.recheckHistory()
    await settle()
    f.service.continue('sequence')
    await settle()
    expect(f.execute).toHaveBeenCalledTimes(1)
    expect(f.service.getSnapshot().flows[0].phase).toBe('blocked')
    f.disconnect()
  })

  it('checks the wallet again after the second-step simulation before requesting a signature', async () => {
    const f = setup()
    const simulation = deferred<void>()
    const send = vi.fn().mockResolvedValue(replacementHash)
    f.execute
      .mockReset()
      .mockResolvedValueOnce(hash)
      .mockImplementation(async (parameters) => {
        await simulation.promise
        parameters.beforeSubmit?.()
        return send()
      })
    f.start()
    await settle()
    f.gate.resolve({ receipt })
    await settle()
    expect(f.execute).toHaveBeenCalledTimes(2)
    f.wallet.address = to
    simulation.resolve()
    await settle()
    expect(send).not.toHaveBeenCalled()
    expect(f.service.getSnapshot().records).toHaveLength(1)
    expect(f.service.getSnapshot().flows[0]).toMatchObject({ phase: 'blocked', stepId: 'deposit' })
    f.disconnect()
  })
})

describe('Safe proposals and dependent preparations', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
  })
  const safePlan = () => buildTransactionPlan({ connectedChainId: 1, walletType: 'safe', intent: makePlan().intent })
  it('saves a late proposal after closure, recovers it, and requires Safe success plus the confirmed receipt', async () => {
    const saved: TTransactionRecord[] = []
    const persistence: TTransactionPersistence = {
      load: async () => saved,
      apply: async (record, observation) => {
        const next = observation
          ? reduceTransaction(saved.find((item) => item.id === record.id) ?? record, observation)
          : record
        saved.splice(0, saved.length, next)
        return next
      }
    }
    const first = fixture(persistence)
    const proposal = deferred<`0x${string}`>()
    first.adapter.proposeSafeBatch = vi.fn().mockReturnValue(proposal.promise)
    first.adapter.observeSafeExecution = vi.fn().mockResolvedValue({ status: 'pending' })
    first.service.start({ commandId: 'safe', owner, plan: safePlan() })
    await settle()
    first.service.pause('safe')
    proposal.resolve('0x1234')
    await settle()
    expect(saved[0].original.hash).toBeUndefined()
    expect(saved[0].safe?.proposalId).toBe('0x1234')
    expect(first.adapter.waitForReceipt).not.toHaveBeenCalled()
    first.disconnect()
    const recovered = fixture(persistence)
    recovered.adapter.proposeSafeBatch = vi.fn()
    recovered.adapter.observeSafeExecution = vi.fn().mockResolvedValue({ status: 'success', hash })
    recovered.service.start({ commandId: 'reopen', owner, plan: safePlan() })
    await settle()
    expect(recovered.adapter.proposeSafeBatch).not.toHaveBeenCalled()
    expect(selectTransaction(recovered.service.getSnapshot().records[0]).outcome).toBe('pending')
    recovered.gate.resolve({ receipt })
    await settle()
    expect(selectTransaction(recovered.service.getSnapshot().records[0]).outcome).toBe('success')
    recovered.disconnect()
  })
  it.each(['failed', 'cancelled'])('does not infer source success when Safe reports %s', async (status) => {
    const f = fixture()
    f.adapter.proposeSafeBatch = vi.fn().mockResolvedValue('0x1234')
    f.adapter.observeSafeExecution = vi.fn().mockResolvedValue({ status })
    f.service.start({ commandId: 'safe', owner, plan: safePlan() })
    await settle()
    expect(selectTransaction(f.service.getSnapshot().records[0]).outcome).toBe('error')
    expect(f.adapter.waitForReceipt).not.toHaveBeenCalled()
    expect(f.refresh).not.toHaveBeenCalled()
    f.disconnect()
  })
  it('keeps conflicting Safe evidence unresolved across storage refreshes', async () => {
    const f = fixture()
    f.adapter.proposeSafeBatch = vi.fn().mockResolvedValue('0x1234')
    f.adapter.observeSafeExecution = vi.fn().mockResolvedValue({ status: 'pending' })
    f.service.start({ commandId: 'safe', owner, plan: safePlan() })
    await settle()
    const record = f.service.getSnapshot().records[0]
    const succeeded = reduceTransaction(record, {
      kind: 'safe-execution',
      result: { status: 'success', hash },
      observedAt: 1
    })
    const conflicted = reduceTransaction(succeeded, {
      kind: 'safe-execution',
      result: { status: 'failed' },
      observedAt: 2
    })
    expect(selectTransaction(conflicted).outcome).toBe('unknown')
    expect(reduceTransaction(succeeded, { kind: 'safe-execution', result: { status: 'pending' }, observedAt: 3 })).toBe(
      succeeded
    )
    expect(() => reduceTransaction(record, { kind: 'receipt', result: { receipt }, observedAt: 1 })).toThrow()
    f.disconnect()
  })
  it('pauses after a late permit signature and prepares the call only after explicit continuation', async () => {
    const f = fixture()
    const signature = deferred<`0x${string}`>()
    f.adapter.signPermit = vi.fn().mockReturnValue(signature.promise)
    const plan = {
      ...makePlan(),
      steps: [
        { id: 'permit', label: 'Permit', kind: 'prepare' as const, chainId: 1 },
        { id: 'deposit', label: 'Deposit', kind: 'prepare' as const, chainId: 1 }
      ]
    }
    const prepareStep = vi.fn(async (step, outcome) =>
      step.id === 'permit'
        ? { ...step, kind: 'permit', data: {} }
        : { ...step, kind: 'execute', request: { chainId: 1, to, data: outcome.signatures.permit } }
    )
    f.service.start({ commandId: 'permit', owner, plan, prepareStep })
    await settle()
    f.service.pause('permit')
    signature.resolve('0x1234')
    await settle()
    expect(f.service.getSnapshot().flows[0].phase).toBe('paused')
    expect(f.execute).not.toHaveBeenCalled()
    expect(prepareStep).toHaveBeenCalledTimes(1)
    f.service.continue('permit')
    await settle()
    expect(f.execute).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ request: expect.objectContaining({ data: '0x1234' }) })
    )
    expect(f.service.getSnapshot().records).toHaveLength(1)
    f.gate.resolve({ receipt })
    await settle()
    expect(f.service.getSnapshot().flows[0].phase).toBe('success')
    f.disconnect()
  })
  it('rejects a deferred request that changes the reviewed chain before reaching the wallet', async () => {
    const f = fixture()
    const plan = { ...makePlan(), steps: [{ id: 'deposit', label: 'Deposit', kind: 'prepare' as const, chainId: 1 }] }
    f.service.start({
      commandId: 'wrong-chain',
      owner,
      plan,
      prepareStep: async () => ({
        id: 'deposit',
        label: 'Deposit',
        kind: 'execute',
        chainId: 1,
        request: { chainId: 10, to, data: '0x1234' }
      })
    })
    await settle()
    expect(f.execute).not.toHaveBeenCalled()
    expect(f.service.getSnapshot().flows[0].phase).toBe('blocked')
    f.disconnect()
  })
})
