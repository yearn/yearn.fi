// @vitest-environment jsdom

import { AccountDropdown } from '@shared/components/AccountDropdown'
import { WalletAccountValue } from '@shared/components/WalletAccountValue'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const wallet = vi.hoisted(() => ({
  isLoading: false,
  totalValue: 178.05
}))

vi.mock('@shared/contexts/useWallet', () => ({ useWalletStatus: () => ({ isLoading: wallet.isLoading }) }))
vi.mock('@shared/contexts/useWalletVaultTotals', () => ({ useWalletVaultTotals: () => wallet }))
vi.mock('@shared/contexts/useWeb3', () => ({
  useWeb3: () => ({ address: '0x0000000000000000000000000000000000000001', onDesactivate: vi.fn() })
}))
vi.mock('@shared/contexts/useNotifications', () => ({ useNotifications: () => ({ cachedEntries: [] }) }))
vi.mock('@shared/contexts/useYearn', () => ({ useYearn: () => ({}) }))
vi.mock('@pages/vaults/contexts/useAppSettings', () => ({ useAppSettings: () => ({}) }))
vi.mock('@hooks/useThemePreference', () => ({ useThemePreference: () => 'light', setThemePreference: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))

beforeEach(() => {
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
