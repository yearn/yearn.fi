import { IconChevron } from '@lib/icons/IconChevron'
import { cl, toAddress } from '@lib/utils'
import type { TYDaemonVault } from '@lib/utils/schemas/yDaemonVaultsSchemas'
import { SuggestedVaultCard } from '@vaults-v3/components/SuggestedVaultCard'
import type { ReactElement } from 'react'
import { useEffect, useRef, useState } from 'react'

type TTrendingVaultsProps = {
  suggestedVaults: TYDaemonVault[]
}

export function TrendingVaults({ suggestedVaults }: TTrendingVaultsProps): ReactElement | null {
  const [isTrendingExpanded, setIsTrendingExpanded] = useState(true)
  const trendingCarouselRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const updateScrollButtons = (): void => {
    if (!trendingCarouselRef.current) {
      return
    }
    const { scrollLeft, scrollWidth, clientWidth } = trendingCarouselRef.current
    setCanScrollLeft(scrollLeft > 0)
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 1)
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

  const onScrollBack = (): void => {
    if (!trendingCarouselRef.current) {
      return
    }
    const itemWidth = 280 + 16 // card width + gap
    trendingCarouselRef.current.scrollTo({
      left: trendingCarouselRef.current.scrollLeft - itemWidth,
      behavior: 'smooth'
    })
  }

  const onScrollForward = (): void => {
    if (!trendingCarouselRef.current) {
      return
    }
    const itemWidth = 280 + 16 // card width + gap
    trendingCarouselRef.current.scrollTo({
      left: trendingCarouselRef.current.scrollLeft + itemWidth,
      behavior: 'smooth'
    })
  }

  if (suggestedVaults.length === 0) {
    return null
  }

  return (
    <div className={'w-full bg-app pb-2'}>
      <div className={'flex flex-col gap-0 rounded-xl border border-neutral-200 bg-surface'}>
        <div className={'flex w-full items-center justify-between gap-3 px-4 py-3 md:px-6 md:py-4'}>
          <button
            type={'button'}
            className={'flex items-center gap-3'}
            onClick={(): void => setIsTrendingExpanded((previous) => !previous)}
          >
            <div className={'flex flex-col text-left'}>
              <p className={'text-sm font-semibold tracking-wide text-neutral-500'}>{'Trending Vaults'}</p>
            </div>
            <IconChevron
              className={'size-4 text-neutral-600 transition-transform duration-200'}
              direction={isTrendingExpanded ? 'up' : 'down'}
            />
          </button>
          {isTrendingExpanded && suggestedVaults.length > 4 ? (
            <div className={'hidden gap-3 md:flex'}>
              <button
                onClick={onScrollBack}
                disabled={!canScrollLeft}
                className={cl(
                  'flex h-5! items-center rounded-[4px] px-2 outline-solid outline-1! outline-neutral-200 transition-colors ',
                  canScrollLeft ? 'text-neutral-400 hover:bg-neutral-200' : 'text-neutral-300 cursor-not-allowed'
                )}
              >
                <IconChevron className={'size-3 rotate-90'} />
              </button>
              <button
                onClick={onScrollForward}
                disabled={!canScrollRight}
                className={cl(
                  'flex h-5! items-center rounded-[4px] px-2  transition-colors outline-solid outline-1! outline-neutral-200',
                  canScrollRight ? 'text-neutral-400 hover:bg-neutral-200' : 'text-neutral-300 cursor-not-allowed'
                )}
              >
                <IconChevron className={'size-3 -rotate-90'} />
              </button>
            </div>
          ) : null}
        </div>
        {isTrendingExpanded ? (
          <div ref={trendingCarouselRef} className={'overflow-x-auto scrollbar-none px-4 pb-4 md:px-6 scroll-smooth'}>
            <div className={'flex'}>
              {suggestedVaults.map((vault) => {
                const key = `${vault.chainID}_${toAddress(vault.address)}`
                return (
                  <div key={key} className={'w-[280px] flex-shrink-0'}>
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
