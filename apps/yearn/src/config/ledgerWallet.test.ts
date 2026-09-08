import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  injectedOptions: undefined as unknown,
  walletConnectOptions: undefined as unknown
}))

vi.mock('wagmi', () => ({
  createConnector: (connector: unknown) => connector
}))

vi.mock('wagmi/connectors', () => ({
  injected: (options: unknown) => {
    mocks.injectedOptions = options
    return () => ({ id: 'injected', name: 'Injected', type: 'injected' })
  },
  walletConnect: (options: unknown) => {
    mocks.walletConnectOptions = options
    return () => ({ id: 'walletConnect', name: 'WalletConnect', type: 'walletConnect' })
  }
}))

describe('Ledger wallet connector', () => {
  beforeEach(() => {
    mocks.injectedOptions = undefined
    mocks.walletConnectOptions = undefined
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('preserves a dedicated Ledger identity without opening a second QR modal', async () => {
    vi.stubGlobal('window', {})
    const { LEDGER_WALLET_ID, ledgerWallet } = await import('@/config/ledgerWallet')
    const metadata = {
      description: 'Yearn',
      icons: ['https://yearn.fi/icon.png'],
      name: 'Yearn Finance',
      url: 'https://yearn.fi'
    }
    const connector = ledgerWallet({ metadata, projectId: 'project-id' })
    const configuredConnector = connector({} as never)

    expect(mocks.walletConnectOptions).toEqual({
      customStoragePrefix: 'clientTwo',
      metadata,
      projectId: 'project-id',
      showQrModal: false,
      telemetryEnabled: false
    })
    expect(configuredConnector).toMatchObject({
      id: LEDGER_WALLET_ID,
      name: 'Ledger',
      type: 'walletConnect'
    })
  })

  it('uses the provider injected by the modern Ledger Wallet browser', async () => {
    const provider = { isLedgerLive: true, request: vi.fn() }
    vi.stubGlobal('window', { ethereum: provider })
    const { ledgerWallet } = await import('@/config/ledgerWallet')
    const connector = ledgerWallet({
      metadata: { description: 'Yearn', icons: [], name: 'Yearn Finance', url: 'https://yearn.fi' },
      projectId: 'project-id'
    })
    const configuredConnector = connector({} as never)

    expect(mocks.injectedOptions).toEqual({
      target: { id: 'ledger', name: 'Ledger', provider }
    })
    expect(mocks.walletConnectOptions).toBeUndefined()
    expect(configuredConnector).toMatchObject({ id: 'ledger', name: 'Ledger', type: 'injected' })
  })
})
