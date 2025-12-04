import { formatAmount } from '@lib/utils'

import type { FC } from 'react'

export const TvlStat: FC<{ tvl: number }> = ({ tvl }) => {
  return (
    <div
      className={
        'flex flex-row items-center justify-center gap-2 rounded-[16px] border border-neutral-200 bg-card px-3 py-1'
      }
    >
      <div className={'relative flex size-2 items-center justify-center'}>
        <div
          className={'absolute size-2 animate-[ping_3s_ease-in-out_infinite] rounded-full bg-neutral-0 opacity-75'}
        ></div>
        <div className={'relative size-2 rounded-full bg-neutral-400'}></div>
      </div>
      <p className={'text-[14px] text-neutral-900'}>
        <span className={'text-[14px] text-neutral-900 opacity-75'}>{'$'}</span>
        {formatAmount(tvl ?? 0, 0, 0)}
        <span className={'text-[14px] text-neutral-900 opacity-75'}>{' deposited in Yearn Vaults'}</span>
      </p>
    </div>
  )
}
