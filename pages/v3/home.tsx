import { useV3VaultFilter } from '@lib/hooks/useV3VaultFilter'
import type { ReactElement } from 'react'
import { BrandNewVaultCard } from './components/BrandNewVaultCard'
import { DiscoverCard } from './components/DiscoverCard'
import { PortfolioCard } from './components/PortfolioCard'
// import { V3Card } from './components/V3Card'
import { ExploreOurVaults } from './components/V3SecondaryCard'

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
          {/* <div className={'col-span-12 min-w-0 md:order-1 md:col-span-8 md:col-start-1 md:row-span-2 md:row-start-1'}>
            <V3Card className={'h-full'} />
          </div> */}
          <div className={'col-span-12 min-w-0 md:order-2 md:col-span-12 md:col-start-1 md:row-span-4 md:row-start-1'}>
            <ExploreOurVaults className={'h-full'} />
          </div>
          <div className={'col-span-12 min-w-0 md:order-3 md:col-span-20 md:col-start-13 md:row-span-4 md:row-start-1'}>
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
