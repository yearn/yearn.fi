import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  const appKit = {
    connectWallet: vi.fn(async () => undefined),
    disconnect: vi.fn(async () => undefined),
    getWalletList: vi.fn(() => ({ count: 0, page: 1, wallets: [], wcWallets: [] })),
    ready: vi.fn(async () => undefined),
    resetConnectingWallet: vi.fn(() => undefined)
  }
  const ledgerConnector = {
    emitter: { emit: vi.fn() },
    id: 'ledger',
    isAuthorized: vi.fn(async () => true),
    name: 'Ledger',
    type: 'walletConnect',
    uid: 'ledger-uid'
  }
  const safeConnector = {
    emitter: { emit: vi.fn() },
    id: 'safe',
    isAuthorized: vi.fn(async () => true),
    name: 'Safe',
    type: 'safe',
    uid: 'safe-uid'
  }
  const iframeWagmiConfig = {
    connectors: [ledgerConnector],
    id: 'iframe-wagmi-config',
    state: { connections: new Map() }
  }
  const wagmiConfig = {
    connectors: [ledgerConnector],
    id: 'adapter-owned-wagmi-config',
    state: { connections: new Map() }
  }

  return {
    activeConnector: undefined as unknown,
    adapterOptions: undefined as unknown,
    agentConnectorFactory: vi.fn(),
    agentEnabled: true,
    appKit,
    appKitOptions: undefined as unknown,
    coreConnect: vi.fn(async (): Promise<void> => undefined),
    coreDisconnect: vi.fn(async () => undefined),
    createConfigOptions: undefined as unknown,
    customRpcUrls: { 'eip155:1': [{ url: 'https://rpc.example' }] },
    iframeWagmiConfig,
    ledgerConnector,
    ledgerConnectorFactory: vi.fn(),
    networks: [{ id: 1, name: 'Ethereum' }],
    registeredConfig: undefined as unknown,
    runtime: 'app' as 'app' | 'ledger-iframe' | 'safe-iframe',
    safeConnector,
    safeConnectorFactory: vi.fn(),
    storage: { id: 'cookie-storage' },
    storageOptions: undefined as unknown,
    transports: { 1: { id: 'mainnet-transport' } },
    wagmiConfig
  }
})

vi.mock('@reown/appkit-adapter-wagmi', () => ({
  WagmiAdapter: class {
    wagmiConfig = mocks.wagmiConfig

    constructor(options: unknown) {
      mocks.adapterOptions = options
    }
  }
}))

vi.mock('@reown/appkit/react', () => ({
  createAppKit: (options: unknown) => {
    mocks.appKitOptions = options
    return mocks.appKit
  }
}))

vi.mock('@wagmi/core', () => ({
  connect: mocks.coreConnect,
  disconnect: mocks.coreDisconnect,
  getAccount: () => ({ connector: mocks.activeConnector })
}))

vi.mock('@shared/utils/wagmi', () => ({
  registerConfig: (config: unknown) => {
    mocks.registeredConfig = config
  }
}))

vi.mock('@yearn/wallet-ui/appkit', () => ({
  requireWalletConnectProjectId: (projectId: string | undefined) => projectId?.trim() || 'project-id'
}))

vi.mock('@/config/appkitConfig', () => ({
  createYearnAppKitOptions: (adapter: unknown, projectId: string, customRpcUrls: unknown) => ({
    adapter,
    customRpcUrls,
    projectId
  }),
  createYearnCustomRpcUrls: () => mocks.customRpcUrls,
  YEARN_APPKIT_METADATA: { name: 'Yearn Finance' },
  YEARN_APPKIT_NETWORKS: mocks.networks
}))

vi.mock('@/config/agentWallet', () => ({
  agentWallet: () => mocks.agentConnectorFactory,
  isAgentWalletEnabled: () => mocks.agentEnabled
}))

vi.mock('@/config/ledgerWallet', () => ({
  ledgerWallet: () => mocks.ledgerConnectorFactory,
  LEDGER_WALLET_ID: 'ledger'
}))

vi.mock('@/config/wagmiTransports', () => ({
  buildTransports: () => mocks.transports
}))

vi.mock('@/config/walletRuntime', () => ({
  getYearnWagmiStorageKey: (runtime: string) => (runtime === 'app' ? 'wagmi' : `yearn-${runtime}`),
  resolveYearnWalletRuntime: () => mocks.runtime
}))

vi.mock('@/env', () => ({
  env: { NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID: ' project-id ' }
}))

vi.mock('wagmi', () => ({
  cookieStorage: { id: 'cookie-storage-driver' },
  createConfig: (options: unknown) => {
    mocks.createConfigOptions = options
    return mocks.iframeWagmiConfig
  },
  createStorage: (options: unknown) => {
    mocks.storageOptions = options
    return mocks.storage
  }
}))

vi.mock('wagmi/connectors', () => ({
  safe: () => mocks.safeConnectorFactory
}))

describe('Yearn wallet runtime initialization', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
    vi.stubGlobal('window', {})
    mocks.activeConnector = undefined
    mocks.adapterOptions = undefined
    mocks.agentEnabled = true
    mocks.appKitOptions = undefined
    mocks.createConfigOptions = undefined
    mocks.iframeWagmiConfig.connectors = [mocks.ledgerConnector]
    mocks.iframeWagmiConfig.state.connections.clear()
    mocks.registeredConfig = undefined
    mocks.runtime = 'app'
    mocks.storageOptions = undefined
    vi.clearAllMocks()
    vi.resetModules()
  })

  it('uses one AppKit adapter config for top-level wallet connection and transactions', async () => {
    const wallet = await import('@/config/wagmi')

    expect(mocks.adapterOptions).toMatchObject({
      connectors: [mocks.agentConnectorFactory],
      customRpcUrls: mocks.customRpcUrls,
      networks: mocks.networks,
      projectId: 'project-id',
      ssr: true,
      storage: mocks.storage,
      transports: mocks.transports
    })
    expect(mocks.storageOptions).toEqual({ key: 'wagmi', storage: { id: 'cookie-storage-driver' } })
    expect(mocks.appKitOptions).toEqual({
      adapter: wallet.wagmiAdapter,
      customRpcUrls: mocks.customRpcUrls,
      projectId: 'project-id'
    })
    expect(wallet.wagmiConfig).toBe(mocks.wagmiConfig)
    expect(mocks.registeredConfig).toBe(mocks.wagmiConfig)
  })

  it('does not initialize AppKit during server rendering', async () => {
    vi.stubGlobal('window', undefined)

    const wallet = await import('@/config/wagmi')

    expect(wallet.wagmiAdapter).toBeDefined()
    expect(wallet.appKit).toBeUndefined()
    expect(mocks.appKitOptions).toBeUndefined()
  })

  it('leaves top-level Ledger selection to AppKit without exposing the development connector', async () => {
    mocks.agentEnabled = false

    await import('@/config/wagmi')

    expect(mocks.adapterOptions).toMatchObject({ connectors: [] })
  })

  it('creates an isolated, AppKit-free Safe iframe config', async () => {
    mocks.runtime = 'safe-iframe'
    mocks.iframeWagmiConfig.connectors = [mocks.safeConnector]

    const wallet = await import('@/config/wagmi')

    expect(wallet.appKit).toBeUndefined()
    expect(wallet.wagmiAdapter).toBeUndefined()
    expect(mocks.appKitOptions).toBeUndefined()
    expect(mocks.createConfigOptions).toMatchObject({
      connectors: [mocks.safeConnectorFactory],
      multiInjectedProviderDiscovery: false,
      ssr: true,
      storage: mocks.storage,
      transports: mocks.transports
    })
    expect(mocks.storageOptions).toEqual({ key: 'yearn-safe-iframe', storage: { id: 'cookie-storage-driver' } })
  })

  it('creates an isolated, AppKit-free Ledger iframe config', async () => {
    mocks.runtime = 'ledger-iframe'

    const wallet = await import('@/config/wagmi')

    expect(wallet.appKit).toBeUndefined()
    expect(wallet.wagmiAdapter).toBeUndefined()
    expect(mocks.createConfigOptions).toMatchObject({
      connectors: [mocks.ledgerConnectorFactory],
      multiInjectedProviderDiscovery: false
    })
    expect(mocks.storageOptions).toEqual({ key: 'yearn-ledger-iframe', storage: { id: 'cookie-storage-driver' } })
  })

  it('deduplicates simultaneous iframe connection requests through Wagmi', async () => {
    mocks.runtime = 'ledger-iframe'
    const wallet = await import('@/config/wagmi')
    const firstConnection = wallet.reconcileYearnIframeWallet()
    const secondConnection = wallet.reconcileYearnIframeWallet()

    expect(secondConnection).toBe(firstConnection)
    await firstConnection

    expect(mocks.coreConnect).toHaveBeenCalledOnce()
    expect(mocks.coreConnect).toHaveBeenCalledWith(mocks.iframeWagmiConfig, {
      connector: mocks.ledgerConnector
    })
    expect(mocks.appKit.connectWallet).not.toHaveBeenCalled()
  })

  it('does not start an invisible pairing request for an unauthorized legacy Ledger session', async () => {
    mocks.runtime = 'ledger-iframe'
    mocks.ledgerConnector.isAuthorized.mockResolvedValueOnce(false)
    const wallet = await import('@/config/wagmi')

    await expect(wallet.reconcileYearnIframeWallet()).resolves.toBe(false)

    expect(mocks.coreConnect).not.toHaveBeenCalled()
  })

  it('does not auto-connect a top-level wallet through iframe reconciliation', async () => {
    const wallet = await import('@/config/wagmi')

    await expect(wallet.reconcileYearnIframeWallet()).resolves.toBe(false)

    expect(mocks.coreConnect).not.toHaveBeenCalled()
    expect(mocks.appKit.connectWallet).not.toHaveBeenCalled()
  })

  it('routes explicit disconnect through the owning runtime', async () => {
    const topLevelWallet = await import('@/config/wagmi')
    await topLevelWallet.disconnectYearnWallet()

    expect(mocks.appKit.disconnect).toHaveBeenCalledWith('eip155')
    expect(mocks.coreDisconnect).not.toHaveBeenCalled()

    vi.resetModules()
    vi.clearAllMocks()
    mocks.runtime = 'ledger-iframe'
    const iframeWallet = await import('@/config/wagmi')
    await iframeWallet.disconnectYearnWallet()

    expect(mocks.coreDisconnect).toHaveBeenCalledWith(mocks.iframeWagmiConfig)
    expect(mocks.appKit.disconnect).not.toHaveBeenCalled()
  })

  it('keeps an embedded wallet disconnected until the user requests another connection', async () => {
    mocks.runtime = 'safe-iframe'
    mocks.iframeWagmiConfig.connectors = [mocks.safeConnector]
    mocks.activeConnector = mocks.safeConnector
    const wallet = await import('@/config/wagmi')

    await wallet.disconnectYearnWallet()
    mocks.activeConnector = undefined

    await expect(wallet.reconcileYearnIframeWallet()).resolves.toBe(false)
    expect(mocks.coreConnect).not.toHaveBeenCalled()

    await expect(wallet.requestYearnIframeWalletConnection()).resolves.toBe(true)
    expect(mocks.coreConnect).toHaveBeenCalledOnce()
    expect(mocks.coreConnect).toHaveBeenCalledWith(mocks.iframeWagmiConfig, {
      connector: mocks.safeConnector
    })
  })

  it('lets an explicit iframe disconnect win over a pending connection', async () => {
    mocks.runtime = 'safe-iframe'
    mocks.iframeWagmiConfig.connectors = [mocks.safeConnector]
    const connectionResolver: { current?: () => void } = {}
    const pendingConnection = new Promise<void>((resolve) => {
      connectionResolver.current = resolve
    })
    mocks.coreConnect.mockImplementationOnce(() => pendingConnection)
    const wallet = await import('@/config/wagmi')

    const reconciliation = wallet.reconcileYearnIframeWallet()
    const disconnection = wallet.disconnectYearnWallet()

    expect(mocks.coreDisconnect).not.toHaveBeenCalled()
    connectionResolver.current?.()

    await expect(reconciliation).resolves.toBe(true)
    await expect(disconnection).resolves.toBeUndefined()
    expect(mocks.coreDisconnect).toHaveBeenCalledOnce()
    expect(mocks.coreConnect.mock.invocationCallOrder[0]).toBeLessThan(mocks.coreDisconnect.mock.invocationCallOrder[0])
    await expect(wallet.reconcileYearnIframeWallet()).resolves.toBe(false)
  })
})
