import Link from '@components/Link'
import { cl } from '@lib/utils'
import type { ReactElement } from 'react'
import { TextAnimation } from './TextAnimate'

const HERO_STORIES = [
  'Money Robots at Your Beck and Call',
  'Kind of like AI, but also totally not',
  'No Shitcoins, just Earn Yield on Shit',
  'Transparency is a feature, not a footnote',
  'We love vibes, but not when it comes to smart contracts.',
  'Automation that never sleeps',
  'Composable vaults are better vaults',
  `Transparency doesn't have to be "nice to have"`
]

export function HeroCard({ className }: { className?: string }): ReactElement {
  return (
    <div
      className={cl(
        'relative flex h-full w-full min-w-0 flex-col overflow-hidden rounded-3xl',
        'bg-gradient-to-r from-[#D21162] to-[#2C3DA6] px-6 py-8 md:px-10 md:py-12',
        className
      )}
    >
      <h2
        className={'mt-4 text-[42px] font-black uppercase leading-[46px] text-white md:text-[56px] md:leading-[62px]'}
      >
        {'A brave new world for yield'}
      </h2>
      <p className={'mt-4 max-w-xl text-base text-white/80 md:text-lg'}>
        {'Automation, composability, and personal dashboards—now shipping inside Yearn v3.'}
      </p>
      <div className={'mt-8 h-[84px] w-full'}>
        <TextAnimation words={HERO_STORIES} />
      </div>
      <div className={'mt-10 flex flex-wrap gap-3'}>
        <Link
          className={cl(
            'inline-flex items-center justify-center rounded-lg border border-white/60 px-6 py-2',
            'text-sm font-semibold text-white transition hover:border-white hover:text-white'
          )}
          href={'/v3'}
        >
          {'Enter app'}
        </Link>
        <Link
          className={cl(
            'inline-flex items-center justify-center rounded-lg bg-white px-6 py-2',
            'text-sm font-semibold text-[#020637] transition hover:bg-white/90'
          )}
          href={'/v3/about'}
        >
          {'Learn more'}
        </Link>
      </div>
    </div>
  )
}
