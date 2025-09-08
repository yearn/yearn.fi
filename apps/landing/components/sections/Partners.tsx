import { SectionHeader } from '@lib/components/SectionHeader'
import Image from '/src/components/Image'
import Link from '/src/components/Link'
import type { FC } from 'react'
import { useState } from 'react'

type TPartner = {
  image: string
  alt: string
  href: string
  size?: number
}

const partners: TPartner[] = [
  {
    image: '/landing/x/curve.png',
    alt: 'Curve',
    href: 'https://curve.yearn.space/'
  },
  {
    image: '/landing/x/morpho.png',
    alt: 'Morpho',
    href: 'https://morpho.yearn.space/'
  },
  {
    image: '/landing/x/katana.png',
    alt: 'Katana',
    href: 'https://katana.yearn.space/',
    size: 40
  },
  {
    image: '/landing/x/aerodrome.png',
    alt: 'Aerodrome',
    href: 'https://aerodrome.yearn.space/'
  },
  {
    image: '/landing/x/velodrome.png',
    alt: 'Velodrome',
    href: 'https://velodrome.yearn.space/'
  },
  {
    image: '/landing/x/pooltogether.png',
    alt: 'PoolTogether',
    href: 'https://pooltogether.yearn.space/',
    size: 40
  }
]

const PartnerLogo: FC<TPartner> = ({ image, alt, href, size = 40 }) => {
  const [isHovered, setIsHovered] = useState(false)
  return (
    <Link href={href} className={'block flex-1'}>
      <div
        className={
          'relative flex h-20 cursor-pointer items-center justify-center rounded-lg bg-gray-800 p-4 transition-colors duration-200 hover:bg-blue-500 lg:h-full lg:p-6'
        }
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {isHovered && (
          <div
            className={
              'absolute -top-12 left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded-full bg-gray-700 px-3 py-2 text-sm text-neutral-900 lg:block'
            }
          >
            {alt}
            <div
              className={
                'absolute left-1/2 top-full size-0 -translate-x-1/2 border-x-4 border-t-4 border-transparent border-t-gray-700'
              }
            ></div>
          </div>
        )}
        <Image
          src={image}
          alt={alt}
          width={size}
          height={size}
          className={'object-contain'}
          style={{
            maxWidth: `${size}px`,
            maxHeight: `${size}px`
          }}
        />
      </div>
    </Link>
  )
}

export const Partners: FC = () => (
  <section className={'flex w-full justify-center  py-16 lg:py-32'}>
    <div className={'flex w-full max-w-[1180px] flex-col items-center justify-between  lg:flex-row '}>
      <div className={'flex w-full flex-col gap-4 px-4'}>
        <SectionHeader
          tagline={'Partners'}
          title={'Yearn X'}
          description={'Collaborations exploring yield opportunities with our partners'}
        />

        {/* Mobile */}
        <div className={'flex flex-col gap-4 pt-8 lg:hidden'}>
          <div className={'grid grid-cols-2 gap-2'}>
            {partners.map((partner) => (
              <PartnerLogo
                key={partner.href}
                image={partner.image}
                alt={partner.alt}
                href={partner.href}
                size={partner.size}
              />
            ))}
          </div>
        </div>

        {/* Desktop */}
        <div className={'hidden gap-4 pt-8 md:pt-14 lg:flex lg:flex-row'}>
          <div className={'flex size-full h-[128px] flex-col gap-2'}>
            <div className={'flex flex-1 flex-row gap-2'}>
              {partners.map((partner) => (
                <PartnerLogo
                  key={partner.href}
                  image={partner.image}
                  alt={partner.alt}
                  href={partner.href}
                  size={partner.size}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
)
