import Link from '@components/Link'
import { cl } from '@lib/utils'
import type { ReactElement } from 'react'
import { TextAnimation } from './TextAnimate'

// import { TypeMarkYearn } from '../../../apps/lib/icons/TypeMarkYearn'

const HERO_STORIES = [
  'Money Robots at Your Beck and Call',
  `Transparency doesn't have to be "nice to have"`,
  'We love vibes, but not for smart contracts.',
  'Composable vaults are better vaults',
  'Automation that never sleeps',
  'Kind of like AI, but without the hallucinations',
  'No Shitcoins, just Earn Yield on Shit',
]

export function HeroCard({ className }: { className?: string }): ReactElement {
  return (
    <div
      className={cl(
        'relative flex h-full w-full min-w-0 flex-col justify-center overflow-hidden rounded-3xl',
        'bg-gradient-to-r from-[#D21162] to-[#2C3DA6] px-6 py-8 md:px-10',
        className
      )}
    >
      {/* <div className={'flex h-14 items-start'}>
        <TypeMarkYearnNaughty className={'h-full w-auto'} color={'white'} />
      </div> */}
      <h2
        className={
          'text-[42px] font-black uppercase leading-[46px] text-white md:text-[50px] md:leading-[62px]'
        }
      >
        {'Yearn Vaults are a brave new world for yield'}
      </h2>
      <div className={'mt-8 h-9 w-full'}>
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
