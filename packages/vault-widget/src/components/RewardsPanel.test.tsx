// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { VaultWidgetConfig, VaultWidgetCopy, VaultWidgetToken } from '../types'
import { RewardsPanel } from './RewardsPanel'

const mocks = vi.hoisted(() => ({
  action: vi.fn(),
  discover: vi.fn(),
  useAccount: vi.fn(),
  usePublicClient: vi.fn()
}))

vi.mock('wagmi', () => ({
  useAccount: mocks.useAccount,
  usePublicClient: mocks.usePublicClient
}))

vi.mock('../context', () => ({
  useVaultWidgetServices: () => ({
    rewards: {
      discover: mocks.discover
    }
  })
}))

vi.mock('../headless/useVaultWidgetActionController', () => ({
  useVaultWidgetActionController: mocks.action
}))

const account = '0x1111111111111111111111111111111111111111' as const
const token: VaultWidgetToken = {
  address: '0x2222222222222222222222222222222222222222',
  chainId: 1,
  decimals: 18,
  symbol: 'RWD'
}
const config: VaultWidgetConfig = {
  adapters: [],
  chainId: 1,
  depositTokens: [token],
  id: 'reward-test',
  name: 'Reward test',
  positionToken: token,
  rewards: { tokens: [token] },
  vaultAddress: '0x3333333333333333333333333333333333333333',
  withdrawTokens: [token]
}
const copy = { confirmInWallet: 'Confirm in your wallet' } as VaultWidgetCopy

describe('RewardsPanel transaction overlay', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0)
      return 1
    })
    mocks.useAccount.mockReturnValue({ address: account })
    mocks.usePublicClient.mockReturnValue({})
    mocks.discover.mockResolvedValue([
      {
        amount: 1_000_000_000_000_000_000n,
        id: 'reward',
        kind: 'staking',
        quote: {
          adapterId: 'staking-reward',
          amountIn: 0n,
          expectedOut: 1_000_000_000_000_000_000n,
          minExpectedOut: 1_000_000_000_000_000_000n,
          positionAmount: 0n,
          transaction: {
            chainId: 1,
            data: '0x1234',
            to: config.vaultAddress
          }
        },
        token,
        usdValue: 1
      }
    ])
    mocks.action.mockReturnValue({
      allowance: 0n,
      canSubmit: false,
      execution: {
        status: 'confirming',
        step: { id: 'claim', kind: 'execute', label: 'Claim RWD rewards' },
        stepCount: 1,
        stepIndex: 0
      },
      isLoading: false,
      plan: undefined,
      resetExecution: vi.fn(),
      submit: vi.fn(),
      walletType: 'eoa'
    })
  })

  it('covers the complete widget while a reward claim awaits wallet confirmation', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false }
      }
    })
    render(
      <QueryClientProvider client={queryClient}>
        <div className="yv-widget">
          <RewardsPanel config={config} copy={copy} onRefresh={vi.fn().mockResolvedValue(undefined)} />
        </div>
      </QueryClientProvider>
    )

    const dialog = await screen.findByRole('dialog', { name: 'Confirm in your wallet' })
    expect(dialog.closest('.yv-widget')).toBeTruthy()
    expect(dialog.textContent).toContain('Claim RWD rewards (1/1)')
  })
})
