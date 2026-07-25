import { MethodNotFoundRpcError } from 'viem'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Config } from 'wagmi'
import {
  createSafeAwareExecutionService,
  createWagmiExecutionService,
  createWagmiSafeExecutionService
} from './execution'

const wagmiActions = vi.hoisted(() => ({
  getAccount: vi.fn(),
  getCallsStatus: vi.fn(),
  getPublicClient: vi.fn(),
  sendCalls: vi.fn(),
  sendTransaction: vi.fn(),
  waitForTransactionReceipt: vi.fn()
}))

vi.mock('wagmi/actions', () => wagmiActions)

beforeEach(() => {
  vi.clearAllMocks()
})

const account = '0x1111111111111111111111111111111111111111'
const safeHash = `0x${'33'.repeat(32)}` as const
const config = {} as Config
const request = {
  chainId: 1,
  data: '0x1234',
  to: '0x2222222222222222222222222222222222222222'
} as const
const step = {
  chainId: 1,
  id: 'safe-proposal',
  kind: 'safe-proposal' as const,
  label: 'Propose transaction',
  requests: [request]
}

describe('createSafeAwareExecutionService', () => {
  it('detects Safe wallets and delegates proposal lifecycle operations', async () => {
    const propose = vi.fn(async () => '0x1234' as const)
    const waitForExecution = vi.fn(async () => '0xabcd' as const)
    const service = createSafeAwareExecutionService({
      isSafe: async () => true,
      propose,
      waitForExecution
    })

    await expect(service.getWalletType?.({ account, config })).resolves.toBe('safe')
    await expect(
      service.proposeSafeBatch?.({
        account,
        chainId: 1,
        config,
        requests: [request],
        step
      })
    ).resolves.toBe('0x1234')
    await expect(service.waitForSafeExecution?.(config, 1, '0x1234')).resolves.toBe('0xabcd')
    expect(propose).toHaveBeenCalledOnce()
    expect(waitForExecution).toHaveBeenCalledOnce()
  })
})

describe('createWagmiExecutionService', () => {
  it('simulates each request before asking the wallet to send it', async () => {
    const call = vi.fn().mockResolvedValue({ data: '0x' })
    wagmiActions.getPublicClient.mockReturnValue({ call })
    wagmiActions.sendTransaction.mockResolvedValue('0x1234')
    const service = createWagmiExecutionService()

    await expect(
      service.execute({
        account,
        config,
        request,
        step: { id: 'deposit', kind: 'execute', label: 'Deposit', request }
      })
    ).resolves.toBe('0x1234')

    expect(call).toHaveBeenCalledWith({
      account,
      data: request.data,
      to: request.to,
      value: 0n
    })
    expect(call.mock.invocationCallOrder[0]).toBeLessThan(wagmiActions.sendTransaction.mock.invocationCallOrder[0]!)
  })

  it('does not invoke the wallet when simulation fails', async () => {
    const simulationError = new Error('execution reverted')
    wagmiActions.getPublicClient.mockReturnValue({
      call: vi.fn().mockRejectedValue(simulationError)
    })
    const service = createWagmiExecutionService()

    await expect(
      service.execute({
        account,
        config,
        request,
        step: { id: 'withdraw', kind: 'execute', label: 'Withdraw', request }
      })
    ).rejects.toBe(simulationError)
    expect(wagmiActions.sendTransaction).not.toHaveBeenCalled()
  })

  it('turns a reverted receipt into an execution error', async () => {
    wagmiActions.waitForTransactionReceipt.mockResolvedValue({ status: 'reverted' })
    const service = createWagmiExecutionService()

    await expect(service.waitForReceipt(config, 1, '0x1234')).rejects.toThrow('Transaction reverted')
  })
})

describe('createWagmiSafeExecutionService', () => {
  it('detects the Safe connector and submits an atomic EIP-5792 call batch', async () => {
    const simulateBlocks = vi.fn().mockResolvedValue([
      {
        calls: [{ status: 'success' }, { status: 'success' }]
      }
    ])
    wagmiActions.getAccount.mockReturnValue({ connector: { id: 'safe' } })
    wagmiActions.getPublicClient.mockReturnValue({ simulateBlocks })
    wagmiActions.sendCalls.mockResolvedValue({ id: '0x1234' })
    const service = createWagmiSafeExecutionService()
    const requestWithValue = {
      ...request,
      value: 42n
    }

    await expect(service.getWalletType?.({ account, config })).resolves.toBe('safe')
    await expect(
      service.proposeSafeBatch?.({
        account,
        chainId: 1,
        config,
        requests: [request, requestWithValue],
        step: { ...step, requests: [request, requestWithValue] }
      })
    ).resolves.toBe('0x1234')

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
      chainId: 1,
      forceAtomic: true
    })
  })

  it('does not propose a Safe batch when atomic simulation fails', async () => {
    const simulationError = new Error('execution reverted')
    wagmiActions.getPublicClient.mockReturnValue({
      simulateBlocks: vi.fn().mockResolvedValue([
        {
          calls: [{ error: simulationError, status: 'failure' }]
        }
      ])
    })
    const service = createWagmiSafeExecutionService()

    await expect(
      service.proposeSafeBatch?.({
        account,
        chainId: 1,
        config,
        requests: [request],
        step
      })
    ).rejects.toBe(simulationError)
    expect(wagmiActions.sendCalls).not.toHaveBeenCalled()
  })

  it('does not propose a Safe batch when atomic simulation returns incomplete results', async () => {
    wagmiActions.getPublicClient.mockReturnValue({
      simulateBlocks: vi.fn().mockResolvedValue([{ calls: [] }])
    })
    const service = createWagmiSafeExecutionService()

    await expect(
      service.proposeSafeBatch?.({
        account,
        chainId: 1,
        config,
        requests: [request],
        step
      })
    ).rejects.toThrow('Safe batch simulation returned incomplete results')
    expect(wagmiActions.sendCalls).not.toHaveBeenCalled()
  })

  it('delegates simulation to the Safe wallet when eth_simulateV1 is unavailable', async () => {
    wagmiActions.getPublicClient.mockReturnValue({
      simulateBlocks: vi
        .fn()
        .mockRejectedValue(new MethodNotFoundRpcError(new Error('method unavailable'), { method: 'eth_simulateV1' }))
    })
    wagmiActions.sendCalls.mockResolvedValue({ id: '0x1234' })
    const service = createWagmiSafeExecutionService()

    await expect(
      service.proposeSafeBatch?.({
        account,
        chainId: 1,
        config,
        requests: [request],
        step
      })
    ).resolves.toBe('0x1234')
    expect(wagmiActions.sendCalls).toHaveBeenCalledOnce()
  })

  it('classifies other connectors as EOAs', async () => {
    wagmiActions.getAccount.mockReturnValue({ connector: { id: 'injected' } })
    const service = createWagmiSafeExecutionService()

    await expect(service.getWalletType?.({ account, config })).resolves.toBe('eoa')
  })

  it('tracks a pending Safe call batch through its mined receipt', async () => {
    wagmiActions.getCallsStatus.mockResolvedValueOnce({ status: 'pending' }).mockResolvedValueOnce({
      receipts: [{ transactionHash: safeHash }],
      status: 'success'
    })
    const service = createWagmiSafeExecutionService({ pollIntervalMs: 0 })

    await expect(service.waitForSafeExecution?.(config, 1, '0x1234')).resolves.toBe(safeHash)
    expect(wagmiActions.getCallsStatus).toHaveBeenCalledTimes(2)
    expect(wagmiActions.getCallsStatus).toHaveBeenNthCalledWith(1, config, { id: '0x1234' })
    expect(wagmiActions.getCallsStatus).toHaveBeenNthCalledWith(2, config, { id: '0x1234' })
  })

  it('rejects failed Safe call batches', async () => {
    wagmiActions.getCallsStatus.mockResolvedValue({ status: 'failure' })
    const service = createWagmiSafeExecutionService({ pollIntervalMs: 0 })

    await expect(service.waitForSafeExecution?.(config, 1, '0x1234')).rejects.toThrow('Safe transaction failed')
  })

  it.each([
    { receipts: undefined, source: 'missing' },
    { receipts: [{ transactionHash: '0xabcd' }], source: 'malformed' }
  ])('rejects a successful Safe status with a $source transaction receipt', async ({ receipts }) => {
    wagmiActions.getCallsStatus.mockResolvedValue({ receipts, status: 'success' })
    const service = createWagmiSafeExecutionService({ pollIntervalMs: 0 })

    await expect(service.waitForSafeExecution?.(config, 1, '0x1234')).rejects.toThrow(
      'without a valid transaction receipt'
    )
  })
})
