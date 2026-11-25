'use client'

import { useWalletActivity } from '@erc4626/components/WalletActivity'
import { AccountMenu, type TAccountMenuData } from '@yearn/site-header/account'
import { useWalletDisconnect, WalletSurface } from '@yearn/wallet-ui'
import { useAccount, useChains, useSwitchChain } from 'wagmi'

function useWalletAccount(onClose: () => void): TAccountMenuData {
  const { address, chain } = useAccount()
  const { disconnect } = useWalletDisconnect()
  const chains = useChains()
  const { mutate: switchChain, isPending, error } = useSwitchChain()
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
    networkAction: (
      <div className="mt-3 space-y-2">
        <label className="flex items-center gap-3 text-sm text-text-secondary">
          Network
          <select
            aria-label="Switch network"
            aria-busy={isPending || undefined}
            value={chain?.id ?? ''}
            disabled={isPending}
            onChange={(event) => switchChain({ chainId: Number(event.currentTarget.value) }, { onSuccess: onClose })}
            className="min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-text-primary"
          >
            {!chain && (
              <option value="" disabled>
                Unsupported network
              </option>
            )}
            {chains.map((network) => (
              <option key={network.id} value={network.id}>
                {network.name}
              </option>
            ))}
          </select>
        </label>
        {error && (
          <p role="alert" className="text-sm text-error">
            The network could not be switched. Please try again in your wallet.
          </p>
        )}
      </div>
    )
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
