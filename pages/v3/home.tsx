import { useV3VaultFilter } from '@lib/hooks/useV3VaultFilter'
import { cl } from '@lib/utils'
import type { CSSProperties, ReactElement } from 'react'
import { useRef, useState } from 'react'
import { DiscoverCard } from './components/DiscoverCard'
import { FAQs } from './components/FAQs'
import { HeroCard } from './components/HeroCard'
import { Integrations } from './components/Integrations'
import { Partners } from './components/Partners'
import { PortfolioCard } from './components/PortfolioCard'
import { Security } from './components/Security'
import { ExploreOurVaults } from './components/V3SecondaryCard'
import { VaultInfo } from './components/VaultInfo'

const LEARN_MORE_SECTIONS = [
  { key: 'vaultInfo', Component: VaultInfo, rowSpan: 6 },
  { key: 'security', Component: Security, rowSpan: 5 },
  { key: 'partners', Component: Partners, rowSpan: 4 },
  { key: 'integrations', Component: Integrations, rowSpan: 8 },
  { key: 'faqs', Component: FAQs, rowSpan: 6 }
] as const

function V3Home(): ReactElement {
  const { holdingsVaults } = useV3VaultFilter(null, null, '', null)
  const [isLearnMoreExpanded, setIsLearnMoreExpanded] = useState(false)
  const [frozenRowHeight, setFrozenRowHeight] = useState<number | null>(null)
  const [frozenRowGap, setFrozenRowGap] = useState<number>(0)
  const gridRef = useRef<HTMLDivElement>(null)
  const heroSectionRef = useRef<HTMLDivElement>(null)

  const measureGridMetrics = (): { rowHeight: number; rowGap: number } | null => {
    if (!gridRef.current) {
      return null
    }

    const styles = window.getComputedStyle(gridRef.current)
    const rowGap = Number.parseFloat(styles.rowGap || '0') || 0
    const heroHeight = heroSectionRef.current?.getBoundingClientRect().height ?? 0

    if (heroHeight > 0) {
      const adjustedHeroHeight = heroHeight - rowGap * 3
      if (adjustedHeroHeight > 0) {
        return { rowHeight: adjustedHeroHeight / 4, rowGap }
      }
    }

    const gridHeight = gridRef.current.getBoundingClientRect().height
    const adjustedGridHeight = gridHeight - rowGap * 7

    if (adjustedGridHeight > 0) {
      return { rowHeight: adjustedGridHeight / 8, rowGap }
    }

    return null
  }

  const handleLearnMore = (): void => {
    setIsLearnMoreExpanded((previous) => {
      if (!previous) {
        const measurements = measureGridMetrics()
        if (measurements) {
          setFrozenRowHeight(measurements.rowHeight)
          setFrozenRowGap(measurements.rowGap)
        }
      } else {
        setFrozenRowHeight(null)
        setFrozenRowGap(0)
      }

      return !previous
    })
  }

  const expandedGridStyles =
    isLearnMoreExpanded && frozenRowHeight
      ? ({
          gridTemplateRows: `repeat(8, ${frozenRowHeight}px)`,
          gridAutoRows: `${frozenRowHeight}px`
        } satisfies CSSProperties)
      : undefined

  const getSectionHeight = (rowSpan: number): number | null => {
    if (frozenRowHeight == null) {
      return null
    }
    return frozenRowHeight * rowSpan + frozenRowGap * (rowSpan - 1)
  }

  const buildLearnMoreWrapperProps = (rowSpan: number) => {
    const sectionHeight = getSectionHeight(rowSpan)
    const style: CSSProperties = {
      gridRow: `span ${rowSpan} / auto`
    }

    if (sectionHeight != null) {
      style.minHeight = `${sectionHeight}px`
    }

    return {
      className: 'col-span-12 min-w-0 md:col-span-32 md:col-start-1',
      style,
      sectionHeight
    }
  }

  return (
    <div className={'min-h-screen w-full bg-neutral-0'}>
      <div className={'mx-auto w-full max-w-[1232px] px-4'}>
        <div
          ref={gridRef}
          className={cl(
            'grid grid-cols-12 gap-4 overflow-x-hidden pt-12 md:grid-cols-32 md:grid-rows-8 md:gap-6 md:pt-20 md:pb-6',
            isLearnMoreExpanded ? 'md:min-h-screen md:auto-rows-auto' : 'md:h-screen md:auto-rows-fr md:grid-rows-8'
          )}
          style={expandedGridStyles}
        >
          {/* <div className={'col-span-12 min-w-0 md:order-1 md:col-span-8 md:col-start-1 md:row-span-2 md:row-start-1'}>
            <V3Card className={'h-full'} />
          </div> */}
          <div
            ref={heroSectionRef}
            className={'col-span-12 min-w-0 md:order-1 md:col-span-21 md:col-start-1 md:row-span-4 md:row-start-1'}
          >
            <HeroCard className={'h-full'} onLearnMore={handleLearnMore} isLearnMoreExpanded={isLearnMoreExpanded} />
          </div>
          <div className={'col-span-12 min-w-0 md:order-2 md:col-span-11 md:col-start-22 md:row-span-4 md:row-start-1'}>
            <ExploreOurVaults className={'h-full'} />
          </div>
          {isLearnMoreExpanded &&
            LEARN_MORE_SECTIONS.map(({ key, Component, rowSpan }) => {
              const { sectionHeight, ...wrapperProps } = buildLearnMoreWrapperProps(rowSpan)
              return (
                <div key={key} {...wrapperProps}>
                  <Component sectionHeight={sectionHeight ?? undefined} />
                </div>
              )
            })}
          <div
            className={cl(
              'col-span-12 min-w-0 md:order-4 md:col-span-14 md:col-start-1 md:row-span-4',
              isLearnMoreExpanded ? '' : 'md:row-start-5'
            )}
          >
            <DiscoverCard />
          </div>
          <div
            className={cl(
              'col-span-12 min-w-0 md:order-5 md:col-span-18 md:col-start-15 md:row-span-4',
              isLearnMoreExpanded ? '' : 'md:row-start-5'
            )}
          >
            <PortfolioCard holdingsVaults={holdingsVaults} />
          </div>
        </div>
      </div>
    </div>
  )
}

export default V3Home
