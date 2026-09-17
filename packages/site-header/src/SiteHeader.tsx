'use client'

import { TypeMarkYearn } from '@yearn/site-header/icons/TypeMarkYearn'
import { HeaderNavMenu } from '@yearn/site-header/navigation'
import { cl } from '@yearn/site-header/utils'
import type { ReactNode } from 'react'

export type TSiteHeaderProps = {
  isHomePage?: boolean
  isDarkTheme?: boolean
  siteBaseUrl?: string
  navigation?: ReactNode
  actions?: ReactNode
  children?: ReactNode
}

/** Shared Yearn masthead; each app supplies its wallet controls and mobile navigation. */
export function SiteHeader({
  isHomePage = false,
  isDarkTheme = false,
  siteBaseUrl = '',
  navigation,
  actions,
  children
}: TSiteHeaderProps) {
  return (
    <div
      id="head"
      className={cl('sticky inset-x-0 top-0 z-50 w-full backdrop-blur-md', isHomePage ? 'bg-transparent' : 'bg-app')}
    >
      <div className="mx-auto w-full max-w-[1232px] px-4">
        <header className="flex h-[var(--header-height)] w-full items-center justify-between px-0">
          <div className="flex items-center justify-start gap-x-6 px-1 py-2 md:py-1" data-tour="vaults-header-nav">
            <a
              href={`${siteBaseUrl}/`}
              aria-label="Yearn home"
              className="flex items-center gap-1 transition-colors hover:opacity-80"
            >
              <TypeMarkYearn
                aria-hidden="true"
                className="h-8 w-auto"
                color={isHomePage || isDarkTheme ? '#FFFFFF' : '#0657F9'}
              />
            </a>
            <div className="hidden items-center gap-3 pb-0.5 md:flex">
              {navigation ?? (
                <HeaderNavMenu isHomePage={isHomePage} isDarkTheme={isDarkTheme} siteBaseUrl={siteBaseUrl} />
              )}
            </div>
          </div>
          <div className="flex items-center justify-end gap-2">{actions}</div>
        </header>
      </div>
      {children}
    </div>
  )
}
