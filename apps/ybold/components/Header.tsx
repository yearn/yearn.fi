'use client'

import { WalletAccountMenu } from '@ybold/components/WalletAccountMenu'
import { YEARN_VAULT_URL } from '@ybold/lib/contracts'
import { SiteHeader } from '@yearn/site-header'
import { IconBurgerPlain } from '@yearn/site-header/icons/IconBurgerPlain'
import { IconWallet } from '@yearn/site-header/icons/IconWallet'
import { MobileNavMenu } from '@yearn/site-header/mobile'
import { formatWalletAddress, useWalletDrawer } from '@yearn/wallet-ui'
import { useState } from 'react'
import { useAccount } from 'wagmi'

export function Header() {
  const { address, isConnected } = useAccount()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isAccountOpen, setIsAccountOpen] = useState(false)
  const { openWalletDrawer, dialogId, isOpen: isWalletDrawerOpen, toggleWalletDrawer } = useWalletDrawer()

  return (
    <SiteHeader
      siteBaseUrl="https://yearn.fi"
      actions={
        <nav className="flex items-center gap-2">
          <a
            href={YEARN_VAULT_URL}
            target="_blank"
            rel="noreferrer"
            className="hidden rounded-full border border-navy px-4 py-1.5 text-sm font-medium text-navy transition hover:bg-navy hover:text-white sm:block"
          >
            Open on Yearn.Fi
          </a>
          {isConnected ? (
            <WalletAccountMenu key={address} isOpen={isAccountOpen} setIsOpen={setIsAccountOpen} />
          ) : (
            <button
              type="button"
              data-wallet-entry="header"
              data-wallet-drawer-trigger
              aria-label="Connect wallet"
              aria-controls={dialogId}
              aria-expanded={isWalletDrawerOpen}
              aria-haspopup="dialog"
              onClick={toggleWalletDrawer}
              className="inline-flex h-8 shrink-0 items-center justify-center gap-2 rounded-lg bg-text-primary px-3 text-xs text-surface transition-opacity hover:opacity-90"
            >
              <IconWallet className="size-4" />
              <span className="hidden sm:inline">Connect Wallet</span>
            </button>
          )}
          <button
            type="button"
            data-mobile-nav-trigger
            aria-label="Open navigation menu"
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg p-2.5 text-text-primary hover:bg-surface-secondary md:hidden"
            onClick={() => setIsMobileMenuOpen(true)}
          >
            <IconBurgerPlain className="size-6" />
          </button>
        </nav>
      }
    >
      <MobileNavMenu
        isOpen={isMobileMenuOpen && !isWalletDrawerOpen && !isAccountOpen}
        onClose={() => setIsMobileMenuOpen(false)}
        isDarkTheme={false}
        siteBaseUrl="https://yearn.fi"
        walletIdentity={address ? formatWalletAddress(address) : undefined}
        onWalletClick={() => {
          setIsMobileMenuOpen(false)
          if (isConnected) setIsAccountOpen(true)
          else openWalletDrawer()
        }}
      />
    </SiteHeader>
  )
}
