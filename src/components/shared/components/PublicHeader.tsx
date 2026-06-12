'use client'

import { TypeMarkYearn } from '@shared/icons/TypeMarkYearn'
import type { ReactElement } from 'react'
import { HeaderNavMenu } from './HeaderNavMenu'

export function PublicHeader(): ReactElement {
  return (
    <div id={'head'} className={'sticky inset-x-0 top-0 z-50 w-full bg-transparent backdrop-blur-md'}>
      <div className={'mx-auto w-full max-w-[1232px] px-4'}>
        <header className={'flex h-[var(--header-height)] w-full items-center justify-between px-0'}>
          <div className={'flex items-center justify-start gap-x-6 px-1 py-2 md:py-1'} data-tour="vaults-header-nav">
            <a href={'/'} className={'flex items-center gap-1 transition-colors hover:opacity-80'}>
              <TypeMarkYearn className={'h-8 w-auto'} color={'#FFFFFF'} />
            </a>
            <div className={'hidden items-center gap-3 pb-0.5 md:flex'}>
              <HeaderNavMenu isHomePage={true} isDarkTheme={true} />
            </div>
          </div>
          <div className={'flex items-center justify-end gap-2'} />
        </header>
      </div>
    </div>
  )
}
