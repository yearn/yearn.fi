import { CUSTOM_WALLET_ICONS, WALLET_ICONS } from '@yearn/wallet-ui/walletIcons'
import { injected, safe, walletConnect } from 'wagmi/connectors'

export type TWalletOption = {
  id: string
  name: string
  icon: string
  rdns?: string
  mobileLink: string
  qrLink?: string
  mobileQrLink?: string
  downloadUrl: string
  androidDownloadUrl?: string
  desktopLink?: string
}

// Keep the intentional catalogue small. WalletConnect handles sessions; these are only app links and branding.
export const CURATED_WALLETS: readonly TWalletOption[] = [
  {
    id: 'trust',
    name: 'Trust Wallet',
    icon: WALLET_ICONS.trust,
    rdns: 'com.trustwallet.app',
    mobileLink: 'trust://wc',
    downloadUrl: 'https://trustwallet.com/download'
  },
  {
    id: 'metaMask',
    name: 'MetaMask',
    icon: WALLET_ICONS.metaMask,
    rdns: 'io.metamask',
    mobileLink: 'metamask://wc',
    qrLink: 'https://metamask.app.link/wc',
    downloadUrl: 'https://metamask.io/download'
  },
  {
    id: 'binance',
    name: 'Binance Wallet',
    icon: WALLET_ICONS.binance,
    rdns: 'com.binance.wallet',
    mobileLink: 'bnc://app.binance.com/cedefi/wc',
    downloadUrl: 'https://www.binance.com/en/download'
  },
  {
    id: 'safepal',
    name: 'SafePal Wallet',
    icon: WALLET_ICONS.safepal,
    mobileLink: 'safepalwallet://wc',
    downloadUrl: 'https://www.safepal.com/en/download'
  },
  {
    id: 'tokenPocket',
    name: 'TokenPocket',
    icon: WALLET_ICONS.tokenPocket,
    rdns: 'pro.tokenpocket',
    mobileLink: 'tpoutside://wc',
    mobileQrLink: 'tpoutside://wc',
    downloadUrl: 'https://tokenpocket.pro/en/download/app'
  },
  {
    id: 'fireblocks',
    name: 'Fireblocks',
    icon: CUSTOM_WALLET_ICONS.fireblocks,
    mobileLink: 'fireblocks-wc://wc',
    downloadUrl: 'https://apps.apple.com/us/app/fireblocks/id1439296596',
    androidDownloadUrl: 'https://play.google.com/store/apps/details?id=com.fireblocks.client'
  },
  {
    id: 'ironWallet',
    name: 'IronWallet',
    icon: CUSTOM_WALLET_ICONS.ironWallet,
    mobileLink: 'https://app.ironwallet.io/wc',
    downloadUrl: 'https://ironwallet.io'
  },
  {
    id: 'bitget',
    name: 'Bitget Wallet',
    icon: WALLET_ICONS.bitget,
    rdns: 'com.bitget.web3',
    mobileLink: 'bitkeep://wc',
    downloadUrl: 'https://web3.bitget.com/en/wallet-download'
  },
  {
    id: 'okx',
    name: 'OKX Wallet',
    icon: WALLET_ICONS.okx,
    rdns: 'com.okex.wallet',
    mobileLink: 'okex://main/wc',
    downloadUrl: 'https://okx.com/download'
  },
  {
    id: 'ledger',
    name: 'Ledger',
    icon: WALLET_ICONS.ledger,
    mobileLink: 'ledgerlive://wc',
    desktopLink: 'ledgerlive://wc',
    qrLink: 'ledgerlive://wc',
    downloadUrl: 'https://www.ledger.com/ledger-live'
  },
  {
    id: 'safeWalletConnect',
    name: 'Safe',
    icon: CUSTOM_WALLET_ICONS.safeWalletConnect,
    mobileLink: 'safe://wc',
    downloadUrl: 'https://apps.apple.com/app/id6748754793',
    androidDownloadUrl: 'https://play.google.com/store/apps/details?id=global.safe.mobileapp'
  }
]

export function getWalletAppLink(wallet: TWalletOption, uri: string, mobile: boolean): string | undefined {
  const link = mobile ? wallet.mobileLink : wallet.desktopLink
  return link === '' ? uri : link ? `${link}?uri=${encodeURIComponent(uri)}` : undefined
}

export function getWalletQrUri(wallet: TWalletOption | undefined, uri: string, mobile: boolean): string {
  const link = (mobile ? wallet?.mobileQrLink : undefined) ?? wallet?.qrLink
  return link ? `${link}?uri=${encodeURIComponent(uri)}` : uri
}

export function rememberWalletApp(wallet?: TWalletOption, mobile = true): void {
  if (typeof window === 'undefined') return
  const link = mobile ? wallet?.mobileLink : wallet?.desktopLink
  try {
    // Sign Client reads this preference to reopen the chosen app for subsequent signing requests.
    // It appends /wc itself. Persist only the app base, never the pairing URI or its secret.
    if (link) {
      window.localStorage.setItem(
        'WALLETCONNECT_DEEPLINK_CHOICE',
        JSON.stringify({
          href: link.endsWith('/wc') ? link.slice(0, -2) : link,
          name: wallet?.name
        })
      )
    } else {
      window.localStorage.removeItem('WALLETCONNECT_DEEPLINK_CHOICE')
    }
  } catch {
    // Storage may be unavailable in private browsing; the initial app link still works.
  }
}

export function getYearnConnectors({
  projectId,
  appName,
  appUrl,
  appIcon
}: {
  projectId?: string
  appName: string
  appUrl: string
  appIcon: string
}) {
  return [
    injected(),
    safe(),
    ...(projectId?.trim()
      ? [
          walletConnect({
            projectId: projectId.trim(),
            showQrModal: false,
            metadata: {
              name: appName,
              description: appName,
              url: typeof window === 'undefined' ? appUrl : window.location.origin,
              icons: [appIcon]
            }
          })
        ]
      : [])
  ]
}
