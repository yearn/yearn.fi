import { restorePreviousAccount } from '@yearn/wallet-ui/connectionCleanup'
import { expect, it, vi } from 'vitest'
import { type Config, cookieStorage, createConfig, createStorage, http } from 'wagmi'
import { connect, disconnect, getAccount, getConnections, switchAccount } from 'wagmi/actions'
import { mainnet } from 'wagmi/chains'
import { mock } from 'wagmi/connectors'

const deferred = <T = void>() => {
  const resolver: { resolve?: (value: T) => void } = {}
  const promise = new Promise<T>((resolve) => {
    resolver.resolve = resolve
  })
  return { promise, resolve: (value: T) => resolver.resolve?.(value) }
}

function createWalletConfig(storage: Config['storage'] = null): Config {
  return createConfig({
    chains: [mainnet],
    connectors: [
      mock({ accounts: ['0x1111111111111111111111111111111111111111'] }),
      mock({ accounts: ['0x2222222222222222222222222222222222222222'] }),
      mock({ accounts: ['0x3333333333333333333333333333333333333333'] })
    ].map((createConnector, index) => (config) => ({ ...createConnector(config), id: `mock-${index}` })),
    multiInjectedProviderDiscovery: false,
    storage,
    transports: { [mainnet.id]: http() }
  })
}

it('removes a late obsolete connection, so disconnecting the chosen wallet leaves no account', async () => {
  const config = createWalletConfig()
  const [obsolete, chosen] = config.connectors
  const approveObsolete = deferred()
  const originalConnect = obsolete.connect.bind(obsolete)
  vi.spyOn(obsolete, 'connect').mockImplementationOnce(async (...parameters) => {
    await approveObsolete.promise
    return originalConnect(...parameters)
  })
  const olderConnection = connect(config, { connector: obsolete })
  await connect(config, { connector: chosen })
  expect(getAccount(config).connector?.uid).toBe(chosen.uid)
  approveObsolete.resolve()
  await olderConnection
  expect(getAccount(config).connector?.uid).toBe(obsolete.uid)

  await restorePreviousAccount(config, { connector: obsolete, previousConnector: chosen })
  expect(getAccount(config).connector?.uid).toBe(chosen.uid)
  expect(getConnections(config).map(({ connector }) => connector.uid)).toEqual([chosen.uid])
  await disconnect(config, { connector: chosen })
  expect(getAccount(config).status).toBe('disconnected')
  expect(getConnections(config)).toEqual([])
})

it('preserves an external account switch while obsolete connector cleanup is pending', async () => {
  const config = createWalletConfig()
  const [obsolete, chosen, external] = config.connectors
  await connect(config, { connector: chosen })
  await connect(config, { connector: external })
  await connect(config, { connector: obsolete })
  const completeDisconnect = deferred()
  const originalDisconnect = obsolete.disconnect.bind(obsolete)
  vi.spyOn(obsolete, 'disconnect').mockImplementationOnce(async () => {
    await completeDisconnect.promise
    await originalDisconnect()
  })
  const cleanup = restorePreviousAccount(config, { connector: obsolete, previousConnector: chosen })
  await switchAccount(config, { connector: external })
  completeDisconnect.resolve()
  await cleanup
  expect(getAccount(config).connector?.uid).toBe(external.uid)
  expect(getConnections(config).some(({ connector }) => connector.uid === obsolete.uid)).toBe(false)
})

it('does not restore an account explicitly disconnected while cleanup is pending', async () => {
  const config = createWalletConfig()
  const [obsolete, chosen] = config.connectors
  await connect(config, { connector: chosen })
  await connect(config, { connector: obsolete })
  const completeDisconnect = deferred()
  const originalDisconnect = obsolete.disconnect.bind(obsolete)
  vi.spyOn(obsolete, 'disconnect').mockImplementationOnce(async () => {
    await completeDisconnect.promise
    await originalDisconnect()
  })
  const cleanup = restorePreviousAccount(config, { connector: obsolete, previousConnector: chosen })
  await disconnect(config, { connector: chosen })
  completeDisconnect.resolve()
  await cleanup
  expect(getAccount(config).status).toBe('disconnected')
  expect(getConnections(config)).toEqual([])
})

it.each([false, true])('preserves a new connection during cleanup (early disconnect event: %s)', async (emitEarly) => {
  const config = createWalletConfig()
  const [obsolete, chosen, previous] = config.connectors
  await connect(config, { connector: previous })
  await connect(config, { connector: obsolete })
  const completeDisconnect = deferred()
  const originalDisconnect = obsolete.disconnect.bind(obsolete)
  vi.spyOn(obsolete, 'disconnect').mockImplementationOnce(async () => {
    if (emitEarly) obsolete.emitter.emit('disconnect')
    await completeDisconnect.promise
    await originalDisconnect()
  })

  const cleanup = restorePreviousAccount(config, { connector: obsolete, previousConnector: previous })
  await connect(config, { connector: chosen })
  completeDisconnect.resolve()
  await cleanup

  expect(getAccount(config).connector?.uid).toBe(chosen.uid)
  expect(getConnections(config).map(({ connector }) => connector.uid)).toEqual([previous.uid, chosen.uid])
  await disconnect(config, { connector: chosen })
  await disconnect(config, { connector: previous })
  expect(getAccount(config).status).toBe('disconnected')
})

it.each([false, true])(
  'preserves a same-turn connection and recent wallet (cookie storage: %s)',
  async (useStorage) => {
    const config = createWalletConfig(
      useStorage ? createStorage({ storage: cookieStorage, key: 'cleanup-race' }) : null
    )
    const [obsolete, chosen, previous] = config.connectors
    await connect(config, { connector: previous })
    await connect(config, { connector: obsolete })
    const completeConnection = deferred<{ accounts: readonly [`0x${string}`]; chainId: number }>()
    const completeDisconnect = deferred()
    vi.spyOn(chosen, 'connect').mockReturnValueOnce(completeConnection.promise as never)
    vi.spyOn(obsolete, 'disconnect').mockImplementationOnce(() => completeDisconnect.promise)
    const connection = connect(config, { connector: chosen })
    const cleanup = restorePreviousAccount(config, { connector: obsolete, previousConnector: previous })
    completeConnection.resolve({ accounts: ['0x2222222222222222222222222222222222222222'], chainId: 1 })
    completeDisconnect.resolve()
    await Promise.all([connection, cleanup])
    expect(getAccount(config).connector?.uid).toBe(chosen.uid)
    expect(getConnections(config).map(({ connector }) => connector.uid)).toEqual([previous.uid, chosen.uid])
    if (useStorage) expect(await config.storage?.getItem('recentConnectorId')).toBe(chosen.id)
    await config.storage?.removeItem('recentConnectorId')
    await config.storage?.removeItem('store')
  }
)
