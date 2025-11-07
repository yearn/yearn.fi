import Link from '@components/Link'
import { cl } from '@lib/utils'
import type { ReactElement } from 'react'

export function DiscoverCard({ className }: { className?: string }): ReactElement {
  return (
    <div
      className={cl(
        'w-full h-full rounded-3xl bg-neutral-100 p-6 text-white shadow-[0_12px_32px_rgba(4,8,32,0.55)]',
        'md:p-8',
        className
      )}
    >
      <strong className={'block pb-2 text-3xl font-black text-white md:pb-4 md:text-4xl md:leading-[48px]'}>
        {'Discover Yearn'}
      </strong>
      <p className={'pb-4 text-sm text-white/70 md:text-base'}>
        {'Navigate the ecosystem — vaults, docs, governance, and new strategy drops.'}
      </p>
      <div className={'grid gap-3'}>
        <Link
          className={cl(
            'flex items-center justify-between rounded-2xl bg-[#0F1B4F] px-4 py-3',
            'text-sm font-semibold text-white transition hover:bg-[#152566]'
          )}
          href={'/v3'}
        >
          <span>{'Launch Yearn v3'}</span>
          <span className={'text-xs uppercase tracking-[0.35em] text-white/60'}>{'App'}</span>
        </Link>
        <Link
          className={cl(
            'flex items-center justify-between rounded-2xl bg-[#0F1B4F] px-4 py-3',
            'text-sm font-semibold text-white transition hover:bg-[#152566]'
          )}
          href={'/vaults'}
        >
          <span>{'Browse legacy vaults'}</span>
          <span className={'text-xs uppercase tracking-[0.35em] text-white/60'}>{'Vaults'}</span>
        </Link>
        <a
          className={cl(
            'flex items-center justify-between rounded-2xl bg-[#0F1B4F] px-4 py-3',
            'text-sm font-semibold text-white transition hover:bg-[#152566]'
          )}
          href={'https://docs.yearn.finance/'}
          target={'_blank'}
          rel={'noreferrer'}
        >
          <span>{'Read the knowledge base'}</span>
          <span className={'text-xs uppercase tracking-[0.35em] text-white/60'}>{'Docs'}</span>
        </a>
        <a
          className={cl(
            'flex items-center justify-between rounded-2xl bg-[#0F1B4F] px-4 py-3',
            'text-sm font-semibold text-white transition hover:bg-[#152566]'
          )}
          href={'https://gov.yearn.finance/'}
          target={'_blank'}
          rel={'noreferrer'}
        >
          <span>{'Join governance discussions'}</span>
          <span className={'text-xs uppercase tracking-[0.35em] text-white/60'}>{'Forum'}</span>
        </a>
      </div>
    </div>
  )
}
