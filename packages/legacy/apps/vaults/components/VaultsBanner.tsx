import { SectionHeader } from '@lib/components/SectionHeader'
import { useWeb3 } from '@lib/contexts/useWeb3'
import Image from 'next/image'
import Link from 'next/link'

import type { ReactElement } from 'react'

export function VaultsBanner(): ReactElement | null {
  const { address } = useWeb3()

  if (address) {
    return null
  }

  return (
    <div
      className={
        'relative flex w-full items-stretch overflow-hidden rounded-[16px] bg-gradient-to-b from-blue-800/50 to-blue-900/10 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)]'
      }>
      <div className={'flex flex-1 flex-col justify-center gap-4 p-8'}>
        <SectionHeader tagline={'Growing every day'} title={'Vaults'} align={'left'} />
        <div className={'flex flex-col gap-4'}>
          <p
            className={
              ' max-w-[55ch] border-t border-white/10 pt-4 text-[18px] text-steelGray-500 md:max-w-full '
            }>
            {'Strategies curated to maximize yield across DeFi.'}
          </p>
          <Link href={'/vaults'} className={'text-neutral-900 dark:text-white'}>
            {'Learn More'} {'→'}
          </Link>
        </div>
      </div>
      <div
        className={
          'hidden w-1/2 border-l border-white/10 bg-white/5 md:flex md:shrink-0 md:items-center md:justify-center'
        }>
        <div className={'relative size-48'}>
          <Image
            src={'/landing/safe.png'}
            alt={'Yearn Vaults Safe'}
            fill
            className={'object-contain'}
            priority
          />
        </div>
      </div>
    </div>
  )
}
