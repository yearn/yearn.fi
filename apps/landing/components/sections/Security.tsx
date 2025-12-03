import { SectionHeader } from '@lib/components/SectionHeader'
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
    background: string
  }
} = {
  [SecurityCardType.Audits]: {
    title: 'Audits',
    description: 'Yearn Contracts are audited thoroughly by a variety of auditors.',
    href: 'https://docs.yearn.fi/developers/security/',
    imageSrc: '/landing/yearn-apps-logo.png',
    background: 'linear-gradient(135deg, var(--color-blue-700), var(--color-blue-900))'
  },
  [SecurityCardType.BugBounties]: {
    title: 'Bug Bounties',
    description: 'Security is our top priority. Report vulnerabilities and get rewarded.',
    href: 'https://immunefi.com/bug-bounty/yearnfinance',
    imageSrc: '/landing/integrations.png',
    background: 'linear-gradient(135deg, var(--color-blue-900), var(--color-blue-700))'
  }
}

const SecurityCard: FC<{
  type: SecurityCardType
}> = ({ type }) => {
  const { title, description, href, background } = Cards[type]

  return (
    <Link href={href} className={'flex'}>
      <div
        className={
          'group relative cursor-pointer overflow-hidden rounded-2xl border border-neutral-200 bg-surface transition-all duration-300 hover:scale-[1.02] hover:shadow-lg'
        }
        style={{ background }}
      >
        <div className={'relative z-10 p-8 transition-all duration-300 group-hover:bg-black/10'}>
          <h3 className={'mb-4 text-3xl text-white'}>{title}</h3>
          <p className={'mb-4 text-[18px] text-white'}>{description}</p>
          <div className={'flex items-center text-white'}>{'Learn More →'}</div>
        </div>
      </div>
    </Link>
  )
}

export const Security: FC = () => (
  <section className={'flex w-full justify-center border-t border-neutral-200 bg-transparent py-16 lg:py-32'}>
    <div className={'flex w-full max-w-[1180px] flex-col items-center justify-between  lg:flex-row '}>
      <div className={'w-full max-w-7xl px-4'}>
        <div className={'px-2'}>
          <SectionHeader
            align={'center'}
            tagline={'Audited, secure'}
            title={'Security First'}
            description={'Yearn prioritizes security to protect your assets.'}
          />
        </div>
        <div className={'grid gap-6 pt-16 md:grid-cols-2'}>
          <SecurityCard type={SecurityCardType.Audits} />
          <SecurityCard type={SecurityCardType.BugBounties} />
        </div>
      </div>
    </div>
  </section>
)
