import Link from '@components/Link'
import { cl } from '@lib/utils'
import type { ReactElement } from 'react'
import { V3_CARD_BASE } from './v3CardBase'

export function ExploreV2Vaults({ className }: { className?: string }): ReactElement {
  return (
    <Link className={cl(V3_CARD_BASE, className)} href={'/vaults?type=lp'}>
      <img
        alt={'Single asset vaults graphic'}
        className={' max-h-[260px] object-contain m-4'}
        draggable={false}
        src={'/LP-3.svg'}
      />
    </Link>
  )
}

export function ExploreOurVaults({ className }: { className?: string }): ReactElement {
  return (
    <Link className={cl(V3_CARD_BASE, className)} href={'/vaults'}>
      <img
        alt={'Explore Our Vaults graphic'}
        className={'w-full h-full object-cover rounded-lg'}
        draggable={false}
        src={'/explore-our-vaults2.png'}
      />
    </Link>
  )
}
