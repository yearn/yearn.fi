import type { Config } from '@wagmi/core'
import {
  createWagmiVaultWidgetExecutionAdapter,
  type TWagmiVaultWidgetExecutionAdapterOptions
} from '@yearn/vault-widget/wagmi'
import {
  BaseError,
  type Hash,
  MethodNotFoundRpcError,
  MethodNotSupportedRpcError,
  type ReplacementReturnType,
  type TransactionReceipt
} from 'viem'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const wagmiActions = vi.hoisted(() => ({
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
const transactionHash = `0x${'22'.repeat(32)}` as Hash
const otherTransactionHash = `0x${'33'.repeat(32)}` as Hash
const config = {} as Config
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

type TAdapterOverrides = Omit<Partial<TWagmiVaultWidgetExecutionAdapterOptions>, 'config'>

function createAdapter(overrides: TAdapterOverrides = {}) {
  return createWagmiVaultWidgetExecutionAdapter({
    config,
    resolveExecutionChainId: (chainId) => (chainId === canonicalChainId ? executionChainId : undefined),
    ...overrides
  })
}

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

function mockReceiptWait(receipt: TransactionReceipt, replacement?: ReplacementReturnType) {
  const waitForTransactionReceipt = vi.fn(
    async ({ onReplaced }: { onReplaced?: (value: ReplacementReturnType) => void }) => {
      if (replacement) onReplaced?.(replacement)
      return receipt
    }
  )
  wagmiActions.getPublicClient.mockReturnValue({ waitForTransactionReceipt })
  return waitForTransactionReceipt
}

beforeEach(() => {
  vi.resetAllMocks()
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

  it.each([
    undefined,
    0,
    -1,
    1.5,
    Number.NaN
  ])('rejects invalid execution-chain resolver output %s before invoking Wagmi', async (resolvedChainId) => {
    const adapter = createAdapter({ resolveExecutionChainId: () => resolvedChainId })

    await expect(adapter.switchChain({ chainId: canonicalChainId })).rejects.toThrow(
      `Chain ${canonicalChainId} is not enabled for execution`
    )
    expect(wagmiActions.switchChain).not.toHaveBeenCalled()
  })

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

  it('simulates on the execution chain before sending a transaction', async () => {
    const call = vi.fn().mockResolvedValue({ data: '0x' })
    wagmiActions.getPublicClient.mockReturnValue({ call })
    wagmiActions.sendTransaction.mockResolvedValue(transactionHash)
    const adapter = createAdapter()

    await expect(adapter.execute({ account, request })).resolves.toBe(transactionHash)

    expect(wagmiActions.getPublicClient).toHaveBeenCalledWith(config, { chainId: executionChainId })
    expect(call).toHaveBeenCalledWith({
      account,
      data: request.data,
      to: request.to,
      value: 0n
    })
    expect(wagmiActions.sendTransaction).toHaveBeenCalledWith(config, {
      account,
      chainId: executionChainId,
      data: request.data,
      to: request.to,
      value: 0n
    })
    expect(call.mock.invocationCallOrder[0]).toBeLessThan(wagmiActions.sendTransaction.mock.invocationCallOrder[0]!)
    expect(request.chainId).toBe(canonicalChainId)
  })

  it('does not invoke the wallet when simulation fails', async () => {
    const simulationError = new Error('execution reverted')
    wagmiActions.getPublicClient.mockReturnValue({ call: vi.fn().mockRejectedValue(simulationError) })
    const adapter = createAdapter()

    await expect(adapter.execute({ account, request })).rejects.toBe(simulationError)
    expect(wagmiActions.sendTransaction).not.toHaveBeenCalled()
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
    wagmiActions.getPublicClient.mockReturnValue({ call: vi.fn().mockResolvedValue({ data: '0x' }) })
    wagmiActions.sendTransaction.mockResolvedValue('0x1234')
    const adapter = createAdapter()

    await expect(adapter.execute({ account, request })).rejects.toThrow('Wallet returned an invalid transaction hash')
  })

  it('maps receipt lookup to the execution chain and returns a matching successful receipt', async () => {
    const waitForTransactionReceipt = mockReceiptWait(successfulReceipt)
    const adapter = createAdapter()

    await expect(adapter.waitForReceipt({ chainId: canonicalChainId, hash: transactionHash })).resolves.toEqual({
      receipt: successfulReceipt
    })
    expect(wagmiActions.getPublicClient).toHaveBeenCalledWith(config, { chainId: executionChainId })
    expect(waitForTransactionReceipt).toHaveBeenCalledWith({
      hash: transactionHash,
      onReplaced: expect.any(Function),
      timeout: 0
    })
  })

  it('returns a matching reverted receipt for executor classification', async () => {
    const revertedReceipt = { ...successfulReceipt, status: 'reverted' } as TransactionReceipt
    mockReceiptWait(revertedReceipt)
    const adapter = createAdapter()

    await expect(adapter.waitForReceipt({ chainId: canonicalChainId, hash: transactionHash })).resolves.toEqual({
      receipt: revertedReceipt
    })
  })

  it('accepts a repriced replacement reported by viem', async () => {
    const replacementReceipt = { ...successfulReceipt, transactionHash: otherTransactionHash } as TransactionReceipt
    mockReceiptWait(replacementReceipt, createReplacement('repriced', replacementReceipt))
    const adapter = createAdapter()

    await expect(adapter.waitForReceipt({ chainId: canonicalChainId, hash: transactionHash })).resolves.toEqual({
      receipt: replacementReceipt,
      replacement: { reason: 'repriced', replacedHash: transactionHash }
    })
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
    mockReceiptWait(receipt as TransactionReceipt)
    const adapter = createAdapter()

    await expect(adapter.waitForReceipt({ chainId: canonicalChainId, hash: transactionHash })).rejects.toThrow(
      expectedError
    )
  })

  it('rejects replacement information that does not match the mined receipt', async () => {
    const replacementReceipt = { ...successfulReceipt, transactionHash: otherTransactionHash } as TransactionReceipt
    const replacement = createReplacement('repriced', replacementReceipt)
    mockReceiptWait(replacementReceipt, {
      ...replacement,
      transaction: { hash: transactionHash } as ReplacementReturnType['transaction']
    })
    const adapter = createAdapter()

    await expect(adapter.waitForReceipt({ chainId: canonicalChainId, hash: transactionHash })).rejects.toThrow(
      'Wallet returned a receipt for an unexpected transaction'
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
