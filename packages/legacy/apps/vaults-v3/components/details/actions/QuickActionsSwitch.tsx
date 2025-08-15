import { IconArrowRight } from '@lib/icons/IconArrowRight'

import type { ReactElement } from 'react'

export function VaultDetailsQuickActionsSwitch(): ReactElement {
  return (
    <div className={'flex w-full justify-center md:w-14'}>
      <div className={'flex h-12 md:mt-5 w-12 rotate-90 items-center justify-center md:h-14 md:w-14 md:rotate-0'}>
        <span className={'sr-only'}>{'Deposit / Withdraw'}</span>
        <IconArrowRight className={'h-4 w-4 text-neutral-900/50 md:h-6 md:w-6 md:mt-2'} />
      </div>
    </div>
  )
}
