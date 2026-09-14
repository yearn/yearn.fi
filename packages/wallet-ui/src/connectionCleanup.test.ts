import { restorePreviousAccount } from '@yearn/wallet-ui/WalletDrawer'
import { expect, it, vi } from 'vitest'
import { type Config, createConfig, http } from 'wagmi'
import { connect, disconnect, getAccount, getConnections, switchAccount } from 'wagmi/actions'
import { mainnet } from 'wagmi/chains'
import { mock } from 'wagmi/connectors'

const deferred = () => {
  const resolver: { resolve?: () => void } = {}
  const promise = new Promise<void>((resolve) => {
    resolver.resolve = resolve
  })
  return { promise, resolve: () => resolver.resolve?.() }
}

function createWalletConfig(): Config {
  return createConfig({
    chains: [mainnet],
    connectors: [
      mock({ accounts: ['0x1111111111111111111111111111111111111111'] }),
      mock({ accounts: ['0x2222222222222222222222222222222222222222'] }),
      mock({ accounts: ['0x3333333333333333333333333333333333333333'] })
    ],
    multiInjectedProviderDiscovery: false,
    storage: null,
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
