// @vitest-environment jsdom
import { WalletAccountContent } from '@erc4626/components/WalletAccount'
import { SUPPORTED_CHAINS } from '@erc4626/lib/chains'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { TAccountMenuData } from '@yearn/site-header/account'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  switchChain: vi.fn(),
  pending: false,
  error: undefined as Error | undefined,
  chainId: 1 as number | undefined
}))
vi.mock('@erc4626/components/WalletActivity', () => ({ useWalletActivity: () => [] }))
vi.mock('@yearn/site-header/account', () => ({
  AccountMenu: ({ account }: { account: TAccountMenuData }) => account.networkAction
}))
vi.mock('@yearn/wallet-ui', () => ({ useWalletDisconnect: () => ({ disconnect: vi.fn() }) }))
vi.mock('wagmi', () => ({
  useAccount: () => ({
    address: '0x1111111111111111111111111111111111111111',
    chain: SUPPORTED_CHAINS.find(({ id }) => id === mocks.chainId)
  }),
  useChains: () => SUPPORTED_CHAINS,
  useSwitchChain: () => ({
    mutate: mocks.switchChain,
    isPending: mocks.pending,
    error: mocks.error
  })
}))

afterEach(cleanup)
beforeEach(() => {
  mocks.switchChain.mockReset()
  mocks.pending = false
  mocks.error = undefined
  mocks.chainId = 1
})

it('switches to Robinhood and closes only after wallet approval succeeds', () => {
  const onClose = vi.fn()
  render(<WalletAccountContent onClose={onClose} />)
  expect(screen.getAllByRole('option')).toHaveLength(SUPPORTED_CHAINS.length)
  expect(screen.getByRole('option', { name: 'Robinhood Chain' }).getAttribute('value')).toBe('4663')
  fireEvent.change(screen.getByRole('combobox', { name: 'Switch network' }), { target: { value: '4663' } })
  expect(mocks.switchChain).toHaveBeenCalledWith({ chainId: 4663 }, { onSuccess: expect.any(Function) })
  expect(onClose).not.toHaveBeenCalled()
  mocks.switchChain.mock.calls[0][1].onSuccess()
  expect(onClose).toHaveBeenCalledOnce()
})

it('prevents overlapping switches and keeps a rejected switch retryable', () => {
  const onClose = vi.fn()
  mocks.pending = true
  const view = render(<WalletAccountContent onClose={onClose} />)
  expect((screen.getByRole('combobox') as HTMLSelectElement).disabled).toBe(true)
  mocks.pending = false
  mocks.error = new Error('User rejected request')
  view.rerender(<WalletAccountContent onClose={onClose} />)
  expect((screen.getByRole('combobox') as HTMLSelectElement).value).toBe('1')
  expect((screen.getByRole('combobox') as HTMLSelectElement).disabled).toBe(false)
  expect(screen.getByRole('alert').textContent).toContain('could not be switched')
  expect(onClose).not.toHaveBeenCalled()
})

it('offers supported networks when the current wallet chain is unsupported', () => {
  mocks.chainId = 999999
  render(<WalletAccountContent onClose={vi.fn()} />)
  expect((screen.getByRole('combobox') as HTMLSelectElement).value).toBe('')
  expect(screen.getByRole('option', { name: 'Unsupported network' })).toBeTruthy()
  expect(mocks.switchChain).not.toHaveBeenCalled()
})
