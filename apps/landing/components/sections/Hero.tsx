import { SectionHeader } from '@lib/components/SectionHeader'
import { TvlStat } from '@lib/components/TvlStat'
import { useFetch } from '@lib/hooks/useFetch'
import type { ReactElement } from 'react'
import { z } from 'zod'
import Image from '/src/components/Image'
import Link from '/src/components/Link'
import { Button } from '../common/Button'

function AnimatedLogos(): ReactElement {
  return (
    <>
      <div
        className={'absolute'}
        style={{
          backgroundImage: "url('/landing/yfi-bottom-right.png')",
          backgroundRepeat: 'no-repeat',
          width: '480px',
          height: '160px',
          left: '70%',
          bottom: '0px'
        }}
      />
      <div
        className={'absolute'}
        style={{
          backgroundImage: "url('/landing/yfi-top-right.png')",
          backgroundRepeat: 'no-repeat',
          backgroundSize: '100% 100%',
          width: '240px',
          height: '240px',
          left: '76%',
          top: '104px'
        }}
      />
      <div
        className={'absolute'}
        style={{
          backgroundImage: "url('/landing/yfi-top-left.png')",
          backgroundRepeat: 'no-repeat',
          width: '240px',
          height: '240px',
          right: '70%',
          top: '32px'
        }}
      />
      <div
        className={'absolute'}
        style={{
          backgroundImage: "url('/landing/yfi-left-center.png')",
          backgroundRepeat: 'no-repeat',
          width: '200px',
          height: '290px',
          right: '78%',
          top: '200px'
        }}
      />
      <div
        className={'absolute'}
        style={{
          backgroundImage: "url('/landing/yfi-bottom-left.png')",
          backgroundRepeat: 'no-repeat',
          width: '440px',
          height: '160px',
          right: '60%',
          bottom: '0px'
        }}
      />
    </>
  )
}

export function Hero(): ReactElement {
  const { data: tvl } = useFetch<number>({
    endpoint: 'https://api.llama.fi/tvl/yearn',
    schema: z.number()
  })

  return (
    <>
      {/* Desktop Hero Section */}
      <div className={'hidden w-full justify-center overflow-hidden border-b border-white/10 md:flex'}>
        <div
          style={{
            backgroundImage: "url('/landing/hero-background.png')",
            backgroundRepeat: 'no-repeat',
            backgroundSize: '100% 100%',
            backgroundPosition: 'center',
            overflow: 'hidden'
          }}
          className={'relative flex h-[600px] w-[2365px] max-w-[2352px] flex-col items-center self-center'}
        >
          <AnimatedLogos />
          <div className={'flex h-full items-center justify-center'}>
            <div className={'z-20 flex flex-col items-center justify-center gap-12 text-center'}>
              <div className={'mb-8 mt-12'}>
                <TvlStat tvl={tvl ?? 0} />
              </div>
              <SectionHeader
                isH1
                align={'center'}
                title={'Earn on your Crypto'}
                description={"Yearn is DeFi's Yield Aggregator"}
              />
              <div className={'flex flex-row items-center justify-center gap-4'}>
                <Link href={'/v3'}>
                  <Button className={'md:text-[18px]'}>{'Explore Vaults'}</Button>
                </Link>
                {/* <Link href={'/apps'}>
									<Button
										className={'md:text-[18px]'}
										variant={'secondary'}>
										{'View Apps'}
									</Button>
								</Link> */}
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* Mobile Hero Section */}
      <div
        className={'flex w-full flex-col items-center bg-white/5 px-4 py-16 md:hidden'}
        style={{
          backgroundImage: "url('/landing/hero-background-mobile.png')",
          backgroundRepeat: 'no-repeat',
          backgroundSize: '100% 100%',
          backgroundPosition: 'center'
        }}
      >
        <div className={'mt-4 flex w-full max-w-sm flex-col items-center gap-4 text-center'}>
          <Image
            src={'/landing/yfi-top-right.png'}
            alt={'Yearn Finance Logo'}
            width={150}
            height={150}
            className={'size-auto max-w-[150px] sm:max-w-[180px]'}
            priority
          />
          <div className={'flex flex-col gap-12'}>
            <SectionHeader
              isH1
              align={'center'}
              title={'Earn on your Crypto'}
              description={"DeFi's most battle tested yield aggregator"}
            />
            <div className={'flex flex-col items-center justify-center gap-4'}>
              <Link href={'/v3'} className={'block w-full'}>
                <Button className={'max-w-xs'} variant={'primary'}>
                  {'Explore Vaults'}
                </Button>
              </Link>
              {/* <Link
								href={'/apps'}
								className={'block w-full'}>
								<Button
									className={'max-w-xs'}
									variant={'secondary'}>
									{'View Apps'}
								</Button>
							</Link> */}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
