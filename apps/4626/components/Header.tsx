'use client'

import { WalletAccountContent, WalletAccountDropdown } from '@erc4626/components/WalletAccount'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { SiteHeader } from '@yearn/site-header'
import { IconBurgerPlain } from '@yearn/site-header/icons/IconBurgerPlain'
import { IconMoon } from '@yearn/site-header/icons/IconMoon'
import { IconSun } from '@yearn/site-header/icons/IconSun'
import { IconWallet } from '@yearn/site-header/icons/IconWallet'
import { HeaderNavMenu } from '@yearn/site-header/navigation'
import { setThemePreference, useThemePreference } from '@yearn/site-header/theme'
import { useRef, useState } from 'react'
import { useAccount } from 'wagmi'

const siteBaseUrl = 'https://yearn.fi'
const linkClass = 'text-base font-medium text-text-secondary transition-colors hover:text-text-primary'

function WalletButton({ onOpen, onAccountOpen }: { onOpen?: () => void; onAccountOpen: () => void }) {
  return (
    <ConnectButton.Custom>
      {({ account, mounted, openConnectModal }) => (
        <button
          type="button"
          disabled={!mounted}
          onClick={() => {
            if (account) onAccountOpen()
            else {
              onOpen?.()
              openConnectModal()
            }
          }}
          className={
            account
              ? 'inline-flex items-center gap-2 rounded-lg bg-surface-secondary px-3 py-1.5 text-sm text-text-secondary'
              : 'inline-flex h-8 items-center justify-center gap-2 rounded-lg bg-text-primary px-3 text-xs text-surface transition-opacity hover:opacity-90'
          }
        >
          <IconWallet className="size-4" />
          {mounted && account ? account.displayName : 'Connect wallet'}
        </button>
      )}
    </ConnectButton.Custom>
  )
}

export function Header() {
  const { address } = useAccount()
  return <HeaderContent key={address ?? 'disconnected'} />
}

function HeaderContent() {
  const isDarkTheme = useThemePreference() !== 'light'
  const accountTrigger = useRef<HTMLDivElement>(null)
  const mobileMenu = useRef<HTMLDialogElement>(null)
  const [isAccountOpen, setIsAccountOpen] = useState(false)
  const [mobileWallet, setMobileWallet] = useState(false)
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
          <div className="hidden items-center gap-2 md:flex">
            <nav aria-label="Yearn" className="flex gap-4">
              {links}
            </nav>
            {themeButton}
            <div ref={accountTrigger} className="relative" onMouseDown={(event) => event.stopPropagation()}>
              <WalletButton onAccountOpen={() => setIsAccountOpen((open) => !open)} />
              <WalletAccountDropdown
                triggerRef={accountTrigger}
                isOpen={isAccountOpen}
                onClose={() => setIsAccountOpen(false)}
              />
            </div>
          </div>
          <button
            type="button"
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg p-2.5 text-text-primary hover:bg-surface-secondary md:hidden"
            onClick={() => mobileMenu.current?.showModal()}
            aria-label="Open navigation menu"
          >
            <IconBurgerPlain className="size-6" />
          </button>
        </>
      }
    >
      <dialog
        ref={mobileMenu}
        aria-label={mobileWallet ? 'Wallet account' : 'Navigation menu'}
        onClose={() => setMobileWallet(false)}
        className="fixed inset-x-0 top-0 m-0 max-h-dvh w-full max-w-none overflow-y-auto border-b border-border bg-app p-5 text-text-primary backdrop:bg-black/40"
      >
        <div className="sticky -top-5 z-10 -mx-5 -mt-5 mb-5 flex items-center justify-between bg-app px-5 pt-5">
          <span className="text-lg font-semibold">{mobileWallet ? 'Wallet' : 'Menu'}</span>
          <button
            type="button"
            onClick={() => mobileMenu.current?.close()}
            aria-label="Close navigation menu"
            className="size-11 text-2xl"
          >
            ×
          </button>
        </div>
        {mobileWallet ? (
          <WalletAccountContent onClose={() => mobileMenu.current?.close()} />
        ) : (
          <>
            <nav aria-label="Yearn mobile" className="flex flex-col gap-5">
              {links}
              <HeaderNavMenu inline isHomePage={false} isDarkTheme={isDarkTheme} siteBaseUrl={siteBaseUrl} />
            </nav>
            <div className="mt-6 flex items-center justify-between border-t border-border pt-4">
              <WalletButton onOpen={() => mobileMenu.current?.close()} onAccountOpen={() => setMobileWallet(true)} />
              {themeButton}
            </div>
          </>
        )}
      </dialog>
    </SiteHeader>
  )
}
