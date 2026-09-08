import { AppKit } from '@reown/appkit'
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi'
import { ApiController, OptionsController } from '@reown/appkit-controllers'
import { HelpersUtil } from '@reown/appkit-utils'
import { createConfig, http, injected } from '@wagmi/core'
import { mainnet } from '@wagmi/core/chains'
import { WALLET_APPKIT_FEATURES } from '@yearn/wallet-ui/appkit'
import { describe, expect, it, vi } from 'vitest'

// Exercise the installed SDK patch, not a mock of ready(), so upgrades cannot silently remove the fix.
type TStartupClient = {
  initializeWallets: (options: object) => Promise<void>
  initialize: (options: object) => Promise<void>
  ready: AppKit['ready']
  walletsReadyPromise?: Promise<void>
  readyPromise?: Promise<void>
}

describe('patched AppKit wallet readiness', () => {
  it('waits for restoration but not remote configuration or usage', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    const log = vi.spyOn(console, 'info').mockImplementation(() => undefined)
    const restoration = Promise.withResolvers<void>()
    const configuration = Promise.withResolvers<Awaited<ReturnType<typeof ApiController.fetchProjectConfig>>>()
    const usage = Promise.withResolvers<void>()
    const fetchConfig = vi.spyOn(ApiController, 'fetchProjectConfig').mockReturnValue(configuration.promise)
    const fetchUsage = vi.spyOn(ApiController, 'fetchUsage').mockReturnValue(usage.promise)
    const reconnect = OptionsController.state.enableReconnect
    OptionsController.setEnableReconnect(true)
    const client = Object.assign(Object.create(AppKit.prototype) as TStartupClient, {
      initializeProjectSettings: vi.fn(),
      initControllers: vi.fn(),
      initChainAdapters: vi.fn(async () => undefined),
      sendInitializeEvent: vi.fn(),
      syncExistingConnection: vi.fn(() => restoration.promise),
      syncAdapterConnections: vi.fn(async () => undefined)
    })
    const options = { features: WALLET_APPKIT_FEATURES }
    client.walletsReadyPromise = client.initializeWallets(options)
    client.readyPromise = client.initialize(options)
    const walletsReady = vi.fn()
    const fullyReady = vi.fn()
    const walletWait = client.ready({ walletsOnly: true }).then(walletsReady)
    const fullWait = client.ready().then(fullyReady)

    try {
      await vi.waitFor(() => expect(client.syncExistingConnection).toHaveBeenCalledOnce())
      expect(walletsReady).not.toHaveBeenCalled()
      expect(client.syncAdapterConnections).not.toHaveBeenCalled()
      restoration.resolve()
      await walletWait
      expect(
        log.mock.calls.filter(([, details]) => details.event === 'settled').map(([, details]) => details.stage)
      ).toEqual(['initialize adapters', 'restore active session', 'restore previous connectors'])
      expect(client.syncAdapterConnections).toHaveBeenCalledOnce()
      expect(fetchConfig).toHaveBeenCalledOnce()
      expect(fullyReady).not.toHaveBeenCalled()
      configuration.resolve([])
      await vi.waitFor(() => expect(fetchUsage).toHaveBeenCalledOnce())
      expect(fullyReady).not.toHaveBeenCalled()
      usage.resolve()
      await fullWait
      expect(fullyReady).toHaveBeenCalledOnce()
    } finally {
      restoration.resolve()
      configuration.resolve([])
      usage.resolve()
      await Promise.allSettled([walletWait, fullWait])
      OptionsController.setEnableReconnect(reconnect)
      vi.unstubAllEnvs()
      vi.restoreAllMocks()
    }
  })

  it.each([
    { scenario: 'never connected', hasConnected: false, hasDisconnected: false, calls: 0 },
    { scenario: 'explicitly disconnected', hasConnected: true, hasDisconnected: true, calls: 0 },
    { scenario: 'saved connection', hasConnected: true, hasDisconnected: false, calls: 1 }
  ])('only restores eligible connectors: $scenario', async ({ hasConnected, hasDisconnected, calls }) => {
    const config = createConfig({ chains: [mainnet], connectors: [injected()], transports: { [mainnet.id]: http() } })
    const provider = vi.spyOn(config.connectors[0], 'getProvider').mockResolvedValue(undefined)
    vi.spyOn(HelpersUtil, 'getConnectorStorageInfo').mockReturnValue({ hasConnected, hasDisconnected })
    const adapter = Object.assign(Object.create(WagmiAdapter.prototype) as WagmiAdapter, {
      availableConnectors: [{ id: 'injected' }],
      namespace: 'eip155',
      wagmiConfig: config
    })

    try {
      await adapter.syncConnections()
      expect(provider).toHaveBeenCalledTimes(calls)
    } finally {
      vi.restoreAllMocks()
    }
  })
})
