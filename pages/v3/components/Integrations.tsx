import Link from '@components/Link'
import { SectionHeader } from '@lib/components/SectionHeader'
import type { FC } from 'react'
import Image from '/src/components/Image'

type Integration = {
  name: string
  imageSrc: string
  description: string
  href: string
}

const integrations: Integration[] = [
  {
    name: 'Cove',
    imageSrc: '/landing/integrations/cove.png',
    description: 'Earn the best yields on-chain without the hassle of managing a portfolio.',
    href: 'https://cove.finance'
  },
  {
    name: '1UP',
    imageSrc: '/landing/integrations/1up.png',
    description: '1UP is a public good liquid locker for YFI.',
    href: 'https://1up.tokyo/'
  },
  {
    name: 'Stakedao',
    imageSrc: '/landing/integrations/stakedao.png',
    description: 'A non-custodial liquid staking platform focused on governance tokens.',
    href: 'https://stakedao.org'
  },
  {
    name: 'Sturdy',
    imageSrc: '/landing/integrations/sturdy.png',
    description: 'Isolated lending with shared liquidity.',
    href: 'https://sturdy.finance'
  },
  {
    name: 'PWN',
    imageSrc: '/landing/integrations/pwn.png',
    description: 'PWN is a hub for peer-to-peer (P2P) loans backed by digital assets.',
    href: 'https://pwn.finance'
  },
  {
    name: 'Superform',
    imageSrc: '/landing/integrations/super.png',
    description: 'Superform grows your onchain wealth. Earn the best returns on your crypto.',
    href: 'https://superform.xyz'
  },
  {
    name: 'Resupply',
    imageSrc: '/landing/integrations/resupply.png',
    description: 'A decentralized stablecoin protocol.',
    href: 'https://resupply.fi/'
  }
]

const IntegrationItem: FC<Integration & { index: number }> = ({ name, imageSrc, description, href, index }) => (
  <Link href={href} className={'block cursor-pointer'}>
    <div
      className={`flex flex-row items-center p-3 transition-all duration-300 ease-in-out hover:scale-[1.005] hover:bg-[#2a2b2c] hover:shadow-lg md:p-4 ${index % 2 === 0 ? 'bg-[#212223]' : 'bg-[#212223]/50'}`}
    >
      <div className={'relative mr-4 shrink-0 self-center'}>
        <Image src={imageSrc} alt={name} width={40} height={40} className={'rounded-full'} />
      </div>
      <div className={'flex min-w-0 flex-1 flex-col md:flex-row md:items-center md:justify-between'}>
        <div className={'flex items-center text-[20px] text-white'}>
          {name}{' '}
          <span className={'ml-2 text-neutral-700 transition-all duration-300 ease-in-out hover:text-neutral-500'}>
            {'↗'}
          </span>
        </div>
        <div
          className={
            'hidden text-base text-neutral-400 transition-colors duration-300 ease-in-out hover:text-neutral-300 md:block md:max-w-[60%] md:text-right'
          }
        >
          {description}
        </div>
      </div>
    </div>
  </Link>
)

type IntegrationsProps = {
  sectionHeight?: number
}

export const Integrations: FC<IntegrationsProps> = ({ sectionHeight }) => {
  const sectionStyle = sectionHeight ? { minHeight: `${sectionHeight}px` } : undefined

  return (
    <section className={'flex w-full justify-center  py-0 lg:py-0'} style={sectionStyle}>
      <div className={'flex w-[1180px] flex-col items-center justify-between md:flex-row'}>
        <div className={'w-full px-4'}>
          <SectionHeader
            tagline={'Partners'}
            title={'Integrations'}
            description={'External Yearn vaults available through our partners'}
          />
          <div className={'mt-8 grid overflow-hidden rounded-lg'}>
            {integrations.map((integration, index) => (
              <IntegrationItem index={index} key={integration.href} {...integration} />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
