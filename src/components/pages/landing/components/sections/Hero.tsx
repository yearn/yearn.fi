import { Button } from '@shared/components/Button'
import { SectionHeader } from '@shared/components/SectionHeader'
import { TvlStat } from '@shared/components/TvlStat'
import { useFetch } from '@shared/hooks/useFetch'
import type { ReactElement } from 'react'
import * as z from 'zod'
import Image from '/src/components/Image'
import Link from '/src/components/Link'

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
      <div
        className={
          '-mt-[var(--header-height)] hidden w-full justify-center overflow-hidden border-b border-white/10 md:flex'
        }
      >
        <div
          style={{
            backgroundImage: "url('/landing/hero-background.png')",
            backgroundRepeat: 'no-repeat',
            backgroundSize: '100% 100%',
            backgroundPosition: 'center',
            overflow: 'hidden'
          }}
          className={'relative flex h-[600px] w-full min-w-[2352px] flex-col items-center self-center'}
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
                <Link href={'/vaults'}>
                  <Button className={'!text-[18px] max-w-xs !px-4 !py-3 !rounded-full !bg-primary'} variant={'primary'}>
                    {'Explore Vaults'}
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* Mobile Hero Section */}
      <div
        className={
          '-mt-[var(--header-height)] flex w-full flex-col items-center bg-white/5 px-4 py-12 pt-20 sm:py-16 sm:pt-24 md:hidden'
        }
        style={{
          backgroundImage: "url('/landing/hero-background-mobile.png')",
          backgroundRepeat: 'no-repeat',
          backgroundSize: 'cover',
          backgroundPosition: 'center'
        }}
      >
        <div className={'mt-4 flex w-full max-w-sm flex-col items-center gap-6 text-center sm:gap-8'}>
          <Image
            src={'/landing/yfi-top-right.png'}
            alt={'Yearn Finance Logo'}
            width={180}
            height={180}
            className={'size-auto max-w-[120px] sm:max-w-[150px]'}
            priority
          />
          <div className={'mb-2'}>
            <TvlStat tvl={tvl ?? 0} />
          </div>
          <div className={'flex flex-col gap-8 sm:gap-10'}>
            <SectionHeader
              isH1
              align={'center'}
              title={'Earn on your Crypto'}
              description={"DeFi's most battle tested yield aggregator"}
            />
            <div className={'flex flex-col items-center justify-center'}>
              <Link href={'/vaults'} className={'block w-full max-w-[280px]'}>
                <Button
                  className={
                    '!text-[16px] sm:!text-[18px] w-full !px-6 !py-4 sm:!py-5 !rounded-full !bg-primary min-h-[48px]'
                  }
                  variant={'primary'}
                >
                  {'Explore Vaults'}
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
