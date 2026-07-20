import { SectionHeader } from '@shared/components/SectionHeader'
import Link from 'next/link'
import type { FC } from 'react'
import Image from '/src/components/Image'

type TIntegration = {
  name: string
  imageSrc: string
  description: string
  href: string
}

const integrations: TIntegration[] = [
  {
    name: 'Curve',
    imageSrc: '/landing/integrations/curve.png',
    description: 'The platform for building deep, sustainable onchain liquidity',
    href: 'https://www.curve.finance/'
  },
  {
    name: 'Alchemix',
    imageSrc: '/landing/integrations/alchemix.png',
    description: 'Self-Repaying DeFi Loans',
    href: 'https://alchemix.fi/'
  },
  {
    name: 'Origin',
    imageSrc: '/landing/integrations/origin.png',
    description: 'Building foundational infrastructure for onchain yield',
    href: 'https://www.originprotocol.com/'
  },
  {
    name: 'Katana',
    imageSrc: '/landing/integrations/katana.png',
    description: 'A layer-2 blockchain built to generate real revenue and sustainable yield for users',
    href: 'https://katana.network/'
  },
  {
    name: 'Trueo',
    imageSrc: '/landing/integrations/trueo.png',
    description: 'A fully onchain, yield-bearing prediction market protocol',
    href: 'https://trueo.com/'
  },
  {
    name: 'Term',
    imageSrc: '/landing/integrations/term.png',
    description: 'Fixed-rate lending via onchain auctions',
    href: 'https://www.term.finance/'
  },
  {
    name: 'Cap',
    imageSrc: '/landing/integrations/cap.png',
    description: 'A covered credit application consisting of a digital dollar and a credit platform',
    href: 'https://www.cap.app/'
  }
]

const IntegrationItem: FC<TIntegration & { index: number }> = ({ name, imageSrc, description, href, index }) => {
  return (
    <Link href={href} target={'_blank'} rel={'noopener noreferrer'} className={'block cursor-pointer'}>
      <div
        className={`flex min-h-[56px] flex-row items-center p-3 transition-all duration-300 ease-in-out hover:scale-[1.005] hover:bg-black/60 hover:shadow-lg sm:min-h-[60px] sm:p-[14px] md:p-[16px] ${index % 2 === 0 ? 'bg-black/50' : 'bg-black/30'}`}
      >
        <div className={'relative mr-3 shrink-0 self-center sm:mr-4'}>
          <Image
            src={imageSrc}
            alt={name}
            width={40}
            height={40}
            className={
              'size-9 rounded-full transition-transform duration-300 ease-in-out group-hover:scale-110 sm:size-10'
            }
          />
        </div>
        <div className={'flex min-w-0 flex-1 flex-col md:flex-row md:items-center md:justify-between'}>
          <div className={'flex items-center text-base text-white sm:text-lg md:text-[20px]'}>
            {name}{' '}
            <span className={'ml-2 text-neutral-700 transition-all duration-300 ease-in-out hover:text-neutral-500'}>
              {'↗'}
            </span>
          </div>
          <div className={'hidden font-light text-gray-400 md:block md:max-w-[60%] md:text-base md:text-right'}>
            {description}
          </div>
        </div>
      </div>
    </Link>
  )
}

export const Integrations: FC = () => (
  <section className={'flex w-full justify-center bg-white/5 py-12 sm:py-16 lg:py-32'}>
    <div className={'flex w-full max-w-[1180px] flex-col items-center justify-between md:flex-row'}>
      <div className={'w-full px-4'}>
        <SectionHeader
          tagline={'Partners'}
          title={'Integrations'}
          description={'Partners actively using Yearn vaults'}
        />
        <div className={'mt-6 grid overflow-hidden rounded-lg sm:mt-8'}>
          {integrations.map((integration, index) => (
            <IntegrationItem
              index={index}
              key={integration.href}
              name={integration.name}
              imageSrc={integration.imageSrc}
              description={integration.description}
              href={integration.href}
            />
          ))}
        </div>
      </div>
    </div>
  </section>
)
