// @vitest-environment jsdom

import { MobileNavMenu } from '@shared/components/MobileNavMenu'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { WalletDrawerContext } from '@yearn/wallet-ui/context'
import { WalletSurface } from '@yearn/wallet-ui/WalletSurface'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const wallet = vi.hoisted(() => ({
  isActive: true,
  openLoginModal: vi.fn(),
  closeNavigation: vi.fn()
}))

vi.mock('@shared/contexts/useWeb3', () => ({
  useWeb3: () => ({
    isActive: wallet.isActive,
    address: wallet.isActive ? '0x1111111111111111111111111111111111111111' : undefined,
    openLoginModal: () => wallet.openLoginModal()
  })
}))
vi.mock('@shared/contexts/useWalletVaultTotals', () => ({
  useWalletVaultTotals: () => ({ totalValue: 25, isLoading: false })
}))
vi.mock('@shared/contexts/useNotifications', () => ({ useNotifications: () => ({ cachedEntries: [] }) }))
vi.mock('@shared/contexts/useYearn', () => ({ useYearn: () => ({}) }))
vi.mock('@pages/vaults/contexts/useAppSettings', () => ({ useAppSettings: () => ({}) }))
vi.mock('@hooks/useThemePreference', () => ({ useThemePreference: () => 'light', setThemePreference: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))

function MobileNavigation() {
  const [isNavigationOpen, setIsNavigationOpen] = useState(false)
  const [isPickerOpen, setIsPickerOpen] = useState(false)
  wallet.openLoginModal.mockImplementation(() => setIsPickerOpen(true))

  return (
    <WalletDrawerContext.Provider
      value={{
        dialogId: 'test-wallet-picker',
        isConnecting: false,
        isOpen: isPickerOpen,
        closeWalletDrawer: () => setIsPickerOpen(false),
        openWalletDrawer: () => setIsPickerOpen(true),
        toggleWalletDrawer: () => setIsPickerOpen((isOpen) => !isOpen)
      }}
    >
      <button
        type="button"
        data-mobile-nav-trigger
        data-wallet-drawer-trigger
        onClick={() => setIsNavigationOpen(true)}
      >
        Open navigation menu
      </button>
      <MobileNavMenu
        isOpen={isNavigationOpen}
        onClose={() => {
          wallet.closeNavigation()
          setIsNavigationOpen(false)
        }}
        pathname="/vaults"
        isDarkTheme={false}
        onThemeToggle={() => undefined}
        notificationStatus={null}
      />
      <WalletSurface
        isOpen={isPickerOpen}
        onClose={() => setIsPickerOpen(false)}
        dialogId="test-wallet-picker"
        title="Connect a wallet"
      >
        Choose a wallet
      </WalletSurface>
    </WalletDrawerContext.Provider>
  )
}

beforeEach(() => {
  wallet.isActive = true
  wallet.closeNavigation.mockClear()
  wallet.openLoginModal.mockClear()
  vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  )
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('mobile navigation wallet handoff', () => {
  it.each([true, false])(
    'releases navigation immediately and restores the menu opener (connected: %s)',
    async (isActive) => {
      wallet.isActive = isActive
      render(<MobileNavigation />)
      const opener = screen.getByRole('button', { name: 'Open navigation menu' })
      opener.focus()
      fireEvent.click(opener)
      const walletButton = await screen.findByRole('button', { name: 'Wallet' })
      walletButton.focus()
      fireEvent.click(walletButton)

      expect(wallet.closeNavigation).toHaveBeenCalledTimes(1)
      expect(wallet.openLoginModal).toHaveBeenCalledTimes(isActive ? 0 : 1)
      expect(screen.queryByRole('button', { name: 'Close navigation menu', hidden: true })).toBeNull()
      const panel = screen.getByRole('dialog', { name: isActive ? 'Wallet' : 'Connect a wallet' })
      expect(screen.getAllByRole('dialog')).toHaveLength(1)
      expect(document.body.style.overflow).toBe('hidden')
      await waitFor(() => expect(document.activeElement).toBe(panel))

      fireEvent.keyDown(document, { key: 'Escape' })
      expect(screen.queryByRole('dialog')).toBeNull()
      await waitFor(() => expect(document.activeElement).toBe(opener))
      expect(document.body.style.overflow).toBe('')
      expect(opener.closest('[inert]')).toBeNull()
    }
  )
})
