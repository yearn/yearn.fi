// @vitest-environment jsdom

import { useWalletDrawer } from '@yearn/wallet-ui/context'
import { WalletDrawerProvider } from '@yearn/wallet-ui/WalletDrawer'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, it, vi } from 'vitest'

vi.mock('@reown/appkit/react', () => ({
  useAppKit: () => ({ open: vi.fn() }),
  useAppKitState: () => ({ connectingWallet: undefined }),
  // Reown creates a new setter on every render; depending on it rewrites theme styles on every click.
  useAppKitTheme: () => ({ setThemeMode: () => undefined })
}))
vi.mock('wagmi', () => ({
  useAccount: () => ({ isConnected: false }),
  useConnect: () => ({ connectors: [] })
}))
vi.mock('@yearn/wallet-ui/ReownWalletModalOverrides', () => ({ ReownWalletModalOverrides: () => null }))

function WalletTrigger() {
  const { toggleWalletDrawer } = useWalletDrawer()
  return (
    <button type="button" data-wallet-drawer-trigger onClick={toggleWalletDrawer}>
      Connect wallet
    </button>
  )
}

afterEach(() => {
  document.body.replaceChildren()
  vi.unstubAllGlobals()
})

it('only updates the external modal theme when the app theme changes', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
  vi.stubGlobal('requestAnimationFrame', () => 1)
  vi.stubGlobal('cancelAnimationFrame', vi.fn())
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  const appKit = {
    connectWallet: vi.fn(async () => undefined),
    getWalletList: vi.fn(() => ({ count: 0, page: 1, wallets: [], wcWallets: [] })),
    ready: vi.fn(async () => undefined),
    resetConnectingWallet: vi.fn(),
    setThemeMode: vi.fn()
  }
  const render = async (theme: 'dark' | 'light') => {
    await act(async () => {
      root.render(
        <WalletDrawerProvider appKit={appKit} appKitTheme={theme}>
          <WalletTrigger />
        </WalletDrawerProvider>
      )
    })
  }

  try {
    await render('light')
    expect(appKit.setThemeMode).toHaveBeenCalledExactlyOnceWith('light')

    await act(async () => container.querySelector<HTMLButtonElement>('[data-wallet-drawer-trigger]')?.click())
    expect(container.querySelector('[role="dialog"]')).not.toBeNull()
    await act(async () => container.querySelector<HTMLButtonElement>('[data-wallet-drawer-trigger]')?.click())
    expect(container.querySelector('[role="dialog"]')).toBeNull()
    await render('light')
    expect(appKit.setThemeMode).toHaveBeenCalledTimes(1)

    await render('dark')
    expect(appKit.setThemeMode).toHaveBeenCalledTimes(2)
    expect(appKit.setThemeMode).toHaveBeenLastCalledWith('dark')
  } finally {
    await act(async () => root.unmount())
  }
})
