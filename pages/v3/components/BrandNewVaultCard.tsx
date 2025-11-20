import Link from '@components/Link'
import { cl } from '@lib/utils'
import type { CSSProperties, ReactElement } from 'react'
import { useEffect, useState } from 'react'

function Background(): ReactElement {
  return (
    <div className={cl('absolute inset-0', 'pointer-events-none', 'bg-gradient-to-r from-[#D21162] to-[#2C3DA6]')} />
  )
}

type TBrandNewStory = {
  id: string
  headline: string[]
  description: string
}

type TBrandCardRow =
  | (TBrandNewStory & { kind: 'story' })
  | {
      id: string
      kind: 'links'
    }

const BRAND_NEW_STORIES: TBrandNewStory[] = [
  {
    id: 'money-robots',
    headline: ['Money Robots at Your Beck and Call'],
    description: 'Smart contracts and permission-less keeper bots automate rebalancing and compounding gains.'
  },
  {
    id: 'opposite-ai',
    headline: ['Kind of like AI, but also totally not'],
    description:
      'No vibes-based hallucinations here, just yield. Ethereum contracts are built to be deterministic and reliable.'
  },
  {
    id: 'no-shitcoins',
    headline: ['No Shitcoins. just Earn Yield on Shit'],
    description: 'Blue-chip vaults squeeze productivity out of whatever tokens you already hold.'
  },
  {
    id: 'vibecoding',
    headline: ['We love vibes, but not when it comes to smart contracts.'],
    description:
      'Time in the market matters. Our contracts are production-hardened and Yearn code has weathered every season. Battle tested beats buzzwords every time.'
  },
  {
    id: 'automation',
    headline: ['Automation that never sleeps'],
    description:
      'Keeper fleets interact with autonomous computer programs to compound your investment while you sleep in.'
  },
  {
    id: 'composability',
    headline: ['Composable vaults are better vaults'],
    description: 'Our vaults are built to tap into the rich Ethereum DeFi ecosystem and its deep liquidity.'
  },
  {
    id: 'risk',
    headline: [`Transparency doesn't have to be "nice to have"`],
    description: 'You can see what we can see. Let us show you how to look.'
  }
]

const SCROLL_ROWS: TBrandCardRow[] = [
  ...BRAND_NEW_STORIES.map((story) => ({ ...story, kind: 'story' as const })),
  { id: 'cta-links', kind: 'links' as const }
]

function usePrefersReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia === 'undefined') {
      return
    }
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const updatePreference = (): void => {
      setPrefersReducedMotion(mediaQuery.matches)
    }
    updatePreference()
    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', updatePreference)
    } else if (typeof mediaQuery.addListener === 'function') {
      mediaQuery.addListener(updatePreference)
    }
    return () => {
      if (typeof mediaQuery.removeEventListener === 'function') {
        mediaQuery.removeEventListener('change', updatePreference)
      } else if (typeof mediaQuery.removeListener === 'function') {
        mediaQuery.removeListener(updatePreference)
      }
    }
  }, [])

  return prefersReducedMotion
}

export function BrandNewVaultCard({ className }: { className?: string }): ReactElement {
  const [expandedStoryIds, setExpandedStoryIds] = useState<Set<string>>(
    () => new Set(BRAND_NEW_STORIES[0] ? [BRAND_NEW_STORIES[0].id] : [])
  )
  const [isInteracting, setIsInteracting] = useState(false)
  const prefersReducedMotion = usePrefersReducedMotion()

  const marqueeDuration = `${Math.max(SCROLL_ROWS.length * 6, 18)}s`

  const handleInteractionChange = (value: boolean): void => {
    setIsInteracting(value)
  }

  const toggleStory = (storyId: string): void => {
    setExpandedStoryIds((prev) => {
      const next = new Set(prev)
      if (next.has(storyId)) {
        next.delete(storyId)
      } else {
        next.add(storyId)
      }
      return next
    })
  }

  const renderStoryRow = (story: TBrandNewStory, keySuffix: string): ReactElement => {
    const isExpanded = expandedStoryIds.has(story.id)

    return (
      <button
        key={`${story.id}-${keySuffix}`}
        className={cl(
          'group/story relative w-full text-left',
          'rounded-xl border border-transparent px-1 py-2 transition'
          // isExpanded ? 'border-white/50 bg-white/10' : 'hover:border-white/30 hover:bg-white/5'
        )}
        onClick={(): void => toggleStory(story.id)}
        type={'button'}
        aria-expanded={isExpanded}
      >
        <div className={'flex items-start gap-4'}>
          <span
            aria-hidden={'true'}
            className={cl('mt-2 flex size-8 items-center justify-center text-xl font-semibold text-white')}
          >
            {isExpanded ? '×' : '+'}
          </span>
          <h3
            className={cl(
              'font-black uppercase text-white',
              'text-[32px] leading-[38px] md:text-[32px] md:leading-[36px]'
            )}
          >
            {story.headline.map((line, index) => (
              <span className={'block'} key={`${story.id}-${keySuffix}-line-${index}`}>
                {line}
              </span>
            ))}
          </h3>
        </div>
        {isExpanded ? <p className={'mt-3 ml-12 text-sm text-white/80 md:text-base'}>{story.description}</p> : null}
      </button>
    )
  }

  const renderLinksRow = (keySuffix: string): ReactElement => (
    <div
      key={`cta-links-${keySuffix}`}
      className={'flex flex-wrap items-center gap-3 rounded-2xl border border-white/20 p-3 text-white backdrop-blur-sm'}
    >
      <Link
        className={cl(
          'inline-flex flex-1 items-center justify-center rounded-lg border border-white/60 px-4 py-2 text-sm font-semibold',
          'transition hover:border-white hover:text-white'
        )}
        href={'/v3'}
      >
        {'Enter app'}
      </Link>
      <a
        className={cl(
          'inline-flex flex-1 items-center justify-center rounded-lg bg-white px-4 py-2 text-sm font-semibold text-[#020637]',
          'transition hover:bg-white/90'
        )}
        href={'https://docs.yearn.finance/'}
        target={'_blank'}
        rel={'noreferrer'}
      >
        {'Read docs'}
      </a>
    </div>
  )

  const primaryRows = SCROLL_ROWS.map((row) =>
    row.kind === 'links' ? renderLinksRow('primary') : renderStoryRow(row, 'primary')
  )
  const secondaryRows = SCROLL_ROWS.map((row) =>
    row.kind === 'links' ? renderLinksRow('secondary') : renderStoryRow(row, 'secondary')
  )

  const marqueeChildren = prefersReducedMotion ? primaryRows : [...secondaryRows, ...primaryRows]

  const scrollRows = (
    <div
      className={cl(
        'flex flex-col gap-5 pr-2',
        !prefersReducedMotion ? 'brand-new-marquee' : undefined,
        isInteracting && !prefersReducedMotion ? 'brand-new-marquee--paused' : undefined
      )}
      style={
        !prefersReducedMotion
          ? ({
              ['--brand-new-marquee-duration' as string]: marqueeDuration
            } as CSSProperties)
          : undefined
      }
    >
      {marqueeChildren}
    </div>
  )

  return (
    <div
      className={cl(
        'relative flex h-full w-full min-w-0 overflow-hidden rounded-3xl',
        'px-4 pb-6 pt-6 md:px-10 md:pb-0 md:pt-0',
        className
      )}
      onMouseEnter={(): void => handleInteractionChange(true)}
      onMouseLeave={(): void => handleInteractionChange(false)}
      onFocusCapture={(): void => handleInteractionChange(true)}
      onBlurCapture={(event): void => {
        if (!event.currentTarget.contains(event.relatedTarget as Node)) {
          handleInteractionChange(false)
        }
      }}
    >
      <div className={'relative z-10 flex w-full flex-col gap-4'}>
        <div className={'relative flex-1 overflow-hidden'}>
          {/* <div className={'pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-[#090f24]'} />
          <div className={'pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[#090f24]'} /> */}
          <div className={'relative'}>{scrollRows}</div>
        </div>
      </div>
      <Link
        href={'/v3/about'}
        className={cl(
          'pointer-events-none absolute bottom-6 left-6 right-6 z-20 flex items-center justify-center rounded-xl border border-white/40 bg-white/10 px-4 py-3 text-sm font-semibold text-white backdrop-blur',
          'transition-all duration-300 ease-out',
          isInteracting ? 'pointer-events-auto opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
        )}
      >
        {'Learn more about Yearn v3'}
      </Link>
      <Background />
    </div>
  )
}
