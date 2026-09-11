import { WALLET_APPKIT_FEATURES, WALLETCONNECT_WALLET_IDS } from '@yearn/wallet-ui/appkit'
import { base, mainnet } from 'viem/chains'
import { describe, expect, it } from 'vitest'
import {
  createYearnAppKitOptions,
  createYearnCustomRpcUrls,
  YEARN_APPKIT_METADATA,
  YEARN_APPKIT_NETWORKS,
  YEARN_WAGMI_RECONNECT_ON_MOUNT
} from '@/config/appkitConfig'
import { supportedAppChains, supportedWalletChains } from '@/config/supportedChains'

describe('Yearn AppKit configuration', () => {
  it('keeps every wallet and canonical app chain in the adapter network list', () => {
    const expectedNetworkIds = [
      ...new Set([...supportedWalletChains, ...supportedAppChains].map((network) => network.id))
    ]

    expect(YEARN_APPKIT_NETWORKS.map((network) => network.id)).toEqual(expectedNetworkIds)
  })

  it('maps configured RPC fallbacks to their EIP-155 network keys', () => {
    const customRpcUrls = createYearnCustomRpcUrls([mainnet, base], (network) => [
      `https://primary.example/${network.id}`,
      `https://fallback.example/${network.id}`
    ])

    expect(customRpcUrls).toEqual({
      'eip155:1': [{ url: 'https://primary.example/1' }, { url: 'https://fallback.example/1' }],
      'eip155:8453': [{ url: 'https://primary.example/8453' }, { url: 'https://fallback.example/8453' }]
    })
  })

  it('leaves network switching to Yearn while retaining the shared curated wallet policy', () => {
    const adapter = {} as Parameters<typeof createYearnAppKitOptions>[0]
    const customRpcUrls = createYearnCustomRpcUrls([mainnet], () => ['https://rpc.example'])
    const options = createYearnAppKitOptions(adapter, 'project-id', customRpcUrls)

    expect(options).toMatchObject({
      adapters: [adapter],
      allWallets: 'SHOW',
      customRpcUrls,
      defaultNetwork: YEARN_APPKIT_NETWORKS[0],
      enableBaseAccount: false,
      enableCoinbase: false,
      enableEIP6963: true,
      enableInjected: true,
      enableNetworkSwitch: false,
      enableReconnect: true,
      enableWallets: true,
      features: WALLET_APPKIT_FEATURES,
      includeWalletIds: WALLETCONNECT_WALLET_IDS,
      metadata: YEARN_APPKIT_METADATA,
      networks: YEARN_APPKIT_NETWORKS,
      projectId: 'project-id'
    })
    expect(YEARN_WAGMI_RECONNECT_ON_MOUNT).toBe(false)
  })
})
