import Image from 'next/image'
import type { ReactElement } from 'react'
import Marquee from 'react-fast-marquee'

const PARTNERS = [
  { src: '/landing/partners/aave.png', width: 220 },
  { src: '/landing/partners/ajna.png', width: 173 },
  { src: '/landing/partners/compound.png', width: 246 },
  { src: '/landing/partners/curve.png', width: 175 },
  { src: '/landing/partners/lido.png', width: 182 },
  { src: '/landing/partners/pendle.png', width: 257 },
  { src: '/landing/partners/sky.png', width: 130 },
  { src: '/landing/partners/spark.png', width: 194 },
  { src: '/landing/partners/swell.png', width: 142 }
]

export function Partners(): ReactElement {
  const partnerSpacing = 30
  return (
    <div className={'flex w-full justify-center'}>
      <div className={'h-20 w-full'}>
        <Marquee
          gradient
          gradientColor={'#080A0C'}
          pauseOnHover={true}
          speed={20}
          gradientWidth={'25%'}
          className={'h-full overflow-hidden'}>
          <div className={'flex h-full items-center'}>
            {[...PARTNERS, ...PARTNERS].map(partner => (
              <div
                className={'flex h-full max-h-[32px] items-center justify-center'}
                style={{ marginLeft: partnerSpacing, marginRight: partnerSpacing }}
                key={partner.src}>
                <Image src={partner.src} alt={'partner'} width={partner.width / 2.25} height={32} />
              </div>
            ))}
          </div>
        </Marquee>
      </div>
    </div>
  )
}
