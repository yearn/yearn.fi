import {
  connectEvmWalletWithAppKit,
  formatWalletAddress,
  getBrowserWalletLabel,
  getWalletConnectionErrorMessage,
  resolveEvmAppKitWalletItem,
  selectBrowserWalletConnectors,
  type TEvmAppKitConnectionClient,
  type TWalletConnectorSummary
} from '@yearn/wallet-ui/connectors'
import { describe, expect, it, vi } from 'vitest'

const connector = (overrides: Partial<TWalletConnectorSummary>): TWalletConnectorSummary => ({
  id: 'injected',
  name: 'Injected',
  type: 'injected',
  ...overrides
})

describe('wallet drawer connector selection', () => {
  it('returns discovered browser wallets without the generic fallback', () => {
    const selected = selectBrowserWalletConnectors([
      connector({}),
      connector({ id: 'walletConnect', name: 'WalletConnect', type: 'walletConnect' }),
      connector({ id: 'com.rabby', name: 'Rabby' }),
      connector({ id: 'io.metamask', name: 'MetaMask' })
    ])

    expect(selected.map(({ id }) => id)).toEqual(['com.rabby', 'io.metamask'])
  })

  it('excludes unsupported browser wallets', () => {
    const selected = selectBrowserWalletConnectors([
      connector({}),
      connector({ id: 'app.phantom', name: 'Phantom' }),
      connector({ id: 'io.metamask', name: 'MetaMask' })
    ])

    expect(selected.map(({ id }) => id)).toEqual(['io.metamask'])
  })

  it('does not expose the legacy fallback when only an excluded wallet was announced', () => {
    const selected = selectBrowserWalletConnectors([connector({}), connector({ id: 'app.phantom', name: 'Phantom' })])

    expect(selected).toEqual([])
  })

  it('keeps the generic injected connector when no announced wallet exists', () => {
    const selected = selectBrowserWalletConnectors([
      connector({}),
      connector({ id: 'walletConnect', name: 'WalletConnect', type: 'walletConnect' }),
      connector({ id: 'safe', name: 'Safe', type: 'safe' })
    ])

    expect(selected).toHaveLength(1)
    expect(selected[0]?.id).toBe('injected')
  })

  it('excludes unrelated non-injected connectors', () => {
    const selected = selectBrowserWalletConnectors([
      connector({ id: 'walletConnect', name: 'WalletConnect', type: 'walletConnect' }),
      connector({ id: 'safe', name: 'Safe', type: 'safe' }),
      connector({ id: 'coinbaseWalletSDK', name: 'Coinbase Wallet', type: 'coinbaseWallet' })
    ])

    expect(selected).toEqual([])
  })

  it('includes host-provided development or compatibility connectors', () => {
    const selected = selectBrowserWalletConnectors(
      [connector({}), connector({ id: 'agent', name: 'Agent Wallet', type: 'mock' })],
      { additionalConnectorIds: ['agent'] }
    )

    expect(selected.map(({ id }) => id)).toEqual(['injected', 'agent'])
  })
})

describe('wallet drawer labels and errors', () => {
  it('labels the generic injected connector as a browser wallet', () => {
    expect(getBrowserWalletLabel(connector({}))).toBe('Browser wallet')
  })

  it('silences cancellation but still reports a missing extension', () => {
    expect(getWalletConnectionErrorMessage(new Error('User rejected the request'))).toBeUndefined()
    expect(getWalletConnectionErrorMessage(new Error('Connection cancelled'))).toBeUndefined()
    expect(getWalletConnectionErrorMessage(new Error('Modal closed by user'))).toBeUndefined()
    expect(getWalletConnectionErrorMessage(new Error('Provider not found'))).toContain('No browser wallet')
  })

  it('uses a retryable fallback without exposing provider internals', () => {
    expect(getWalletConnectionErrorMessage(new Error('opaque connector failure'))).toBe(
      'The wallet could not be opened. Check the extension or network connection and try again.'
    )
  })
})

describe('wallet address formatting', () => {
  it('shows a stable compact account label', () => {
    expect(formatWalletAddress('0x1234567890abcdef1234567890abcdef12345678')).toBe('0x1234…5678')
    expect(formatWalletAddress(undefined)).toBe('Wallet')
  })
})

describe('AppKit browser-wallet connection', () => {
  it('opens an injected wallet while full remote startup remains pending', async () => {
    const fullStartup = Promise.withResolvers<void>()
    const appKit = {
      ready: vi.fn((options?: { walletsOnly?: boolean }) =>
        options?.walletsOnly ? Promise.resolve() : fullStartup.promise
      ),
      getWalletList: vi.fn(() => ({ wallets: [] })),
      connectWallet: vi.fn(async () => undefined),
      resetConnectingWallet: vi.fn()
    } as unknown as TEvmAppKitConnectionClient

    try {
      await connectEvmWalletWithAppKit(appKit, connector({ id: 'io.rabby', name: 'Rabby' }))
      expect(appKit.connectWallet).toHaveBeenCalledOnce()
      expect(appKit.resetConnectingWallet).toHaveBeenCalledOnce()
    } finally {
      fullStartup.resolve()
    }
  })

  it('times startup separately from connection and logs account status without private data', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    const log = vi.spyOn(console, 'info').mockImplementation(() => undefined)
    const clock = vi.spyOn(performance, 'now').mockReturnValue(100)
    const unsubscribe = vi.fn()
    const appKit = {
      subscribeAccount: vi.fn((callback: (account: unknown) => void) => {
        callback({ isConnected: false, status: 'connecting', address: 'PRIVATE_ADDRESS' })
        return unsubscribe
      }),
      ready: vi.fn(async () => {
        clock.mockReturnValue(10100)
      }),
      getWalletList: vi.fn(() => ({ wallets: [] })),
      connectWallet: vi.fn(async () => {
        clock.mockReturnValue(10300)
      }),
      resetConnectingWallet: vi.fn()
    } as unknown as TEvmAppKitConnectionClient

    try {
      await connectEvmWalletWithAppKit(appKit, connector({ id: 'com.rabby', name: 'Rabby' }))

      expect(log.mock.calls.map(([, details]) => [details.stage, details.elapsedMs])).toEqual([
        ['account state changed', 0],
        ['waiting for wallet readiness', 10000],
        ['AppKit full startup complete', 10000],
        ['wallets ready', 10000],
        ['requesting wallet connection', 10000],
        ['wallet connection resolved', 10200],
        ['connection cleanup complete', 10200]
      ])
      expect(JSON.stringify(log.mock.calls)).not.toContain('PRIVATE_ADDRESS')
      expect(unsubscribe).toHaveBeenCalledOnce()
    } finally {
      vi.unstubAllEnvs()
      vi.restoreAllMocks()
    }
  })

  it('does not subscribe or log diagnostics in production', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    const log = vi.spyOn(console, 'info').mockImplementation(() => undefined)
    const appKit = {
      subscribeAccount: vi.fn(),
      ready: vi.fn(async () => undefined),
      getWalletList: vi.fn(() => ({ wallets: [] })),
      connectWallet: vi.fn(async () => undefined),
      resetConnectingWallet: vi.fn()
    } as unknown as TEvmAppKitConnectionClient

    try {
      await connectEvmWalletWithAppKit(appKit, connector({}))
      expect(log).not.toHaveBeenCalled()
      expect(appKit.subscribeAccount).not.toHaveBeenCalled()
    } finally {
      vi.unstubAllEnvs()
      vi.restoreAllMocks()
    }
  })

  it('reuses AppKit connector metadata and clears its pending state after connecting', async () => {
    const selectedConnector = connector({ id: 'io.metamask', icon: 'data:image/svg+xml,metamask', name: 'MetaMask' })
    const wallet = {
      connectors: [{ chain: 'eip155', id: 'io.metamask' }],
      id: 'metamask-wallet',
      imageUrl: 'https://example.com/metamask.svg',
      isInjected: true,
      isRecent: false,
      name: 'MetaMask',
      walletInfo: {}
    } as Parameters<typeof resolveEvmAppKitWalletItem>[1][number]
    const appKit = {
      connectWallet: vi.fn(async () => undefined),
      getWalletList: vi.fn(() => ({ count: 1, page: 1, wallets: [wallet], wcWallets: [] })),
      ready: vi.fn(async () => undefined),
      resetConnectingWallet: vi.fn(() => undefined)
    } as unknown as TEvmAppKitConnectionClient

    await connectEvmWalletWithAppKit(appKit, selectedConnector)

    expect(appKit.ready).toHaveBeenCalledWith({ walletsOnly: true })
    expect(appKit.connectWallet).toHaveBeenCalledWith(wallet, 'eip155')
    expect(appKit.resetConnectingWallet).toHaveBeenCalledOnce()
  })

  it('builds a connector-backed item when AppKit has not listed the wallet yet', () => {
    const selectedConnector = connector({ id: 'com.rabby', icon: 'data:image/svg+xml,rabby', name: 'Rabby' })

    expect(resolveEvmAppKitWalletItem(selectedConnector, [])).toEqual({
      connectors: [{ chain: 'eip155', id: 'com.rabby', rdns: 'com.rabby' }],
      id: 'com.rabby',
      imageUrl: 'data:image/svg+xml,rabby',
      isInjected: true,
      isRecent: false,
      name: 'Rabby',
      walletInfo: {}
    })
  })

  it('routes a dedicated WalletConnect transport through its concrete connector', () => {
    const selectedConnector = connector({ id: 'ledger', name: 'Ledger', type: 'walletConnect' })

    expect(resolveEvmAppKitWalletItem(selectedConnector, [])).toMatchObject({
      connectors: [{ chain: 'eip155', id: 'ledger' }],
      id: 'ledger',
      isInjected: true
    })
  })

  it('clears AppKit pending state when a wallet rejects the request', async () => {
    const selectedConnector = connector({ id: 'io.metamask', name: 'MetaMask' })
    const appKit = {
      connectWallet: vi.fn(async () => {
        throw new Error('User rejected the request')
      }),
      getWalletList: vi.fn(() => ({ count: 0, page: 1, wallets: [], wcWallets: [] })),
      ready: vi.fn(async () => undefined),
      resetConnectingWallet: vi.fn(() => undefined)
    } as unknown as TEvmAppKitConnectionClient

    await expect(connectEvmWalletWithAppKit(appKit, selectedConnector)).rejects.toThrow('User rejected')
    expect(appKit.resetConnectingWallet).toHaveBeenCalledOnce()
  })
})
