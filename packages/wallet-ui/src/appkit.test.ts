import { mainnet } from '@reown/appkit/networks'
import {
  createWalletAppKitOptions,
  isSafeConnectorId,
  requireWalletConnectProjectId,
  WALLET_APPKIT_FEATURES,
  WALLETCONNECT_WALLET_IDS,
  WALLETCONNECT_WALLETS
} from '@yearn/wallet-ui/appkit'
import { describe, expect, it } from 'vitest'

describe('shared AppKit configuration', () => {
  it('requires an explicit Reown project ID', () => {
    expect(requireWalletConnectProjectId('  project-id  ')).toBe('project-id')
    expect(() => requireWalletConnectProjectId('  ')).toThrow(
      'NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID is required to initialize Reown AppKit'
    )
  })

  it('builds a wallet-only AppKit configuration around host settings', () => {
    const adapter = {} as Parameters<typeof createWalletAppKitOptions>[0]['adapter']
    const metadata = {
      description: 'Host description',
      icons: ['https://example.com/icon.svg'],
      name: 'Host app',
      url: 'https://example.com'
    }
    const options = createWalletAppKitOptions({
      adapter,
      defaultNetwork: mainnet,
      enableNetworkSwitch: true,
      metadata,
      networks: [mainnet],
      projectId: 'project-id',
      themeMode: 'dark'
    })

    expect(options).toMatchObject({
      adapters: [adapter],
      allWallets: 'SHOW',
      defaultNetwork: mainnet,
      enableBaseAccount: false,
      enableCoinbase: false,
      enableEIP6963: true,
      enableInjected: true,
      enableNetworkSwitch: true,
      enableReconnect: true,
      enableWallets: true,
      features: WALLET_APPKIT_FEATURES,
      includeWalletIds: WALLETCONNECT_WALLET_IDS,
      metadata,
      networks: [mainnet],
      projectId: 'project-id',
      themeMode: 'dark'
    })
  })

  it('limits the remote catalog to ten ranked wallets plus Safe', () => {
    expect(WALLETCONNECT_WALLETS.map(({ name }) => name)).toEqual([
      'Trust Wallet',
      'MetaMask',
      'Binance Wallet',
      'SafePal',
      'TokenPocket',
      'Fireblocks',
      'IronWallet',
      'Bitget Wallet',
      'OKX Wallet',
      'Ledger Wallet',
      'Safe'
    ])
    expect(WALLETCONNECT_WALLET_IDS).toHaveLength(11)
    expect(new Set(WALLETCONNECT_WALLET_IDS).size).toBe(11)
  })

  it('recognizes only the exact Safe connector identity', () => {
    expect(isSafeConnectorId('safe')).toBe(true)
    expect(isSafeConnectorId('SAFE')).toBe(true)
    expect(isSafeConnectorId('walletconnect-safe-like')).toBe(false)
    expect(isSafeConnectorId(undefined)).toBe(false)
  })
})
