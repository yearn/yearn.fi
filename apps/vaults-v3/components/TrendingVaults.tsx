import Link from '@components/Link'
import { RenderAmount } from '@lib/components/RenderAmount'
import { TokenLogo } from '@lib/components/TokenLogo'
import { IconChevron } from '@lib/icons/IconChevron'
import { cl, toAddress } from '@lib/utils'
import { formatPercent } from '@lib/utils/format'
import type { TYDaemonVault } from '@lib/utils/schemas/yDaemonVaultsSchemas'
import { getNetwork } from '@lib/utils/wagmi'
import { SuggestedVaultCard } from '@vaults-v3/components/SuggestedVaultCard'
import { useVaultApyData } from '@vaults-v3/hooks/useVaultApyData'
import type { CSSProperties, ReactElement } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

type TTrendingVaultsProps = {
  suggestedVaults: TYDaemonVault[]
}

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

function TrendingVaultMarqueeItem({ vault }: { vault: TYDaemonVault }): ReactElement {
  const apyData = useVaultApyData(vault)
  const chain = getNetwork(vault.chainID)
  const tokenIcon = `${import.meta.env.VITE_BASE_YEARN_ASSETS_URI}/tokens/${vault.chainID}/${toAddress(
    vault.token.address
  ).toLowerCase()}/logo-128.png`
  const chainLogoSrc = `${import.meta.env.VITE_BASE_YEARN_ASSETS_URI}/chains/${vault.chainID}/logo-32.png`

  const apyDisplay = useMemo((): string => {
    if (apyData.mode === 'historical' || apyData.mode === 'noForward') {
      return formatPercent(apyData.netApr * 100, 2, 2)
    }
    if (apyData.mode === 'rewards' && vault.staking.source === 'VeYFI' && apyData.estAprRange) {
      return `${formatPercent(apyData.estAprRange[0] * 100, 2, 2)} – ${formatPercent(apyData.estAprRange[1] * 100, 2, 2)}`
    }
    if (apyData.mode === 'katana' && apyData.katanaTotalApr !== undefined) {
      return formatPercent(apyData.katanaTotalApr * 100, 2, 2)
    }
    const boostedApr = apyData.baseForwardApr + apyData.rewardsAprSum
    if (apyData.mode === 'rewards') {
      return formatPercent(boostedApr * 100, 2, 2)
    }
    return formatPercent(apyData.baseForwardApr * 100, 2, 2)
  }, [apyData, vault])

  return (
    <Link
      to={`/vaults/${vault.chainID}/${toAddress(vault.address)}`}
      className={cl(
        'inline-flex items-center gap-2 rounded-md border border-border bg-surface px-2 py-1.5',
        'shadow-[0_8px_18px_rgba(4,8,32,0.06)] transition-colors hover:bg-surface-secondary'
      )}
    >
      <div className={'relative flex size-5 items-center justify-center'}>
        <TokenLogo src={tokenIcon} tokenSymbol={vault.token.symbol || ''} width={20} height={20} />
        <div
          className={
            'absolute -bottom-1 -right-1 flex size-3 items-center justify-center rounded-full border border-border bg-surface'
          }
        >
          <TokenLogo src={chainLogoSrc} tokenSymbol={chain.name} width={12} height={12} />
        </div>
      </div>
      <span className={'max-w-[160px] truncate text-xs font-semibold text-text-primary'}>{vault.name}</span>
      <span aria-hidden className={'text-text-tertiary'}>
        {'|'}
      </span>
      <span className={'text-xs font-semibold tabular-nums text-text-primary'}>{apyDisplay}</span>
      <span aria-hidden className={'text-text-tertiary'}>
        {'|'}
      </span>
      <span className={'text-xs font-semibold tabular-nums text-text-primary'}>
        <RenderAmount
          value={vault.tvl?.tvl || 0}
          symbol={'USD'}
          decimals={0}
          options={{ shouldCompactValue: true, maximumFractionDigits: 2, minimumFractionDigits: 0 }}
        />
      </span>
      <span className={'sr-only'}>{`on ${chain.name}`}</span>
    </Link>
  )
}

function TrendingVaultsCollapsedMarquee({ suggestedVaults }: { suggestedVaults: TYDaemonVault[] }): ReactElement {
  const [isInteracting, setIsInteracting] = useState(false)
  const prefersReducedMotion = usePrefersReducedMotion()
  const marqueeDuration = `${Math.max(suggestedVaults.length * 6, 24)}s`
  const marqueeItems = useMemo((): ReactElement[] => {
    const vaultItems = suggestedVaults.map((vault) => (
      <TrendingVaultMarqueeItem key={`${vault.chainID}_${toAddress(vault.address)}`} vault={vault} />
    ))

    if (prefersReducedMotion) {
      return vaultItems
    }

    const vaultItemsDuplicate = suggestedVaults.map((vault) => (
      <TrendingVaultMarqueeItem key={`${vault.chainID}_${toAddress(vault.address)}_dup`} vault={vault} />
    ))

    return [...vaultItemsDuplicate, ...vaultItems]
  }, [prefersReducedMotion, suggestedVaults])

  return (
    <div
      className={cl(
        'relative flex min-w-0 flex-1 items-center',
        prefersReducedMotion ? 'overflow-x-auto scrollbar-themed' : 'overflow-hidden'
      )}
      onMouseEnter={(): void => setIsInteracting(true)}
      onMouseLeave={(): void => setIsInteracting(false)}
      onFocusCapture={(): void => setIsInteracting(true)}
      onBlurCapture={(event): void => {
        if (!event.currentTarget.contains(event.relatedTarget as Node)) {
          setIsInteracting(false)
        }
      }}
    >
      <div
        className={'pointer-events-none absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-surface to-transparent'}
      />
      <div
        className={'pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-surface to-transparent'}
      />
      <div
        className={cl(
          'flex w-max items-center gap-2 whitespace-nowrap',
          !prefersReducedMotion ? 'trending-vaults-marquee' : undefined,
          isInteracting && !prefersReducedMotion ? 'trending-vaults-marquee--paused' : undefined
        )}
        style={
          !prefersReducedMotion
            ? ({
                ['--trending-marquee-duration' as string]: marqueeDuration
              } as CSSProperties)
            : undefined
        }
      >
        {marqueeItems}
      </div>
    </div>
  )
}

function TrendingVaultsSkeleton(): ReactElement {
  const placeholderCards = ['one', 'two', 'three', 'four']

  return (
    <div className={'w-full bg-app pb-2'}>
      <div className={'flex flex-col gap-0 rounded-xl border border-border bg-surface'}>
        <div className={'flex w-full items-center justify-between gap-3 px-4 py-3 md:px-6 md:py-'}>
          <div className={'flex min-w-0 flex-1 items-center gap-3'}>
            <div className={'h-4 w-32 rounded-md bg-surface-tertiary/70 animate-pulse'} />
            <div className={'hidden h-5 w-24 rounded-md bg-surface-tertiary/60 md:block animate-pulse'} />
          </div>
          <div className={'size-6 rounded-full bg-surface-tertiary/60 animate-pulse'} />
        </div>
        <div className={'overflow-hidden px-4 pt-0.5 pb-4 md:px-6'}>
          <div className={'flex gap-4'}>
            {placeholderCards.map((key) => (
              <div key={`trending-skeleton-${key}`} className={'w-[272px] flex-shrink-0'}>
                <div className={'flex h-full flex-col rounded-md border border-border bg-surface p-4'}>
                  <div className={'flex items-center gap-3'}>
                    <div className={'size-9 rounded-full bg-surface-tertiary/70 animate-pulse'} />
                    <div className={'flex-1 space-y-2'}>
                      <div className={'h-3 w-3/4 rounded bg-surface-tertiary/70 animate-pulse'} />
                      <div className={'h-2 w-1/2 rounded bg-surface-tertiary/60 animate-pulse'} />
                    </div>
                  </div>
                  <div className={'mt-4 flex items-end justify-between gap-4'}>
                    <div className={'space-y-2'}>
                      <div className={'h-2 w-16 rounded bg-surface-tertiary/60 animate-pulse'} />
                      <div className={'h-6 w-24 rounded bg-surface-tertiary/70 animate-pulse'} />
                    </div>
                    <div className={'space-y-2 text-right'}>
                      <div className={'ml-auto h-2 w-10 rounded bg-surface-tertiary/60 animate-pulse'} />
                      <div className={'ml-auto h-5 w-14 rounded bg-surface-tertiary/70 animate-pulse'} />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export function TrendingVaults({ suggestedVaults }: TTrendingVaultsProps): ReactElement | null {
  const [isTrendingExpanded, setIsTrendingExpanded] = useState(true)
  const trendingCarouselRef = useRef<HTMLDivElement>(null)
  const pendingPrependWidthRef = useRef(0)
  const pendingPrependScrollDeltaRef = useRef<number | null>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)
  const [renderedVaults, setRenderedVaults] = useState<TYDaemonVault[]>(suggestedVaults)

  const getScrollStep = useCallback((): number => {
    const viewport = trendingCarouselRef.current
    if (!viewport) {
      return 0
    }

    const items = viewport.querySelectorAll<HTMLElement>('[data-trending-vault-card]')
    if (items.length >= 2) {
      const first = items[0].getBoundingClientRect()
      const second = items[1].getBoundingClientRect()
      const step = Math.round(second.left - first.left)
      if (step > 0) {
        return step
      }
      return Math.round(first.width)
    }
    if (items.length === 1) {
      return Math.round(items[0].getBoundingClientRect().width)
    }
    return 0
  }, [])

  useEffect(() => {
    setRenderedVaults(suggestedVaults)
    pendingPrependWidthRef.current = 0
  }, [suggestedVaults])

  const updateScrollButtons = (): void => {
    if (!trendingCarouselRef.current) {
      return
    }
    if (!isTrendingExpanded || suggestedVaults.length <= 1 || suggestedVaults.length <= 4) {
      setCanScrollLeft(false)
      setCanScrollRight(false)
      return
    }
    const { scrollWidth, clientWidth } = trendingCarouselRef.current
    const isScrollable = scrollWidth > clientWidth + 1
    setCanScrollLeft(isScrollable)
    setCanScrollRight(isScrollable)
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: <>
  useEffect(() => {
    const container = trendingCarouselRef.current
    if (!container) {
      return
    }

    updateScrollButtons()
    container.addEventListener('scroll', updateScrollButtons)
    window.addEventListener('resize', updateScrollButtons)

    return () => {
      container.removeEventListener('scroll', updateScrollButtons)
      window.removeEventListener('resize', updateScrollButtons)
    }
  }, [isTrendingExpanded, suggestedVaults.length])

  // biome-ignore lint/correctness/useExhaustiveDependencies: we intentionally re-run after list growth to apply pending prepend scroll adjustment
  useEffect(() => {
    const container = trendingCarouselRef.current
    const pending = pendingPrependWidthRef.current
    if (!container || pending === 0) {
      return
    }
    container.scrollLeft += pending
    pendingPrependWidthRef.current = 0

    const delta = pendingPrependScrollDeltaRef.current
    if (delta !== null) {
      pendingPrependScrollDeltaRef.current = null
      container.scrollTo({
        left: container.scrollLeft + delta,
        behavior: 'smooth'
      })
    }
  }, [renderedVaults.length])

  const onScrollBack = (): void => {
    if (!trendingCarouselRef.current) {
      return
    }
    const step = getScrollStep() || 280 + 16 // fallback to legacy sizing
    if (trendingCarouselRef.current.scrollLeft <= step + 1) {
      pendingPrependWidthRef.current += step * suggestedVaults.length
      pendingPrependScrollDeltaRef.current = -step
      setRenderedVaults((prev) => [...suggestedVaults, ...prev])
      return
    }
    trendingCarouselRef.current.scrollTo({
      left: trendingCarouselRef.current.scrollLeft - step,
      behavior: 'smooth'
    })
  }

  const onScrollForward = (): void => {
    if (!trendingCarouselRef.current) {
      return
    }
    const step = getScrollStep() || 280 + 16 // fallback to legacy sizing
    const { scrollLeft, clientWidth, scrollWidth } = trendingCarouselRef.current
    const isAtEnd = scrollLeft + clientWidth >= scrollWidth - step - 1
    if (isAtEnd) {
      setRenderedVaults((prev) => [...prev, ...suggestedVaults])
    }
    trendingCarouselRef.current.scrollTo({
      left: trendingCarouselRef.current.scrollLeft + step,
      behavior: 'smooth'
    })
  }

  if (suggestedVaults.length === 0) {
    return <TrendingVaultsSkeleton />
  }

  return (
    <div className={'w-full bg-app pb-2'}>
      <div className={'flex flex-col gap-0 rounded-xl border border-border bg-surface'}>
        <div className={'flex w-full items-center justify-between gap-3 px-4 py-3 md:px-6 md:py-3'}>
          <div className={'flex min-w-0 flex-1 items-center gap-3 '}>
            <div className={'flex flex-col text-left'}>
              <p className={'text-sm font-semibold tracking-wide text-text-secondary'}>{'Trending Vaults'}</p>
            </div>
            {!isTrendingExpanded ? <TrendingVaultsCollapsedMarquee suggestedVaults={suggestedVaults} /> : null}
            {isTrendingExpanded && suggestedVaults.length > 4 ? (
              <div className={'hidden gap-3 md:flex'}>
                <button
                  onClick={onScrollBack}
                  disabled={!canScrollLeft}
                  className={cl(
                    'flex h-5! items-center rounded-[4px] px-2 outline-solid outline-1! outline-border transition-colors ',
                    canScrollLeft
                      ? 'text-text-secondary hover:bg-surface-secondary'
                      : 'text-text-tertiary cursor-not-allowed'
                  )}
                >
                  <IconChevron className={'size-3 rotate-90'} />
                </button>
                <button
                  onClick={onScrollForward}
                  disabled={!canScrollRight}
                  className={cl(
                    'flex h-5! items-center rounded-[4px] px-2  transition-colors outline-solid outline-1! outline-border',
                    canScrollRight
                      ? 'text-text-secondary hover:bg-surface-secondary'
                      : 'text-text-tertiary cursor-not-allowed'
                  )}
                >
                  <IconChevron className={'size-3 -rotate-90'} />
                </button>
              </div>
            ) : null}
          </div>
          <button
            type={'button'}
            className={'flex items-center gap-3'}
            onClick={(): void => setIsTrendingExpanded((previous) => !previous)}
          >
            <IconChevron
              className={'size-4 text-text-secondary transition-transform duration-200'}
              direction={isTrendingExpanded ? 'up' : 'down'}
            />
          </button>
        </div>
        {isTrendingExpanded ? (
          <div
            ref={trendingCarouselRef}
            className={'overflow-x-auto scrollbar-themed px-4 pt-0.5 pb-4 md:px-6 scroll-smooth'}
          >
            <div className={'flex gap-4'}>
              {renderedVaults.map((vault, index) => {
                const key = `${vault.chainID}_${toAddress(vault.address)}_${index}`
                return (
                  <div key={key} data-trending-vault-card className={'w-[272px] flex-shrink-0'}>
                    <SuggestedVaultCard vault={vault} />
                  </div>
                )
              })}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
