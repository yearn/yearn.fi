// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { decodeFunctionData, erc20Abi } from 'viem'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Config } from 'wagmi'
import { VaultWidgetProvider } from '../context'
import type { VaultWidgetServices } from '../services'
import type { VaultWidgetQuote, VaultWidgetToken } from '../types'
import { useVaultWidgetActionController } from './useVaultWidgetActionController'

const mocks = vi.hoisted(() => ({
  executePlan: vi.fn(),
  getPublicClient: vi.fn(),
  useAccount: vi.fn(),
  useConfig: vi.fn()
}))

vi.mock('wagmi', () => ({
  useAccount: mocks.useAccount,
  useConfig: mocks.useConfig
}))

vi.mock('wagmi/actions', () => ({
  getPublicClient: mocks.getPublicClient
}))

vi.mock('./executeTransactionPlan', () => ({
  executeVaultWidgetPlan: mocks.executePlan
}))

const account = '0x1111111111111111111111111111111111111111' as const
const tokenAddress = '0x2222222222222222222222222222222222222222' as const
const spender = '0x3333333333333333333333333333333333333333' as const
const transactionTarget = '0x4444444444444444444444444444444444444444' as const
const transactionHash = `0x${'55'.repeat(32)}` as const
const tokenOnMainnet: VaultWidgetToken = {
  address: tokenAddress,
  chainId: 1,
  decimals: 18,
  symbol: 'MAIN'
}
const tokenOnOptimism: VaultWidgetToken = {
  ...tokenOnMainnet,
  chainId: 10,
  symbol: 'OP'
}
const quote: VaultWidgetQuote = {
  adapterId: 'composed-migration',
  amountIn: 10n,
  approvals: [
    { amount: 10n, spender, token: tokenOnMainnet },
    { amount: 10n, spender, token: tokenOnOptimism }
  ],
  expectedOut: 10n,
  minExpectedOut: 10n,
  positionAmount: 10n,
  transaction: {
    chainId: 10,
    data: '0x1234',
    to: transactionTarget
  }
}
const wagmiConfig = {} as Config

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

describe('useVaultWidgetActionController', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.useAccount.mockReturnValue({ address: account, chainId: 1, connector: { id: 'injected' } })
    mocks.useConfig.mockReturnValue(wagmiConfig)
    mocks.getPublicClient.mockImplementation((_config: Config, { chainId }: { chainId: number }) => ({
      readContract: vi.fn().mockResolvedValue(chainId === 1 ? 10n : 0n)
    }))
    mocks.executePlan.mockResolvedValue({ hash: transactionHash })
  })

  it('keeps same-address allowances separate by chain and plans every insufficient approval', async () => {
    const { result } = renderHook(
      () =>
        useVaultWidgetActionController({
          activity: { chainId: 1 },
          mode: 'migrate',
          quote
        }),
      {
        wrapper: createWrapper({
          activityStore: {
            add: vi.fn().mockResolvedValue(1),
            list: vi.fn().mockResolvedValue([]),
            remove: vi.fn().mockResolvedValue(undefined),
            update: vi.fn().mockResolvedValue(undefined)
          },
          execution: {
            execute: vi.fn(),
            waitForReceipt: vi.fn()
          }
        })
      }
    )

    await waitFor(() => expect(result.current.canSubmit).toBe(true))

    expect(mocks.getPublicClient).toHaveBeenCalledWith(wagmiConfig, { chainId: 1 })
    expect(mocks.getPublicClient).toHaveBeenCalledWith(wagmiConfig, { chainId: 10 })
    expect(result.current.allowance).toBe(10n)
    expect(result.current.plan?.steps.map(({ kind }) => kind)).toEqual([
      'switch-chain',
      'approve',
      'execute',
      'refresh'
    ])
    const approvalStep = result.current.plan?.steps.find(({ kind }) => kind === 'approve')
    expect(
      decodeFunctionData({
        abi: erc20Abi,
        data: approvalStep?.request?.data ?? '0x'
      }).args
    ).toEqual([spender, 10n])

    await act(async () => result.current.submit())
    expect(mocks.executePlan).toHaveBeenCalledWith(expect.objectContaining({ plan: result.current.plan }))
  })
})
