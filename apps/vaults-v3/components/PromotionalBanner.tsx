import Link from '@components/Link'
import { cl } from '@lib/utils'
import type { ReactElement } from 'react'

export type TPromotionalBannerProps = {
  title: string
  subtitle: string
  description: string
  ctaLabel: string
  ctaTo: string
  variant?: 'default' | 'yvUSD'
  onClose?: () => void
}

export function PromotionalBanner({
  title,
  subtitle,
  description,
  ctaLabel,
  ctaTo,

  variant = 'default',
  onClose
}: TPromotionalBannerProps): ReactElement {
  const theme =
    variant === 'yvUSD'
      ? {
          container: 'bg-gradient-to-r from-[#7B3FE4] to-[#FBBF24] shadow-xl',
          ctaText: 'text-[#7B3FE4]',
          accent: 'text-white/80',
          emoji: '💸'
        }
      : {
          container: 'bg-gradient-to-r from-[#7B3FE4] to-[#FBBF24] shadow-xl',
          ctaText: 'text-[#7B3FE4]',
          accent: 'text-white/80',
          emoji: '✨'
        }

  return (
    <div
      className={cl(
        'relative flex w-full flex-col overflow-hidden rounded-xl border border-transparent p-6 md:flex-row md:items-center md:justify-between',
        theme.container
      )}
      data-variant={variant}
    >
      <div className={'z-10 flex flex-1 flex-col gap-2'}>
        <div className={'flex flex-col'}>
          <span className={cl('font-mono text-xs font-bold uppercase tracking-wider', theme.accent)}>{subtitle}</span>
          <h2 className={'text-3xl font-black tracking-tight text-white md:text-4xl'}>{title}</h2>
        </div>
        <p className={'max-w-md text-sm font-medium text-white/90 md:text-base'}>{description}</p>

        {onClose ? (
          <button
            type={'button'}
            onClick={onClose}
            className={
              'absolute top-4 right-4 z-20 flex size-8 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 md:hidden'
            }
            aria-label={'Close banner'}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        ) : null}

        <div className={'mt-4 flex items-center gap-4'}>
          <Link
            to={ctaTo}
            className={cl(
              'inline-flex h-10 items-center justify-center rounded-lg bg-white px-6 text-sm font-bold transition-transform hover:scale-105 hover:bg-white/95 active:scale-95',
              theme.ctaText
            )}
          >
            {ctaLabel}
          </Link>
        </div>
      </div>

      {onClose ? (
        <button
          type={'button'}
          onClick={onClose}
          className={
            'absolute top-4 right-4 z-20 hidden size-8 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 md:flex'
          }
          aria-label={'Close banner'}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      ) : null}

      {/* Visual / Asset Area */}
      <div className={'relative mt-6 flex items-center justify-center md:absolute md:right-8 md:mt-0 md:h-full'}>
        <div className={'relative size-32 md:size-48'}>
          {/* Placeholder for Nanobanana - distinct visual style */}
          <div className={'absolute inset-0 animate-pulse rounded-full bg-yellow-400/20 blur-3xl'} />
          <div className="relative flex h-full w-full items-center justify-center text-8xl grayscale-0 filter drop-shadow-lg transition-all hover:scale-110">
            {theme.emoji}
          </div>
        </div>
      </div>

      {/* Background Decor */}
      <div className={'pointer-events-none absolute inset-0 mix-blend-overlay opacity-30'}>
        <div
          className={
            'absolute -top-1/2 -left-1/2 size-full rounded-full bg-gradient-to-br from-purple-600 to-transparent blur-3xl'
          }
        />
        <div
          className={
            'absolute -bottom-1/2 -right-1/2 size-full rounded-full bg-gradient-to-tl from-yellow-400 to-transparent blur-3xl'
          }
        />
      </div>
    </div>
  )
}

export type TCollapsedPromotionalBannerProps = {
  title: string
  subtitle: string
  variant?: 'default' | 'yvUSD'
  onExpand: () => void
}

export function CollapsedPromotionalBanner({
  title,
  subtitle,
  variant = 'default',
  onExpand
}: TCollapsedPromotionalBannerProps): ReactElement {
  const theme =
    variant === 'yvUSD'
      ? {
          container: 'bg-gradient-to-r from-[#7B3FE4] to-[#FBBF24] shadow-md',
          accent: 'text-white/80'
        }
      : {
          container: 'bg-gradient-to-r from-[#7B3FE4] to-[#FBBF24] shadow-md',
          accent: 'text-white/80'
        }

  return (
    <div
      className={cl(
        'relative flex w-full items-center justify-between overflow-hidden rounded-xl p-3',
        theme.container
      )}
      data-variant={variant}
    >
      <div className={'relative z-10 flex min-w-0 flex-1 items-center gap-2'}>
        <p className={'min-w-0 truncate text-sm font-black tracking-tight text-white'}>
          <span className={'whitespace-nowrap'}>{title}</span>
          <span className={cl('whitespace-nowrap font-mono text-xs font-bold tracking-wider', theme.accent)}>
            {' | '}
            {subtitle}
          </span>
        </p>
      </div>
      <button
        type={'button'}
        onClick={onExpand}
        className={
          'relative z-10 ml-4 inline-flex h-9 items-center justify-center rounded-lg bg-white/15 px-4 text-xs font-bold text-white transition-colors hover:bg-white/20'
        }
      >
        {'Show details'}
      </button>

      <div className={'pointer-events-none absolute inset-0 mix-blend-overlay opacity-30'}>
        <div
          className={
            'absolute -top-1/2 -left-1/2 size-full rounded-full bg-gradient-to-br from-purple-600 to-transparent blur-3xl'
          }
        />
        <div
          className={
            'absolute -bottom-1/2 -right-1/2 size-full rounded-full bg-gradient-to-tl from-yellow-400 to-transparent blur-3xl'
          }
        />
      </div>
    </div>
  )
}
