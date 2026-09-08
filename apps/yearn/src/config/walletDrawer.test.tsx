// @vitest-environment jsdom

import { useIsWalletConnecting, useWeb3, Web3ContextApp } from '@shared/contexts/useWeb3'
import { WalletDrawerProvider } from '@yearn/wallet-ui/WalletDrawer'
import { act, memo } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const walletState = vi.hoisted(() => ({
  connectingWallet: undefined as { id: string } | undefined,
  isConnected: false,
  isConnecting: false,
  modalOpen: false,
  runtime: 'app',
  trackEvent: vi.fn(),
  openAppKit: vi.fn(),
  setThemeMode: vi.fn()
}))

vi.mock('@reown/appkit/react', () => ({
  useAppKit: () => ({ open: walletState.openAppKit }),
  useAppKitState: () => ({ connectingWallet: walletState.connectingWallet }),
  useAppKitTheme: () => ({ setThemeMode: walletState.setThemeMode })
}))

vi.mock('wagmi', () => ({
  useAccount: () => ({ isConnected: walletState.isConnected, isConnecting: walletState.isConnecting }),
  useEnsName: () => ({ data: undefined, isLoading: false }),
  useConnect: () => ({ connectors: [{ id: 'io.rabby', name: 'Rabby', type: 'injected', uid: 'rabby' }] })
}))

vi.mock('@yearn/wallet-ui/ReownWalletModalOverrides', () => ({ ReownWalletModalOverrides: () => null }))
vi.mock('@hooks/usePlausible', () => ({ usePlausible: () => walletState.trackEvent }))
vi.mock('@shared/utils/tools.address', () => ({ toAddress: (address: string) => address }))
vi.mock('@shared/utils', () => ({
  fetchClusterName: vi.fn(),
  getClusterImageUrl: vi.fn(),
  isAddress: () => false,
  isSafeConnectorId: () => false
}))
vi.mock('@/config/agentWallet', () => ({ AGENT_WALLET_ID: 'agent', shouldAutoConnectAgentWallet: () => false }))
vi.mock('@/config/tenderly', () => ({ resolveConnectedCanonicalChainId: () => undefined }))
vi.mock('@/config/wagmi', () => ({
  connectYearnWallet: vi.fn(),
  disconnectYearnWallet: vi.fn(),
  requestYearnIframeWalletConnection: vi.fn(),
  get yearnWalletRuntime() {
    return walletState.runtime
  }
}))

const roots: Root[] = []

function WalletStatus() {
  const { openLoginModal: openWalletDrawer } = useWeb3()
  const isConnecting = useIsWalletConnecting()

  return (
    <button type="button" data-wallet-drawer-trigger onClick={openWalletDrawer}>
      {isConnecting ? 'Connecting…' : 'Ready'}
    </button>
  )
}

async function renderWalletDrawer() {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  roots.push(root)
  const accountRender = vi.fn()
  const AccountConsumer = memo(function AccountConsumer() {
    const { address } = useWeb3()
    accountRender(address)
    return null
  })
  const appKit = {
    setThemeMode: walletState.setThemeMode,
    connectWallet: vi.fn(() => {
      walletState.connectingWallet = { id: 'io.rabby' }
      return new Promise<void>(() => undefined)
    }),
    getWalletList: vi.fn(() => ({ count: 0, page: 1, wallets: [], wcWallets: [] })),
    ready: vi.fn(async () => undefined),
    resetConnectingWallet: vi.fn(() => {
      walletState.connectingWallet = undefined
    })
  }
  const render = async () => {
    await act(async () => {
      root.render(
        <WalletDrawerProvider appKit={appKit}>
          <Web3ContextApp>
            <div>
              <WalletStatus />
              <AccountConsumer />
            </div>
          </Web3ContextApp>
          {walletState.modalOpen && (
            <button
              type="button"
              onClick={() => {
                walletState.modalOpen = false
              }}
            >
              Close QR
            </button>
          )}
        </WalletDrawerProvider>
      )
    })
  }
  const click = async (label: string) => {
    const button = Array.from(container.querySelectorAll('button')).find((item) => item.textContent?.includes(label))
    expect(button).toBeDefined()
    await act(async () => button?.click())
    await render()
  }

  await render()

  return { accountRender, appKit, click, container, render }
}

beforeEach(() => {
  walletState.isConnected = false
  walletState.isConnecting = false
  walletState.modalOpen = false
  walletState.runtime = 'app'
  walletState.connectingWallet = undefined
  vi.clearAllMocks()
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
  vi.stubGlobal(
    'requestAnimationFrame',
    vi.fn(() => 1)
  )
  vi.stubGlobal('cancelAnimationFrame', vi.fn())
})

afterEach(async () => {
  await act(async () => {
    roots.forEach((root) => {
      root.unmount()
    })
  })
  roots.length = 0
  document.body.replaceChildren()
  vi.unstubAllGlobals()
})

describe('wallet drawer connection state', () => {
  it('does not rerender account-data consumers when opening, waiting, or cancelling', async () => {
    const view = await renderWalletDrawer()
    const connection = Promise.withResolvers<void>()
    view.appKit.connectWallet.mockReturnValueOnce(connection.promise)
    view.accountRender.mockClear()

    await view.click('Ready')
    await view.click('Rabby')
    expect(view.container.querySelector('[data-wallet-drawer-trigger]')?.textContent).toBe('Connecting…')
    expect(view.accountRender).not.toHaveBeenCalled()

    await act(async () => connection.reject(new Error('User rejected the request')))
    expect(view.container.querySelector('[data-wallet-drawer-trigger]')?.textContent).toBe('Ready')
    expect(view.accountRender).not.toHaveBeenCalled()
  })

  it('can reopen the picker after closing WalletConnect while its transport remains connecting', async () => {
    walletState.openAppKit.mockImplementationOnce(async () => {
      walletState.isConnecting = true
      walletState.modalOpen = true
    })
    const view = await renderWalletDrawer()
    await view.click('Ready')
    await view.click('WalletConnect')
    await view.click('Close QR')

    expect(walletState.isConnecting).toBe(true)
    expect(view.container.querySelector('[data-wallet-drawer-trigger]')?.textContent).toBe('Ready')
    await view.click('Ready')
    await view.click('Rabby')
    expect(view.appKit.connectWallet).toHaveBeenCalledOnce()
  })

  it('ignores a stale AppKit flag when no picker action is pending', async () => {
    walletState.connectingWallet = { id: 'old-wallet' }
    const view = await renderWalletDrawer()
    expect(view.container.querySelector('[data-wallet-drawer-trigger]')?.textContent).toBe('Ready')
  })

  it('still reports an active host-wallet handshake inside an iframe', async () => {
    walletState.runtime = 'safe-iframe'
    walletState.isConnecting = true
    const view = await renderWalletDrawer()
    expect(view.container.querySelector('[data-wallet-drawer-trigger]')?.textContent).toBe('Connecting…')
  })

  it('shows pending state while the detected wallet still needs approval', async () => {
    const view = await renderWalletDrawer()
    await view.click('Ready')
    await view.click('Rabby')

    expect(view.appKit.connectWallet).toHaveBeenCalledOnce()
    expect(view.container.querySelector('[data-wallet-drawer-trigger]')?.textContent).toBe('Connecting…')
    expect(view.container.querySelector('[role="dialog"]')?.textContent).toContain('Waiting for Rabby…')
    expect(view.appKit.resetConnectingWallet).not.toHaveBeenCalled()
  })

  it('finishes the picker when Wagmi connects even if the AppKit promise stays pending', async () => {
    const view = await renderWalletDrawer()
    await view.click('Ready')
    await view.click('Rabby')

    view.accountRender.mockClear()
    walletState.isConnected = true
    await view.render()

    expect(view.accountRender).toHaveBeenCalled()
    expect(view.container.querySelector('[role="dialog"]')).toBeNull()
    expect(view.container.querySelector('[data-wallet-drawer-trigger]')?.textContent).toBe('Ready')
    expect(view.appKit.resetConnectingWallet).toHaveBeenCalled()

    walletState.isConnected = false
    await view.render()
    await view.click('Ready')

    expect(view.container.querySelector('[role="dialog"]')).not.toBeNull()
    expect(view.container.querySelector('[data-wallet-drawer-trigger]')?.textContent).toBe('Ready')
    await view.click('Rabby')
    expect(view.appKit.connectWallet).toHaveBeenCalledTimes(2)
  })

  it('clears an AppKit pending flag that arrives after the wallet is already connected', async () => {
    walletState.isConnected = true
    const view = await renderWalletDrawer()
    view.appKit.resetConnectingWallet.mockClear()

    walletState.connectingWallet = { id: 'io.rabby' }
    await view.render()

    expect(view.appKit.resetConnectingWallet).toHaveBeenCalled()
    expect(walletState.connectingWallet).toBeUndefined()
    expect(view.container.querySelector('[data-wallet-drawer-trigger]')?.textContent).toBe('Ready')
  })

  it('allows a silent retry after cancellation and sends only one request for a double-click', async () => {
    const view = await renderWalletDrawer()
    view.appKit.connectWallet.mockRejectedValueOnce(new Error('User rejected the request'))
    await view.click('Ready')
    await view.click('Rabby')

    expect(view.container.querySelector('[role="alert"]')).toBeNull()
    expect(view.container.querySelector('[data-wallet-drawer-trigger]')?.textContent).toBe('Ready')
    expect(view.appKit.resetConnectingWallet).toHaveBeenCalledOnce()

    const retryButton = Array.from(view.container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Rabby')
    )
    expect(retryButton).toBeDefined()
    await act(async () => {
      retryButton?.click()
      retryButton?.click()
    })
    await view.render()

    expect(view.appKit.connectWallet).toHaveBeenCalledTimes(2)
    expect(view.container.querySelector('[role="alert"]')).toBeNull()
    expect(view.container.querySelector('[role="dialog"]')?.textContent).toContain('Waiting for Rabby…')
  })

  it('restores the picker after a modal-open failure and can retry either Reown view', async () => {
    const view = await renderWalletDrawer()
    walletState.openAppKit.mockRejectedValueOnce(new Error('Network error'))
    await view.click('Ready')
    await view.click('More wallets')

    expect(view.container.querySelector('[role="alert"]')?.textContent).toContain('The wallet could not be opened')
    expect(view.container.querySelector('[data-wallet-drawer-trigger]')?.textContent).toBe('Ready')

    await view.click('More wallets')
    expect(walletState.openAppKit).toHaveBeenCalledTimes(2)
    expect(walletState.openAppKit).toHaveBeenLastCalledWith({ namespace: 'eip155', view: 'AllWallets' })
    expect(view.container.querySelector('[role="dialog"]')).toBeNull()

    await view.click('Ready')
    await view.click('WalletConnect')
    expect(walletState.openAppKit).toHaveBeenLastCalledWith({
      namespace: 'eip155',
      view: 'ConnectingWalletConnectBasic'
    })
    expect(view.appKit.connectWallet).not.toHaveBeenCalled()
    expect(view.container.querySelector('[role="dialog"]')).toBeNull()
    expect(view.container.querySelector('[data-wallet-drawer-trigger]')?.textContent).toBe('Ready')
  })
})
