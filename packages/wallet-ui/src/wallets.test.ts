import { CURATED_WALLETS, getWalletAppLink, getYearnConnectors, rememberWalletApp } from '@yearn/wallet-ui/wallets'
import { expect, it, vi } from 'vitest'
import { createConfig, http } from 'wagmi'
import { mainnet } from 'wagmi/chains'

const transport = vi.hoisted(() => ({ options: vi.fn(), provider: {} }))
vi.mock('wagmi/connectors', async (importOriginal) => ({
  ...(await importOriginal<typeof import('wagmi/connectors')>()),
  walletConnect: (options: unknown) => {
    transport.options(options)
    return () => ({
      id: 'walletConnect',
      name: 'WalletConnect',
      type: 'walletConnect',
      getProvider: async () => transport.provider
    })
  }
}))

const options = {
  projectId: ' test ',
  appName: 'Yearn',
  appUrl: 'https://yearn.fi',
  appIcon: 'https://yearn.fi/icon.png'
}

it('configures one shared WalletConnect transport without a third-party modal', async () => {
  const config = createConfig({
    chains: [mainnet],
    transports: { [mainnet.id]: http() },
    connectors: getYearnConnectors(options),
    storage: null,
    ssr: true
  })
  expect(config.connectors.map(({ id }) => id)).toEqual(['injected', 'safe', 'walletConnect'])
  expect(transport.options).toHaveBeenCalledWith({
    projectId: 'test',
    showQrModal: false,
    metadata: {
      name: options.appName,
      description: options.appName,
      url: window.location.origin,
      icons: [options.appIcon]
    }
  })
  expect(await config.connectors[2].getProvider()).toBe(transport.provider)
  expect(CURATED_WALLETS.map(({ name }) => name)).toEqual([
    'Trust Wallet',
    'MetaMask',
    'Binance Wallet',
    'SafePal Wallet',
    'TokenPocket',
    'Fireblocks',
    'IronWallet',
    'Bitget Wallet',
    'OKX Wallet',
    'Ledger',
    'Safe'
  ])
})

it('keeps browser discovery and Safe available without WalletConnect configuration', () => {
  expect(getYearnConnectors({ ...options, projectId: ' ' })).toHaveLength(2)
})

it('encodes the full pairing URI for app handoffs and keeps desktop choices explicit', () => {
  const uri = 'wc:topic@2?relay-protocol=irn&symKey=secret'
  CURATED_WALLETS.forEach((wallet) => {
    const link = getWalletAppLink(wallet, uri, true)
    expect(link === uri || (link && decodeURIComponent(link.split('?uri=')[1]) === uri)).toBe(true)
    expect(wallet.downloadUrl).toMatch(/^https:\/\//)
    expect(getWalletAppLink(wallet, uri, false)).toBe(
      wallet.desktopLink ? `${wallet.desktopLink}?uri=${encodeURIComponent(uri)}` : undefined
    )
  })
})

it('remembers only the selected app base for signing and clears it between sessions', () => {
  const storage = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key)
  })
  try {
    rememberWalletApp(CURATED_WALLETS[0])
    expect(JSON.parse(storage.get('WALLETCONNECT_DEEPLINK_CHOICE')!)).toEqual({
      href: 'trust://',
      name: 'Trust Wallet'
    })
    rememberWalletApp(CURATED_WALLETS[2])
    expect(JSON.parse(storage.get('WALLETCONNECT_DEEPLINK_CHOICE')!).href).toBe('bnc://app.binance.com/cedefi/')
    rememberWalletApp()
    expect(storage.size).toBe(0)
  } finally {
    vi.unstubAllGlobals()
  }
})
