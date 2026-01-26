import Link from '@components/Link'
import { SuggestedVaultCard } from '@pages/vaults/components/SuggestedVaultCard'
import { useVaultApyData } from '@pages/vaults/hooks/useVaultApyData'
import { RenderAmount } from '@shared/components/RenderAmount'
import { TokenLogo } from '@shared/components/TokenLogo'
import { useLocalStorage } from '@shared/hooks/useLocalStorage'
import { IconChevron } from '@shared/icons/IconChevron'
import { cl, toAddress } from '@shared/utils'
import { formatPercent } from '@shared/utils/format'
import type { TYDaemonVault } from '@shared/utils/schemas/yDaemonVaultsSchemas'
import { getNetwork } from '@shared/utils/wagmi'
import type { CSSProperties, ReactElement } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

type TTrendingVaultsProps = {
  suggestedVaults: TYDaemonVault[]
}

const MAX_EXPANDED_VAULTS = 4
const EXPANDED_CARD_WIDTH = 272
const EXPANDED_CARD_GAP = 16

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
    if (apyData.mode === 'katana' && apyData.katanaEstApr !== undefined) {
      return formatPercent(apyData.katanaEstApr * 100, 2, 2)
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
      <span className={'max-w-[160px] truncate text-mobile-label font-semibold text-text-primary'}>{vault.name}</span>
      <span aria-hidden className={'text-text-tertiary'}>
        {'|'}
      </span>
      <span className={'text-mobile-label font-semibold tabular-nums text-text-primary'}>{apyDisplay}</span>
      <span aria-hidden className={'text-text-tertiary'}>
        {'|'}
      </span>
      <span className={'text-mobile-label font-semibold tabular-nums text-text-primary'}>
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
        <div className={'flex w-full items-center justify-between gap-3 px-4 py-3 md:px-6 md:py-3'}>
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
  const [isTrendingExpanded, setIsTrendingExpanded] = useLocalStorage<boolean>(
    'yearn.fi/trending-vaults-expanded@0.0.1',
    false
  )
  const expandedCardsRef = useRef<HTMLDivElement>(null)
  const [visibleExpandedCards, setVisibleExpandedCards] = useState(() =>
    Math.min(MAX_EXPANDED_VAULTS, suggestedVaults.length)
  )

  useEffect(() => {
    setVisibleExpandedCards(Math.min(MAX_EXPANDED_VAULTS, suggestedVaults.length))
  }, [suggestedVaults.length])

  const updateVisibleExpandedCards = useCallback((): void => {
    const container = expandedCardsRef.current
    if (!container) {
      return
    }
    const availableWidth = container.clientWidth
    if (availableWidth <= 0) {
      return
    }
    const fitCount = Math.max(
      1,
      Math.floor((availableWidth + EXPANDED_CARD_GAP) / (EXPANDED_CARD_WIDTH + EXPANDED_CARD_GAP))
    )
    const nextCount = Math.min(MAX_EXPANDED_VAULTS, suggestedVaults.length, fitCount)
    setVisibleExpandedCards((prev) => (prev === nextCount ? prev : nextCount))
  }, [suggestedVaults.length])

  useEffect(() => {
    if (!isTrendingExpanded) {
      return
    }
    updateVisibleExpandedCards()
  }, [isTrendingExpanded, updateVisibleExpandedCards])

  useEffect(() => {
    if (!isTrendingExpanded) {
      return
    }
    const container = expandedCardsRef.current
    if (!container) {
      return
    }
    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(() => updateVisibleExpandedCards())
      observer.observe(container)
      return () => observer.disconnect()
    }
    window.addEventListener('resize', updateVisibleExpandedCards)
    return () => {
      window.removeEventListener('resize', updateVisibleExpandedCards)
    }
  }, [isTrendingExpanded, updateVisibleExpandedCards])

  const expandedVaults = useMemo(
    () => suggestedVaults.slice(0, visibleExpandedCards),
    [suggestedVaults, visibleExpandedCards]
  )

  if (suggestedVaults.length === 0) {
    return <TrendingVaultsSkeleton />
  }

  return (
    <div className={'w-full bg-app pb-2'}>
      <div className={'flex flex-col gap-0 rounded-xl border border-border bg-surface'}>
        <div className={'flex w-full items-center justify-between gap-3 px-4 py-3 md:px-6 md:py-3'}>
          <div className={'flex min-w-0 flex-1 items-center gap-3 '}>
            <div className={'flex flex-col text-left'}>
              <p className={'text-base font-semibold tracking-wide text-text-secondary'}>{'Curated Vaults'}</p>
            </div>
            {!isTrendingExpanded ? <TrendingVaultsCollapsedMarquee suggestedVaults={suggestedVaults} /> : null}
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
          <div className={'overflow-hidden px-4 pt-0.5 pb-4 md:px-6'}>
            <div ref={expandedCardsRef} className={'w-full'}>
              <div
                className={'grid gap-4'}
                style={{ gridTemplateColumns: `repeat(${expandedVaults.length}, minmax(0, 1fr))` }}
              >
                {expandedVaults.map((vault, index) => {
                  const key = `${vault.chainID}_${toAddress(vault.address)}_${index}`
                  return (
                    <div key={key} className={'min-w-0'}>
                      <SuggestedVaultCard vault={vault} />
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
