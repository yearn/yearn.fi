import { SectionHeader } from '@lib/components/SectionHeader'
import type { ReactElement } from 'react'
import Image from '/src/components/Image'

export function VaultInfo(): ReactElement {
  return (
    <section className={'flex w-full justify-center bg-white/5 py-4 lg:py-4 '}>
      <div className={'flex w-full max-w-[1180px] flex-col gap-10 px-4 lg:flex-row lg:items-center'}>
        <div className={'flex flex-row grow gap-4'}>
          <div className={'w-1/2 flex flex-1 flex-col gap-8'}>
            <SectionHeader
              tagline={'What is Yearn?'}
              title={'What is a Yearn Vault'}
              description={'A peek into how Yearn Vaults work'}
            />
            <div className={'space-y-6 text-lg text-neutral-600'}>
              <p>
                {
                  'Yearn Vaults are smart contracts on Ethereum that you deposit assets into and those assets are then automatically allocated toward yield earning opportunities called strategies.'
                }
              </p>
              <p>
                {
                  "These strategies could supply to lending markets, stake tokens to earn governance rewards, provide liquidity to automated market makers, and more. What opportunities a vault's funds are allocated to depends on the risk parameters of the vault."
                }
              </p>
              <p>
                {
                  "Yearn optimizes vault strategy deployments and allocations to optimize earnings, and then sell and compound earned rewards back into the deposited asset. And it happens without anyone having access to your principal. It feels like magic, but it isn't!"
                }
              </p>
            </div>
          </div>
          <div className={'flex flex-1 items-center justify-center'}>
            <Image
              src={'/yvaults-v3-more-detail.png'}
              alt={'Diagram showing Yearn v3 vault structure'}
              width={600}
              height={650}
              className={'max-h-[520px] w-full max-w-[520px] object-contain'}
            />
          </div>
        </div>
      </div>
    </section>
  )
}
