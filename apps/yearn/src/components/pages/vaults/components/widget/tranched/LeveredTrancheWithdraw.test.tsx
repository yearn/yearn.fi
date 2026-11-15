// @vitest-environment jsdom
import { LeveredTrancheWithdraw } from '@pages/vaults/components/widget/tranched/LeveredTrancheWithdraw'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import type { ComponentProps, ReactNode } from 'react'
import { afterEach, expect, it, vi } from 'vitest'

const account = '0x1111111111111111111111111111111111111111'
const simulate = vi.hoisted(() => vi.fn(() => ({ isSuccess: true, data: { request: {} } })))

vi.mock('wagmi', () => ({ useAccount: () => ({ address: account }) }))
vi.mock('@shared/hooks/useChainTimestamp', () => ({ useChainTimestamp: () => ({ timestamp: 100 }) }))
vi.mock('@shared/hooks/useAppWagmi', () => ({
  useReadContract: ({ functionName }: { functionName: string }) => ({
    data: functionName === 'maxWithdraw' ? 1_000_000n : undefined,
    refetch: vi.fn()
  }),
  useSimulateContract: simulate
}))
vi.mock('@yearn/vault-widget/advanced', () => ({
  TransactionOverlay: () => null,
  InfoOverlay: ({ isOpen, children }: { isOpen: boolean; children: ReactNode }) => (isOpen ? children : null),
  WidgetWithdraw: ({
    contentBelowInput,
    disableFlow,
    hideActionButton
  }: ComponentProps<typeof import('@yearn/vault-widget/advanced').WidgetWithdraw>) => (
    <div data-flow-disabled={disableFlow}>
      <section aria-label="Preview cooldown">{contentBelowInput}</section>
      {!hideActionButton ? <button type="button">{'Withdraw'}</button> : null}
    </div>
  )
}))

afterEach(cleanup)

it('keeps Junior withdrawal and cooldown actions disabled in the preview', () => {
  render(
    <LeveredTrancheWithdraw
      vaultAddress="0x2222222222222222222222222222222222222222"
      assetAddress="0x3333333333333333333333333333333333333333"
      chainId={1}
      vaultSymbol="yvUSD-B"
      vaultUserData={{
        assetToken: undefined,
        vaultToken: undefined,
        stakingToken: undefined,
        pricePerShare: 1_000_000n,
        availableToDeposit: 0n,
        depositedShares: 10n ** 18n,
        depositedValue: 1_000_000n,
        stakingWithdrawableAssets: 0n,
        stakingRedeemableShares: 0n,
        isLoading: false,
        refetch: vi.fn()
      }}
      disableActions
    />
  )

  const panel = within(screen.getByRole('region', { name: 'Preview cooldown' }))
  expect((panel.getByRole('button', { name: 'Withdraw' }) as HTMLButtonElement).disabled).toBe(true)
  expect((panel.getByRole('button', { name: 'Start Cooldown' }) as HTMLButtonElement).disabled).toBe(true)
  expect(screen.getAllByRole('button', { name: 'Withdraw' })).toHaveLength(1)
  expect(panel.getByText('Cooldown remaining:')).toBeTruthy()
  expect(panel.getByText('Not started')).toBeTruthy()
  expect(panel.getByText('Withdrawal window remaining: Closed')).toBeTruthy()
  fireEvent.click(panel.getByRole('button', { name: 'more info' }))
  expect(panel.getByText('Cooldown and withdrawal transactions are disabled in this preview.')).toBeTruthy()
  expect(simulate).toHaveBeenCalledWith(expect.objectContaining({ query: { enabled: false } }))
})
