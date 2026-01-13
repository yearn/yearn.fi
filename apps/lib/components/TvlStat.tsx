import { formatAmount } from '@lib/utils'

import type { ReactElement } from 'react'

export function TvlStat({ tvl }: { tvl: number }): ReactElement {
  return (
    <div className={'flex items-center justify-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-3 py-1'}>
      <div className={'relative flex size-2 items-center justify-center'}>
        <div className={'absolute size-2 animate-[ping_3s_ease-in-out_infinite] rounded-full bg-white opacity-75'} />
        <div className={'relative size-2 rounded-full bg-neutral-400'} />
      </div>
      <p className={'text-sm text-white'}>
        <span className={'opacity-75'}>{'$'}</span>
        {formatAmount(tvl ?? 0, 0, 0)}
        <span className={'opacity-75'}>{' deposited in Yearn Vaults'}</span>
      </p>
    </div>
  )
}
