import { LauncherDropdown } from '@lib/components/LauncherDropdown'
import { IconChevron } from '@lib/icons/IconChevron'
import { TypeMarkYearn as TypeMarkYearnFull } from '@lib/icons/TypeMarkYearn'
import { TypeMarkYearn as TypeMarkYearnText } from '@lib/icons/TypeMarkYearn-text-only'
import { cl } from '@lib/utils'
import type { ReactElement } from 'react'
import { useState } from 'react'

export function LandingAppHeader(): ReactElement {
  const [isLauncherOpen, setIsLauncherOpen] = useState(false)

  return (
    <div id={'head'} className={'inset-x-0 top-0 z-50 mt-4 w-full md:mt-7'}>
      <div className={'w-full'}>
        <header className={'flex max-w-[1232px] items-center justify-between gap-4 py-1 md:px-10! md:py-4'}>
          <div className={'relative flex items-center gap-2'}>
            <button
              type={'button'}
              onClick={() => setIsLauncherOpen(!isLauncherOpen)}
              className={'flex items-center gap-1 transition-colors hover:opacity-80'}
            >
              <TypeMarkYearnText className={'h-8 w-auto md:hidden'} color={'#E1E1E1'} />
              <div className={'hidden items-center gap-x-1 md:flex'}>
                <TypeMarkYearnText className={'h-8 w-auto'} color={'#E1E1E1'} />
                <TypeMarkYearnFull className={'yearn-typemark h-8 w-auto'} color={'#E1E1E1'} />
              </div>
              <IconChevron
                className={cl('size-4 text-neutral-400 transition-transform', isLauncherOpen ? 'rotate-180' : '')}
              />
            </button>
            <LauncherDropdown isOpen={isLauncherOpen} onClose={() => setIsLauncherOpen(false)} />
          </div>
        </header>
      </div>
    </div>
  )
}
