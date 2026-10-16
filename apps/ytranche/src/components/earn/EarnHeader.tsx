'use client'

import { SiteHeader } from '@yearn/site-header'
import { IconBurgerPlain } from '@yearn/site-header/icons/IconBurgerPlain'
import { HeaderNavMenu } from '@yearn/site-header/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { useRef, useState } from 'react'
import { ThemeSwitcher, type TTheme, WalletButton } from '@/components/ytranche/shared'

const SITE_BASE_URL = 'https://yearn.fi'

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

export function EarnHeader({
  theme,
  onThemeChange,
  layout
}: {
  theme: TTheme
  onThemeChange: (theme: TTheme) => void
  layout: 'fixed' | 'centered'
}) {
  const mobileMenu = useRef<HTMLDialogElement>(null)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const isDarkTheme = theme === 'dark'
  const layoutLinks = (
    <nav className="flex items-center gap-3 text-sm text-text-secondary" aria-label="Earn layout">
      {[
        { name: 'Fixed', href: '/', value: 'fixed' },
        { name: 'Centered', href: '/earn-centered', value: 'centered' }
      ].map((item) => (
        <Link
          key={item.value}
          href={item.href}
          aria-current={layout === item.value ? 'page' : undefined}
          className={layout === item.value ? 'font-semibold text-text-primary' : 'hover:text-text-primary'}
        >
          {item.name}
        </Link>
      ))}
    </nav>
  )
  return (
    <SiteHeader
      siteBaseUrl={SITE_BASE_URL}
      isDarkTheme={isDarkTheme}
      navigation={
        <>
          <HeaderNavMenu isHomePage={false} isDarkTheme={isDarkTheme} siteBaseUrl={SITE_BASE_URL} />
          <div className="hidden border-l border-border pl-4 lg:block">{layoutLinks}</div>
        </>
      }
      actions={
        <>
          <div className="hidden md:block">
            <ThemeSwitcher theme={theme} onChange={onThemeChange} />
          </div>
          <WalletButton inverse={isDarkTheme} />
          <button
            type="button"
            data-mobile-nav-trigger
            aria-label="Open navigation menu"
            aria-controls="ytranche-navigation"
            aria-expanded={isMenuOpen}
            className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-text-primary hover:bg-surface-secondary md:hidden"
            onClick={() => {
              mobileMenu.current?.showModal()
              setIsMenuOpen(true)
            }}
          >
            <IconBurgerPlain className="size-6" />
          </button>
        </>
      }
    >
      <dialog
        ref={mobileMenu}
        id="ytranche-navigation"
        aria-label="Navigation menu"
        onClose={() => setIsMenuOpen(false)}
        className="fixed inset-x-0 top-0 m-0 max-h-dvh w-full max-w-none overflow-y-auto border-b border-border bg-app p-5 text-text-primary backdrop:bg-black/40"
      >
        <div className="mb-5 flex items-center justify-between">
          <span className="text-lg font-semibold">Yearn Earn</span>
          <button
            type="button"
            aria-label="Close navigation menu"
            onClick={() => mobileMenu.current?.close()}
            className="flex size-11 items-center justify-center rounded-lg text-2xl hover:bg-surface-secondary"
          >
            ×
          </button>
        </div>
        <HeaderNavMenu inline isHomePage={false} isDarkTheme={isDarkTheme} siteBaseUrl={SITE_BASE_URL} />
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-border pt-4">
          <div onClick={() => mobileMenu.current?.close()}>{layoutLinks}</div>
          <ThemeSwitcher theme={theme} onChange={onThemeChange} />
        </div>
      </dialog>
    </SiteHeader>
  )
}
