'use client'

import { YVUSD_LEARN_MORE_URL } from '@pages/vaults/utils/yvUsd'
import { cl } from '@shared/utils'
import type { CSSProperties, ReactElement } from 'react'

const BANNER_BACKGROUND_STYLE: CSSProperties = {
  backgroundImage: 'url(/yvusd-banner-bg.png)',
  backgroundPosition: 'center',
  backgroundRepeat: 'no-repeat',
  backgroundSize: 'cover'
}

export function YvUsdHeaderBanner({ className }: { className?: string }): ReactElement {
  return (
    <aside
      className={cl('relative flex h-full min-h-0 w-full overflow-hidden rounded-md border border-border', className)}
      style={BANNER_BACKGROUND_STYLE}
      aria-label={'yvUSD announcement banner'}
    >
      <div className={'flex w-full items-center px-5 py-2 md:px-8'}>
        <div className={'min-w-0'}>
          <p className={'max-w-[28rem] text-xl font-bold leading-none text-white md:max-w-[48rem] md:text-4xl'}>
            {'Transparent, Verifiable, Real Yield'}
          </p>
          <p className={'mt-2 text-[12pt] font-bold leading-tight text-white md:text-sm md:mt-0 lg:text-[1.05rem]'}>
            <a
              href={YVUSD_LEARN_MORE_URL}
              target={'_blank'}
              rel={'noopener noreferrer'}
              className={'underline underline-offset-2 transition-opacity hover:opacity-85'}
            >
              {'Learn more'}
            </a>
            {" about Yearn's new cross-chain, cross-asset, delta-neutral vault."}
          </p>
        </div>
      </div>
    </aside>
  )
}
