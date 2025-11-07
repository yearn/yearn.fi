import { useV3VaultFilter } from '@lib/hooks/useV3VaultFilter'
import { cl } from '@lib/utils'
import type { ReactElement } from 'react'
import { useState } from 'react'
import { DiscoverCard } from './components/DiscoverCard'
import { FAQs } from './components/FAQs'
import { HeroCard } from './components/HeroCard'
import { Integrations } from './components/Integrations'
import { Partners } from './components/Partners'
import { PortfolioCard } from './components/PortfolioCard'
import { Security } from './components/Security'
import { ExploreOurVaults } from './components/V3SecondaryCard'

function V3Home(): ReactElement {
  const { holdingsVaults } = useV3VaultFilter(null, null, '', null)
  const [isLearnMoreExpanded, setIsLearnMoreExpanded] = useState(false)

  const handleLearnMore = (): void => {
    setIsLearnMoreExpanded((previous) => !previous)
  }

  return (
    <div className={'min-h-screen w-full bg-neutral-0'}>
      <div className={'mx-auto w-full max-w-[1232px] px-4'}>
        <div
          className={cl(
            'grid grid-cols-12 gap-4 overflow-x-hidden pt-12 md:grid-cols-32 md:gap-6 md:pt-20 md:pb-6',
            isLearnMoreExpanded ? 'md:min-h-screen md:auto-rows-auto' : 'md:h-screen md:auto-rows-fr md:grid-rows-8'
          )}
        >
          {/* <div className={'col-span-12 min-w-0 md:order-1 md:col-span-8 md:col-start-1 md:row-span-2 md:row-start-1'}>
            <V3Card className={'h-full'} />
          </div> */}
          <div className={'col-span-12 min-w-0 md:order-1 md:col-span-21 md:col-start-1 md:row-span-4 md:row-start-1'}>
            <HeroCard className={'h-full'} onLearnMore={handleLearnMore} isLearnMoreExpanded={isLearnMoreExpanded} />
          </div>
          <div className={'col-span-12 min-w-0 md:order-2 md:col-span-11 md:col-start-22 md:row-span-4 md:row-start-1'}>
            <ExploreOurVaults className={'h-full'} />
          </div>
          {isLearnMoreExpanded && (
            <div className={'col-span-12 min-w-0 md:col-span-32 md:col-start-1'}>
              <div className={'space-y-16 rounded-3xl bg-neutral-100 py-12 md:space-y-24 md:py-16'}>
                <Security />
                <Partners />
                <Integrations />
                <FAQs />
              </div>
            </div>
          )}
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
