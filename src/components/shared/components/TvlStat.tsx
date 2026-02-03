import { formatAmount } from '@shared/utils'

import type { ReactElement } from 'react'

export function TvlStat({ tvl }: { tvl: number }): ReactElement {
  return (
    <div className={'flex items-center justify-center gap-2 rounded-2xl bg-white/10 px-3 py-1.5 max-w-full'}>
      <div className={'relative flex size-2 shrink-0 items-center justify-center'}>
        <div className={'absolute size-2 animate-[ping_3s_ease-in-out_infinite] rounded-full bg-white opacity-75'} />
        <div className={'relative size-2 rounded-full bg-neutral-400'} />
      </div>
      <p className={'text-xs sm:text-sm text-white text-center'}>
        <span className={'opacity-75'}>{'$'}</span>
        {formatAmount(tvl ?? 0, 0, 0)}
        <span className={'opacity-75 hidden min-[360px]:inline'}>{' deposited in Yearn Vaults'}</span>
        <span className={'opacity-75 min-[360px]:hidden'}>{' in Yearn'}</span>
      </p>
    </div>
  )
}
