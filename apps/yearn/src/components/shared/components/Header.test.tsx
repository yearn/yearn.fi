// @vitest-environment jsdom
import AppHeader from '@shared/components/Header'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'

const acknowledge = vi.hoisted(() => vi.fn())
vi.mock('next/navigation', () => ({ usePathname: () => '/vaults' }))
vi.mock('@hooks/useThemePreference', () => ({ useThemePreference: () => 'light', setThemePreference: vi.fn() }))
vi.mock('@shared/contexts/useNotifications', () => ({
  useNotifications: () => ({ notificationStatus: 'pending', acknowledge })
}))
vi.mock('@shared/contexts/useWeb3', () => ({
  useWeb3: () => ({
    address: '0x1111111111111111111111111111111111111111',
    isActive: true,
    isIdentityLoading: true,
    isUserConnecting: false
  })
}))
vi.mock('@shared/contexts/useWallet', () => ({ useWalletStatus: () => ({ isLoading: true }) }))
vi.mock('@shared/contexts/useTenderlyPanel', () => ({ useTenderlyPanel: () => ({}) }))
vi.mock('@shared/components/yToast', () => ({ toast: vi.fn() }))
vi.mock('@shared/components/AccountDropdown', () => ({
  AccountDropdown: ({ isOpen }: { isOpen: boolean }) => (isOpen ? <div>Account is open</div> : null)
}))
vi.mock('@shared/components/HeaderNavMenu', () => ({ HeaderNavMenu: () => null }))
vi.mock('@shared/components/MobileNavMenu', () => ({ MobileNavMenu: () => null }))
vi.mock('wagmi', () => ({ useAccount: () => ({}), useSwitchChain: () => ({}) }))
vi.mock('@/config/tenderly', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  isTenderlyModeConfigured: () => false,
  isTenderlyModeEnabled: () => false
}))
afterEach(cleanup)

it('acknowledges activity and opens the account while balances and identity are still loading', () => {
  render(<AppHeader />)
  fireEvent.click(screen.getByText(/0x1111/))
  expect(acknowledge).toHaveBeenCalledOnce()
  expect(screen.getByText('Account is open')).toBeTruthy()
})
