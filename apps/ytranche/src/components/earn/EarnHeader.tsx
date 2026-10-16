'use client'

import Image from 'next/image'
import Link from 'next/link'
import { ThemeSwitcher, type TTheme, WalletButton } from '@/components/ytranche/shared'

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
  return (
    <header className="earn-header">
      <div className="earn-header__inner">
        <EarnBrand inverse={theme === 'dark'} />
        <div className="earn-header__navigation">
          <nav className="earn-header__nav earn-header__layout-nav" aria-label="Earn layout">
            <Link
              className={layout === 'fixed' ? 'is-active' : undefined}
              href="/"
              aria-current={layout === 'fixed' ? 'page' : undefined}
            >
              Fixed
            </Link>
            <Link
              className={layout === 'centered' ? 'is-active' : undefined}
              href="/earn-centered"
              aria-current={layout === 'centered' ? 'page' : undefined}
            >
              Centered
            </Link>
          </nav>
        </div>
        <div className="earn-header__actions">
          <ThemeSwitcher theme={theme} onChange={onThemeChange} />
          <WalletButton inverse={theme === 'dark'} />
        </div>
      </div>
    </header>
  )
}
