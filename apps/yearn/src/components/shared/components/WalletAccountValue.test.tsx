// @vitest-environment jsdom

import { AccountDropdown } from '@shared/components/AccountDropdown'
import { WalletAccountValue } from '@shared/components/WalletAccountValue'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const wallet = vi.hoisted(() => ({
  disconnect: vi.fn(),
  isLoading: false,
  totalValue: 178.05
}))

vi.mock('@shared/contexts/useWallet', () => ({ useWalletStatus: () => ({ isLoading: wallet.isLoading }) }))
vi.mock('@shared/contexts/useWalletVaultTotals', () => ({ useWalletVaultTotals: () => wallet }))
vi.mock('@shared/contexts/useWeb3', () => ({
  useWeb3: () => ({
    isActive: true,
    address: '0x0000000000000000000000000000000000000001',
    onDesactivate: wallet.disconnect
  })
}))
vi.mock('@shared/contexts/useNotifications', () => ({ useNotifications: () => ({ cachedEntries: [] }) }))
vi.mock('@shared/contexts/useYearn', () => ({ useYearn: () => ({}) }))
vi.mock('@pages/vaults/contexts/useAppSettings', () => ({ useAppSettings: () => ({}) }))
vi.mock('@hooks/useThemePreference', () => ({ useThemePreference: () => 'light', setThemePreference: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))

beforeEach(() => {
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
  wallet.disconnect.mockClear()
  wallet.isLoading = false
  wallet.totalValue = 178.05
})

afterEach(() => {
  cleanup()
})

it('shows the ready value immediately on both opening and reopening', () => {
  const onClose = vi.fn()
  const view = render(<AccountDropdown isOpen onClose={onClose} />)

  expect(screen.getByRole('button', { name: 'View portfolio' })).toBeDefined()
  expect(screen.queryByRole('status')).toBeNull()
  expect(screen.getByText('$178')).toBeDefined()

  view.rerender(<AccountDropdown isOpen={false} onClose={onClose} />)
  view.rerender(<AccountDropdown isOpen onClose={onClose} />)
  expect(screen.getByRole('button', { name: 'View portfolio' })).toBeDefined()
  expect(screen.queryByRole('status')).toBeNull()
  expect(screen.getByText('$178')).toBeDefined()
})

it('keeps the skeleton while balances load and treats a loaded zero as a real value', () => {
  wallet.isLoading = true
  const view = render(<WalletAccountValue />)
  expect(screen.getByRole('status')).toBeDefined()

  wallet.isLoading = false
  wallet.totalValue = 0
  view.rerender(<WalletAccountValue />)
  expect(screen.queryByRole('status')).toBeNull()
  expect(screen.getByText('$0')).toBeDefined()

  wallet.isLoading = true
  view.rerender(<WalletAccountValue />)
  expect(screen.getByRole('status')).toBeDefined()
  expect(screen.queryByText('$0')).toBeNull()
})

it('allows disconnect while values are loading and resets settings when reopened', () => {
  wallet.isLoading = true
  const onClose = vi.fn()
  const view = render(<AccountDropdown isOpen onClose={onClose} />)
  fireEvent.click(screen.getByRole('button', { name: 'Disconnect wallet' }))
  expect(wallet.disconnect).toHaveBeenCalledTimes(1)
  expect(onClose).toHaveBeenCalledTimes(1)
  fireEvent.click(screen.getByRole('button', { name: 'Wallet settings' }))
  expect(screen.getByRole('button', { name: 'Back to account' })).toBeDefined()
  view.rerender(<AccountDropdown isOpen={false} onClose={onClose} />)
  view.rerender(<AccountDropdown isOpen onClose={onClose} />)
  expect(screen.getByRole('button', { name: 'View portfolio' })).toBeDefined()
  expect(screen.queryByRole('button', { name: 'Back to account' })).toBeNull()
})

it('rounds the whole wallet amount before separating cents', () => {
  wallet.totalValue = 1.999
  render(<WalletAccountValue />)
  expect(screen.getByText('$2')).toBeDefined()
  expect(screen.getByText('.00')).toBeDefined()
})
