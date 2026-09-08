// @vitest-environment jsdom
import { useTransactionStatusPoller } from '@shared/hooks/useTransactionStatusPoller'
import type { TNotification } from '@shared/types/notifications'
import { act, renderHook } from '@testing-library/react'
import type { TransactionReceipt } from 'viem'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  update: vi.fn(),
  refresh: vi.fn(),
  receipt: vi.fn(),
  blockNumber: vi.fn(),
  getPublicClient: vi.fn(),
  safe: vi.fn(),
  calls: vi.fn(),
  block: vi.fn()
}))
vi.mock('@shared/contexts/useNotifications', () => ({ useNotifications: () => ({ updateEntry: mocks.update }) }))
vi.mock('@shared/hooks/useNotificationAssetRefresh', () => ({ useNotificationAssetRefresh: () => mocks.refresh }))
vi.mock('@shared/hooks/useSafeTransactionDetails', () => ({ fetchSafeTransactionDetails: mocks.safe }))
vi.mock('@shared/utils/wagmi', () => ({ getNetwork: () => ({}), retrieveConfig: () => ({}) }))
vi.mock('@wagmi/core', () => ({
  getPublicClient: mocks.getPublicClient,
  getConnectorClient: vi.fn().mockResolvedValue({})
}))
vi.mock('viem/actions', () => ({ getCallsStatus: mocks.calls }))
vi.mock('wagmi/actions', () => ({ getBlock: mocks.block }))

const HASH = `0x${'a'.repeat(64)}` as const
const EXECUTION_HASH = `0x${'b'.repeat(64)}` as const
const notification: TNotification = {
  id: 1,
  type: 'deposit',
  address: '0x0000000000000000000000000000000000000001',
  chainId: 8453,
  executionChainId: 12345,
  amount: '1',
  status: 'pending',
  txHash: HASH
}
const receipt = { transactionHash: HASH, blockNumber: 10n, status: 'success' } as TransactionReceipt

describe('source receipt reconciliation', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.resetAllMocks()
    mocks.update.mockResolvedValue(undefined)
    mocks.refresh.mockResolvedValue(undefined)
    mocks.receipt.mockResolvedValue(receipt)
    mocks.blockNumber.mockResolvedValue(10n)
    mocks.getPublicClient.mockReturnValue({ getTransactionReceipt: mocks.receipt, getBlockNumber: mocks.blockNumber })
    mocks.block.mockResolvedValue({ timestamp: 100n })
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  })
  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it.each(['eoa', 'safe-service', 'safe-wallet'])(
    'requires Base confirmation depth through the execution chain for %s',
    async (source) => {
      const isSafe = source !== 'eoa'
      mocks.safe.mockResolvedValue(
        source === 'safe-service' ? { executionTxHash: EXECUTION_HASH, txStatus: 'SUCCESS' } : undefined
      )
      mocks.calls.mockResolvedValue({ status: 'success', receipts: [{ transactionHash: EXECUTION_HASH }] })
      mocks.receipt.mockResolvedValue({ ...receipt, transactionHash: isSafe ? EXECUTION_HASH : HASH })
      renderHook(() =>
        useTransactionStatusPoller({
          ...notification,
          ...(isSafe ? ({ status: 'submitted', awaitingExecution: true } as const) : {})
        })
      )
      await act(async () => undefined)
      expect(mocks.getPublicClient).toHaveBeenCalledWith({}, { chainId: 12345 })
      expect(mocks.receipt).toHaveBeenCalledWith({ hash: isSafe ? EXECUTION_HASH : HASH })
      expect(mocks.update).not.toHaveBeenCalled()
      mocks.blockNumber.mockResolvedValue(11n)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(isSafe ? 15_000 : 60_000)
      })
      expect(mocks.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'success', txHash: isSafe ? EXECUTION_HASH : HASH }),
        1
      )
      expect(mocks.update.mock.invocationCallOrder[0]).toBeLessThan(mocks.refresh.mock.invocationCallOrder[0])
    }
  )

  it.each(['hung', 'rejected'])('records success despite a %s refresh', async (failure) => {
    mocks.blockNumber.mockResolvedValue(11n)
    mocks.refresh.mockImplementation(() =>
      failure === 'hung' ? new Promise<void>(() => undefined) : Promise.reject(new Error('offline'))
    )
    renderHook(() => useTransactionStatusPoller(notification))
    await act(async () => undefined)
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'success' }), 1)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000)
    })
    expect(mocks.update).toHaveBeenCalledTimes(1)
  })

  it('records bridge source confirmation without claiming destination delivery or refreshing destination balances', async () => {
    mocks.blockNumber.mockResolvedValue(11n)
    renderHook(() => useTransactionStatusPoller({ ...notification, bridgeProtocol: 'relay' }))
    await act(async () => undefined)
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'submitted',
        sourceConfirmedAt: 100,
        bridgeStatus: 'pending',
        timeFinished: undefined
      }),
      1
    )
    expect(mocks.refresh).not.toHaveBeenCalled()
  })

  it.each(['service', 'wallet'])(
    'preserves Safe internal failure from the %s despite a successful outer receipt',
    async (source) => {
      mocks.blockNumber.mockResolvedValue(11n)
      mocks.safe.mockResolvedValue(source === 'service' ? { executionTxHash: HASH, txStatus: 'FAILED' } : undefined)
      mocks.calls.mockResolvedValue({ status: 'failure', receipts: [{ transactionHash: HASH }] })
      renderHook(() =>
        useTransactionStatusPoller({
          ...notification,
          status: 'submitted',
          awaitingExecution: true,
          bridgeProtocol: 'relay'
        })
      )
      await act(async () => undefined)
      expect(mocks.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'error', awaitingExecution: false }),
        1
      )
      expect(mocks.refresh).not.toHaveBeenCalled()
      expect(mocks.update.mock.calls[0][0].sourceConfirmedAt).toBeUndefined()
    }
  )

  it('discards an in-flight receipt after its recorded hash changes', async () => {
    const gate: { resolve?: (value: TransactionReceipt) => void } = {}
    mocks.receipt.mockImplementation(
      () =>
        new Promise<TransactionReceipt>((resolve) => {
          gate.resolve = resolve
        })
    )
    mocks.blockNumber.mockResolvedValue(11n)
    const { rerender } = renderHook(({ record }) => useTransactionStatusPoller(record), {
      initialProps: { record: notification }
    })
    await act(async () => undefined)
    rerender({ record: { ...notification, txHash: EXECUTION_HASH } })
    await act(async () => {
      gate.resolve?.(receipt)
    })
    expect(mocks.update).not.toHaveBeenCalled()
    expect(mocks.refresh).not.toHaveBeenCalled()
  })

  it('discards a receipt after unmount', async () => {
    const gate: { resolve?: (value: TransactionReceipt) => void } = {}
    mocks.receipt.mockImplementation(
      () =>
        new Promise<TransactionReceipt>((resolve) => {
          gate.resolve = resolve
        })
    )
    mocks.blockNumber.mockResolvedValue(11n)
    const { unmount } = renderHook(() => useTransactionStatusPoller(notification))
    await act(async () => undefined)
    unmount()
    await act(async () => {
      gate.resolve?.(receipt)
    })
    expect(mocks.update).not.toHaveBeenCalled()
  })
})
