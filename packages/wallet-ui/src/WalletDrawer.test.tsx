import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useWalletDrawer } from '@yearn/wallet-ui/context'
import { WalletDrawerProvider } from '@yearn/wallet-ui/WalletDrawer'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ConnectorAlreadyConnectedError } from 'wagmi'

type TMockAccount = { status: string; connector?: { uid: string } }

const mocks = vi.hoisted(() => ({
  connectAsync: vi.fn(),
  openConnectModal: vi.fn(),
  connectWalletConnect: vi.fn(),
  switchAccount: vi.fn(),
  disconnect: vi.fn(),
  accountChange: undefined as ((account: TMockAccount, previousAccount: TMockAccount) => void) | undefined,
  config: {},
  connectModalOpen: false,
  isConnected: false,
  connector: undefined as { uid: string } | undefined,
  mobile: false,
  connectors: [
    { id: 'io.rabby', uid: 'rabby', name: 'Rabby', type: 'injected' },
    { id: 'com.walletchan', uid: 'walletchan', name: 'WalletChan', type: 'injected' },
    { id: 'walletConnect', uid: 'wc', name: 'WalletConnect', type: 'walletConnect' }
  ]
}))

vi.mock('wagmi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('wagmi')>()),
  useConfig: () => mocks.config,
  useAccount: () => ({ isConnected: mocks.isConnected, connector: mocks.connector }),
  useConnect: () => ({ connectors: mocks.connectors, connectAsync: mocks.connectAsync })
}))

vi.mock('wagmi/actions', () => ({
  getAccount: () => ({ connector: mocks.connector }),
  getConnections: () => [...mocks.connectors, { uid: 'external-wallet' }].map((connector) => ({ connector })),
  switchAccount: mocks.switchAccount,
  disconnect: mocks.disconnect,
  watchAccount: (
    _config: unknown,
    { onChange }: { onChange: (account: TMockAccount, previousAccount: TMockAccount) => void }
  ) => {
    const previous = mocks.accountChange
    mocks.accountChange = onChange
    return () => {
      mocks.accountChange = previous
    }
  }
}))

vi.mock('@rainbow-me/rainbowkit', () => ({
  useConnectModal: () => ({ openConnectModal: mocks.openConnectModal, connectModalOpen: mocks.connectModalOpen }),
  WalletButton: {
    Custom: ({ children }: { children: (props: unknown) => ReactNode }) =>
      children({
        connect: mocks.connectWalletConnect,
        mounted: true,
        ready: false,
        connector: mocks.connectors.find(({ id }) => id === 'walletConnect')
      })
  }
}))

function Trigger() {
  const { isConnecting, toggleWalletDrawer } = useWalletDrawer()
  return (
    <>
      <button type="button" data-wallet-drawer-trigger onClick={toggleWalletDrawer}>
        Wallet
      </button>
      <span data-testid="pending">{String(isConnecting)}</span>
      <button type="button">After wallet</button>
    </>
  )
}

function App() {
  return (
    <WalletDrawerProvider>
      <Trigger />
    </WalletDrawerProvider>
  )
}

const deferred = () => {
  const callbacks: { resolve?: () => void; reject?: (error: Error) => void } = {}
  const promise = new Promise<void>((resolve, reject) => {
    callbacks.resolve = resolve
    callbacks.reject = reject
  })
  return { promise, resolve: () => callbacks.resolve?.(), reject: (error: Error) => callbacks.reject?.(error) }
}

const open = () => {
  const trigger = screen.getByRole('button', { name: 'Wallet' })
  trigger.focus()
  fireEvent.click(trigger)
  return trigger
}

beforeEach(() => {
  mocks.connectAsync.mockReset()
  mocks.openConnectModal.mockReset()
  mocks.connectWalletConnect.mockReset()
  mocks.switchAccount.mockReset()
  mocks.disconnect.mockReset()
  mocks.accountChange = undefined
  mocks.connectModalOpen = false
  mocks.isConnected = false
  mocks.connector = undefined
  mocks.mobile = false
  mocks.connectors = [
    { id: 'io.rabby', uid: 'rabby', name: 'Rabby', type: 'injected' },
    { id: 'com.walletchan', uid: 'walletchan', name: 'WalletChan', type: 'injected' },
    { id: 'walletConnect', uid: 'wc', name: 'WalletConnect', type: 'walletConnect' }
  ]
  vi.stubGlobal('matchMedia', () => ({
    matches: mocks.mobile,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  }))
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('connection attempt ownership', () => {
  it('opens immediately, connects detected EIP-6963 through Wagmi and closes on success', async () => {
    render(<App />)
    open()
    expect(screen.getByRole('dialog')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'WalletChan Detected' }))
    expect(mocks.connectAsync).toHaveBeenCalledWith({ connector: mocks.connectors[1] })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(screen.getByTestId('pending').textContent).toBe('false')
  })

  it('settles rejection and allows a retry without reopening the panel', async () => {
    const request = deferred()
    mocks.connectAsync.mockReturnValueOnce(request.promise)
    render(<App />)
    open()
    fireEvent.click(screen.getByRole('button', { name: 'Rabby Detected' }))
    expect(screen.getByTestId('pending').textContent).toBe('true')
    await act(async () => request.reject(new Error('User rejected request')))
    expect(screen.getByTestId('pending').textContent).toBe('false')
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getByRole('button', { name: 'Rabby Detected' })).toBeTruthy()
  })

  it('reuses the selected wallet restored during refresh before reconnect finishes', async () => {
    const request = deferred()
    mocks.connectAsync.mockReturnValueOnce(request.promise)
    render(<App />)
    open()
    fireEvent.click(screen.getByRole('button', { name: 'Rabby Detected' }))
    // Wagmi already has this account, but isConnected stays false while it checks other connectors.
    mocks.connector = { uid: 'rabby' }
    await act(async () => request.reject(new ConnectorAlreadyConnectedError()))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getByTestId('pending').textContent).toBe('false')
    expect(mocks.disconnect).not.toHaveBeenCalled()
  })

  it('does not let a restored wallet close a newer connection attempt', async () => {
    const first = deferred()
    const second = deferred()
    mocks.connectAsync.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    render(<App />)
    open()
    fireEvent.click(screen.getByRole('button', { name: 'Rabby Detected' }))
    fireEvent.click(screen.getByRole('button', { name: 'WalletChan Detected' }))
    mocks.connector = { uid: 'rabby' }
    await act(async () => first.reject(new ConnectorAlreadyConnectedError()))
    expect(screen.getByRole('button', { name: 'Waiting for WalletChan…' })).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()
    await act(async () => second.reject(new Error('User rejected request')))
    expect(screen.getByTestId('pending').textContent).toBe('false')
  })

  it('Escape clears pending and old failure cannot replace a newer attempt', async () => {
    const first = deferred()
    const second = deferred()
    mocks.connectAsync.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    render(<App />)
    const trigger = open()
    fireEvent.click(screen.getByRole('button', { name: 'Rabby Detected' }))
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.getByTestId('pending').textContent).toBe('false')
    expect(document.activeElement).toBe(trigger)
    open()
    fireEvent.click(screen.getByRole('button', { name: 'WalletChan Detected' }))
    await act(async () => first.reject(new Error('Old request failed')))
    expect(screen.getByTestId('pending').textContent).toBe('true')
    expect(screen.queryByRole('alert')).toBeNull()
    await act(async () => second.resolve())
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('does not let an old success close a newer connection request', async () => {
    const first = deferred()
    const second = deferred()
    mocks.connectAsync.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    const view = render(<App />)
    open()
    fireEvent.click(screen.getByRole('button', { name: 'Rabby Detected' }))
    fireEvent.click(screen.getByRole('button', { name: 'WalletChan Detected' }))
    mocks.isConnected = true
    mocks.connector = { uid: 'rabby' }
    view.rerender(<App />)
    await act(async () => first.resolve())
    expect(screen.getByRole('button', { name: 'Waiting for WalletChan…' })).toBeTruthy()
    expect(screen.getByRole('dialog')).toBeTruthy()
    await act(async () => second.resolve())
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('keeps a retry of the same detected connector pending when the old request succeeds', async () => {
    const first = deferred()
    const retry = deferred()
    mocks.connectAsync.mockReturnValueOnce(first.promise).mockReturnValueOnce(retry.promise)
    const view = render(<App />)
    open()
    fireEvent.click(screen.getByRole('button', { name: 'Rabby Detected' }))
    fireEvent.keyDown(document, { key: 'Escape' })
    open()
    fireEvent.click(screen.getByRole('button', { name: 'Rabby Detected' }))
    mocks.isConnected = true
    mocks.connector = { uid: 'rabby' }
    view.rerender(<App />)
    await act(async () => first.resolve())
    expect(screen.queryByRole('dialog')).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Waiting for Rabby…' }).getAttribute('aria-busy')).toBe('true')
    await act(async () => retry.resolve())
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('hands QR ownership to RainbowKit and can reopen after dismissal despite stale transport readiness', async () => {
    const view = render(<App />)
    const trigger = open()
    fireEvent.click(screen.getByRole('button', { name: 'WalletConnect' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByTestId('pending').textContent).toBe('false')
    await waitFor(() => expect(mocks.connectWalletConnect).toHaveBeenCalledTimes(1))
    mocks.connectModalOpen = true
    view.rerender(<App />)
    mocks.connectModalOpen = false
    view.rerender(<App />)
    expect(document.activeElement).toBe(trigger)
    open()
    fireEvent.click(screen.getByRole('button', { name: 'WalletConnect' }))
    await waitFor(() => expect(mocks.connectWalletConnect).toHaveBeenCalledTimes(2))
    expect(screen.getByTestId('pending').textContent).toBe('false')
  })

  it('routes phone WalletConnect to the curated RainbowKit chooser and can reopen after dismissal', async () => {
    vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)' })
    const view = render(<App />)
    open()
    fireEvent.click(screen.getByRole('button', { name: 'WalletConnect' }))
    await waitFor(() => expect(mocks.openConnectModal).toHaveBeenCalledOnce())
    expect(mocks.connectWalletConnect).not.toHaveBeenCalled()
    mocks.connectModalOpen = true
    view.rerender(<App />)
    mocks.connectModalOpen = false
    view.rerender(<App />)
    open()
    fireEvent.click(screen.getByRole('button', { name: 'WalletConnect' }))
    await waitFor(() => expect(mocks.openConnectModal).toHaveBeenCalledTimes(2))
    expect(screen.getByTestId('pending').textContent).toBe('false')
  })

  it.each(['walletchan', 'external-wallet'])(
    'restores %s if an obsolete provider response displaces it',
    async (previousUid) => {
      const first = deferred()
      const second = deferred()
      mocks.connectAsync.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
      render(<App />)
      open()
      fireEvent.click(screen.getByRole('button', { name: 'Rabby Detected' }))
      fireEvent.click(screen.getByRole('button', { name: 'WalletChan Detected' }))
      await act(async () => second.resolve())
      mocks.connector = { uid: 'rabby' }
      mocks.accountChange?.(
        { status: 'connected', connector: mocks.connector },
        { status: 'connected', connector: { uid: previousUid } }
      )
      await act(async () => first.resolve())
      expect(mocks.switchAccount).toHaveBeenCalledWith(mocks.config, { connector: { uid: previousUid } })
      expect(mocks.disconnect).toHaveBeenCalledWith(mocks.config, { connector: mocks.connectors[0] })
    }
  )

  it('keeps an explicit disconnect when an obsolete provider request later succeeds', async () => {
    const request = deferred()
    mocks.connectAsync.mockReturnValueOnce(request.promise)
    render(<App />)
    open()
    fireEvent.click(screen.getByRole('button', { name: 'Rabby Detected' }))
    fireEvent.keyDown(document, { key: 'Escape' })
    mocks.connector = { uid: 'rabby' }
    mocks.accountChange?.({ status: 'connected', connector: mocks.connector }, { status: 'disconnected' })
    await act(async () => request.resolve())
    expect(mocks.disconnect).toHaveBeenCalledWith(mocks.config, { connector: mocks.connectors[0] })
    expect(mocks.switchAccount).not.toHaveBeenCalled()
  })

  it('restores a newer detected account if an abandoned QR pairing later connects', async () => {
    const view = render(<App />)
    open()
    fireEvent.click(screen.getByRole('button', { name: 'WalletConnect' }))
    await waitFor(() => expect(mocks.connectWalletConnect).toHaveBeenCalledOnce())
    mocks.connectModalOpen = true
    view.rerender(<App />)
    mocks.connectModalOpen = false
    view.rerender(<App />)
    open()
    fireEvent.click(screen.getByRole('button', { name: 'WalletChan Detected' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    mocks.connector = { uid: 'wc' }
    await act(async () =>
      mocks.accountChange?.(
        { status: 'connected', connector: mocks.connector },
        { status: 'connected', connector: { uid: 'walletchan' } }
      )
    )
    expect(mocks.switchAccount).toHaveBeenCalledWith(mocks.config, { connector: { uid: 'walletchan' } })
  })

  it('accepts the active QR pairing and leaves its modal lifecycle to RainbowKit', async () => {
    const view = render(<App />)
    open()
    fireEvent.click(screen.getByRole('button', { name: 'WalletConnect' }))
    await waitFor(() => expect(mocks.connectWalletConnect).toHaveBeenCalledOnce())
    mocks.connectModalOpen = true
    view.rerender(<App />)
    mocks.connector = { uid: 'wc' }
    await act(async () =>
      mocks.accountChange?.({ status: 'connected', connector: mocks.connector }, { status: 'disconnected' })
    )
    expect(mocks.switchAccount).not.toHaveBeenCalled()
    expect(mocks.disconnect).not.toHaveBeenCalled()
  })

  it('uses RainbowKit for More wallets and supports missing WalletConnect configuration', async () => {
    const view = render(<App />)
    open()
    fireEvent.click(screen.getByRole('button', { name: 'More wallets' }))
    await waitFor(() => expect(mocks.openConnectModal).toHaveBeenCalledOnce())
    mocks.connectors = mocks.connectors.filter(({ id }) => id !== 'walletConnect')
    view.rerender(<App />)
    open()
    expect((screen.getByRole('button', { name: 'WalletConnect Unavailable' }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: 'More wallets' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('does not reopen a dismissed secondary modal when its old opening promise later fails', async () => {
    const request = deferred()
    mocks.connectWalletConnect.mockReturnValue(request.promise)
    const view = render(<App />)
    open()
    fireEvent.click(screen.getByRole('button', { name: 'WalletConnect' }))
    await waitFor(() => expect(mocks.connectWalletConnect).toHaveBeenCalledOnce())
    mocks.connectModalOpen = true
    view.rerender(<App />)
    mocks.connectModalOpen = false
    view.rerender(<App />)
    await act(async () => request.reject(new Error('Old transport failure')))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByTestId('pending').textContent).toBe('false')
  })
})

describe('adaptive wallet surface', () => {
  it('click-away can dismiss a pending request and reopening has no stale spinner', () => {
    mocks.connectAsync.mockReturnValue(new Promise(() => undefined))
    render(<App />)
    open()
    fireEvent.click(screen.getByRole('button', { name: 'Rabby Detected' }))
    fireEvent.pointerDown(screen.getByRole('button', { name: 'After wallet' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    open()
    expect(screen.getByTestId('pending').textContent).toBe('false')
  })

  it('mobile traps Tab, locks page scrolling, and restores page and trigger on close', async () => {
    mocks.mobile = true
    document.body.style.overflow = 'scroll'
    const view = render(<App />)
    const trigger = open()
    expect(screen.getByRole('dialog').getAttribute('aria-modal')).toBe('true')
    expect(document.body.style.overflow).toBe('hidden')
    expect(view.container.inert).toBe(true)
    const first = screen.getByRole('button', { name: 'Close wallet picker' })
    const last = screen.getByRole('button', { name: 'More wallets' })
    last.focus()
    fireEvent.keyDown(document, { key: 'Tab' })
    expect(document.activeElement).toBe(first)
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(last)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(document.body.style.overflow).toBe('scroll')
    expect(view.container.inert).not.toBe(true)
    expect(document.activeElement).toBe(trigger)
    document.body.style.overflow = ''
  })

  it('releases mobile inert and scroll before handing off to RainbowKit', async () => {
    mocks.mobile = true
    const view = render(<App />)
    open()
    mocks.connectWalletConnect.mockImplementation(() => {
      expect(view.container.inert).not.toBe(true)
      expect(document.body.style.overflow).toBe('')
    })
    fireEvent.click(screen.getByRole('button', { name: 'WalletConnect' }))
    await waitFor(() => expect(mocks.connectWalletConnect).toHaveBeenCalledOnce())
  })

  it('desktop Tab exits the portal to the control after its trigger', () => {
    render(<App />)
    open()
    screen.getByRole('button', { name: 'More wallets' }).focus()
    fireEvent.keyDown(document, { key: 'Tab' })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'After wallet' }))
  })
})
