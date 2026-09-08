import { buildTransactionPlan, type VaultWidgetExecutionAdapter } from '@yearn/vault-widget/headless'
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
