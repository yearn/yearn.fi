// @vitest-environment jsdom

import { act, renderHook, waitFor } from '@testing-library/react'
import { usePublicClient } from '@yearn/vault-widget/internal/hooks/useAppWagmi'
import { useVaultWidgetRuntime } from '@yearn/vault-widget/runtime'
import type { Hash } from 'viem'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { EnsoSimulationError, simulateEnsoOrder, type TEnsoTransaction, useEnsoOrder } from './useEnsoOrder'

vi.mock('@yearn/vault-widget/internal/hooks/useAppWagmi', () => ({
  usePublicClient: vi.fn()
}))

vi.mock('@yearn/vault-widget/runtime', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@yearn/vault-widget/runtime')>()),
  useVaultWidgetRuntime: vi.fn()
}))

const TRANSACTION: TEnsoTransaction = {
  to: '0x0000000000000000000000000000000000000001',
  from: '0x0000000000000000000000000000000000000002',
  data: '0x1234',
  value: '7',
  chainId: 1
}
const REFRESHED_TRANSACTION: TEnsoTransaction = {
  ...TRANSACTION,
  data: '0x5678'
}
const EXECUTION_HASH = `0x${'f'.repeat(64)}` as Hash

const usePublicClientMock = vi.mocked(usePublicClient)
const useVaultWidgetRuntimeMock = vi.mocked(useVaultWidgetRuntime)

function mockRuntime(execute: ReturnType<typeof vi.fn>): void {
  useVaultWidgetRuntimeMock.mockReturnValue({
    chains: {
      resolveExecutionChainId: (chainId: number) => chainId
    },
    execution: { execute }
  } as never)
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('simulateEnsoOrder', () => {
  it('simulates the exact raw Enso transaction before wallet submission', async () => {
    const call = vi.fn(async () => ({ data: '0x' as const }))

    await simulateEnsoOrder({ call } as never, TRANSACTION)

    expect(call).toHaveBeenCalledWith({
      account: TRANSACTION.from,
      to: TRANSACTION.to,
      data: TRANSACTION.data,
      value: 7n
    })
  })

  it('turns a simulation revert into an actionable blocked-execution error', async () => {
    const cause = new Error('execution reverted')
    const call = vi.fn(async () => {
      throw cause
    })

    await expect(simulateEnsoOrder({ call } as never, TRANSACTION)).rejects.toMatchObject({
      name: 'EnsoSimulationError',
      message: 'This route can no longer execute. The quote is refreshing; please try again.',
      cause
    } satisfies Partial<EnsoSimulationError>)
  })
})

describe('useEnsoOrder', () => {
  it('refreshes a failed preflight and executes only the refreshed transaction on retry', async () => {
    let transaction = TRANSACTION
    const call = vi.fn().mockRejectedValueOnce(new Error('execution reverted')).mockResolvedValueOnce({ data: '0x' })
    const execute = vi.fn().mockResolvedValue(EXECUTION_HASH)
    const refreshEnsoTransaction = vi.fn(async () => {
      transaction = REFRESHED_TRANSACTION
    })
    usePublicClientMock.mockReturnValue({ call } as never)
    mockRuntime(execute)

    const { result, rerender } = renderHook(() =>
      useEnsoOrder({
        getEnsoTransaction: () => transaction,
        refreshEnsoTransaction,
        chainId: 1
      })
    )

    await act(async () => {
      await expect(result.current.prepareEnsoOrder.execute()).rejects.toBeInstanceOf(EnsoSimulationError)
    })
    expect(refreshEnsoTransaction).toHaveBeenCalledTimes(1)
    expect(execute).not.toHaveBeenCalled()

    rerender()
    await waitFor(() => {
      expect(result.current.prepareEnsoOrder.transaction?.data).toBe(REFRESHED_TRANSACTION.data)
      expect(result.current.prepareEnsoOrder.isSuccess).toBe(true)
    })

    await act(async () => {
      await expect(result.current.prepareEnsoOrder.execute()).resolves.toBe(EXECUTION_HASH)
    })
    expect(call).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ data: REFRESHED_TRANSACTION.data, to: REFRESHED_TRANSACTION.to })
    )
    expect(execute).toHaveBeenCalledWith({
      account: REFRESHED_TRANSACTION.from,
      request: {
        chainId: 1,
        to: REFRESHED_TRANSACTION.to,
        data: REFRESHED_TRANSACTION.data,
        value: BigInt(REFRESHED_TRANSACTION.value)
      }
    })
  })

  it('keeps rejected calldata blocked when refresh does not provide a new transaction', async () => {
    const call = vi.fn().mockRejectedValue(new Error('execution reverted'))
    const execute = vi.fn().mockResolvedValue(EXECUTION_HASH)
    const refreshEnsoTransaction = vi.fn().mockResolvedValue(undefined)
    usePublicClientMock.mockReturnValue({ call } as never)
    mockRuntime(execute)

    const { result } = renderHook(() =>
      useEnsoOrder({
        getEnsoTransaction: () => TRANSACTION,
        refreshEnsoTransaction,
        chainId: 1
      })
    )

    await act(async () => {
      await expect(result.current.prepareEnsoOrder.execute()).rejects.toBeInstanceOf(EnsoSimulationError)
    })
    expect(result.current.prepareEnsoOrder.isError).toBe(true)

    await act(async () => {
      await expect(result.current.prepareEnsoOrder.execute()).rejects.toBeInstanceOf(EnsoSimulationError)
    })
    expect(call).toHaveBeenCalledTimes(1)
    expect(refreshEnsoTransaction).toHaveBeenCalledTimes(1)
    expect(execute).not.toHaveBeenCalled()
  })

  it('does not refresh when wallet execution fails after a successful preflight', async () => {
    const walletError = new Error('User rejected the request')
    const call = vi.fn().mockResolvedValue({ data: '0x' })
    const execute = vi.fn().mockRejectedValue(walletError)
    const refreshEnsoTransaction = vi.fn().mockResolvedValue(undefined)
    usePublicClientMock.mockReturnValue({ call } as never)
    mockRuntime(execute)

    const { result } = renderHook(() =>
      useEnsoOrder({
        getEnsoTransaction: () => TRANSACTION,
        refreshEnsoTransaction,
        chainId: 1
      })
    )

    await act(async () => {
      await expect(result.current.prepareEnsoOrder.execute()).rejects.toBe(walletError)
    })
    expect(call).toHaveBeenCalledTimes(1)
    expect(execute).toHaveBeenCalledTimes(1)
    expect(refreshEnsoTransaction).not.toHaveBeenCalled()
  })
})
