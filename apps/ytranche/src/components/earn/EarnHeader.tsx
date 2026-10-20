'use client'

import { SiteHeader } from '@yearn/site-header'
import { ThemeSettings } from '@yearn/site-header/account'
import { IconBurgerPlain } from '@yearn/site-header/icons/IconBurgerPlain'
import { IconMoon } from '@yearn/site-header/icons/IconMoon'
import { IconSun } from '@yearn/site-header/icons/IconSun'
import { IconWallet } from '@yearn/site-header/icons/IconWallet'
import { MobileNavMenu } from '@yearn/site-header/mobile'
import { formatWalletAddress, useWalletDrawer, WalletSurface } from '@yearn/wallet-ui'
import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'
import { useAccount } from 'wagmi'
import { HeaderStreams } from '@/components/earn/HeaderStreams'
import { WalletAccountDropdown } from '@/components/ytranche/WalletAccountMenu'
import type { TTheme } from '@/lib/theme'

const SITE_BASE_URL = 'https://yearn.fi'
const SHOW_THEME_SWITCH = false

export function EarnBrand({ inverse = false }: { inverse?: boolean }) {
  return (
    <Link className={`earn-brand${inverse ? ' earn-brand--inverse' : ''}`} href="/">
      <Image src="/yearn-symbol.svg" alt="" width={28} height={33} priority />
      <strong>YEARN</strong>
      <i aria-hidden="true" />
      <span>Earn</span>
    </Link>
  )
}

type TEarnHeaderProps = {
  theme: TTheme
  onThemeChange: (theme: TTheme) => void
}

export function EarnHeader(props: TEarnHeaderProps) {
  const { address } = useAccount()
  return <EarnHeaderContent key={address ?? 'disconnected'} {...props} />
}

function EarnHeaderContent({ theme, onThemeChange }: TEarnHeaderProps) {
  const { address, isConnected } = useAccount()
  const { openWalletDrawer, dialogId, isOpen: isWalletPickerOpen } = useWalletDrawer()
  const [isAccountOpen, setIsAccountOpen] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const isDarkTheme = theme === 'dark'
  return (
    <SiteHeader
      siteBaseUrl={SITE_BASE_URL}
      isDarkTheme={isDarkTheme}
      actions={
        <>
          {SHOW_THEME_SWITCH && (
            <div className="hidden md:block">
              <button
                type="button"
                className="min-h-[44px] min-w-[44px] rounded-full p-2.5 text-text-secondary transition-colors hover:text-text-primary"
                onClick={() => onThemeChange(isDarkTheme ? 'light' : 'dark')}
                aria-label={isDarkTheme ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {isDarkTheme ? <IconSun className="size-5" /> : <IconMoon className="size-5" />}
              </button>
            </div>
          )}
          <button
            type="button"
            data-wallet-entry="header"
            data-wallet-drawer-trigger={!isConnected || undefined}
            data-wallet-account-trigger={isConnected || undefined}
            aria-label={
              isConnected && address ? `Open wallet account ${formatWalletAddress(address)}` : 'Connect wallet'
            }
            aria-controls={isConnected ? 'ytranche-wallet-account' : dialogId}
            aria-expanded={isConnected ? isAccountOpen : isWalletPickerOpen}
            aria-haspopup="dialog"
            className={
              isConnected
                ? 'inline-flex items-center gap-2 rounded-lg bg-surface-secondary px-3 py-1.5 text-sm text-text-secondary'
                : 'inline-flex h-8 items-center justify-center gap-2 rounded-lg bg-text-primary px-3 text-xs text-surface transition-opacity hover:opacity-90'
            }
            onClick={() => {
              if (isConnected) setIsAccountOpen((open) => !open)
              else openWalletDrawer()
            }}
          >
            <IconWallet className="size-4" />
            <span className="hidden sm:inline">
              {isConnected && address ? formatWalletAddress(address) : 'Connect wallet'}
            </span>
          </button>
          <button
            type="button"
            data-mobile-nav-trigger
            aria-label="Open navigation menu"
            aria-expanded={isMenuOpen}
            className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-text-primary hover:bg-surface-secondary md:hidden"
            onClick={() => setIsMenuOpen(true)}
          >
            <IconBurgerPlain className="size-6" />
          </button>
        </>
      }
    >
      <HeaderStreams />
      <WalletAccountDropdown address={address} isOpen={isAccountOpen} onClose={() => setIsAccountOpen(false)} />
      <MobileNavMenu
        isOpen={isMenuOpen && !isAccountOpen && !isWalletPickerOpen && !isSettingsOpen}
        onClose={() => setIsMenuOpen(false)}
        isDarkTheme={isDarkTheme}
        siteBaseUrl={SITE_BASE_URL}
        walletIdentity={address ? formatWalletAddress(address) : undefined}
        onThemeToggle={SHOW_THEME_SWITCH ? () => onThemeChange(isDarkTheme ? 'light' : 'dark') : undefined}
        onWalletClick={() => {
          setIsMenuOpen(false)
          if (isConnected) setIsAccountOpen(true)
          else openWalletDrawer()
        }}
        onSettingsClick={() => {
          setIsMenuOpen(false)
          setIsSettingsOpen(true)
        }}
      />
      <WalletSurface
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        themeClassName="ytranche-wallet-ui"
        dialogId="ytranche-settings"
        title="Settings"
        desktopTop="calc(var(--header-height) + 0.5rem)"
        desktopRight="max(1rem, calc((100vw - 1232px) / 2 + 1rem))"
      >
        <ThemeSettings />
      </WalletSurface>
    </SiteHeader>
  )
}
