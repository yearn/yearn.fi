import { IconChevron } from '@lib/icons/IconChevron'
import { cl, toAddress } from '@lib/utils'
import type { TYDaemonVault } from '@lib/utils/schemas/yDaemonVaultsSchemas'
import { CollapsedPromotionalBanner, PromotionalBanner } from '@vaults-v3/components/PromotionalBanner'
import { SuggestedVaultCard } from '@vaults-v3/components/SuggestedVaultCard'
import type { ReactElement } from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'

type TTrendingVaultsProps = {
  suggestedVaults: TYDaemonVault[]
  promotionalBanner?: {
    title: string
    subtitle: string
    description: string
    ctaLabel: string
    ctaTo: string
  }
}

export function TrendingVaults(props: TTrendingVaultsProps): ReactElement | null {
  const { suggestedVaults } = props
  const [isTrendingExpanded, setIsTrendingExpanded] = useState(true)
  const trendingCarouselRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)
  const [renderedVaults, setRenderedVaults] = useState<TYDaemonVault[]>(suggestedVaults)
  const [isBannerOpen, setIsBannerOpen] = useState(true)

  useEffect(() => {
    setRenderedVaults(suggestedVaults)
  }, [suggestedVaults])

  const getScrollStep = useCallback((): number | undefined => {
    if (!trendingCarouselRef.current) {
      return undefined
    }
    const firstChild = trendingCarouselRef.current.querySelector<HTMLElement>('[data-trending-vault-card]')
    if (firstChild) {
      const style = window.getComputedStyle(firstChild)
      const width = firstChild.offsetWidth
      const marginLeft = parseFloat(style.marginLeft) || 0
      const marginRight = parseFloat(style.marginRight) || 0
      return width + marginLeft + marginRight
    }
    return undefined
  }, [])

  const updateScrollButtons = (): void => {
    if (!trendingCarouselRef.current) {
      return
    }
    const { scrollLeft, scrollWidth, clientWidth } = trendingCarouselRef.current
    const step = getScrollStep() || 280 + 16
    setCanScrollLeft(scrollLeft > 0)
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - step / 2)
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
  }, [isTrendingExpanded, suggestedVaults.length, getScrollStep])

  const onScrollBack = (): void => {
    if (!trendingCarouselRef.current) {
      return
    }
    const step = getScrollStep() || 280 + 16
    trendingCarouselRef.current.scrollTo({
      left: trendingCarouselRef.current.scrollLeft - step,
      behavior: 'smooth'
    })
  }

  const onScrollForward = (): void => {
    if (!trendingCarouselRef.current) {
      return
    }
    const step = getScrollStep() || 280 + 16
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

  if (suggestedVaults.length === 0 && !props.promotionalBanner) {
    return null
  }

  if (props.promotionalBanner && isBannerOpen) {
    return (
      <div className={'w-full bg-app pb-2'}>
        <PromotionalBanner
          title={props.promotionalBanner.title}
          subtitle={props.promotionalBanner.subtitle}
          description={props.promotionalBanner.description}
          ctaLabel={props.promotionalBanner.ctaLabel}
          ctaTo={props.promotionalBanner.ctaTo}
          variant={'yvUSD'}
          onClose={(): void => setIsBannerOpen(false)}
        />
      </div>
    )
  }

  return (
    <div className={'w-full bg-app pb-2'}>
      {props.promotionalBanner && !isBannerOpen ? (
        <div className={'mb-4'}>
          <CollapsedPromotionalBanner
            title={props.promotionalBanner.title}
            subtitle={props.promotionalBanner.subtitle}
            variant={'yvUSD'}
            onExpand={(): void => setIsBannerOpen(true)}
          />
        </div>
      ) : null}
      <div className={'flex flex-col gap-0 rounded-xl border border-border bg-surface'}>
        <div className={'flex w-full items-center justify-between gap-3 px-4 py-3 md:px-6 md:py-4'}>
          <div className={'flex items-center gap-3'}>
            <div className={'flex flex-col text-left'}>
              <p className={'text-sm font-semibold tracking-wide text-text-secondary'}>{'Trending Vaults'}</p>
            </div>
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
            className={'overflow-x-auto scrollbar-none px-4 pt-0.5 pb-4 md:px-6 scroll-smooth'}
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
