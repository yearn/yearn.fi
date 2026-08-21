import type { Config } from '@wagmi/core'
import {
  createWagmiVaultWidgetExecutionAdapter,
  type TWagmiVaultWidgetExecutionAdapterOptions
} from '@yearn/vault-widget/wagmi'
import {
  BaseError,
  createClient,
  createPublicClient,
  custom,
  defineChain,
  type Hash,
  MethodNotFoundRpcError,
  MethodNotSupportedRpcError,
  type ReplacementReturnType,
  type TransactionReceipt
} from 'viem'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const wagmiActions = vi.hoisted(() => ({
  getAccount: vi.fn(),
  getConnectorClient: vi.fn(),
  getPublicClient: vi.fn(),
  sendCalls: vi.fn(),
  sendTransaction: vi.fn(),
  switchChain: vi.fn(),
  waitForCallsStatus: vi.fn()
}))

vi.mock('@wagmi/core/actions', () => wagmiActions)

const account = '0x1111111111111111111111111111111111111111'
const canonicalChainId = 1
const executionChainId = 73_571
const executionChain = defineChain({
  id: executionChainId,
  name: 'Execution test chain',
  nativeCurrency: { decimals: 18, name: 'Ether', symbol: 'ETH' },
  rpcUrls: { default: { http: ['http://execution.test'] } }
})
const transactionHash = `0x${'22'.repeat(32)}` as Hash
const otherTransactionHash = `0x${'33'.repeat(32)}` as Hash
const config = {} as Config
const connector = { id: 'test-connector' }
const request = {
  chainId: canonicalChainId,
  data: '0x1234',
  to: '0x2222222222222222222222222222222222222222'
} as const
const requestWithValue = { ...request, value: 42n }
const successfulReceipt = {
  status: 'success',
  transactionHash
} as TransactionReceipt

function createReplacement(
  reason: ReplacementReturnType['reason'],
  replacementReceipt: TransactionReceipt
): ReplacementReturnType {
  return {
    reason,
    replacedTransaction: { hash: transactionHash } as ReplacementReturnType['replacedTransaction'],
    transaction: { hash: replacementReceipt.transactionHash } as ReplacementReturnType['transaction'],
    transactionReceipt: replacementReceipt
  }
}

function createReceiptPublicClient(status: '0x0' | '0x1', hash: Hash = transactionHash) {
  const transportRequest = vi.fn().mockResolvedValue({
    blockHash: `0x${'44'.repeat(32)}`,
    blockNumber: '0x1',
    contractAddress: null,
    cumulativeGasUsed: '0x5208',
    effectiveGasPrice: '0x1',
    from: account,
    gasUsed: '0x5208',
    logs: [],
    logsBloom: `0x${'00'.repeat(256)}`,
    status,
    to: request.to,
    transactionHash: hash,
    transactionIndex: '0x0',
    type: '0x2'
  })
  const publicClient = createPublicClient({
    chain: executionChain,
    transport: custom({ request: transportRequest })
  })
  return { publicClient, transportRequest }
}

type TAdapterOverrides = Omit<Partial<TWagmiVaultWidgetExecutionAdapterOptions>, 'config'>

function createAdapter(overrides: TAdapterOverrides = {}) {
  return createWagmiVaultWidgetExecutionAdapter({
    config,
    resolveExecutionChainId: (chainId) => (chainId === canonicalChainId ? executionChainId : undefined),
    ...overrides
  })
}

beforeEach(() => {
  vi.resetAllMocks()
  wagmiActions.getAccount.mockReturnValue({ connector })
  wagmiActions.getConnectorClient.mockResolvedValue({})
})

describe('createWagmiVaultWidgetExecutionAdapter', () => {
  it('rejects invalid polling configuration during construction', () => {
    expect(() => createAdapter({ safePollingIntervalMs: -1 })).toThrow(
      'safePollingIntervalMs must be a non-negative integer'
    )
    expect(() => createAdapter({ safePollingIntervalMs: 1.5 })).toThrow(
      'safePollingIntervalMs must be a non-negative integer'
    )
    expect(() => createAdapter({ safeTimeoutMs: 0 })).toThrow('safeTimeoutMs must be a positive integer')
  })

  it.each([undefined, 0, -1, 1.5, Number.NaN])(
    'rejects invalid execution-chain resolver output %s before invoking Wagmi',
    async (resolvedChainId) => {
      const adapter = createAdapter({ resolveExecutionChainId: () => resolvedChainId })

      await expect(adapter.switchChain({ chainId: canonicalChainId })).rejects.toThrow(
        `Chain ${canonicalChainId} is not enabled for execution`
      )
      expect(wagmiActions.switchChain).not.toHaveBeenCalled()
    }
  )

  it('uses identity chain mapping when no resolver is supplied', async () => {
    wagmiActions.switchChain.mockResolvedValue({ id: canonicalChainId })
    const adapter = createWagmiVaultWidgetExecutionAdapter({ config })

    await adapter.switchChain({ chainId: canonicalChainId })

    expect(wagmiActions.switchChain).toHaveBeenCalledWith(config, { chainId: canonicalChainId })
  })
})

describe('Wagmi EOA execution adapter', () => {
  it('maps canonical chains before switching', async () => {
    wagmiActions.switchChain.mockResolvedValue({ id: executionChainId })
    const adapter = createAdapter()

    await adapter.switchChain({ chainId: canonicalChainId })

    expect(wagmiActions.switchChain).toHaveBeenCalledWith(config, { chainId: executionChainId })
  })

  it('estimates on the execution chain and sends a 10% gas buffer', async () => {
    const estimateGas = vi.fn().mockResolvedValue(100_000n)
    wagmiActions.getPublicClient.mockReturnValue({ estimateGas })
    wagmiActions.sendTransaction.mockResolvedValue(transactionHash)
    const adapter = createAdapter()

    await expect(adapter.execute({ account, request })).resolves.toBe(transactionHash)

    expect(wagmiActions.getAccount).toHaveBeenCalledWith(config)
    expect(wagmiActions.getConnectorClient).toHaveBeenCalledWith(config, {
      account,
      assertChainId: false,
      chainId: executionChainId,
      connector
    })
    expect(wagmiActions.getPublicClient).toHaveBeenCalledWith(config, { chainId: executionChainId })
    expect(estimateGas).toHaveBeenCalledWith({
      account,
      data: request.data,
      to: request.to,
      value: 0n
    })
    expect(wagmiActions.sendTransaction).toHaveBeenCalledWith(config, {
      account,
      chainId: executionChainId,
      data: request.data,
      gas: 110_000n,
      connector,
      to: request.to,
      value: 0n
    })
    expect(estimateGas.mock.invocationCallOrder[0]).toBeLessThan(
      wagmiActions.sendTransaction.mock.invocationCallOrder[0]!
    )
    expect(request.chainId).toBe(canonicalChainId)
  })

  it('does not invoke the wallet when simulation fails', async () => {
    const simulationError = new Error('execution reverted')
    wagmiActions.getPublicClient.mockReturnValue({ estimateGas: vi.fn().mockRejectedValue(simulationError) })
    const adapter = createAdapter()

    await expect(adapter.execute({ account, request })).rejects.toBe(simulationError)
    expect(wagmiActions.sendTransaction).not.toHaveBeenCalled()
  })

  it('does not let optional nonce lookups delay wallet submission indefinitely', async () => {
    vi.useFakeTimers()
    try {
      const estimateGas = vi.fn().mockResolvedValue(100_000n)
      const requestPendingForever = vi.fn(() => new Promise(() => undefined))
      wagmiActions.getPublicClient.mockReturnValue({ estimateGas, request: requestPendingForever })
      wagmiActions.getConnectorClient.mockResolvedValue({ request: requestPendingForever })
      wagmiActions.sendTransaction.mockResolvedValue(transactionHash)
      const adapter = createAdapter()

      const executePromise = adapter.execute({ account, request })
      await vi.advanceTimersByTimeAsync(0)

      expect(wagmiActions.sendTransaction).toHaveBeenCalledOnce()
      await vi.advanceTimersByTimeAsync(3_000)

      await expect(executePromise).resolves.toBe(transactionHash)
      expect(requestPendingForever).toHaveBeenCalledTimes(2)
    } finally {
      vi.useRealTimers()
    }
  })

  it('rejects execution when no public client is configured', async () => {
    wagmiActions.getPublicClient.mockReturnValue(undefined)
    const adapter = createAdapter()

    await expect(adapter.execute({ account, request })).rejects.toThrow(
      `No public client is configured for chain ${executionChainId}`
    )
    expect(wagmiActions.sendTransaction).not.toHaveBeenCalled()
  })

  it('rejects an invalid transaction hash returned by the wallet', async () => {
    wagmiActions.getPublicClient.mockReturnValue({ estimateGas: vi.fn().mockResolvedValue(100_000n) })
    wagmiActions.sendTransaction.mockResolvedValue('0x1234')
    const adapter = createAdapter()

    await expect(adapter.execute({ account, request })).rejects.toThrow('Wallet returned an invalid transaction hash')
  })

  it('maps receipt lookup to the execution chain and returns a matching successful receipt', async () => {
    const waitForTransactionReceipt = vi.fn().mockResolvedValue(successfulReceipt)
    wagmiActions.getPublicClient.mockReturnValue({ waitForTransactionReceipt })
    const adapter = createAdapter()

    await expect(adapter.waitForReceipt({ chainId: canonicalChainId, hash: transactionHash })).resolves.toEqual({
      receipt: successfulReceipt
    })
    expect(wagmiActions.getPublicClient).toHaveBeenCalledWith(config, { chainId: executionChainId })
    expect(waitForTransactionReceipt).toHaveBeenCalledWith({
      confirmations: 1,
      hash: transactionHash,
      onReplaced: expect.any(Function),
      timeout: 0
    })
  })

  it('detects the transaction first and then applies the canonical-chain confirmation policy', async () => {
    const waitForTransactionReceipt = vi.fn().mockResolvedValue(successfulReceipt)
    const resolveConfirmations = vi.fn().mockReturnValue(2)
    wagmiActions.getPublicClient.mockReturnValue({ waitForTransactionReceipt })
    const adapter = createAdapter({ resolveConfirmations })

    await expect(adapter.waitForReceipt({ chainId: canonicalChainId, hash: transactionHash })).resolves.toEqual({
      receipt: successfulReceipt
    })
    expect(resolveConfirmations).toHaveBeenCalledWith(canonicalChainId)
    expect(waitForTransactionReceipt).toHaveBeenNthCalledWith(1, {
      confirmations: 1,
      hash: transactionHash,
      onReplaced: expect.any(Function),
      timeout: 0
    })
    expect(waitForTransactionReceipt).toHaveBeenNthCalledWith(2, {
      checkReplacement: false,
      confirmations: 2,
      hash: transactionHash,
      timeout: 0
    })
  })

  it('returns a reverted receipt from the public client for executor classification', async () => {
    const { publicClient, transportRequest } = createReceiptPublicClient('0x0')
    wagmiActions.getPublicClient.mockReturnValue(publicClient)
    const adapter = createAdapter()

    await expect(adapter.waitForReceipt({ chainId: canonicalChainId, hash: transactionHash })).resolves.toMatchObject({
      receipt: {
        status: 'reverted',
        transactionHash
      }
    })
    expect(transportRequest.mock.calls[0]?.[0]).toEqual({
      method: 'eth_getTransactionReceipt',
      params: [transactionHash]
    })
  })

  it.each(['repriced', 'cancelled', 'replaced'] as const)(
    'detects a real Viem %s replacement across connector and public identity sources',
    async (expectedReason) => {
      const isCancellation = expectedReason === 'cancelled'
      const blockHash = `0x${'44'.repeat(32)}` as Hash
      const blockNumberRequestCount = { current: 0 }
      const replacementAccount = '0x96A489A533bA0913dD8E507e6D985a45BC783566'
      const replacementTarget = '0xBe53A109B494E5c9f97b9Cd39Fe969BE68BF6204'
      const replacementRequest = { ...request, to: replacementTarget } as const
      const replacementInput =
        expectedReason === 'replaced' ? ('0xabcd' as const) : isCancellation ? ('0x' as const) : replacementRequest.data
      const replacementTo = (
        expectedReason === 'replaced'
          ? '0x4444444444444444444444444444444444444444'
          : isCancellation
            ? replacementAccount
            : replacementTarget
      ).toLowerCase()
      const blockReplacementFrom = isCancellation ? replacementAccount : replacementAccount.toLowerCase()
      const blockReplacementTo = isCancellation ? replacementAccount : replacementTo
      const connectorRpcRequest = vi.fn(async ({ method, params }: { method: string; params?: readonly unknown[] }) => {
        if (method === 'eth_getTransactionCount') {
          if (expectedReason === 'repriced') return '0x120'
          throw new Error('Wallet nonce lookup unavailable')
        }
        if (method === 'eth_getTransactionByHash') {
          if (expectedReason !== 'repriced' || params?.[0] !== transactionHash) return null
          return {
            blockHash: null,
            blockNumber: null,
            chainId: '0x1',
            from: replacementAccount,
            gas: '0x5208',
            hash: transactionHash,
            input: replacementRequest.data,
            maxFeePerGas: '0x77359400',
            maxPriorityFeePerGas: '0x77359400',
            nonce: '0x120',
            to: replacementTarget,
            transactionIndex: null,
            type: '0x2',
            value: '0x0'
          }
        }
        throw new Error(`Unexpected connector RPC method: ${method}`)
      })
      const publicRpcRequest = vi.fn(async ({ method, params }: { method: string; params?: readonly unknown[] }) => {
        if (method === 'eth_estimateGas') return '0x186a0'
        if (method === 'eth_getTransactionCount') return expectedReason === 'repriced' ? '0x121' : '0x120'
        if (method === 'eth_blockNumber') {
          blockNumberRequestCount.current += 1
          return blockNumberRequestCount.current === 1 ? '0x10' : '0x11'
        }
        if (method === 'eth_getTransactionByHash') return null
        if (method === 'eth_getTransactionReceipt') {
          if (params?.[0] === transactionHash) return null
          if (params?.[0] === otherTransactionHash) {
            return {
              blockHash,
              blockNumber: '0x10',
              contractAddress: null,
              cumulativeGasUsed: '0x5208',
              effectiveGasPrice: '0x3b9aca00',
              from: replacementAccount.toLowerCase(),
              gasUsed: '0x5208',
              logs: [],
              logsBloom: `0x${'00'.repeat(256)}`,
              status: '0x1',
              to: replacementTo,
              transactionHash: otherTransactionHash,
              transactionIndex: '0x0',
              type: '0x2'
            }
          }
        }
        if (method === 'eth_getBlockByNumber') {
          return {
            hash: blockHash,
            number: '0x10',
            timestamp: '0x1',
            transactions: [
              {
                blockHash,
                blockNumber: '0x10',
                chainId: '0x1',
                from: blockReplacementFrom,
                gas: '0x5208',
                hash: otherTransactionHash,
                input: replacementInput,
                maxFeePerGas: '0x77359400',
                maxPriorityFeePerGas: '0x77359400',
                nonce: '0x120',
                to: blockReplacementTo,
                transactionIndex: '0x0',
                type: '0x2',
                value: '0x0'
              }
            ]
          }
        }
        throw new Error(`Unexpected public RPC method: ${method}`)
      })
      const connectorClient = createClient({
        chain: executionChain,
        pollingInterval: 1,
        transport: custom({ request: connectorRpcRequest })
      })
      const publicClient = createPublicClient({
        chain: executionChain,
        pollingInterval: 1,
        transport: custom({ request: publicRpcRequest })
      })
      wagmiActions.getConnectorClient.mockResolvedValue(connectorClient)
      wagmiActions.getPublicClient.mockReturnValue(publicClient)
      wagmiActions.sendTransaction.mockResolvedValue(transactionHash)
      const adapter = createAdapter({ resolveConfirmations: () => 2 })

      await adapter.execute({ account: replacementAccount, request: replacementRequest })

      const receiptPromise = adapter.waitForReceipt({ chainId: canonicalChainId, hash: transactionHash })
      if (expectedReason === 'replaced') {
        await expect(receiptPromise).rejects.toThrow('Wallet returned an unverifiable transaction replacement')
      } else {
        await expect(receiptPromise).resolves.toMatchObject({
          receipt: { status: 'success', transactionHash: otherTransactionHash },
          replacement: { reason: expectedReason, replacedHash: transactionHash }
        })
      }
      expect(
        connectorRpcRequest.mock.calls.some(
          ([rpc]) => rpc.method === 'eth_getTransactionByHash' && rpc.params?.[0] === transactionHash
        )
      ).toBe(true)
      expect(connectorRpcRequest.mock.calls.some(([rpc]) => rpc.method === 'eth_getTransactionCount')).toBe(true)
      expect(publicRpcRequest.mock.calls.some(([rpc]) => rpc.method === 'eth_getTransactionCount')).toBe(true)
      expect(
        publicRpcRequest.mock.calls.some(
          ([rpc]) => rpc.method === 'eth_getTransactionByHash' && rpc.params?.[0] === transactionHash
        )
      ).toBe(true)
      expect(blockNumberRequestCount.current).toBeGreaterThanOrEqual(2)
    }
  )

  it('rejects replacement information that does not match the mined receipt', async () => {
    const replacementReceipt = { ...successfulReceipt, transactionHash: otherTransactionHash } as TransactionReceipt
    const waitForTransactionReceipt = vi.fn(
      async ({ onReplaced }: { onReplaced?: (replacement: ReplacementReturnType) => void }) => {
        onReplaced?.({
          ...createReplacement('repriced', replacementReceipt),
          transaction: { hash: transactionHash } as ReplacementReturnType['transaction']
        })
        return replacementReceipt
      }
    )
    wagmiActions.getPublicClient.mockReturnValue({ waitForTransactionReceipt })
    const adapter = createAdapter()

    await expect(adapter.waitForReceipt({ chainId: canonicalChainId, hash: transactionHash })).rejects.toThrow(
      'Wallet returned a receipt for an unexpected transaction'
    )
  })

  it.each([
    {
      expectedError: 'Wallet returned an invalid transaction receipt',
      receipt: { ...successfulReceipt, transactionHash: '0x1234' }
    },
    {
      expectedError: 'Wallet returned a receipt for an unexpected transaction',
      receipt: { ...successfulReceipt, transactionHash: otherTransactionHash }
    }
  ])('rejects an invalid receipt: $expectedError', async ({ expectedError, receipt }) => {
    wagmiActions.getPublicClient.mockReturnValue({ waitForTransactionReceipt: vi.fn().mockResolvedValue(receipt) })
    const adapter = createAdapter()

    await expect(adapter.waitForReceipt({ chainId: canonicalChainId, hash: transactionHash })).rejects.toThrow(
      expectedError
    )
  })
})

describe('Wagmi Safe proposal adapter', () => {
  it('simulates an ordered atomic batch before submitting it on the mapped execution chain', async () => {
    const simulateBlocks = vi.fn().mockResolvedValue([
      {
        calls: [{ status: 'success' }, { status: 'success' }]
      }
    ])
    wagmiActions.getPublicClient.mockReturnValue({ simulateBlocks })
    wagmiActions.sendCalls.mockResolvedValue({ id: '0x1234' })
    const adapter = createAdapter()

    await expect(
      adapter.proposeSafeBatch?.({
        account,
        chainId: canonicalChainId,
        requests: [request, requestWithValue]
      })
    ).resolves.toBe('0x1234')

    expect(wagmiActions.getPublicClient).toHaveBeenCalledWith(config, { chainId: executionChainId })
    expect(simulateBlocks).toHaveBeenCalledWith({
      blocks: [
        {
          calls: [
            { account, data: request.data, to: request.to, value: 0n },
            { account, data: request.data, to: request.to, value: 42n }
          ]
        }
      ]
    })
    expect(simulateBlocks.mock.invocationCallOrder[0]).toBeLessThan(wagmiActions.sendCalls.mock.invocationCallOrder[0]!)
    expect(wagmiActions.sendCalls).toHaveBeenCalledWith(config, {
      account,
      calls: [
        { data: request.data, to: request.to, value: undefined },
        { data: request.data, to: request.to, value: 42n }
      ],
      chainId: executionChainId,
      forceAtomic: true
    })
  })

  it('rejects empty and mixed-chain batches before simulation', async () => {
    const adapter = createAdapter()
    const otherChainRequest = { ...request, chainId: 10 }

    await expect(adapter.proposeSafeBatch?.({ account, chainId: canonicalChainId, requests: [] })).rejects.toThrow(
      'Safe batch cannot be empty'
    )
    await expect(
      adapter.proposeSafeBatch?.({
        account,
        chainId: canonicalChainId,
        requests: [request, otherChainRequest]
      })
    ).rejects.toThrow('Safe batch contains requests from different canonical chains')
    expect(wagmiActions.getPublicClient).not.toHaveBeenCalled()
    expect(wagmiActions.sendCalls).not.toHaveBeenCalled()
  })

  it('rejects a Safe proposal when no public client is configured', async () => {
    wagmiActions.getPublicClient.mockReturnValue(undefined)
    const adapter = createAdapter()

    await expect(
      adapter.proposeSafeBatch?.({ account, chainId: canonicalChainId, requests: [request] })
    ).rejects.toThrow(`No public client is configured for chain ${executionChainId}`)
    expect(wagmiActions.sendCalls).not.toHaveBeenCalled()
  })

  it.each([
    { simulationResult: [] },
    { simulationResult: [{ calls: [] }] },
    {
      simulationResult: [{ calls: [{ status: 'success' }] }, { calls: [{ status: 'success' }] }]
    }
  ])('rejects incomplete atomic simulation result %#', async ({ simulationResult }) => {
    wagmiActions.getPublicClient.mockReturnValue({
      simulateBlocks: vi.fn().mockResolvedValue(simulationResult)
    })
    const adapter = createAdapter()

    await expect(
      adapter.proposeSafeBatch?.({ account, chainId: canonicalChainId, requests: [request, requestWithValue] })
    ).rejects.toThrow('Safe batch simulation returned incomplete results')
    expect(wagmiActions.sendCalls).not.toHaveBeenCalled()
  })

  it('does not submit a Safe proposal when an atomic call fails', async () => {
    const simulationError = new Error('approval reverted')
    wagmiActions.getPublicClient.mockReturnValue({
      simulateBlocks: vi.fn().mockResolvedValue([
        {
          calls: [{ status: 'success' }, { error: simulationError, status: 'failure' }]
        }
      ])
    })
    const adapter = createAdapter()

    await expect(
      adapter.proposeSafeBatch?.({ account, chainId: canonicalChainId, requests: [request, requestWithValue] })
    ).rejects.toBe(simulationError)
    expect(wagmiActions.sendCalls).not.toHaveBeenCalled()
  })

  it.each([
    new MethodNotFoundRpcError(new Error('unavailable'), { method: 'eth_simulateV1' }),
    new MethodNotSupportedRpcError(new Error('unsupported'), { method: 'eth_simulateV1' }),
    new BaseError('wrapped', {
      cause: new MethodNotFoundRpcError(new Error('unavailable'), { method: 'eth_simulateV1' })
    })
  ])('uses the Safe wallet as the simulation boundary for unavailable RPC capability %#', async (error) => {
    wagmiActions.getPublicClient.mockReturnValue({
      simulateBlocks: vi.fn().mockRejectedValue(error)
    })
    wagmiActions.sendCalls.mockResolvedValue({ id: '0x1234' })
    const adapter = createAdapter()

    await expect(adapter.proposeSafeBatch?.({ account, chainId: canonicalChainId, requests: [request] })).resolves.toBe(
      '0x1234'
    )
    expect(wagmiActions.sendCalls).toHaveBeenCalledOnce()
  })

  it('does not swallow ordinary simulation errors', async () => {
    const simulationError = new Error('RPC unavailable')
    wagmiActions.getPublicClient.mockReturnValue({
      simulateBlocks: vi.fn().mockRejectedValue(simulationError)
    })
    const adapter = createAdapter()

    await expect(adapter.proposeSafeBatch?.({ account, chainId: canonicalChainId, requests: [request] })).rejects.toBe(
      simulationError
    )
    expect(wagmiActions.sendCalls).not.toHaveBeenCalled()
  })

  it.each(['proposal-id', '0x', '0xxyz'])('rejects invalid Safe proposal identifier %s', async (proposalId) => {
    wagmiActions.getPublicClient.mockReturnValue({
      simulateBlocks: vi.fn().mockResolvedValue([{ calls: [{ status: 'success' }] }])
    })
    wagmiActions.sendCalls.mockResolvedValue({ id: proposalId })
    const adapter = createAdapter()

    await expect(
      adapter.proposeSafeBatch?.({ account, chainId: canonicalChainId, requests: [request] })
    ).rejects.toThrow('Safe returned an invalid proposal identifier')
  })
})

describe('Wagmi Safe execution tracking adapter', () => {
  it('uses bounded library polling, validates the mapped result chain, and returns the mined hash', async () => {
    wagmiActions.waitForCallsStatus.mockResolvedValue({
      chainId: executionChainId,
      receipts: [successfulReceipt],
      status: 'success'
    })
    const adapter = createAdapter({ safePollingIntervalMs: 25, safeTimeoutMs: 5_000 })

    await expect(adapter.waitForSafeExecution?.({ chainId: canonicalChainId, proposalId: '0x1234' })).resolves.toBe(
      transactionHash
    )
    expect(wagmiActions.waitForCallsStatus).toHaveBeenCalledOnce()
    expect(wagmiActions.waitForCallsStatus).toHaveBeenCalledWith(config, {
      id: '0x1234',
      pollingInterval: 25,
      timeout: 5_000
    })
  })

  it.each([
    {
      expectedError: 'Safe execution completed on an unexpected chain',
      result: { chainId: canonicalChainId, receipts: [successfulReceipt], status: 'success' }
    },
    {
      expectedError: 'Safe transaction failed',
      result: { chainId: executionChainId, receipts: [], status: 'failure' }
    },
    {
      expectedError: 'Safe execution completed without a successful status',
      result: { chainId: executionChainId, receipts: [], status: 'pending' }
    },
    {
      expectedError: 'Safe execution completed with a reverted transaction receipt',
      result: {
        chainId: executionChainId,
        receipts: [{ ...successfulReceipt, status: 'reverted' }],
        status: 'success'
      }
    },
    {
      expectedError: 'Safe execution completed without a valid transaction receipt',
      result: { chainId: executionChainId, receipts: [], status: 'success' }
    },
    {
      expectedError: 'Safe execution completed without a valid transaction receipt',
      result: {
        chainId: executionChainId,
        receipts: [{ ...successfulReceipt, transactionHash: '0x1234' }],
        status: 'success'
      }
    }
  ])('rejects an invalid Safe terminal result: $expectedError', async ({ expectedError, result }) => {
    wagmiActions.waitForCallsStatus.mockResolvedValue(result)
    const adapter = createAdapter()

    await expect(adapter.waitForSafeExecution?.({ chainId: canonicalChainId, proposalId: '0x1234' })).rejects.toThrow(
      expectedError
    )
  })

  it('propagates a Safe polling timeout', async () => {
    const timeoutError = new Error('timed out')
    wagmiActions.waitForCallsStatus.mockRejectedValue(timeoutError)
    const adapter = createAdapter()

    await expect(adapter.waitForSafeExecution?.({ chainId: canonicalChainId, proposalId: '0x1234' })).rejects.toBe(
      timeoutError
    )
  })
})
