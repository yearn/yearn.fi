'use client'

import { WalletAccountMenu } from '@ybold/components/WalletAccountMenu'
import { YEARN_VAULT_URL } from '@ybold/lib/contracts'
import { useWalletDrawer } from '@yearn/wallet-ui/context'
import Image from 'next/image'
import { useAccount } from 'wagmi'

export function Header() {
  const { isConnected } = useAccount()
  const { dialogId, isOpen: isWalletDrawerOpen, toggleWalletDrawer } = useWalletDrawer()

  return (
    <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-6 sm:px-6">
      <Image src="/yearn-logo.svg" alt="Yearn" width={110} height={30} />
      <nav className="flex items-center gap-3">
        <a
          href={YEARN_VAULT_URL}
          target="_blank"
          rel="noreferrer"
          className="hidden rounded-full border border-navy px-4 py-1.5 text-sm font-medium text-navy transition hover:bg-navy hover:text-white sm:block"
        >
          Open on Yearn.Fi
        </a>
        {isConnected ? (
          <WalletAccountMenu />
        ) : (
          <button
            type="button"
            data-wallet-drawer-trigger
            aria-controls={dialogId}
            aria-expanded={isWalletDrawerOpen}
            aria-haspopup="dialog"
            onClick={toggleWalletDrawer}
            className="min-h-10 rounded-full bg-yearn px-4 py-2 text-sm font-medium text-white transition duration-150 hover:bg-navy focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-yearn"
          >
            Connect Wallet
          </button>
        )}
      </nav>
    </header>
  )
}
