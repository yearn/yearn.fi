// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { Header } from '@ybold/components/Header'
import { WalletAccountMenu } from '@ybold/components/WalletAccountMenu'
import { WalletDrawerContext } from '@yearn/wallet-ui/context'
import { WalletSurface } from '@yearn/wallet-ui/WalletSurface'
import { useEffect } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const wallet = vi.hoisted(() => ({
  address: '0x1111111111111111111111111111111111111111',
  isConnected: true,
  mobile: false,
  depositedValue: 25n * 10n ** 18n,
  balanceLoading: false,
  priceLoading: false,
  price: 1,
  mounts: 0,
  disconnect: vi.fn(),
  setAutoStake: vi.fn(),
  setSlippagePercent: vi.fn()
}))

vi.mock('wagmi', () => ({
  useAccount: () => ({ address: wallet.address, isConnected: wallet.isConnected })
}))
vi.mock('@yearn/wallet-ui/useWalletDisconnect', () => ({
  useWalletDisconnect: () => ({ disconnectAsync: wallet.disconnect, isPending: false })
}))
vi.mock('@ybold/components/WalletActivityProvider', () => ({
  useWalletActivity: () => ({ activities: [] })
}))
vi.mock('@yearn/vault-widget/internal/hooks/useVaultUserData', () => ({
  useVaultUserData: () => {
    // Track the data subscription's lifetime independently of the popup DOM.
    useEffect(() => {
      wallet.mounts += 1
    }, [])
    return { depositedValue: wallet.depositedValue, isLoading: wallet.balanceLoading, assetToken: { decimals: 18 } }
  }
}))
vi.mock('@yearn/vault-widget/internal/hooks/useVaultWidgetSpotPrices', () => ({
  useVaultWidgetSpotPrices: () => ({ getUsdPrice: () => wallet.price, isLoading: wallet.priceLoading })
}))
vi.mock('@yearn/vault-widget/runtime', () => ({
  useVaultWidgetRuntime: () => ({
    settings: {
      autoStake: true,
      setAutoStake: wallet.setAutoStake,
      slippagePercent: 0.5,
      setSlippagePercent: wallet.setSlippagePercent
    }
  })
}))

const openAccount = () => fireEvent.click(screen.getByRole('button', { name: /^Open wallet account/ }))

beforeEach(() => {
  vi.clearAllMocks()
  wallet.mounts = 0
  wallet.isConnected = true
  wallet.mobile = false
  wallet.balanceLoading = false
  wallet.priceLoading = false
  wallet.price = 1
  wallet.disconnect.mockResolvedValue(undefined)
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn(() => ({ matches: wallet.mobile, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
  })
})
afterEach(cleanup)

function headerWithPicker(isOpen: boolean) {
  return (
    <WalletDrawerContext.Provider
      value={{
        dialogId: 'test-wallet-picker',
        isConnecting: false,
        isOpen,
        openWalletDrawer: () => undefined,
        closeWalletDrawer: () => undefined,
        toggleWalletDrawer: () => undefined
      }}
    >
      <Header />
      <WalletSurface isOpen={isOpen} onClose={() => undefined} title="Connect a wallet" dialogId="test-wallet-picker">
        Choose a wallet
      </WalletSurface>
    </WalletDrawerContext.Provider>
  )
}

describe('yBOLD wallet account', () => {
  it.each([false, true])(
    'restores focus to replacement header buttons on connect and disconnect (mobile: %s)',
    async (mobile) => {
      wallet.mobile = mobile
      wallet.isConnected = false
      const view = render(headerWithPicker(false))
      const connectButton = screen.getByRole('button', { name: 'Connect Wallet' })
      connectButton.focus()
      view.rerender(headerWithPicker(true))
      await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('dialog')))

      wallet.isConnected = true
      view.rerender(headerWithPicker(false))
      const accountButton = screen.getByRole('button', { name: /^Open wallet account/ })
      await waitFor(() => expect(document.activeElement).toBe(accountButton))
      fireEvent.click(accountButton)
      await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('dialog')))

      const disconnection = Promise.withResolvers<void>()
      wallet.disconnect.mockReturnValue(disconnection.promise)
      fireEvent.click(screen.getByRole('button', { name: 'Disconnect wallet' }))
      await act(async () => {
        wallet.isConnected = false
        view.rerender(headerWithPicker(false))
        disconnection.resolve()
        await disconnection.promise
      })
      await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Connect Wallet' })))
      expect(screen.queryByRole('dialog')).toBeNull()
      expect(document.body.style.overflow).toBe('')
    }
  )

  it('keeps portfolio data mounted and shows cached value immediately on reopening', () => {
    render(<WalletAccountMenu />)
    expect(wallet.mounts).toBe(1)
    openAccount()
    expect(screen.getByRole('dialog', { name: 'Wallet account' })).toBeTruthy()
    expect(screen.getByLabelText('yBOLD position value $25.00')).toBeTruthy()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    wallet.priceLoading = true
    openAccount()
    expect(screen.getByLabelText('yBOLD position value $25.00')).toBeTruthy()
    expect(screen.queryByLabelText('Loading yBOLD position value')).toBeNull()
    expect(wallet.mounts).toBe(1)
  })

  it('opens immediately during initial loading and replaces the skeleton when data arrives', () => {
    wallet.balanceLoading = true
    const view = render(<WalletAccountMenu />)
    openAccount()
    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(screen.getByLabelText('Loading yBOLD position value')).toBeTruthy()
    wallet.balanceLoading = false
    view.rerender(<WalletAccountMenu />)
    expect(screen.queryByLabelText('Loading yBOLD position value')).toBeNull()
    expect(screen.getByLabelText('yBOLD position value $25.00')).toBeTruthy()
  })

  it('uses runtime settings and restores focus when navigating back', async () => {
    render(<WalletAccountMenu />)
    openAccount()
    fireEvent.click(screen.getByRole('button', { name: 'Open wallet settings' }))
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Back to wallet account' }))
    )
    fireEvent.click(screen.getByRole('switch', { name: 'Auto-stake deposits' }))
    fireEvent.click(screen.getByRole('button', { name: '1%' }))
    expect(wallet.setAutoStake).toHaveBeenCalledWith(false)
    expect(wallet.setSlippagePercent).toHaveBeenCalledWith(1)
    fireEvent.click(screen.getByRole('button', { name: 'Back to wallet account' }))
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Open wallet settings' }))
    )
  })

  it('keeps disconnection errors recoverable and closes after retry succeeds', async () => {
    wallet.disconnect.mockRejectedValueOnce(new Error('Connector refused'))
    render(<WalletAccountMenu />)
    openAccount()
    fireEvent.click(screen.getByRole('button', { name: 'Disconnect wallet' }))
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Unable to disconnect. Please try again.')
    fireEvent.click(screen.getByRole('button', { name: 'Disconnect wallet' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(wallet.disconnect).toHaveBeenCalledTimes(2)
  })

  it('copies the address and exposes the portfolio and recent activity', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    render(<WalletAccountMenu />)
    openAccount()
    fireEvent.click(screen.getByRole('button', { name: 'Copy wallet address' }))
    expect(await screen.findByRole('status')).toHaveProperty('textContent', 'Copied')
    expect(writeText).toHaveBeenCalledWith(wallet.address)
    expect(screen.getByRole('link', { name: 'View portfolio' }).getAttribute('href')).toBe('https://yearn.fi/portfolio')
    expect(screen.getByText('No recent yBOLD activity')).toBeTruthy()
  })
})
