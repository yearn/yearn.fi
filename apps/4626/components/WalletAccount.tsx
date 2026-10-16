'use client'

import { useWalletActivity } from '@erc4626/components/WalletActivity'
import { useChainModal } from '@rainbow-me/rainbowkit'
import { AccountDropdown, AccountMenu, type TAccountMenuData } from '@yearn/site-header/account'
import type { RefObject } from 'react'
import { useAccount, useDisconnect } from 'wagmi'

function useWalletAccount(onClose: () => void): TAccountMenuData {
  const { address, chain } = useAccount()
  const { disconnect } = useDisconnect()
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

export function WalletAccountDropdown({
  isOpen,
  onClose,
  triggerRef
}: {
  isOpen: boolean
  onClose: () => void
  triggerRef?: RefObject<HTMLElement | null>
}) {
  const account = useWalletAccount(onClose)
  return <AccountDropdown isOpen={isOpen} onClose={onClose} triggerRef={triggerRef} account={account} />
}

export function WalletAccountContent({ onClose }: { onClose: () => void }) {
  const account = useWalletAccount(onClose)
  return <AccountMenu key={account.address} account={account} />
}
