import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { TWalletConnectorSummary } from '@yearn/wallet-ui/connectors'
import { useWalletDrawer } from '@yearn/wallet-ui/context'
import { WalletDrawerProvider } from '@yearn/wallet-ui/WalletDrawer'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ConnectorAlreadyConnectedError } from 'wagmi'

type TMockAccount = { status: string; connector?: { uid: string } }

const mocks = vi.hoisted(() => ({
  track: vi.fn(),
  connectAsync: vi.fn(),
  message: undefined as ((event: { type: string; data?: unknown }) => void) | undefined,
  restorePreviousAccount: vi.fn(),
  accountChange: undefined as ((account: TMockAccount, previousAccount: TMockAccount) => void) | undefined,
  config: {},
  isConnected: false,
  connector: undefined as { uid: string } | undefined,
  mobile: false,
  connectors: [
    { id: 'io.rabby', uid: 'rabby', name: 'Rabby', type: 'injected' },
    { id: 'com.walletchan', uid: 'walletchan', name: 'WalletChan', type: 'injected' },
    { id: 'walletConnect', uid: 'wc', name: 'WalletConnect', type: 'walletConnect' }
  ] as (TWalletConnectorSummary & {
    uid: string
    emitter?: { on: ReturnType<typeof vi.fn>; off: ReturnType<typeof vi.fn> }
  })[]
}))

vi.mock('wagmi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('wagmi')>()),
  useConfig: () => mocks.config,
  useAccount: () => ({ isConnected: mocks.isConnected, connector: mocks.connector }),
  useConnect: () => ({ connectors: mocks.connectors, connectAsync: mocks.connectAsync })
}))

vi.mock('wagmi/actions', () => ({
  getAccount: () => ({ connector: mocks.connector }),
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

vi.mock('@yearn/wallet-ui/connectionCleanup', () => ({ restorePreviousAccount: mocks.restorePreviousAccount }))

vi.mock('@yearn/wallet-ui/WalletQr', () => ({ WalletQr: () => <img alt="WalletConnect QR code" /> }))

function Trigger() {
  const { isConnecting, toggleWalletDrawer } = useWalletDrawer()
  return (
    <>
      <button type="button" data-wallet-entry="header" data-wallet-drawer-trigger onClick={toggleWalletDrawer}>
        Wallet
      </button>
      <span data-testid="pending">{String(isConnecting)}</span>
      <button type="button">After wallet</button>
    </>
  )
}

function App() {
  return (
    <WalletDrawerProvider onAnalytics={mocks.track}>
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
  mocks.track.mockReset()
  mocks.connectAsync.mockReset()
  mocks.message = undefined
  mocks.restorePreviousAccount.mockReset().mockResolvedValue(undefined)
  mocks.accountChange = undefined
  mocks.isConnected = false
  mocks.connector = undefined
  mocks.mobile = false
  mocks.connectors = [
    { id: 'io.rabby', uid: 'rabby', name: 'Rabby', type: 'injected' },
    { id: 'com.walletchan', uid: 'walletchan', name: 'WalletChan', type: 'injected' },
    { id: 'walletConnect', uid: 'wc', name: 'WalletConnect', type: 'walletConnect' }
  ]
  Object.assign(mocks.connectors[2], {
    emitter: {
      on: vi.fn((_event, listener) => {
        mocks.message = listener
      }),
      off: vi.fn()
    }
  })
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
  it('reports detected rejection, More wallets recovery, and only one successful connection', async () => {
    mocks.connectAsync.mockRejectedValueOnce(Object.assign(new Error('User rejected'), { code: 4001 }))
    render(<App />)
    open()
    fireEvent.click(screen.getByRole('button', { name: 'Rabby Detected' }))
    await waitFor(() =>
      expect(mocks.track).toHaveBeenCalledWith(
        'wallet_connect_result',
        expect.objectContaining({ path: 'detected', outcome: 'rejected' })
      )
    )
    fireEvent.click(screen.getByRole('button', { name: 'More wallets' }))
    fireEvent.click(screen.getByRole('button', { name: 'Trust Wallet' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await waitFor(() =>
      expect(mocks.track.mock.calls.filter(([event]) => event === 'connect_wallet')).toEqual([
        [
          'connect_wallet',
          expect.objectContaining({
            path: 'more_wallets',
            wallet_name: 'trust',
            had_previous_failure: true,
            attempt_number: 2,
            used_more_wallets: true
          })
        ]
      ])
    )
  })

  it('reports QR dismissal without treating a late result as a new connection', async () => {
    const request = deferred()
    mocks.connectAsync.mockReturnValueOnce(request.promise)
    render(<App />)
    open()
    fireEvent.click(screen.getByRole('button', { name: 'WalletConnect' }))
    fireEvent.keyDown(document, { key: 'Escape' })
    await act(async () =>
      mocks.accountChange?.({ status: 'connected', connector: mocks.connectors[2] }, { status: 'disconnected' })
    )
    await act(async () => request.resolve())
    expect(mocks.track).toHaveBeenCalledWith(
      'wallet_connect_result',
      expect.objectContaining({
        path: 'walletconnect',
        outcome: 'closed_without_connection',
        attempt_scope: 'secondary_screen'
      })
    )
    expect(mocks.track.mock.calls.filter(([event]) => event === 'connect_wallet')).toHaveLength(0)
    expect(mocks.restorePreviousAccount).toHaveBeenCalledOnce()
  })

  it.each([false, true])('shows one Trust row and connects its discovered provider (mobile: %s)', async (mobile) => {
    mocks.mobile = mobile
    const discovered = {
      id: 'com.trustwallet.app',
      uid: 'trust-discovered',
      name: 'Trust Wallet',
      type: 'injected',
      icon: 'trust-discovered.svg'
    }
    mocks.connectors.unshift(discovered)
    render(<App />)
    open()
    const rows = screen.getAllByRole('button', { name: 'Trust Wallet Detected' })
    expect(rows).toHaveLength(1)
    expect(rows[0].querySelector('img')?.getAttribute('src')).toBe('trust-discovered.svg')
    fireEvent.click(rows[0])
    expect(mocks.connectAsync).toHaveBeenCalledWith({ connector: discovered })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(mocks.track.mock.calls.filter(([event]) => event === 'connect_wallet')).toEqual([
      [
        'connect_wallet',
        expect.objectContaining({
          path: 'detected',
          wallet_name: 'trust',
          initially_visible: true,
          outcome: 'success'
        })
      ]
    ])
  })

  it('uses a local fallback logo when an announced wallet has no icon', async () => {
    mocks.connectors.unshift({ id: 'com.trustwallet.app', uid: 'trust', name: 'Trust Wallet', type: 'injected' })
    render(<App />)
    open()
    const button = screen.getByRole('button', { name: 'Trust Wallet Detected' })
    expect(button.querySelector('img')?.getAttribute('src')).toMatch(/^data:image\//)
    fireEvent.click(button)
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('uses the browser glyph for an unknown wallet without an icon', async () => {
    render(<App />)
    open()
    const button = screen.getByRole('button', { name: 'Rabby Detected' })
    expect(button.querySelector('svg')).not.toBeNull()
    fireEvent.click(button)
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('releases the mobile picker on the active account event before the connection promise settles', async () => {
    const request = deferred()
    mocks.connectAsync.mockReturnValueOnce(request.promise)
    mocks.mobile = true
    const view = render(<App />)
    const trigger = open()
    fireEvent.click(screen.getByRole('button', { name: 'Rabby Detected' }))
    expect(document.body.style.overflow).toBe('hidden')
    mocks.connector = { uid: 'rabby' }
    await act(async () =>
      mocks.accountChange?.({ status: 'connected', connector: mocks.connector }, { status: 'connecting' })
    )
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByTestId('pending').textContent).toBe('false')
    expect(view.container.inert).not.toBe(true)
    expect(document.body.style.overflow).toBe('')
    expect(document.activeElement).toBe(trigger)

    open()
    await act(async () => request.reject(new Error('Late transport failure')))
    expect(screen.queryByRole('dialog')).not.toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
    expect(mocks.restorePreviousAccount).not.toHaveBeenCalled()
    expect(mocks.track.mock.calls.filter(([event]) => event === 'connect_wallet')).toHaveLength(1)
    expect(mocks.track.mock.calls.filter(([event]) => event === 'wallet_connect_result')).toHaveLength(0)
  })

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

  it('keeps a failed wallet switch open while the previous account remains connected', async () => {
    mocks.isConnected = true
    mocks.connector = { uid: 'walletchan' }
    mocks.connectAsync.mockRejectedValueOnce(new Error('Network failed'))
    render(<App />)
    open()
    fireEvent.click(screen.getByRole('button', { name: 'Rabby Detected' }))
    await screen.findByRole('alert')
    expect(screen.getByRole('dialog')).toBeTruthy()
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
    expect(mocks.restorePreviousAccount).not.toHaveBeenCalled()
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
    await act(async () =>
      mocks.accountChange?.({ status: 'connected', connector: mocks.connector }, { status: 'connecting' })
    )
    view.rerender(<App />)
    await act(async () => first.resolve())
    expect(screen.queryByRole('dialog')).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Waiting for Rabby…' }).getAttribute('aria-busy')).toBe('true')
    await act(async () => retry.resolve())
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('reopens the same pending QR request without creating overlapping pairings', async () => {
    const request = deferred()
    mocks.connectAsync.mockReturnValueOnce(request.promise)
    render(<App />)
    const trigger = open()
    fireEvent.click(screen.getByRole('button', { name: 'WalletConnect' }))
    act(() => mocks.message?.({ type: 'display_uri', data: 'wc:test@2?key=secret' }))
    expect(screen.getByAltText('WalletConnect QR code')).toBeTruthy()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(document.activeElement).toBe(trigger)
    expect(screen.getByTestId('pending').textContent).toBe('false')
    open()
    fireEvent.click(screen.getByRole('button', { name: 'WalletConnect' }))
    expect(screen.getByAltText('WalletConnect QR code')).toBeTruthy()
    expect(mocks.connectAsync).toHaveBeenCalledOnce()
    await act(async () => request.resolve())
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(mocks.connectors[2].emitter?.off).toHaveBeenCalledWith('message', expect.any(Function))
  })

  it('routes phone WalletConnect to the curated chooser and exposes a user-initiated app link', async () => {
    vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 (iPhone)' })
    mocks.connectAsync.mockReturnValue(new Promise(() => undefined))
    render(<App />)
    open()
    fireEvent.click(screen.getByRole('button', { name: 'WalletConnect' }))
    expect(screen.getByRole('button', { name: 'Trust Wallet' })).toBeTruthy()
    expect(mocks.connectAsync).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Trust Wallet' }))
    act(() => mocks.message?.({ type: 'display_uri', data: 'wc:test@2?key=secret' }))
    expect(screen.getByRole('link', { name: 'Open Trust Wallet' }).getAttribute('href')).toBe(
      'trust://wc?uri=wc%3Atest%402%3Fkey%3Dsecret'
    )
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
      expect(mocks.restorePreviousAccount).toHaveBeenCalledWith(
        mocks.config,
        expect.objectContaining({
          connector: mocks.connectors[0],
          previousConnector: { uid: previousUid }
        })
      )
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
    expect(mocks.restorePreviousAccount).toHaveBeenCalledWith(
      mocks.config,
      expect.objectContaining({
        connector: mocks.connectors[0],
        previousConnector: undefined
      })
    )
  })

  it('restores a newer detected account if an abandoned QR pairing later connects', async () => {
    const request = deferred()
    mocks.connectAsync.mockReturnValueOnce(request.promise)
    render(<App />)
    open()
    fireEvent.click(screen.getByRole('button', { name: 'WalletConnect' }))
    fireEvent.keyDown(document, { key: 'Escape' })
    open()
    fireEvent.click(screen.getByRole('button', { name: 'WalletChan Detected' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await act(async () =>
      mocks.accountChange?.(
        { status: 'connected', connector: { uid: 'wc' } },
        { status: 'connected', connector: { uid: 'walletchan' } }
      )
    )
    await act(async () => request.resolve())
    expect(mocks.restorePreviousAccount).toHaveBeenCalledWith(
      mocks.config,
      expect.objectContaining({
        connector: mocks.connectors[2],
        previousConnector: { uid: 'walletchan' }
      })
    )
  })

  it('accepts the active QR pairing and closes on the matching account event', async () => {
    const request = deferred()
    mocks.connectAsync.mockReturnValueOnce(request.promise)
    render(<App />)
    open()
    fireEvent.click(screen.getByRole('button', { name: 'WalletConnect' }))
    await act(async () =>
      mocks.accountChange?.({ status: 'connected', connector: mocks.connectors[2] }, { status: 'disconnected' })
    )
    expect(screen.queryByRole('dialog')).toBeNull()
    await act(async () => request.resolve())
    expect(mocks.restorePreviousAccount).not.toHaveBeenCalled()
    await waitFor(() => expect(mocks.track.mock.calls.filter(([event]) => event === 'connect_wallet')).toHaveLength(1))
  })

  it('supports missing WalletConnect configuration without disabling detected wallets', () => {
    mocks.connectors = mocks.connectors.filter(({ id }) => id !== 'walletConnect')
    render(<App />)
    open()
    expect((screen.getByRole('button', { name: 'WalletConnect Unavailable' }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: 'More wallets' }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: 'Rabby Detected' }) as HTMLButtonElement).disabled).toBe(false)
  })

  it('ignores old transport errors after dismissal and allows a fresh request', async () => {
    const request = deferred()
    mocks.connectAsync.mockReturnValueOnce(request.promise)
    render(<App />)
    open()
    fireEvent.click(screen.getByRole('button', { name: 'WalletConnect' }))
    fireEvent.keyDown(document, { key: 'Escape' })
    await act(async () => request.reject(new Error('Old transport failure')))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByTestId('pending').textContent).toBe('false')
    open()
    fireEvent.click(screen.getByRole('button', { name: 'WalletConnect' }))
    await waitFor(() => expect(mocks.connectAsync).toHaveBeenCalledTimes(2))
  })
})

describe('adaptive wallet surface', () => {
  it('clears a stalled relay spinner and retries without starting an overlapping pairing', async () => {
    vi.useFakeTimers()
    try {
      mocks.connectAsync.mockReturnValue(new Promise(() => undefined))
      render(<App />)
      open()
      fireEvent.click(screen.getByRole('button', { name: 'WalletConnect' }))
      await act(async () => {
        vi.advanceTimersByTime(30000)
      })
      expect(screen.getByRole('alert').textContent).toContain('taking too long')
      expect(screen.getByTestId('pending').textContent).toBe('false')
      fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
      expect(screen.getByTestId('pending').textContent).toBe('true')
      expect(mocks.connectAsync).toHaveBeenCalledOnce()
    } finally {
      vi.useRealTimers()
    }
  })

  it('keeps the catalogue open when an abandoned detected request succeeds', async () => {
    const request = deferred()
    mocks.connectAsync.mockReturnValueOnce(request.promise)
    const view = render(<App />)
    open()
    fireEvent.click(screen.getByRole('button', { name: 'Rabby Detected' }))
    fireEvent.click(screen.getByRole('button', { name: 'More wallets' }))
    await act(async () =>
      mocks.accountChange?.({ status: 'connected', connector: mocks.connectors[0] }, { status: 'disconnected' })
    )
    mocks.connector = mocks.connectors[0]
    mocks.isConnected = true
    view.rerender(<App />)
    expect(screen.getByRole('button', { name: 'Trust Wallet' })).toBeTruthy()
    await act(async () => request.resolve())
    expect(screen.getByRole('button', { name: 'Trust Wallet' })).toBeTruthy()
    expect(mocks.restorePreviousAccount).toHaveBeenCalledOnce()
  })

  it('retries a rejected QR request and copies the current URI without leaking it to analytics', async () => {
    const request = deferred()
    mocks.connectAsync.mockReturnValueOnce(request.promise).mockReturnValueOnce(new Promise(() => undefined))
    const copy = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText: copy }, userAgent: 'desktop' })
    render(<App />)
    open()
    fireEvent.click(screen.getByRole('button', { name: 'WalletConnect' }))
    await act(async () => request.reject(new Error('User rejected request')))
    expect(screen.getByTestId('pending').textContent).toBe('false')
    expect(screen.queryByRole('alert')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    act(() => mocks.message?.({ type: 'display_uri', data: 'wc:test@2?key=secret' }))
    fireEvent.click(screen.getByRole('button', { name: 'Copy connection link' }))
    await screen.findByRole('button', { name: 'Copied' })
    expect(copy).toHaveBeenCalledWith('wc:test@2?key=secret')
    expect(JSON.stringify(mocks.track.mock.calls)).not.toContain('secret')
  })

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

  it('keeps one mobile surface owning focus and scroll throughout the curated and QR screens', () => {
    mocks.mobile = true
    mocks.connectAsync.mockReturnValue(new Promise(() => undefined))
    const view = render(<App />)
    open()
    fireEvent.click(screen.getByRole('button', { name: 'More wallets' }))
    expect(document.activeElement).toBe(screen.getByRole('dialog'))
    fireEvent.click(screen.getByRole('button', { name: 'Trust Wallet' }))
    expect(document.activeElement).toBe(screen.getByRole('dialog'))
    expect(screen.getAllByRole('dialog')).toHaveLength(1)
    expect(view.container.inert).toBe(true)
    expect(document.body.style.overflow).toBe('hidden')
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(view.container.inert).not.toBe(true)
    expect(document.body.style.overflow).toBe('')
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
