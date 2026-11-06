// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { VaultWidgetTransactionPlan, VaultWidgetTransactionRequest } from '@yearn/vault-widget/headless'
import { buildEligibleStyledWidgetPlan } from '@yearn/vault-widget/internal/components/widget/shared/plannedTransaction'
import {
  TransactionOverlay,
  type TransactionStep
} from '@yearn/vault-widget/internal/components/widget/shared/TransactionOverlay'
import {
  createTransactionLifecycle,
  reduceTransaction,
  type TSettlementEvidence,
  type TTransactionPersistence,
  type TTransactionRecord
} from '@yearn/vault-widget/lifecycle'
import { VaultWidgetRuntimeProvider } from '@yearn/vault-widget/runtime'
import { StrictMode, useState } from 'react'
import type { Address, Hash, TransactionReceipt } from 'viem'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('react-rewards', () => ({ useReward: () => ({ reward: () => undefined }) }))
const owner = '0x1111111111111111111111111111111111111111' as const
const token = '0x2222222222222222222222222222222222222222' as const
const vault = '0x3333333333333333333333333333333333333333' as const
const approvalHash = `0x${'a'.repeat(64)}` as const
const actionHash = `0x${'b'.repeat(64)}` as const
const receipt = (hash: Hash) =>
  ({
    transactionHash: hash,
    status: 'success',
    blockNumber: 1n,
    blockHash: approvalHash,
    logs: []
  }) as unknown as TransactionReceipt
const ready = { isSuccess: true, isError: false, isLoading: false, isFetching: false, status: 'success' as const }
const stops: (() => void)[] = []
afterEach(() => {
  cleanup()
  stops.splice(0).forEach((stop) => {
    stop()
  })
})
const deferred = <T,>() => {
  const state: { resolve?: (value: T) => void } = {}
  return {
    promise: new Promise<T>((resolve) => {
      state.resolve = resolve
    }),
    resolve: (value: T) => state.resolve!(value)
  }
}
function durableHost() {
  const records = new Map<string, TTransactionRecord>()
  const locks = new Set<string>()
  const persistence: TTransactionPersistence = {
    load: async () => [...records.values()],
    apply: async (record, observation) => {
      const next = observation ? reduceTransaction(records.get(record.id) ?? record, observation) : record
      records.set(record.id, next)
      return next
    }
  }
  const coordinate = async (id: string, observe: () => Promise<void>) => {
    if (locks.has(id)) return
    locks.add(id)
    try {
      await observe()
    } finally {
      locks.delete(id)
    }
  }
  return { persistence, coordinate, records }
}
function fixture(
  mode: 'deposit' | 'withdraw',
  options: {
    crossChain?: boolean
    approved?: boolean
    host?: ReturnType<typeof durableHost>
    lateHash?: boolean
    intentId?: string
  } = {}
) {
  const approval = deferred<{ receipt: TransactionReceipt }>()
  const action = deferred<{ receipt: TransactionReceipt }>()
  const hash = deferred<Hash>()
  const settlement = deferred<TSettlementEvidence>()
  const requirement = options.crossChain
    ? {
        provider: 'enso' as const,
        destinationChainId: 10,
        protocols: ['relay'],
        coverage: 'incomplete' as const,
        legs: []
      }
    : undefined
  const validate = vi.fn().mockResolvedValue(undefined)
  const wallet: { address: Address; chainId: number } = { address: owner, chainId: 1 }
  const controls: { approve?: () => void; wallet?: (address: Address, chainId: number) => void } = {}
  const execute = vi.fn(
    async ({ request, beforeSubmit }: { request: VaultWidgetTransactionRequest; beforeSubmit?: () => void }) => {
      beforeSubmit?.()
      return request.to === token ? approvalHash : options.lateHash ? hash.promise : actionHash
    }
  )
  const waitForReceipt = vi.fn(({ hash }: { hash: Hash }) =>
    hash === approvalHash ? approval.promise : action.promise
  )
  const adapter = { execute, waitForReceipt, switchChain: vi.fn() }
  const service = createTransactionLifecycle({
    execution: () => adapter,
    executionChainId: () => 1,
    wallet: () => wallet,
    persistence: options.host?.persistence,
    coordinate: options.host?.coordinate,
    observeSettlement: options.crossChain ? () => settlement.promise : undefined,
    settlementIntervalMs: 10
  })
  const stop = service.connect()
  stops.push(stop)
  const start = vi.spyOn(service, 'start')
  const completed = vi.fn()
  const onStepSuccess = vi.fn()
  const intentId = options.intentId ?? `${mode}:reviewed-route:10:0.5`
  function App() {
    const [open, setOpen] = useState(false)
    const [approved, setApproved] = useState(options.approved ?? false)
    const [plan, setPlan] = useState<VaultWidgetTransactionPlan>()
    const [currentWallet, setWallet] = useState({ ...wallet })
    controls.approve = () => setApproved(true)
    controls.wallet = (address, chainId) => {
      Object.assign(wallet, { address, chainId })
      setWallet({ ...wallet })
    }
    const step: TransactionStep = {
      id: approved ? mode : 'approve',
      label: approved ? mode : 'Approve',
      settlement: approved ? requirement : undefined,
      confirmMessage: 'Confirm',
      successTitle: 'Action confirmed',
      successMessage: 'Done',
      completesFlow: approved,
      prepare: approved
        ? {
            ...ready,
            kind: 'raw',
            chainId: 1,
            transaction: { chainId: 1, from: owner, to: vault, data: '0x1234', value: '0' },
            validate,
            execute: vi.fn(),
            refetch: vi.fn(),
            error: null
          }
        : { ...ready, data: { request: { chainId: 1, to: token, data: '0x4321' } } }
    }
    const eligible = buildEligibleStyledWidgetPlan({
      id: intentId,
      canonicalChainId: 1,
      connectedCanonicalChainId: 1,
      isCrossChain: Boolean(options.crossChain),
      isExecutionConfigured: true,
      isWalletSafe: false,
      label: mode,
      mode,
      needsApproval: !approved,
      prepare: step.prepare,
      routeType: 'ENSO'
    })
    return (
      <VaultWidgetRuntimeProvider value={{ lifecycle: service, execution: adapter, wallet: currentWallet }}>
        <button
          type="button"
          onClick={() => {
            setPlan(eligible)
            setOpen(true)
          }}
        >
          Open transaction
        </button>
        <TransactionOverlay
          isOpen={open}
          plan={plan}
          lifecycleRecipe={{
            settlement: requirement,
            previousIntentIds: [`${mode}:legacy-route`],
            id: intentId,
            chainId: 1,
            steps: [...(!approved ? [{ id: 'approve', label: 'Approve' }] : []), { id: mode, label: mode }]
          }}
          step={step}
          onClose={() => {
            setOpen(false)
            setPlan(undefined)
          }}
          onAllComplete={completed}
          onStepSuccess={(id, receipt) => {
            onStepSuccess(id, receipt)
            if (id === 'approve') setApproved(true)
          }}
        />
      </VaultWidgetRuntimeProvider>
    )
  }
  const view = render(
    <StrictMode>
      <App />
    </StrictMode>
  )
  const open = () => fireEvent.click(screen.getByRole('button', { name: 'Open transaction' }))
  const close = () => fireEvent.click(screen.getByRole('button', { name: 'Close transaction progress' }))
  return {
    service,
    settlement,
    start,
    execute,
    waitForReceipt,
    validate,
    approval,
    action,
    hash,
    controls,
    completed,
    onStepSuccess,
    open,
    close,
    view,
    stop
  }
}

const assertReadyPlan = (f: ReturnType<typeof fixture>) => {
  expect(f.start.mock.calls.at(-1)?.[0].plan.steps[0].kind).toBe('execute')
}
describe.each(['deposit', 'withdraw'] as const)('Enso %s path changes', (mode) => {
  it('adopts the pending action when reopening selects a ready plan', async () => {
    const f = fixture(mode)
    f.open()
    await waitFor(() => expect(f.execute).toHaveBeenCalledTimes(1))
    await act(async () => f.approval.resolve({ receipt: receipt(approvalHash) }))
    await waitFor(() => expect(f.service.getSnapshot().records).toHaveLength(2))
    f.close()
    f.open()
    await screen.findByText('Transaction pending')
    assertReadyPlan(f)
    expect(f.execute).toHaveBeenCalledTimes(2)
    expect(f.service.getSnapshot().flows).toHaveLength(1)
    expect(f.validate).toHaveBeenCalledTimes(1)
    await act(async () => f.action.resolve({ receipt: receipt(actionHash) }))
    await screen.findByText('Action confirmed')
    expect(f.onStepSuccess).toHaveBeenLastCalledWith(mode, receipt(actionHash))
    expect(f.completed).toHaveBeenCalledTimes(1)
  })
  it('reattaches the deferred preparation before Continue even when allowance now permits a ready plan', async () => {
    const f = fixture(mode)
    f.open()
    await waitFor(() => expect(f.execute).toHaveBeenCalledTimes(1))
    f.close()
    await act(async () => {
      f.approval.resolve({ receipt: receipt(approvalHash) })
      f.controls.approve!()
    })
    f.open()
    await screen.findByRole('button', { name: 'Continue' })
    assertReadyPlan(f)
    expect(f.execute).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    await waitFor(() => expect(f.execute).toHaveBeenCalledTimes(2))
    expect(f.execute.mock.calls[1][0].request).toMatchObject({ to: vault, data: '0x1234' })
    expect(f.validate).toHaveBeenCalledTimes(1)
  })
  it('does not duplicate a wallet request whose hash arrives after reopening', async () => {
    const f = fixture(mode, { lateHash: true })
    f.open()
    await waitFor(() => expect(f.execute).toHaveBeenCalledTimes(1))
    await act(async () => f.approval.resolve({ receipt: receipt(approvalHash) }))
    await waitFor(() => expect(f.execute).toHaveBeenCalledTimes(2))
    f.close()
    f.open()
    await screen.findByText('Confirm in your wallet')
    assertReadyPlan(f)
    await act(async () => f.hash.resolve(actionHash))
    await screen.findByText('Transaction pending')
    expect(f.execute).toHaveBeenCalledTimes(2)
    expect(f.service.getSnapshot().records).toHaveLength(2)
  })
  it.each([false, true])('adopts durable history in a new host (original host stopped: %s)', async (stopped) => {
    const host = durableHost()
    const first = fixture(mode, { host })
    first.open()
    await waitFor(() => expect(first.execute).toHaveBeenCalledTimes(1))
    await act(async () => first.approval.resolve({ receipt: receipt(approvalHash) }))
    await waitFor(() => expect(host.records.size).toBe(2))
    first.view.unmount()
    if (stopped) first.stop()
    const next = fixture(mode, { host, approved: true })
    next.open()
    await screen.findByText('Transaction pending')
    assertReadyPlan(next)
    expect(next.execute).not.toHaveBeenCalled()
    expect(next.service.getSnapshot().records.at(-1)?.original.hash).toBe(actionHash)
  })
  it('recognizes a pending action saved under the previous plan identity', async () => {
    const host = durableHost()
    const first = fixture(mode, { host, approved: true, intentId: `${mode}:legacy-route` })
    first.open()
    await waitFor(() => expect(host.records.size).toBe(1))
    first.view.unmount()
    first.stop()
    const next = fixture(mode, { host, approved: true })
    next.open()
    await screen.findByText('Transaction pending')
    expect(next.execute).not.toHaveBeenCalled()
    expect(next.service.getSnapshot().records[0].intentKey).toBe(`${mode}:legacy-route`)
  })
  it('respects the old identity lock while another tab is waiting for its action hash', async () => {
    const host = durableHost()
    const first = fixture(mode, { host, lateHash: true, intentId: `${mode}:legacy-route` })
    first.open()
    await waitFor(() => expect(first.execute).toHaveBeenCalledTimes(1))
    await act(async () => first.approval.resolve({ receipt: receipt(approvalHash) }))
    await waitFor(() => expect(first.execute).toHaveBeenCalledTimes(2))
    first.view.unmount()
    const next = fixture(mode, { host, approved: true })
    next.open()
    await screen.findByText(
      'This transaction flow is active in another window. Continue there or review again after it closes.'
    )
    expect(next.execute).not.toHaveBeenCalled()
    await act(async () => first.hash.resolve(actionHash))
    await waitFor(() => expect(host.records.size).toBe(2))
    await act(async () => next.service.recheckHistory())
    next.close()
    next.open()
    await screen.findByText('Transaction pending')
    expect(next.execute).not.toHaveBeenCalled()
  })
  it('validates a fresh ready plan when there is no deferred flow to resume', async () => {
    const f = fixture(mode, { approved: true })
    f.open()
    await screen.findByText('Transaction pending')
    expect(f.execute).toHaveBeenCalledTimes(1)
    expect(f.validate).toHaveBeenCalledTimes(1)
    await act(async () => f.action.resolve({ receipt: receipt(actionHash) }))
    await screen.findByText('Action confirmed')
    expect(f.onStepSuccess).toHaveBeenCalledExactlyOnceWith(mode, receipt(actionHash))
  })
  it.each(['wallet', 'network', 'quote'] as const)(
    'preserves the %s guard on a resumed deferred flow',
    async (guard) => {
      const f = fixture(mode)
      f.open()
      await waitFor(() => expect(f.execute).toHaveBeenCalledTimes(1))
      f.close()
      await act(async () => {
        f.approval.resolve({ receipt: receipt(approvalHash) })
        f.controls.approve!()
      })
      f.open()
      await screen.findByRole('button', { name: 'Continue' })
      await act(async () => {
        if (guard === 'wallet') f.controls.wallet!(token, 1)
        if (guard === 'network') f.controls.wallet!(owner, 10)
        if (guard === 'quote') f.validate.mockRejectedValue(new Error('Quote changed'))
      })
      fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
      await waitFor(() =>
        expect(f.service.getSnapshot().flows[0].error).toContain(
          guard === 'quote' ? 'Quote changed' : 'Reconnect the reviewed wallet'
        )
      )
      expect(f.execute).toHaveBeenCalledTimes(1)
    }
  )
})

describe.each(['deposit', 'withdraw'] as const)('cross-chain %s overlay', (mode) => {
  it('keeps source completion pending across reopening until destination evidence arrives', async () => {
    const f = fixture(mode, { crossChain: true })
    f.open()
    await waitFor(() => expect(f.execute).toHaveBeenCalledTimes(1))
    await act(async () => f.approval.resolve({ receipt: receipt(approvalHash) }))
    await waitFor(() => expect(f.execute).toHaveBeenCalledTimes(2))
    await act(async () => f.action.resolve({ receipt: receipt(actionHash) }))
    await screen.findByText('Settling destination')
    expect(f.completed).not.toHaveBeenCalled()
    f.close()
    f.open()
    await screen.findByText('Settling destination')
    expect(f.execute).toHaveBeenCalledTimes(2)
    await act(async () => f.settlement.resolve({ outcome: 'delivered', authority: 'overall', observedAt: Date.now() }))
    await screen.findByText('Cross-chain transaction complete')
    expect(f.completed).toHaveBeenCalledTimes(1)
  })
})
