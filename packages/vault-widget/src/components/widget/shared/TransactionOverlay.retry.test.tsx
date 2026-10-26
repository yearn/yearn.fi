// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { buildTransactionPlan } from '@yearn/vault-widget/headless'
import {
  TransactionOverlay,
  type TransactionStep
} from '@yearn/vault-widget/internal/components/widget/shared/TransactionOverlay'
import { useDirectDeposit } from '@yearn/vault-widget/internal/hooks/actions/useDirectDeposit'
import { VaultWidgetRuntimeProvider } from '@yearn/vault-widget/runtime'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  execute: vi.fn(),
  reset: vi.fn(),
  reward: vi.fn(),
  preview: { data: 10n, isError: false, isFetching: false },
  prepare: { isSuccess: true, data: { request: { chainId: 1 } } }
}))
vi.mock('@yearn/vault-widget/internal/hooks/useAppWagmi', () => ({
  useReadContract: () => mocks.preview,
  useSimulateContract: () => mocks.prepare
}))
vi.mock('@yearn/vault-widget/internal/hooks/useTokenAllowance', () => ({
  useTokenAllowance: () => ({ allowance: 100n })
}))
vi.mock('react-rewards', () => ({ useReward: () => ({ reward: mocks.reward }) }))
vi.mock('wagmi', () => ({
  useConfig: () => ({}),
  useWriteContract: () => ({ reset: mocks.reset }),
  useSendCalls: () => ({ reset: mocks.reset }),
  useSignTypedData: () => ({}),
  useChainId: () => 1,
  useSwitchChain: () => ({}),
  useCallsStatus: () => ({}),
  useAccount: () => ({
    address: '0x1111111111111111111111111111111111111111',
    chain: { id: 1 },
    status: 'connected',
    connector: { getAccounts: vi.fn(), getChainId: vi.fn() }
  })
}))
const account = '0x1111111111111111111111111111111111111111'
const vault = '0x2222222222222222222222222222222222222222'
const plan = buildTransactionPlan({
  intent: {
    id: 'generic-deposit',
    mode: 'deposit',
    calls: [{ id: 'deposit', label: 'Deposit', request: { chainId: 1, to: vault, data: '0x1234' } }]
  },
  connectedChainId: 1
})
const runtime = { execution: { execute: mocks.execute }, wallet: { address: account, chainId: 1 } } as const

function FrozenDeposit({ readFailed = false }: { readFailed?: boolean }) {
  const flow = useDirectDeposit({
    vaultAddress: vault,
    assetAddress: account,
    account,
    chainId: 1,
    decimals: 6,
    amount: 10n,
    maxDeposit: 100n,
    enabled: !readFailed
  })
  const step: TransactionStep = {
    id: 'deposit',
    prepare: flow.actions.prepareDeposit,
    label: 'Deposit',
    confirmMessage: 'Confirm deposit',
    successTitle: 'Deposited',
    successMessage: 'Deposit complete',
    isEnabled: flow.periphery.prepareDepositEnabled
  }
  return <TransactionOverlay isOpen onClose={vi.fn()} plan={plan} step={step} />
}

afterEach(cleanup)
beforeEach(() => {
  vi.clearAllMocks()
  mocks.preview.data = 10n
  mocks.execute.mockRejectedValue(new Error('Temporary wallet transport failure'))
})

describe('frozen generic deposit retry', () => {
  it.each(['critical read failure', 'zero-share preview'])(
    'blocks a retry after %s until reads recover',
    async (failure) => {
      const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
      const widget = (readFailed = false) => (
        <QueryClientProvider client={client}>
          <VaultWidgetRuntimeProvider value={runtime}>
            <FrozenDeposit readFailed={readFailed} />
          </VaultWidgetRuntimeProvider>
        </QueryClientProvider>
      )
      const view = render(widget())
      await screen.findByRole('button', { name: 'Try Again' })
      expect(mocks.execute).toHaveBeenCalledOnce()

      mocks.preview.data = failure === 'zero-share preview' ? 0n : 10n
      view.rerender(widget(failure === 'critical read failure'))
      const retry = screen.getByRole('button', { name: 'Try Again' }) as HTMLButtonElement
      expect(retry.disabled).toBe(true)
      fireEvent.click(retry)
      expect(mocks.execute).toHaveBeenCalledOnce()

      mocks.preview.data = 10n
      view.rerender(widget())
      expect(retry.disabled).toBe(false)
      fireEvent.click(retry)
      await waitFor(() => expect(mocks.execute).toHaveBeenCalledTimes(2))
    }
  )
})
