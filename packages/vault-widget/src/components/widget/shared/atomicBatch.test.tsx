// @vitest-environment jsdom

import { EventEmitter } from 'node:events'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { connect, disconnect } from '@wagmi/core'
import { useAtomicBatchCapability } from '@yearn/vault-widget/internal/hooks/useAtomicBatchCapability'
import { type VaultWidgetRuntimeOverrides, VaultWidgetRuntimeProvider } from '@yearn/vault-widget/runtime'
import type { PropsWithChildren } from 'react'
import { custom, type EIP1193Provider } from 'viem'
import { base, mainnet } from 'viem/chains'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createConfig, WagmiProvider } from 'wagmi'
import { injected } from 'wagmi/connectors'

const ACCOUNT = '0x1111111111111111111111111111111111111111'
const OTHER_ACCOUNT = '0x2222222222222222222222222222222222222222'
const VAULT = '0x3333333333333333333333333333333333333333'
const HASH = `0x${'a'.repeat(64)}` as const
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
