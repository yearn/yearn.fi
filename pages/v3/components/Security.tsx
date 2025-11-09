import Link from '@components/Link'
import { SectionHeader } from '@lib/components/SectionHeader'
import { type FC, useRef, useState } from 'react'

enum SecurityCardType {
  Audits = 'audits',
  BugBounties = 'bug-bounties'
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
    title: 'Audits',
    description: 'Yearn Contracts are audited thoroughly by a variety of auditors.',
    href: 'https://docs.yearn.fi/developers/security/',
    bgColor: 'bg-[#6B2FEC]'
  },
  [SecurityCardType.BugBounties]: {
    title: 'Bug Bounties',
    description: 'Security is our top priority. Report vulnerabilities and get rewarded.',
    href: 'https://immunefi.com/bug-bounty/yearnfinance',
    bgColor: 'bg-[#0B5DD0]'
  }
}

const SecurityCard: FC<{
  type: SecurityCardType
}> = ({ type }) => {
  const { title, description, href, bgColor } = securityCards[type]
  const cardRef = useRef<HTMLDivElement>(null)
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })
  const [isHovered, setIsHovered] = useState(false)

  const handleMouseMove = (event: React.MouseEvent<HTMLDivElement>): void => {
    if (!cardRef.current) {
      return
    }

    const rect = cardRef.current.getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top

    setMousePosition({ x, y })
  }

  const handleMouseEnter = (): void => setIsHovered(true)

  const handleMouseLeave = (): void => {
    setIsHovered(false)
    setMousePosition({ x: 0, y: 0 })
  }

  return (
    <Link href={href} className={'flex'}>
      <div
        ref={cardRef}
        className={`${bgColor} group relative cursor-pointer overflow-hidden rounded-2xl transition-all duration-300`}
        onMouseMove={handleMouseMove}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {isHovered && (
          <div
            className={'pointer-events-none absolute inset-0 opacity-60 transition-opacity duration-300'}
            style={{
              background: `radial-gradient(200px circle at ${mousePosition.x}px ${mousePosition.y}px, rgba(255,255,255,0.25) 0%, transparent 100%)`
            }}
          />
        )}
        <div className={'relative z-10 p-8 transition-all duration-300'}>
          <h3 className={'mb-4 text-3xl transition-colors duration-300 group-hover:text-neutral-900'}>{title}</h3>
          <p
            className={
              'mb-4 text-[18px] text-neutral-900/70 transition-colors duration-300 group-hover:text-neutral-900/90'
            }
          >
            {description}
          </p>
          <div
            className={'flex items-center text-neutral-900 transition-colors duration-300 group-hover:text-blue-200'}
          >
            {'Learn More →'}
          </div>
        </div>
      </div>
    </Link>
  )
}

type SecurityProps = {
  sectionHeight?: number
}

export const Security: FC<SecurityProps> = ({ sectionHeight }) => {
  const sectionStyle = sectionHeight ? { minHeight: `${sectionHeight}px` } : undefined

  return (
    <section className={'flex w-full justify-center'} style={sectionStyle}>
      <div className={'flex w-full max-w-[1180px] flex-col items-center justify-between lg:flex-row'}>
        <div className={'w-full px-4'}>
          <div className={'px-2'}>
            <SectionHeader
              align={'left'}
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
}
