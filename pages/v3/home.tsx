import Link from '@components/Link'
import { useWallet } from '@lib/contexts/useWallet'
import { useWeb3 } from '@lib/contexts/useWeb3'
import { useV3VaultFilter } from '@lib/hooks/useV3VaultFilter'
import { cl, formatAmount } from '@lib/utils'
import type { TYDaemonVault } from '@lib/utils/schemas/yDaemonVaultsSchemas'
import HoldingsMarquee from '@vaults-v3/components/list/HoldingsMarquee'
import type { CSSProperties, ReactElement } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { V3Mask } from '../../apps/vaults-v3/Mark'

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
    description: 'The strategists and keepers do the babysitting so your cash only ever works night shifts.'
  },
  {
    id: 'opposite-ai',
    headline: ['Kind of like AI, but also totally not'],
    description: 'Human-curated playbooks, machine execution—no vibes-based hallucinations, just yield.'
  },
  {
    id: 'no-shitcoins',
    headline: ['No Shitcoins, just Earn Yield on Shit'],
    description: 'Blue-chip vaults squeeze productivity out of whatever tokens you already hold.'
  },
  {
    id: 'vibecoding',
    headline: [
      'We love vibes, but when it comes to smart contracts, time in the market matters. Our are battle tested.'
    ],
    description: 'Yearn code has weathered every season. Battle tested beats buzzwords every time.'
  },
  {
    id: 'automation',
    headline: ['Automation that never sleeps'],
    description:
      'Keeper fleets interact with autonomous computer programs to compound your investment while you sleep in.'
  },
  {
    id: 'composability',
    headline: ['Composable vault legos'],
    description: 'Strategies plug into hardened DeFi pipes so deposits can route instantly when yields shift.'
  },
  {
    id: 'risk',
    headline: [`Transparency doesn't have to be a "Nice to have"`],
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

function BrandNewVaultCard({ className }: { className?: string }): ReactElement {
  const [activeStoryId, setActiveStoryId] = useState<string>(BRAND_NEW_STORIES[0]?.id ?? '')
  const [isInteracting, setIsInteracting] = useState(false)
  const prefersReducedMotion = usePrefersReducedMotion()

  const activeStory = useMemo(() => BRAND_NEW_STORIES.find((story) => story.id === activeStoryId), [activeStoryId])

  const marqueeDuration = `${Math.max(SCROLL_ROWS.length * 6, 18)}s`

  const handleInteractionChange = (value: boolean): void => {
    setIsInteracting(value)
  }

  const renderStoryRow = (story: TBrandNewStory, keySuffix: string): ReactElement => (
    <button
      key={`${story.id}-${keySuffix}`}
      className={cl(
        'group/story relative text-left',
        'rounded-2xl border border-transparent px-1 py-1 transition',
        activeStoryId === story.id ? 'border-white/50 bg-white/10' : 'hover:border-white/30 hover:bg-white/5'
      )}
      onClick={(): void => setActiveStoryId(story.id)}
      type={'button'}
      aria-pressed={activeStoryId === story.id}
    >
      <h3
        className={cl('font-black uppercase text-white', 'text-[32px] leading-[38px] md:text-[48px] md:leading-[56px]')}
      >
        {story.headline.map((line, index) => (
          <span className={'block'} key={`${story.id}-${keySuffix}-line-${index}`}>
            {line}
          </span>
        ))}
      </h3>
      <p className={'mt-1 text-xs uppercase tracking-[0.35em] text-white/60'}>{'Click for the why'}</p>
    </button>
  )

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

  const scrollRows = (
    <div
      className={cl(
        'flex flex-col gap-5 pr-2',
        !prefersReducedMotion ? 'brand-new-marquee' : undefined,
        isInteracting && !prefersReducedMotion ? 'brand-new-marquee--paused' : undefined
      )}
      style={
        !prefersReducedMotion
          ? ({ ['--brand-new-marquee-duration' as string]: marqueeDuration } as CSSProperties)
          : undefined
      }
    >
      {SCROLL_ROWS.map((row) => (row.kind === 'links' ? renderLinksRow('primary') : renderStoryRow(row, 'primary')))}
      {!prefersReducedMotion
        ? SCROLL_ROWS.map((row) =>
            row.kind === 'links' ? renderLinksRow('secondary') : renderStoryRow(row, 'secondary')
          )
        : null}
    </div>
  )

  return (
    <div
      className={cl(
        'relative flex h-full w-full min-w-0 overflow-hidden rounded-3xl',
        'px-4 pb-6 pt-6 md:px-10 md:pb-10 md:pt-12',
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
        <p className={'text-xs font-semibold uppercase tracking-[0.45em] text-white/70'}>{'Yearn v3'}</p>
        <div className={'relative flex-1 overflow-hidden'}>
          <div className={'pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-[#090f24]'} />
          <div className={'pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[#090f24]'} />
          <div className={'relative'}>{scrollRows}</div>
        </div>
        <div className={'min-h-[64px] text-sm text-white/80 md:text-base'}>
          {activeStory ? activeStory.description : 'Automation, composability, and personal dashboards.'}
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

const V3_CARD_BASE = cl(
  'flex h-full w-full min-w-0 items-center justify-center rounded-3xl border border-transparent bg-neutral-200/80',
  'transition-shadow hover:border-white/40 p-2',
  'shadow-[0_12px_32px_rgba(4,8,32,0.45)]'
)

function V3Card({ className }: { className?: string }): ReactElement {
  return (
    <Link className={cl(V3_CARD_BASE, className)} href={'/v3'}>
      <V3Mask className={'h-auto w-[86%]'} />
    </Link>
  )
}

function V3SecondaryCard({ className }: { className?: string }): ReactElement {
  return (
    <Link className={cl(V3_CARD_BASE, className)} href={'/vaults'}>
      <img
        alt={'Single asset vaults graphic'}
        className={'h-full w-full max-h-[260px] object-contain'}
        draggable={false}
        src={'/LP-3.svg'}
      />
    </Link>
  )
}

function PortfolioCard({
  holdingsVaults,
  className
}: {
  holdingsVaults: TYDaemonVault[]
  className?: string
}): ReactElement {
  const { cumulatedValueInV3Vaults, isLoading } = useWallet()
  const { isActive, address, openLoginModal, onSwitchChain } = useWeb3()
  const hasHoldings = holdingsVaults.length > 0

  const handleConnect = (): void => {
    if (!isActive && address) {
      onSwitchChain(1)
      return
    }
    openLoginModal()
  }

  if (!isActive) {
    return (
      <div
        className={cl(
          'w-full h-full rounded-3xl bg-neutral-100 p-6 text-white shadow-[0_12px_32px_rgba(4,8,32,0.55)]',
          'md:p-8',
          className
        )}
      >
        <strong className={'block pb-2 text-3xl font-black text-white md:pb-4 md:text-4xl md:leading-[48px]'}>
          {'Portfolio'}
        </strong>
        <p className={'max-w-[360px] text-sm text-white/70 md:text-base'}>
          {'Connect a wallet to see your deposits, migration nudges, and net APY across Yearn v3.'}
        </p>
        <button
          className={cl(
            'group relative mt-8 inline-flex items-center justify-center overflow-hidden rounded-lg px-10 py-2',
            'border-none text-sm font-semibold text-white'
          )}
          onClick={handleConnect}
          type={'button'}
        >
          <div
            className={cl(
              'absolute inset-0',
              'pointer-events-none opacity-80 transition-opacity group-hover:opacity-100',
              'bg-[linear-gradient(80deg,#D21162,#2C3DA6)]'
            )}
          />
          <span className={'relative z-10'}>{'Connect wallet'}</span>
        </button>
      </div>
    )
  }

  return (
    <div
      className={cl(
        'w-full h-full rounded-3xl bg-neutral-100 p-6 text-white shadow-[0_12px_32px_rgba(4,8,32,0.55)]',
        'md:p-8',
        className
      )}
    >
      <strong className={'block pb-2 text-3xl font-black text-white md:pb-4 md:text-4xl md:leading-[48px]'}>
        {'Portfolio'}
      </strong>
      <div className={'flex flex-col gap-6 md:flex-row md:items-end md:gap-14'}>
        <div>
          <p className={'pb-1 text-sm uppercase tracking-[0.35em] text-white/60'}>{'Deposited'}</p>
          {isLoading ? (
            <div className={'h-[36.5px] w-32 animate-pulse rounded-sm bg-white/20'} />
          ) : (
            <b className={'font-number text-3xl text-white md:text-4xl'}>
              {'$'}
              <span suppressHydrationWarning>{formatAmount(cumulatedValueInV3Vaults.toFixed(2), 2, 2)}</span>
            </b>
          )}
        </div>
        <p className={'max-w-[260px] text-sm text-white/70 md:text-base'}>
          {'Track net deposits across vaults and staking addresses, updated as strategies compound.'}
        </p>
      </div>
      {hasHoldings ? (
        <div className={'mt-6'}>
          <HoldingsMarquee holdingsVaults={holdingsVaults} />
        </div>
      ) : null}
    </div>
  )
}

function DiscoverCard({ className }: { className?: string }): ReactElement {
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

function V3Home(): ReactElement {
  const { holdingsVaults } = useV3VaultFilter(null, null, '', null)

  return (
    <div className={'min-h-screen w-full bg-neutral-0'}>
      <div className={'mx-auto w-full max-w-[1232px] px-4'}>
        <div
          className={
            'grid grid-cols-12 gap-4 overflow-x-hidden pt-12 md:max-h-screen md:auto-rows-fr md:grid-cols-32 md:grid-rows-8 md:gap-6 md:pt-20 md:pb-6'
          }
        >
          <div className={'col-span-12 min-w-0 md:order-1 md:col-span-6 md:col-start-1 md:row-span-2 md:row-start-1'}>
            <V3Card className={'h-full'} />
          </div>
          <div className={'col-span-12 min-w-0 md:order-2 md:col-span-6 md:col-start-1 md:row-span-2 md:row-start-3'}>
            <V3SecondaryCard className={'h-full'} />
          </div>
          <div className={'col-span-12 min-w-0 md:order-3 md:col-span-26 md:col-start-7 md:row-span-4 md:row-start-1'}>
            <BrandNewVaultCard className={'h-full'} />
          </div>
          <div className={'col-span-12 min-w-0 md:order-4 md:col-span-18 md:row-span-4 md:row-start-5'}>
            <PortfolioCard holdingsVaults={holdingsVaults} />
          </div>
          <div className={'col-span-12 min-w-0 md:order-5 md:col-span-14 md:col-start-19 md:row-span-4 md:row-start-5'}>
            <DiscoverCard />
          </div>
        </div>
      </div>
    </div>
  )
}

export default V3Home
