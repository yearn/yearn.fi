import { SectionHeader } from '@shared/components/SectionHeader'
import type { FC } from 'react'
import Link from '/src/components/Link'

enum SecurityCardType {
  Audits = 'audits',
  BugBounties = 'bug-bounties'
}

const Cards: {
  [key in SecurityCardType]: {
    title: string
    description: string
    href: string
    imageSrc: string
    bgColor: string
  }
} = {
  [SecurityCardType.Audits]: {
    title: 'Audits',
    description: 'Yearn Contracts are audited thoroughly by a variety of auditors.',
    href: 'https://docs.yearn.fi/developers/security/',
    imageSrc: '/landing/yearn-apps-logo.png',
    bgColor: 'bg-gradient-to-br from-[#0657F9] to-[#0B4DD0]'
  },
  [SecurityCardType.BugBounties]: {
    title: 'Bug Bounties',
    description: 'Security is our top priority. Report vulnerabilities and get rewarded.',
    href: 'https://immunefi.com/bug-bounty/yearnfinance',
    imageSrc: '/landing/integrations.png',
    bgColor: 'bg-gradient-to-br from-[#0657F9] to-[#0B4DD0]'
  }
}

const SecurityCard: FC<{
  type: SecurityCardType
}> = ({ type }) => {
  const { title, description, href, bgColor } = Cards[type]

  return (
    <Link href={href} className={'flex'}>
      <div
        className={`${bgColor} group cursor-pointer overflow-hidden rounded-xl transition-all duration-300 hover:brightness-90 sm:rounded-2xl`}
      >
        <div className={'p-5 sm:p-6 md:p-8'}>
          <h3 className={'mb-3 text-2xl text-white sm:mb-4 sm:text-3xl'}>{title}</h3>
          <p className={'mb-4 text-base font-light text-white/70 sm:text-[18px]'}>{description}</p>
          <div
            className={
              'flex min-h-[48px] items-center text-base text-white/90 transition-colors duration-300 group-hover:text-white sm:min-h-0 sm:text-inherit'
            }
          >
            {'Learn More →'}
          </div>
        </div>
      </div>
    </Link>
  )
}

export const Security: FC = () => (
  <section className={'flex w-full justify-center bg-white/5 py-12 sm:py-16 lg:py-32'}>
    <div className={'flex w-full max-w-[1180px] flex-col items-center justify-between lg:flex-row'}>
      <div className={'w-full max-w-7xl px-4'}>
        <div className={'px-1 sm:px-2'}>
          <SectionHeader
            align={'center'}
            tagline={'Audited, secure'}
            title={'Security First'}
            description={'Yearn prioritizes security to protect your assets.'}
          />
        </div>
        <div className={'grid gap-4 pt-8 sm:gap-6 sm:pt-12 md:grid-cols-2 md:pt-16'}>
          <SecurityCard type={SecurityCardType.Audits} />
          <SecurityCard type={SecurityCardType.BugBounties} />
        </div>
      </div>
    </div>
  </section>
)
