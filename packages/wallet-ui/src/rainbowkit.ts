import { darkTheme, getWalletConnectConnector, lightTheme, type WalletList } from '@rainbow-me/rainbowkit'
import {
  binanceWallet,
  bitgetWallet,
  injectedWallet,
  ledgerWallet,
  metaMaskWallet,
  okxWallet,
  safepalWallet,
  safeWallet,
  tokenPocketWallet,
  trustWallet,
  walletConnectWallet
} from '@rainbow-me/rainbowkit/wallets'
import { isMobileWalletBrowser } from '@yearn/wallet-ui/connectors'
import { CUSTOM_WALLET_ICONS } from '@yearn/wallet-ui/walletIcons'

type TCreateWallet = WalletList[number]['wallets'][number]

export const WALLETCONNECT_QR_WALLET_ID = 'yearnWalletConnect'

// A QR-only custom Wallet keeps the flow in RainbowKit instead of its optional transport catalog.
// Phones choose from our curated wallets, whose supported mobile links open the selected app.
const yearnWalletConnect: TCreateWallet = (options) => ({
  ...walletConnectWallet(options),
  id: WALLETCONNECT_QR_WALLET_ID,
  hidden: isMobileWalletBrowser
})

// These three curated choices are not WalletConnect wallets in RainbowKit's built-in list.
// Registry metadata: https://explorer-api.walletconnect.com/v3/wallets (2026-09-11).
const customWallets = [
  {
    id: 'fireblocks',
    name: 'Fireblocks',
    mobileUri: 'fireblocks-wc://wc',
    ios: 'https://apps.apple.com/us/app/fireblocks/id1439296596',
    android: 'https://play.google.com/store/apps/details?id=com.fireblocks.client'
  },
  {
    id: 'ironWallet',
    name: 'IronWallet',
    mobileUri: 'https://app.ironwallet.io/wc',
    ios: 'https://apps.apple.com/gb/app/ironwallet-sell-buy-crypto/id6451146325',
    android: 'https://play.google.com/store/apps/details?id=com.wallet.crypto.btc.eth'
  },
  {
    id: 'safeWalletConnect',
    name: 'Safe',
    mobileUri: 'safe://wc',
    ios: 'https://apps.apple.com/app/id6748754793',
    android: 'https://play.google.com/store/apps/details?id=global.safe.mobileapp'
  }
] as const

const [fireblocksWallet, ironWallet, safeWalletConnect] = customWallets.map(
  (wallet): TCreateWallet =>
    ({ projectId, walletConnectParameters }) => ({
      id: wallet.id,
      name: wallet.name,
      iconUrl: CUSTOM_WALLET_ICONS[wallet.id],
      iconBackground: '#fff',
      downloadUrls: { ios: wallet.ios, android: wallet.android },
      qrCode: { getUri: (uri) => uri },
      mobile: { getUri: (uri) => `${wallet.mobileUri}?uri=${encodeURIComponent(uri)}` },
      createConnector: getWalletConnectConnector({ projectId, walletConnectParameters })
    })
)

export function getYearnWallets(): WalletList {
  const groups: WalletList = [
    { groupName: 'Connect', wallets: [injectedWallet, yearnWalletConnect] },
    {
      groupName: 'More wallets',
      wallets: [
        trustWallet,
        metaMaskWallet,
        binanceWallet,
        safepalWallet,
        tokenPocketWallet,
        fireblocksWallet,
        ironWallet,
        bitgetWallet,
        okxWallet,
        ledgerWallet,
        safeWalletConnect
      ]
    },
    // Safe's iframe SDK remains available without labelling it an installed browser extension.
    { groupName: 'Safe Apps', wallets: [safeWallet] }
  ]
  return groups.map((group) => ({
    ...group,
    wallets: group.wallets.map(
      (createWallet): TCreateWallet =>
        (options) => {
          const wallet = createWallet(options)
          return {
            ...wallet,
            createConnector: (details) => {
              const createConnector = wallet.createConnector(details)
              return (config) => ({
                ...createConnector(config),
                // Keep public wallet metadata for our picker without reading RainbowKit's connector internals.
                yearnWallet: { rdns: wallet.rdns, iconUrl: wallet.iconUrl }
              })
            }
          }
        }
    )
  }))
}

export function getYearnRainbowTheme(mode: 'light' | 'dark' = 'light'): ReturnType<typeof lightTheme> {
  const theme = (mode === 'dark' ? darkTheme : lightTheme)({
    accentColor: '#0657f9',
    accentColorForeground: '#fff',
    borderRadius: 'medium',
    fontStack: 'system',
    overlayBlur: 'small'
  })
  return {
    ...theme,
    colors: {
      ...theme.colors,
      modalBackground: mode === 'dark' ? '#171b21' : '#fff',
      modalText: mode === 'dark' ? '#f8f9fb' : '#1c2130',
      modalTextSecondary: mode === 'dark' ? '#a8adb7' : '#667085',
      modalBorder: mode === 'dark' ? '#303640' : '#e5e7eb',
      generalBorder: mode === 'dark' ? '#303640' : '#e5e7eb',
      menuItemBackground: mode === 'dark' ? '#242a33' : '#f5f7fa',
      modalBackdrop: 'rgba(0, 0, 0, 0.35)'
    },
    fonts: { body: 'inherit' },
    radii: { ...theme.radii, modal: '16px', modalMobile: '16px', actionButton: '12px' }
  }
}
