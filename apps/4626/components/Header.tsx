'use client'

import { WalletAccountDropdown } from '@erc4626/components/WalletAccount'
import { SiteHeader } from '@yearn/site-header'
import { ThemeSettings } from '@yearn/site-header/account'
import { IconBurgerPlain } from '@yearn/site-header/icons/IconBurgerPlain'
import { IconMoon } from '@yearn/site-header/icons/IconMoon'
import { IconSun } from '@yearn/site-header/icons/IconSun'
import { IconWallet } from '@yearn/site-header/icons/IconWallet'
import { MobileNavMenu } from '@yearn/site-header/mobile'
import { setThemePreference, useThemePreference } from '@yearn/site-header/theme'
import { formatWalletAddress, useWalletDrawer, WalletSurface } from '@yearn/wallet-ui'
import { useState } from 'react'
import { useAccount } from 'wagmi'

const siteBaseUrl = 'https://yearn.fi'
const linkClass = 'text-base font-medium text-text-secondary transition-colors hover:text-text-primary'

function WalletButton({
  onOpen,
  onAccountOpen,
  isAccountOpen
}: {
  onOpen?: () => void
  onAccountOpen: () => void
  isAccountOpen: boolean
}) {
  const { address, isConnected } = useAccount()
  const { openWalletDrawer, dialogId, isOpen } = useWalletDrawer()
  const identity = isConnected && address ? formatWalletAddress(address) : undefined
  return (
    <button
      type="button"
      data-wallet-entry="header"
      data-wallet-drawer-trigger={!isConnected || undefined}
      data-wallet-account-trigger={isConnected || undefined}
      aria-controls={isConnected ? 'erc4626-wallet-account' : dialogId}
      aria-expanded={isConnected ? isAccountOpen : isOpen}
      aria-haspopup="dialog"
      aria-label={identity ? `Open wallet account ${identity}` : 'Connect wallet'}
      onClick={() => {
        if (isConnected) onAccountOpen()
        else {
          onOpen?.()
          openWalletDrawer()
        }
      }}
      className={
        identity
          ? 'inline-flex items-center gap-2 rounded-lg bg-surface-secondary px-3 py-1.5 text-sm text-text-secondary'
          : 'inline-flex h-8 items-center justify-center gap-2 rounded-lg bg-text-primary px-3 text-xs text-surface transition-opacity hover:opacity-90'
      }
    >
      <IconWallet className="size-4" />
      <span className="hidden sm:inline">{identity ?? 'Connect wallet'}</span>
    </button>
  )
}

export function Header() {
  const { address } = useAccount()
  return <HeaderContent key={address ?? 'disconnected'} />
}

function HeaderContent() {
  const isDarkTheme = useThemePreference() !== 'light'
  const { address, isConnected } = useAccount()
  const { openWalletDrawer, isOpen: isWalletPickerOpen } = useWalletDrawer()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isAccountOpen, setIsAccountOpen] = useState(false)
  const themeButton = (
    <button
      type="button"
      className="min-h-[44px] min-w-[44px] rounded-full p-2.5 text-text-secondary transition-colors hover:text-text-primary"
      onClick={() => setThemePreference(isDarkTheme ? 'light' : 'soft-dark')}
      aria-label={isDarkTheme ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {isDarkTheme ? <IconSun className="size-5" /> : <IconMoon className="size-5" />}
    </button>
  )
  const links = (
    <>
      <a className={linkClass} href={`${siteBaseUrl}/vaults`}>
        Vaults
      </a>
      <a className={linkClass} href={`${siteBaseUrl}/portfolio`}>
        Portfolio
      </a>
    </>
  )
  return (
    <SiteHeader
      siteBaseUrl={siteBaseUrl}
      isDarkTheme={isDarkTheme}
      actions={
        <>
          <div className="flex items-center gap-2">
            <nav aria-label="Yearn" className="hidden gap-4 md:flex">
              {links}
            </nav>
            <div className="hidden md:block">{themeButton}</div>
            <WalletButton isAccountOpen={isAccountOpen} onAccountOpen={() => setIsAccountOpen((open) => !open)} />
          </div>
          <button
            type="button"
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg p-2.5 text-text-primary hover:bg-surface-secondary md:hidden"
            onClick={() => setIsMobileMenuOpen(true)}
            data-mobile-nav-trigger
            aria-label="Open navigation menu"
          >
            <IconBurgerPlain className="size-6" />
          </button>
        </>
      }
    >
      <WalletAccountDropdown isOpen={isAccountOpen} onClose={() => setIsAccountOpen(false)} />
      <MobileNavMenu
        isOpen={isMobileMenuOpen && !isWalletPickerOpen && !isAccountOpen && !isSettingsOpen}
        onClose={() => setIsMobileMenuOpen(false)}
        isDarkTheme={isDarkTheme}
        siteBaseUrl={siteBaseUrl}
        walletIdentity={address ? formatWalletAddress(address) : undefined}
        onThemeToggle={() => setThemePreference(isDarkTheme ? 'light' : 'soft-dark')}
        onWalletClick={() => {
          setIsMobileMenuOpen(false)
          if (isConnected) setIsAccountOpen(true)
          else openWalletDrawer()
        }}
        onSettingsClick={() => {
          setIsMobileMenuOpen(false)
          setIsSettingsOpen(true)
        }}
      />
      <WalletSurface
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        dialogId="erc4626-settings"
        title="Settings"
        desktopTop="calc(var(--header-height) + 0.5rem)"
        desktopRight="max(1rem, calc((100vw - 1232px) / 2 + 1rem))"
      >
        <ThemeSettings />
      </WalletSurface>
    </SiteHeader>
  )
}
