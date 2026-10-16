'use client'

import Image from 'next/image'
import Link from 'next/link'
import type { TYTrancheModel } from '@/components/ytranche/model'
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
  model,
  theme,
  onThemeChange,
  page,
  layout
}: {
  model: TYTrancheModel
  theme: TTheme
  onThemeChange: (theme: TTheme) => void
  page: 'retail' | 'institutions'
  layout?: 'fixed' | 'centered'
}) {
  return (
    <header className="earn-header">
      <div className="earn-header__inner">
        <EarnBrand inverse={theme === 'dark'} />

        <div className="earn-header__navigation">
          <nav className="earn-header__nav" aria-label="Product navigation">
            <Link
              className={page === 'retail' ? 'is-active' : undefined}
              href="/"
              aria-current={page === 'retail' ? 'page' : undefined}
            >
              Earn
            </Link>
            <Link
              className={page === 'institutions' ? 'is-active' : undefined}
              href="/institutions"
              aria-current={page === 'institutions' ? 'page' : undefined}
            >
              Institutions
            </Link>
          </nav>

          {page === 'retail' && layout ? (
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
          ) : null}
        </div>

        <div className="earn-header__actions">
          <ThemeSwitcher theme={theme} onChange={onThemeChange} />
          <WalletButton model={model} inverse={theme === 'dark'} />
        </div>
      </div>
    </header>
  )
}
