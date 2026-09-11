import {
  createYboldAppKitOptions,
  createYboldCustomRpcUrls,
  isSafeConnectorId,
  requireWalletConnectProjectId,
  resolveYboldRpcUrl,
  YBOLD_APPKIT_FEATURES,
  YBOLD_APPKIT_NETWORKS,
  YBOLD_WAGMI_RECONNECT_ON_MOUNT,
  YBOLD_WALLETCONNECT_WALLET_IDS,
  YBOLD_WALLETCONNECT_WALLETS
} from '@ybold/lib/appkitConfig'
import { createBaseAccountSDK } from '@ybold/lib/disabledBaseAccount'
import { describe, expect, it } from 'vitest'

describe('yBOLD AppKit configuration', () => {
  it('requires an explicit Reown project ID', () => {
    expect(requireWalletConnectProjectId('  project-id  ')).toBe('project-id')
    expect(() => requireWalletConnectProjectId('  ')).toThrow(
      'NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID is required to initialize Reown AppKit'
    )
  })

  it('preserves the configured mainnet RPC and PublicNode default', () => {
    expect(resolveYboldRpcUrl('  https://rpc.example  ')).toBe('https://rpc.example')
    expect(resolveYboldRpcUrl('')).toBe('https://ethereum-rpc.publicnode.com')
    expect(createYboldCustomRpcUrls('https://rpc.example')).toEqual({
      'eip155:1': [{ url: 'https://rpc.example' }]
    })
  })

  it('gives AppKit exclusive ownership of wallet discovery and reconnect', () => {
    const adapter = {} as Parameters<typeof createYboldAppKitOptions>[0]
    const customRpcUrls = createYboldCustomRpcUrls('https://rpc.example')
    const options = createYboldAppKitOptions(adapter, 'project-id', customRpcUrls)

    expect(options).toMatchObject({
      adapters: [adapter],
      allWallets: 'SHOW',
      customRpcUrls,
      enableBaseAccount: false,
      enableCoinbase: false,
      enableEIP6963: true,
      enableInjected: true,
      enableNetworkSwitch: false,
      enableReconnect: true,
      enableWallets: true,
      features: YBOLD_APPKIT_FEATURES,
      includeWalletIds: YBOLD_WALLETCONNECT_WALLET_IDS,
      networks: YBOLD_APPKIT_NETWORKS,
      projectId: 'project-id'
    })
    expect(YBOLD_WAGMI_RECONNECT_ON_MOUNT).toBe(false)
  })

  it('limits the WalletConnect catalog to ten ranked wallets plus Safe', () => {
    expect(YBOLD_WALLETCONNECT_WALLETS.map(({ name }) => name)).toEqual([
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
    expect(YBOLD_WALLETCONNECT_WALLET_IDS).toHaveLength(11)
    expect(new Set(YBOLD_WALLETCONNECT_WALLET_IDS).size).toBe(11)
  })

  it('disables non-wallet AppKit product surfaces', () => {
    expect(YBOLD_APPKIT_FEATURES).toEqual({
      analytics: false,
      connectMethodsOrder: ['wallet'],
      email: false,
      history: false,
      onramp: false,
      pay: false,
      receive: false,
      reownAuthentication: false,
      send: false,
      smartSessions: false,
      socials: false,
      swaps: false
    })
  })

  it('fails closed if disabled Base Account code is reached', () => {
    expect(() => createBaseAccountSDK()).toThrow('Base Account is disabled for the yBOLD Reown AppKit canary')
  })

  it('recognizes only the connector identity emitted by Wagmi Safe', () => {
    expect(isSafeConnectorId('safe')).toBe(true)
    expect(isSafeConnectorId('SAFE')).toBe(true)
    expect(isSafeConnectorId('walletconnect-safe-like')).toBe(false)
    expect(isSafeConnectorId(undefined)).toBe(false)
  })
})
