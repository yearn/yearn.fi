import Link from '@components/Link'
import { SectionHeader } from '@lib/components/SectionHeader'
import { cl } from '@lib/utils'
import type { FC } from 'react'
import { useState } from 'react'

enum SecurityCardType {
  Audits = 'audits',
  BugBounties = 'bug-bounties',
  MoreInfo = 'more-info'
}

const securityCards: {
  [key in SecurityCardType]: {
    title: string
    description: string
    href: string
    bgColor: string
  }
} = {
  [SecurityCardType.Audits]: {
    title: 'View our Audits →',
    description: 'Yearn Contracts have been audited thoroughly by a variety of auditors.',
    href: 'https://github.com/yearn/yearn-security/tree/master/audits',
    bgColor: 'bg-gradient-to-r from-[#D21162] to-[#2C3DA6]'
  },
  [SecurityCardType.BugBounties]: {
    title: 'Explore Bug Bounties →',
    description:
      'Security is a continuous endeavor. Yearn has bug bounties where you can report vulnerabilities and get rewarded.',
    href: 'https://immunefi.com/bug-bounty/yearnfinance',
    bgColor: 'bg-gradient-to-r from-[#D21162] to-[#2C3DA6]'
  },
  [SecurityCardType.MoreInfo]: {
    title: 'Learn more about Security Practices →',
    description: '',
    href: 'https://docs.yearn.fi/developers/security/',
    bgColor: 'bg-gradient-to-r from-[#D21162] to-[#2C3DA6]'
  }
}

const SecurityCard: FC<{ type: SecurityCardType }> = ({ type }) => {
  const { title, description, href, bgColor } = securityCards[type]
  const [isCtaHovered, setIsCtaHovered] = useState(false)

  return (
    <div
      className={cl(
        `${bgColor}`,
        'relative flex w-full flex-col rounded-2xl py-4 px-8 text-neutral-50 transition-all duration-300',
        isCtaHovered ? 'brightness-110 shadow-xl' : ''
      )}
      style={{ transform: isCtaHovered ? 'translateY(-4px)' : undefined }}
    >
      <Link
        href={href}
        className={'text-2xl text-white transition-colors duration-200 hover:text-white'}
        onMouseEnter={() => setIsCtaHovered(true)}
        onMouseLeave={() => setIsCtaHovered(false)}
      >
        {title}
      </Link>
      <p className={'text-[18px] text-white/80'}>{description}</p>
    </div>
  )
}

type SecurityProps = {
  sectionHeight?: number
}

export const Security: FC<SecurityProps> = ({ sectionHeight }) => {
  const sectionStyle = sectionHeight ? { minHeight: `${sectionHeight}px` } : undefined

  return (
    <section className={'flex w-full justify-center py-4 lg:py-4'} style={sectionStyle}>
      <div className={'flex w-full max-w-[1180px] flex-col gap-10 px-4 lg:flex-row lg:items-center'}>
        <div className={'flex flex-1 flex-col gap-6'}>
          <SectionHeader
            align={'left'}
            tagline={'Audited, secure'}
            title={'Security First'}
            description={'Yearn prioritizes security to protect your assets.'}
          />
          <ul className={'space-y-4 text-lg text-neutral-600 list-disc pl-6'}>
            <li>Our Contracts are Battle-tested and heavily audited.</li>
            <li>We perform continuous, active risk management and monitoring.</li>
            <li>Vaults are fully non-custodial. Only you have access to your funds.</li>
            <li>
              All open source. Code is publicly accessible to review and users can interact with our contracts via
              secondary (or their own) interfaces.
            </li>
          </ul>
        </div>
        <div className={'flex flex-1 flex-col gap-6'}>
          <SecurityCard type={SecurityCardType.Audits} />
          <SecurityCard type={SecurityCardType.BugBounties} />
          <SecurityCard type={SecurityCardType.MoreInfo} />
        </div>
      </div>
    </section>
  )
}
