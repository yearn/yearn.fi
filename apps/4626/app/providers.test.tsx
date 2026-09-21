// @vitest-environment jsdom
import { Providers } from '@erc4626/app/providers'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useVaultWidgetRuntime } from '@yearn/vault-widget/runtime'
import type { ReactNode } from 'react'
import type { Hash, TransactionReceipt, WaitForTransactionReceiptParameters } from 'viem'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ waitForReceipt: vi.fn() }))
vi.mock('@erc4626/lib/wagmiConfig', () => ({ wagmiConfig: {} }))
vi.mock('@yearn/vault-widget/wagmi', () => ({ createWagmiVaultWidgetExecutionAdapter: () => ({}) }))
vi.mock('@yearn/vault-widget', async () => {
  const { VaultWidgetRuntimeProvider } = await import('@yearn/vault-widget/runtime')
  return { VaultWidgetRuntimeProvider }
})
vi.mock('@yearn/site-header/theme', () => ({ useThemePreference: () => 'light' }))
vi.mock('@rainbow-me/rainbowkit', () => ({
  RainbowKitProvider: ({ children }: { children: ReactNode }) => children,
  useConnectModal: () => ({}),
  darkTheme: () => ({}),
  lightTheme: () => ({})
}))
vi.mock('wagmi', () => ({
  WagmiProvider: ({ children }: { children: ReactNode }) => children,
  useAccount: () => ({ address: '0x1111111111111111111111111111111111111111', isConnected: true, chainId: 1 }),
  usePublicClient: () => ({ waitForTransactionReceipt: mocks.waitForReceipt }),
  useWaitForTransactionReceipt: () => ({})
}))

const hash = `0x${'1'.repeat(64)}` as Hash
const receipt = (status: TransactionReceipt['status']) => ({ status, transactionHash: hash }) as TransactionReceipt
function SubmitApproval({ chainId = 1 }: { chainId?: number }) {
  const { notifications } = useVaultWidgetRuntime()
  return (
    <button
      type="button"
      onClick={() =>
        void notifications.createSubmitted({
          amount: '1',
          fromAddress: '0x2222222222222222222222222222222222222222',
          fromChainId: chainId,
          fromSymbol: 'TEST',
          ownerAddress: '0x1111111111111111111111111111111111111111',
          status: 'pending',
          txHash: hash,
          type: 'approve'
        })
      }
    >
      Submit approval
    </button>
  )
}

afterEach(cleanup)
beforeEach(() => vi.clearAllMocks())

describe('session transaction receipts', () => {
  it('marks a reverted approval failed after its originating widget unmounts', async () => {
    const pending = Promise.withResolvers<TransactionReceipt>()
    mocks.waitForReceipt.mockReturnValue(pending.promise)
    const view = render(
      <Providers>
        <SubmitApproval />
      </Providers>
    )
    fireEvent.click(screen.getByRole('button', { name: 'Submit approval' }))
    await screen.findByText('approve · Pending')
    view.rerender(
      <Providers>
        <div>Another vault</div>
      </Providers>
    )
    await act(async () => pending.resolve(receipt('reverted')))
    await screen.findByText('approve · Failed')
  })

  it('keeps RPC failures unresolved and recovers on the next receipt lookup', async () => {
    mocks.waitForReceipt.mockRejectedValueOnce(new Error('RPC unavailable')).mockResolvedValue(receipt('success'))
    render(
      <Providers>
        <SubmitApproval />
      </Providers>
    )
    fireEvent.click(screen.getByRole('button', { name: 'Submit approval' }))
    await waitFor(() => expect(mocks.waitForReceipt).toHaveBeenCalledOnce())
    expect(screen.queryByText('approve · Failed')).toBeNull()
    expect(screen.getByText('approve · Pending')).toBeDefined()
    await screen.findByText('approve · Confirmed', {}, { timeout: 4_500 })
  })

  it('keeps the extra confirmation requirement on Base', async () => {
    mocks.waitForReceipt.mockResolvedValue(receipt('success'))
    render(
      <Providers>
        <SubmitApproval chainId={8453} />
      </Providers>
    )
    fireEvent.click(screen.getByRole('button', { name: 'Submit approval' }))
    await screen.findByText('approve · Confirmed')
    expect(mocks.waitForReceipt).toHaveBeenCalledWith(expect.objectContaining({ hash, confirmations: 2 }))
  })

  it('does not report a successful cancellation receipt as a successful approval', async () => {
    mocks.waitForReceipt.mockImplementation(async ({ onReplaced }: WaitForTransactionReceiptParameters) => {
      onReplaced?.({ reason: 'cancelled' } as Parameters<NonNullable<typeof onReplaced>>[0])
      return receipt('success')
    })
    render(
      <Providers>
        <SubmitApproval />
      </Providers>
    )
    fireEvent.click(screen.getByRole('button', { name: 'Submit approval' }))
    await screen.findByText('approve · Failed')
    expect(screen.queryByText('approve · Confirmed')).toBeNull()
  })
})
