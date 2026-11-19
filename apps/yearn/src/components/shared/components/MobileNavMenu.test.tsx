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
vi.mock('@/hooks/useSiteHealth', () => ({
  useSiteHealth: () => ({ data: undefined, isError: false, isPending: true })
}))
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

describe('mobile navigation', () => {
  it('closes navigation when opening full system status', async () => {
    render(<MobileNavigation />)
    fireEvent.click(screen.getByRole('button', { name: 'Open navigation menu' }))
    const statusLink = await screen.findByRole('link', { name: 'Full system status' })

    expect(statusLink.getAttribute('href')).toBe('/status')
    statusLink.addEventListener('click', (event) => event.preventDefault())
    fireEvent.click(statusLink)

    expect(wallet.closeNavigation).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(document.body.style.overflow).toBe('')
  })
})
