// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { decodeFunctionData, erc20Abi } from 'viem'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Config } from 'wagmi'
import { VaultWidgetProvider } from '../context'
import type { VaultWidgetServices } from '../services'
import type { VaultWidgetConfig, VaultWidgetQuote, VaultWidgetToken } from '../types'
import { useVaultWidgetController } from './useVaultWidgetController'

const mocks = vi.hoisted(() => ({
  executePlan: vi.fn(),
  getPublicClient: vi.fn(),
  useAccount: vi.fn(),
  useConfig: vi.fn(),
  usePublicClient: vi.fn()
}))

vi.mock('wagmi', () => ({
  useAccount: mocks.useAccount,
  useConfig: mocks.useConfig,
  usePublicClient: mocks.usePublicClient
}))

vi.mock('wagmi/actions', () => ({
  getPublicClient: mocks.getPublicClient
}))

vi.mock('./executeTransactionPlan', () => ({
  executeVaultWidgetPlan: mocks.executePlan
}))

const account = '0x1111111111111111111111111111111111111111' as const
const asset: VaultWidgetToken = {
  address: '0x2222222222222222222222222222222222222222',
  chainId: 1,
  decimals: 18,
  symbol: 'ASSET'
}
const positionToken: VaultWidgetToken = {
  address: '0x3333333333333333333333333333333333333333',
  chainId: 1,
  decimals: 18,
  symbol: 'yvASSET'
}
const transactionTarget = '0x4444444444444444444444444444444444444444' as const
const firstSpender = '0x6666666666666666666666666666666666666666' as const
const secondSpender = '0x7777777777777777777777777777777777777777' as const
const transactionHash = `0x${'55'.repeat(32)}` as const
const wagmiConfig = {} as Config

function createQuote(data: `0x${string}`, expiresAt: number): VaultWidgetQuote {
  return {
    adapterId: 'enso',
    amountIn: 10n ** 18n,
    expectedOut: 10n ** 18n,
    expiresAt,
    minExpectedOut: 99n * 10n ** 16n,
    positionAmount: 10n ** 18n,
    transaction: {
      chainId: 1,
      data,
      to: transactionTarget
    }
  }
}

function createHarness(quote: (request: unknown, publicClient: unknown) => Promise<VaultWidgetQuote>): {
  config: VaultWidgetConfig
  services: Partial<VaultWidgetServices>
} {
  const publicClient = {
    readContract: vi.fn(
      async ({ address, functionName }: { address: `0x${string}`; functionName: 'allowance' | 'balanceOf' }) => {
        if (functionName === 'allowance') return 10n * 10n ** 18n
        return address === asset.address ? 10n * 10n ** 18n : 0n
      }
    )
  }
  mocks.usePublicClient.mockReturnValue(publicClient)
  mocks.getPublicClient.mockReturnValue(publicClient)

  return {
    config: {
      adapters: [
        {
          id: 'test-route',
          quote,
          supports: () => true
        }
      ],
      chainId: 1,
      depositTokens: [asset],
      id: 'stale-quote-test',
      modes: ['deposit', 'withdraw'],
      name: 'Stale quote test',
      positionToken,
      vaultAddress: positionToken.address,
      withdrawTokens: [asset]
    },
    services: {
      activityStore: {
        add: vi.fn().mockResolvedValue(1),
        list: vi.fn().mockResolvedValue([]),
        remove: vi.fn().mockResolvedValue(undefined),
        update: vi.fn().mockResolvedValue(undefined)
      },
      execution: {
        execute: vi.fn(),
        waitForReceipt: vi.fn()
      },
      settings: {
        read: () => ({
          autoStake: true,
          maxLossBps: 100,
          slippagePercent: 0.5,
          solver: 'enso'
        }),
        write: vi.fn()
      }
    }
  }
}

function createWrapper(services: Partial<VaultWidgetServices>): ({ children }: { children: ReactNode }) => ReactNode {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false }
    }
  })
  return function Wrapper({ children }: { children: ReactNode }): ReactNode {
    return (
      <QueryClientProvider client={queryClient}>
        <VaultWidgetProvider services={services}>{children}</VaultWidgetProvider>
      </QueryClientProvider>
    )
  }
}

describe('useVaultWidgetController stale quote handling', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.useAccount.mockReturnValue({ address: account, chainId: 1, connector: { id: 'injected' } })
    mocks.useConfig.mockReturnValue(wagmiConfig)
    mocks.executePlan.mockResolvedValue({ hash: transactionHash })
  })

  it('executes only the refreshed transaction plan when the displayed quote has expired', async () => {
    const expiredQuote = createQuote('0xaaaa', Date.now() - 1)
    const freshQuote = createQuote('0xbbbb', Date.now() + 60_000)
    const quote = vi.fn().mockResolvedValueOnce(expiredQuote).mockResolvedValueOnce(freshQuote)
    const onEvent = vi.fn()
    const { config, services } = createHarness(quote)
    const { result } = renderHook(() => useVaultWidgetController({ config, onEvent }), {
      wrapper: createWrapper(services)
    })

    act(() => result.current.setAmount('1'))
    await waitFor(() => expect(result.current.canSubmit).toBe(true))

    await act(async () => result.current.submit())

    expect(quote).toHaveBeenCalledTimes(2)
    expect(mocks.executePlan).toHaveBeenCalledWith(
      expect.objectContaining({
        plan: expect.objectContaining({
          quote: expect.objectContaining({ transaction: expect.objectContaining({ data: '0xbbbb' }) })
        })
      })
    )
    expect(onEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'transaction_started',
        plan: expect.objectContaining({ quote: freshQuote })
      })
    )
  })

  it('cancels submission when re-quoting fails instead of executing cached expired data', async () => {
    const expiredQuote = createQuote('0xaaaa', Date.now() - 1)
    const refreshError = new Error('route refresh unavailable')
    const quote = vi.fn().mockResolvedValueOnce(expiredQuote).mockRejectedValueOnce(refreshError)
    const { config, services } = createHarness(quote)
    const { result } = renderHook(() => useVaultWidgetController({ config }), {
      wrapper: createWrapper(services)
    })

    act(() => result.current.setAmount('1'))
    await waitFor(() => expect(result.current.canSubmit).toBe(true))

    await act(async () => result.current.submit())

    expect(quote).toHaveBeenCalledTimes(2)
    expect(mocks.executePlan).not.toHaveBeenCalled()
    expect(result.current.execution).toEqual({ status: 'error', error: refreshError })
  })

  it('cancels submission when a re-quote response is already expired', async () => {
    const expiredQuote = createQuote('0xaaaa', Date.now() - 1)
    const alsoExpiredQuote = createQuote('0xbbbb', Date.now() - 1)
    const quote = vi.fn().mockResolvedValueOnce(expiredQuote).mockResolvedValueOnce(alsoExpiredQuote)
    const { config, services } = createHarness(quote)
    const { result } = renderHook(() => useVaultWidgetController({ config }), {
      wrapper: createWrapper(services)
    })

    act(() => result.current.setAmount('1'))
    await waitFor(() => expect(result.current.canSubmit).toBe(true))

    await act(async () => result.current.submit())

    expect(mocks.executePlan).not.toHaveBeenCalled()
    expect(result.current.execution).toMatchObject({
      status: 'error',
      error: expect.objectContaining({ message: 'The route quote expired and could not be refreshed' })
    })
  })

  it('does not reuse an allowance when the refreshed quote changes its approval target', async () => {
    const expiredQuote = {
      ...createQuote('0xaaaa', Date.now() - 1),
      approval: { amount: 10n ** 18n, spender: firstSpender, token: asset }
    }
    const freshQuote = {
      ...createQuote('0xbbbb', Date.now() + 60_000),
      approval: { amount: 10n ** 18n, spender: secondSpender, token: asset }
    }
    const quote = vi.fn().mockResolvedValueOnce(expiredQuote).mockResolvedValueOnce(freshQuote)
    const { config, services } = createHarness(quote)
    const { result } = renderHook(() => useVaultWidgetController({ config }), {
      wrapper: createWrapper(services)
    })

    act(() => result.current.setAmount('1'))
    await waitFor(() => expect(result.current.canSubmit).toBe(true))

    await act(async () => result.current.submit())

    const executedPlan = mocks.executePlan.mock.calls[0]?.[0].plan
    expect(executedPlan.steps.map(({ kind }: { kind: string }) => kind)).toEqual(['approve', 'execute', 'refresh'])
    expect(
      decodeFunctionData({
        abi: erc20Abi,
        data: executedPlan.steps[0].request.data
      }).args
    ).toEqual([secondSpender, 10n ** 18n])
  })
})
