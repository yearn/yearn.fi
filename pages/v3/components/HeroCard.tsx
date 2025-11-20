import Link from '@components/Link'
import { cl } from '@lib/utils'
import type { ReactElement } from 'react'
import { TextAnimation } from './TextAnimate'

// import { TypeMarkYearn } from '../../../apps/lib/icons/TypeMarkYearn'

const HERO_STORIES = [
  'Money Robots at Your Beck and Call.',
  `Transparency shouldn't be "nice to have."`,
  'We love vibes, but not for smart contracts.',
  'Composable vaults are better vaults.',
  'Automation that never sleeps.',
  'Kind of like AI, but without the hallucinations.',
  'No Shitcoins, just earn yield on shit.'
]

type HeroCardProps = {
  className?: string
  onLearnMore?: () => void
  isLearnMoreExpanded?: boolean
}

export function HeroCard({ className, onLearnMore, isLearnMoreExpanded }: HeroCardProps): ReactElement {
  const learnMoreLabel = isLearnMoreExpanded ? 'Hide details' : 'Learn more'

  return (
    <div
      className={cl(
        'relative flex h-full w-full min-w-0 flex-col justify-center overflow-hidden rounded-xl shadow-md',
        'bg-gradient-to-r from-[#D21162] to-[#2C3DA6] px-6 py-8 md:px-10',
        className
      )}
    >
      {/* <div className={'flex h-14 items-start'}>
        <TypeMarkYearnNaughty className={'h-full w-auto'} color={'white'} />
      </div> */}
      <h2 className={'text-[42px] font-black uppercase leading-[46px] text-white md:text-[50px] md:leading-[62px]'}>
        {'Yearn Vaults are a brave new world for yield'}
      </h2>
      <div className={'mt-8 h-9 w-full'}>
        <TextAnimation words={HERO_STORIES} />
      </div>
      <div className={'mt-10 flex w-full flex-wrap items-center gap-3'}>
        <button
          type={'button'}
          className={cl(
            'inline-flex items-center justify-center rounded-lg bg-white px-6 py-2',
            'text-sm font-semibold text-[#020637] transition hover:bg-white/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70'
          )}
          onClick={onLearnMore}
          aria-expanded={isLearnMoreExpanded ?? false}
        >
          {learnMoreLabel}
        </button>
        <Link
          className={cl(
            'inline-flex items-center justify-center rounded-lg border border-white/60 px-6 py-2',
            'text-sm font-semibold text-white transition hover:border-white hover:text-white'
          )}
          href={'/v3'}
        >
          {'Explore Vaults'}
        </Link>
        <Link
          className={cl(
            'inline-flex items-center justify-center rounded-lg border border-white/60 px-6 py-2',
            'text-sm font-semibold text-white transition hover:border-white hover:text-white'
          )}
          href={'https://docs.yearn.fi'}
        >
          {'Docs'}
        </Link>
      </div>
    </div>
  )
}
