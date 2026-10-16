'use client'

import { useWalletActivity } from '@erc4626/components/WalletActivity'
import { useChainModal } from '@rainbow-me/rainbowkit'
import { AccountMenu, type TAccountMenuData } from '@yearn/site-header/account'
import { useWalletDisconnect, WalletSurface } from '@yearn/wallet-ui'
import { useAccount } from 'wagmi'

function useWalletAccount(onClose: () => void): TAccountMenuData {
  const { address, chain } = useAccount()
  const { disconnect } = useWalletDisconnect()
  const { openChainModal } = useChainModal()
  const activity = useWalletActivity()
  return {
    address,
    displayName: address ? `${address.slice(0, 6)}…${address.slice(-4)}` : 'Not connected',
    recentActivity: activity.filter((item) => item.ownerAddress?.toLowerCase() === address?.toLowerCase()).slice(0, 3),
    onDisconnect: () => {
      disconnect()
      onClose()
    },
    onViewPortfolio: () => {
      window.location.assign('https://yearn.fi/portfolio')
      onClose()
    },
    onViewAllActivity: () => {
      onClose()
      document.getElementById('recent-transactions')?.scrollIntoView({ behavior: 'smooth' })
    },
    networkAction: openChainModal ? (
      <button
        type="button"
        onClick={() => {
          onClose()
          openChainModal()
        }}
        className="mt-3 flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm text-text-secondary hover:bg-surface-secondary"
      >
        <span>{chain?.name ?? 'Unsupported network'}</span>
        <span>Switch network</span>
      </button>
    ) : undefined
  }
}

export function WalletAccountDropdown({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { address, isConnected } = useAccount()
  return (
    <WalletSurface
      isOpen={isOpen && isConnected}
      onClose={onClose}
      dialogId="erc4626-wallet-account"
      title="Wallet"
      triggerSelector="[data-wallet-account-trigger], [data-mobile-nav-trigger]"
      desktopTop="calc(var(--header-height) + 0.5rem)"
      desktopRight="max(1rem, calc((100vw - 1232px) / 2 + 1rem))"
    >
      {isOpen && isConnected && <WalletAccountContent key={address} onClose={onClose} />}
    </WalletSurface>
  )
}

export function WalletAccountContent({ onClose }: { onClose: () => void }) {
  const account = useWalletAccount(onClose)
  return <AccountMenu key={account.address} account={account} />
}
