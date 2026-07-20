// @vitest-environment jsdom

import { EventEmitter } from 'node:events'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react'
import { connect, disconnect } from '@wagmi/core'
import { buildDepositBatch } from '@yearn/vault-widget/internal/components/widget/deposit/depositBatch'
import {
  TransactionOverlay,
  type TransactionStep
} from '@yearn/vault-widget/internal/components/widget/shared/TransactionOverlay'
import { buildWithdrawBatch } from '@yearn/vault-widget/internal/components/widget/withdraw/withdrawBatch'
import { useAtomicBatchCapability } from '@yearn/vault-widget/internal/hooks/useAtomicBatchCapability'
import type { TWidgetAnalyticsContext } from '@yearn/vault-widget/internal/utils/analytics'
import { BOLD_ADDRESS, YBOLD_ZAPPER_ADDRESS } from '@yearn/vault-widget/internal/utils/yBold'
import { type VaultWidgetRuntimeOverrides, VaultWidgetRuntimeProvider } from '@yearn/vault-widget/runtime'
import { type PropsWithChildren, StrictMode, useState } from 'react'
import { custom, type EIP1193Provider } from 'viem'
import { base, mainnet } from 'viem/chains'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createConfig, WagmiProvider } from 'wagmi'
import { injected } from 'wagmi/connectors'

vi.mock('react-rewards', () => ({ useReward: () => ({ reward: vi.fn() }) }))

const ACCOUNT = '0x1111111111111111111111111111111111111111'
const OTHER_ACCOUNT = '0x2222222222222222222222222222222222222222'
const VAULT = '0x3333333333333333333333333333333333333333'
const HASH = `0x${'a'.repeat(64)}` as const
const analyticsContext: TWidgetAnalyticsContext = {
  action: 'deposit',
  route: 'direct_deposit',
  source_chain: 1,
  destination_chain: 1,
  batch_capability: 'supported',
  batch_reason: 'eligible',
  approval_required: true
}
const RECEIPT = {
  transactionHash: HASH,
  blockHash: HASH,
  blockNumber: '0x10',
  transactionIndex: '0x0',
  from: ACCOUNT,
  to: VAULT,
  cumulativeGasUsed: '0x5208',
  gasUsed: '0x5208',
  effectiveGasPrice: '0x1',
  contractAddress: null,
  logs: [],
  logsBloom: `0x${'0'.repeat(512)}`,
  status: '0x1',
  type: '0x2'
}

function deferred<T>() {
  const callbacks: { resolve?: (value: T) => void } = {}
  const promise = new Promise<T>((resolve) => {
    callbacks.resolve = resolve
  })
  return { promise, resolve: (value: T) => callbacks.resolve!(value) }
}

function wallet(id: string, atomic = 'supported') {
  const events = new EventEmitter()
  const state = { account: ACCOUNT as string, chainId: 1 }
  const capabilities = vi.fn(async () => ({
    '0x1': { atomic: { status: atomic } },
    '0x2105': { atomic: { status: 'unsupported' } }
  }))
  const sendCalls = vi.fn(async () => ({ id: 'bundle-1' }))
  const callsStatus = vi.fn(async () => ({
    id: 'bundle-1',
    version: '2.0.0',
    chainId: '0x1',
    atomic: true,
    status: 100,
    receipts: [] as object[]
  }))
  const sendTransaction = vi.fn(async () => HASH)
  const request = vi.fn(async ({ method, params }: { method: string; params?: readonly unknown[] }) => {
    if (method === 'eth_accounts' || method === 'eth_requestAccounts') return [state.account]
    if (method === 'eth_chainId') return `0x${state.chainId.toString(16)}`
    if (method === 'wallet_getCapabilities') return capabilities()
    if (method === 'wallet_sendCalls') return sendCalls()
    if (method === 'wallet_getCallsStatus') return callsStatus()
    if (method === 'eth_sendTransaction') return sendTransaction()
    if (method === 'wallet_switchEthereumChain') {
      state.chainId = Number((params![0] as { chainId: string }).chainId)
      events.emit('chainChanged', `0x${state.chainId.toString(16)}`)
      return null
    }
    throw Object.assign(new Error(`Unsupported method ${method}`), { code: 4200 })
  })
  const provider = {
    request,
    on: events.on.bind(events),
    removeListener: events.removeListener.bind(events)
  } as unknown as EIP1193Provider
  return {
    events,
    state,
    request,
    capabilities,
    sendCalls,
    callsStatus,
    sendTransaction,
    connector: injected({ target: { id, name: id, provider }, shimDisconnect: false })
  }
}

async function setup(runtime: VaultWidgetRuntimeOverrides = {}) {
  const first = wallet('rabby')
  const second = wallet('walletchan', 'unsupported')
  const publicRequest = vi.fn(async ({ method }: { method: string }) => {
    if (method === 'eth_getTransactionReceipt') return RECEIPT
    if (method === 'eth_blockNumber') return '0x20'
    if (method === 'eth_chainId') return '0x1'
    throw new Error(`Unexpected public RPC ${method}`)
  })
  const config = createConfig({
    chains: [mainnet, base],
    connectors: [first.connector, second.connector],
    storage: null,
    multiInjectedProviderDiscovery: false,
    transports: { 1: custom({ request: publicRequest }), 8453: custom({ request: publicRequest }) }
  })
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  await connect(config, { connector: config.connectors[0] })
  const createSubmitted = vi.fn(async () => 'notification-1')
  const update = vi.fn(async () => {})
  const wrapper = ({ children }: PropsWithChildren) => (
    <WagmiProvider config={config} reconnectOnMount={false}>
      <QueryClientProvider client={queryClient}>
        <VaultWidgetRuntimeProvider value={{ notifications: { createSubmitted, update }, ...runtime }}>
          {children}
        </VaultWidgetRuntimeProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
  return { first, second, config, wrapper, queryClient, createSubmitted, update, publicRequest }
}

function step(
  batch = buildDepositBatch({
    routeType: 'DIRECT_DEPOSIT',
    account: ACCOUNT,
    depositToken: BOLD_ADDRESS,
    amount: 10n,
    currentAllowance: 0n,
    chainId: 1,
    vaultAddress: VAULT,
    approvalSpenderAddress: VAULT
  })
): TransactionStep {
  return {
    id: 'deposit-batch',
    batch,
    prepare: { isSuccess: true, data: { request: {} } } as never,
    label: 'Approve & Deposit',
    confirmMessage: 'Confirm in wallet',
    successTitle: 'Deposit successful!',
    successMessage: 'Done',
    isEnabled: true,
    completesFlow: true,
    notification: { amount: '10', fromAddress: BOLD_ADDRESS, fromChainId: 1, fromSymbol: 'BOLD', type: 'deposit' }
  }
}

function Overlay({
  transactionStep = step(),
  onAllComplete = vi.fn(),
  context = analyticsContext
}: {
  transactionStep?: TransactionStep
  onAllComplete?: () => void
  context?: TWidgetAnalyticsContext
}) {
  const [open, setOpen] = useState(true)
  return (
    <>
      <button onClick={() => setOpen(!open)} type="button">
        Toggle overlay
      </button>
      <TransactionOverlay
        analyticsContext={context}
        isOpen={open}
        onClose={() => setOpen(false)}
        step={transactionStep}
        onAllComplete={onAllComplete}
      />
    </>
  )
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('atomic wallet capabilities', () => {
  it('uses the requested chain, and isolates capabilities by extension and account', async () => {
    const h = await setup()
    const { result, rerender } = renderHook(({ account, chainId }) => useAtomicBatchCapability({ account, chainId }), {
      wrapper: h.wrapper,
      initialProps: { account: ACCOUNT as `0x${string}`, chainId: 1 }
    })
    await waitFor(() => expect(result.current.supported).toBe(true))
    expect(h.first.request).toHaveBeenCalledWith(
      { method: 'wallet_getCapabilities', params: [ACCOUNT, ['0x1']] },
      undefined
    )
    rerender({ account: ACCOUNT, chainId: 8453 })
    expect(result.current.supported).toBe(false)
    await waitFor(() => expect(h.first.capabilities).toHaveBeenCalledTimes(2))
    rerender({ account: ACCOUNT, chainId: 1 })
    await waitFor(() => expect(result.current.supported).toBe(true))
    await act(async () => {
      await connect(h.config, { connector: h.config.connectors[1] })
    })
    await waitFor(() => expect(h.second.capabilities).toHaveBeenCalled())
    expect(result.current.supported).toBe(false)
    await act(async () => {
      await connect(h.config, { connector: h.config.connectors[0] })
    })
    await waitFor(() => expect(result.current.supported).toBe(true))
    h.first.capabilities.mockResolvedValue({
      '0x1': { atomic: { status: 'unsupported' } },
      '0x2105': { atomic: { status: 'unsupported' } }
    })
    h.first.state.account = OTHER_ACCOUNT
    await act(async () => {
      h.first.events.emit('accountsChanged', [OTHER_ACCOUNT])
    })
    rerender({ account: OTHER_ACCOUNT, chainId: 1 })
    expect(result.current.supported).toBe(false)
    await act(async () => {
      await disconnect(h.config)
    })
    expect(result.current.supported).toBe(false)
  })

  it('does not block on an unsupported capability RPC or use a stale result from another wallet', async () => {
    const h = await setup()
    const pending = deferred<Awaited<ReturnType<typeof h.first.capabilities>>>()
    h.first.capabilities.mockReturnValue(pending.promise)
    const { result } = renderHook(() => useAtomicBatchCapability({ account: ACCOUNT, chainId: 1 }), {
      wrapper: h.wrapper
    })
    expect(result.current.supported).toBe(false)
    await waitFor(() => expect(h.first.capabilities).toHaveBeenCalled())
    h.second.capabilities.mockRejectedValue(Object.assign(new Error('Unsupported method'), { code: 4200 }))
    await act(async () => {
      await connect(h.config, { connector: h.config.connectors[1] })
    })
    await waitFor(() => expect(h.second.capabilities).toHaveBeenCalledTimes(1))
    await act(async () => {
      pending.resolve({ '0x1': { atomic: { status: 'ready' } }, '0x2105': { atomic: { status: 'unsupported' } } })
    })
    expect(result.current.supported).toBe(false)
  })

  it('queries the mapped execution chain', async () => {
    const h = await setup({ chains: { resolveExecutionChainId: () => 8453 } })
    const { result } = renderHook(() => useAtomicBatchCapability({ account: ACCOUNT, chainId: 1 }), {
      wrapper: h.wrapper
    })
    await waitFor(() => expect(h.first.capabilities).toHaveBeenCalled())
    expect(h.first.request).toHaveBeenCalledWith(
      { method: 'wallet_getCapabilities', params: [ACCOUNT, ['0x2105']] },
      undefined
    )
    expect(result.current.supported).toBe(false)
  })
})

describe('atomic transaction overlay', () => {
  it('keeps Safe queue tracking until execution', async () => {
    const safeId = `0x${'b'.repeat(64)}` as const
    const getTransactionDetails = vi.fn().mockResolvedValue({ safeTxHash: safeId, status: 'awaiting-confirmations' })
    const track = vi.fn()
    const h = await setup({ safe: { isSafe: true, getTransactionDetails }, analytics: { track } })
    h.first.sendCalls.mockResolvedValue({ id: safeId })
    render(<Overlay />, { wrapper: h.wrapper })
    await screen.findByText(/Your transaction has been submitted to your Safe/)
    expect(track).toHaveBeenCalledWith(
      'widget_step_result',
      expect.objectContaining({
        execution_mode: 'safe_batch',
        outcome: 'awaiting_execution'
      })
    )
    expect(track.mock.calls.filter(([event]) => event === 'widget_flow_result')).toHaveLength(0)
    expect(h.createSubmitted).toHaveBeenCalledWith(expect.objectContaining({ txHash: safeId }))
    expect(h.publicRequest).not.toHaveBeenCalledWith(
      expect.objectContaining({ method: 'eth_getTransactionReceipt' }),
      undefined
    )
    getTransactionDetails.mockResolvedValue({ safeTxHash: safeId, status: 'success', executionTxHash: HASH })
    await act(async () => {
      await h.queryClient.refetchQueries({ queryKey: ['vault-widget', 'safe-transaction-details'] })
    })
    await screen.findByText('Deposit successful!')
    expect(h.createSubmitted).toHaveBeenCalledTimes(1)
    expect(track).toHaveBeenCalledWith('widget_flow_result', expect.objectContaining({ outcome: 'success' }))
  })

  it('keeps bridge tracking on the real source hash for a cross-chain batch', async () => {
    const track = vi.fn()
    const h = await setup({ analytics: { track } })
    h.first.callsStatus.mockResolvedValue({
      id: 'bundle-1',
      version: '2.0.0',
      chainId: '0x1',
      atomic: true,
      status: 200,
      receipts: [RECEIPT]
    })
    const transactionStep = step()
    transactionStep.notification = {
      ...transactionStep.notification!,
      type: 'crosschain zap',
      bridgeProtocol: 'relay',
      toChainId: 8453
    }
    render(<Overlay transactionStep={transactionStep} />, { wrapper: h.wrapper })
    await screen.findByText(/Bridging to/)
    expect(track).toHaveBeenCalledWith('widget_step_result', expect.objectContaining({ outcome: 'confirmed' }))
    expect(track.mock.calls.filter(([event]) => event === 'widget_flow_result')).toHaveLength(0)
    fireEvent.click(screen.getByText('Toggle overlay'))
    expect(track).toHaveBeenCalledWith('widget_flow_result', expect.objectContaining({ outcome: 'pending_or_unknown' }))
    expect(h.createSubmitted).toHaveBeenCalledTimes(1)
    expect(h.createSubmitted).toHaveBeenCalledWith(expect.objectContaining({ txHash: HASH, type: 'crosschain zap' }))
    expect(h.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'submitted',
        bridgeStatus: 'pending',
        receipt: expect.objectContaining({ transactionHash: HASH })
      })
    )
  })

  it('tracks the submitting extension and owner after switching wallets', async () => {
    const h = await setup()
    render(<Overlay />, { wrapper: h.wrapper })
    await screen.findByText('Approve & Deposit transaction pending')
    h.second.state.account = OTHER_ACCOUNT
    await act(async () => {
      await connect(h.config, { connector: h.config.connectors[1] })
    })
    h.first.callsStatus.mockResolvedValue({
      id: 'bundle-1',
      version: '2.0.0',
      chainId: '0x1',
      atomic: true,
      status: 200,
      receipts: [RECEIPT]
    })
    await act(async () => {
      await h.queryClient.refetchQueries({ queryKey: ['vault-widget', 'calls-status'] })
    })
    await screen.findByText('Deposit successful!')
    expect(h.second.callsStatus).not.toHaveBeenCalled()
    expect(h.createSubmitted).toHaveBeenCalledWith(expect.objectContaining({ ownerAddress: ACCOUNT, txHash: HASH }))
  })

  it('keeps polling after a tracking error without resubmitting', async () => {
    const h = await setup()
    h.first.callsStatus.mockRejectedValueOnce(Object.assign(new Error('Temporary tracking error'), { code: 4200 }))
    render(<Overlay />, { wrapper: h.wrapper })
    await screen.findByText('Approve & Deposit transaction pending')
    await waitFor(() => expect(h.first.callsStatus).toHaveBeenCalled())
    expect(screen.queryByText('Transaction failed')).toBeNull()
    h.first.callsStatus.mockResolvedValue({
      id: 'bundle-1',
      version: '2.0.0',
      chainId: '0x1',
      atomic: true,
      status: 200,
      receipts: [RECEIPT]
    })
    await act(async () => {
      await h.queryClient.refetchQueries({ queryKey: ['vault-widget', 'calls-status'] })
    })
    await screen.findByText('Deposit successful!')
    expect(h.first.sendCalls).toHaveBeenCalledTimes(1)
    expect(h.first.sendTransaction).not.toHaveBeenCalled()
  })

  it.each(['yearn', 'ybold-deposit', 'ybold-withdraw'] as const)(
    'submits and confirms %s as one atomic request',
    async (route) => {
      const track = vi.fn()
      const h = await setup({ analytics: { track } })
      const batch =
        route === 'yearn'
          ? step().batch
          : route === 'ybold-deposit'
            ? buildDepositBatch({
                routeType: 'YBOLD_ZAPPER',
                account: ACCOUNT,
                depositToken: BOLD_ADDRESS,
                amount: 10n,
                chainId: 1,
                vaultAddress: VAULT,
                approvalSpenderAddress: YBOLD_ZAPPER_ADDRESS
              })
            : buildWithdrawBatch({
                routeType: 'YBOLD_ZAPPER_WITHDRAW',
                account: ACCOUNT,
                sourceToken: VAULT,
                amount: 10n,
                chainId: 1,
                approvalSpenderAddress: YBOLD_ZAPPER_ADDRESS,
                maxLoss: 50n
              })
      const onAllComplete = vi.fn()
      render(
        <StrictMode>
          <h.wrapper>
            <Overlay
              transactionStep={step(batch)}
              onAllComplete={onAllComplete}
              context={{
                ...analyticsContext,
                route:
                  route === 'yearn' ? 'direct_deposit' : route === 'ybold-deposit' ? 'ybold_zap_in' : 'ybold_zap_out',
                action: route === 'ybold-withdraw' ? 'withdraw' : 'deposit'
              }}
            />
          </h.wrapper>
        </StrictMode>
      )
      await waitFor(() => expect(h.first.sendCalls).toHaveBeenCalledTimes(1))
      expect(
        h.first.request.mock.calls.find(([request]) => request.method === 'wallet_sendCalls')?.[0].params?.[0]
      ).toMatchObject({
        atomicRequired: true,
        from: ACCOUNT,
        chainId: '0x1',
        calls: batch?.calls.map((call) => ({ to: call.to, data: call.data, value: undefined }))
      })
      await screen.findByText('Approve & Deposit transaction pending')
      expect(track.mock.calls.filter(([event]) => event === 'widget_flow_started')).toHaveLength(1)
      expect(track.mock.calls.filter(([event]) => event === 'widget_step_started')).toHaveLength(1)
      expect(track.mock.calls.filter(([event]) => event === 'widget_flow_result')).toHaveLength(0)
      expect(h.createSubmitted).not.toHaveBeenCalled()
      expect(h.publicRequest).not.toHaveBeenCalledWith(expect.objectContaining({ method: 'eth_getTransactionReceipt' }))
      expect(screen.queryByText('Deposit successful!')).toBeNull()
      h.first.callsStatus.mockResolvedValue({
        id: 'bundle-1',
        version: '2.0.0',
        chainId: '0x1',
        atomic: true,
        status: 200,
        receipts: [RECEIPT]
      })
      await act(async () => {
        await h.queryClient.refetchQueries({ queryKey: ['vault-widget', 'calls-status'] })
      })
      await screen.findByText('Deposit successful!')
      expect(h.createSubmitted).toHaveBeenCalledTimes(1)
      expect(h.createSubmitted).toHaveBeenCalledWith(expect.objectContaining({ txHash: HASH, ownerAddress: ACCOUNT }))
      expect(h.update).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'notification-1',
          status: 'success',
          receipt: expect.objectContaining({ transactionHash: HASH })
        })
      )
      expect(onAllComplete).toHaveBeenCalledTimes(1)
      expect(h.first.sendTransaction).not.toHaveBeenCalled()
      expect(track.mock.calls.filter(([event]) => event === 'widget_flow_result')).toEqual([
        [
          'widget_flow_result',
          expect.objectContaining({
            outcome: 'success',
            batch_used: true,
            retry_count: 0,
            execution_mode: 'atomic_batch'
          })
        ]
      ])
      expect(JSON.stringify(track.mock.calls)).not.toContain(ACCOUNT)
      expect(JSON.stringify(track.mock.calls)).not.toContain(HASH)
    }
  )

  it('clears a rejected request and can reopen without sending separate transactions', async () => {
    const track = vi.fn()
    const h = await setup({ analytics: { track } })
    h.first.sendCalls.mockRejectedValueOnce(Object.assign(new Error('User rejected the request.'), { code: 4001 }))
    render(<Overlay />, { wrapper: h.wrapper })
    await waitFor(() => expect(h.first.sendCalls).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(screen.queryByText('Confirm in your wallet')).toBeNull())
    expect(track).toHaveBeenCalledWith('widget_flow_result', expect.objectContaining({ outcome: 'rejected' }))
    fireEvent.click(screen.getByText('Toggle overlay'))
    await waitFor(() => expect(h.first.sendCalls).toHaveBeenCalledTimes(2))
    await screen.findByText('Approve & Deposit transaction pending')
    expect(h.first.sendTransaction).not.toHaveBeenCalled()
  })

  it('reports failed bundles and lets a new attempt succeed without stale notification writes', async () => {
    const track = vi.fn()
    const h = await setup({ analytics: { track } })
    const registration = deferred<string>()
    h.createSubmitted.mockReturnValueOnce(registration.promise).mockResolvedValue('notification-2')
    h.first.callsStatus.mockResolvedValueOnce({
      id: 'bundle-1',
      version: '2.0.0',
      chainId: '0x1',
      atomic: true,
      status: 500,
      receipts: [{ ...RECEIPT, status: '0x0' }]
    })
    const onAllComplete = vi.fn()
    render(<Overlay onAllComplete={onAllComplete} />, { wrapper: h.wrapper })
    await screen.findByText('Transaction failed. Please try again.')
    expect(onAllComplete).not.toHaveBeenCalled()
    h.first.sendCalls.mockResolvedValue({ id: 'bundle-2' })
    h.first.callsStatus.mockResolvedValue({
      id: 'bundle-2',
      version: '2.0.0',
      chainId: '0x1',
      atomic: true,
      status: 200,
      receipts: [RECEIPT]
    })
    fireEvent.click(screen.getByText('Try Again'))
    await screen.findByText('Deposit successful!')
    await act(async () => {
      registration.resolve('notification-1')
    })
    expect(h.createSubmitted).toHaveBeenCalledTimes(2)
    expect(h.update).toHaveBeenCalledWith(expect.objectContaining({ id: 'notification-1', status: 'error' }))
    expect(h.update).toHaveBeenCalledWith(expect.objectContaining({ id: 'notification-2', status: 'success' }))
    expect(h.first.sendCalls).toHaveBeenCalledTimes(2)
    expect(onAllComplete).toHaveBeenCalledTimes(1)
    expect(track.mock.calls.filter(([event]) => event === 'widget_flow_result')).toEqual([
      ['widget_flow_result', expect.objectContaining({ outcome: 'success', retry_count: 1 })]
    ])
  })

  it('waits for notification persistence before recording a fast receipt', async () => {
    const h = await setup()
    const registration = deferred<string>()
    h.createSubmitted.mockReturnValue(registration.promise)
    h.first.callsStatus.mockResolvedValue({
      id: 'bundle-1',
      version: '2.0.0',
      chainId: '0x1',
      atomic: true,
      status: 200,
      receipts: [RECEIPT]
    })
    render(<Overlay />, { wrapper: h.wrapper })
    await waitFor(() => expect(h.createSubmitted).toHaveBeenCalledTimes(1))
    expect(h.update).not.toHaveBeenCalled()
    await act(async () => {
      registration.resolve('notification-1')
    })
    await screen.findByText('Deposit successful!')
    expect(h.createSubmitted).toHaveBeenCalledTimes(1)
    expect(h.update).toHaveBeenCalledTimes(1)
  })
})
