import Link from '@components/Link'
import { cl } from '@lib/utils'
import type { ReactElement } from 'react'
import { V3_CARD_BASE } from './v3CardBase'

export function V3SecondaryCard({ className }: { className?: string }): ReactElement {
  return (
    <Link className={cl(V3_CARD_BASE, className)} href={'/vaults'}>
      <img
        alt={'Single asset vaults graphic'}
        className={'h-full w-full max-h-[260px] object-contain'}
        draggable={false}
        src={'/LP-3.svg'}
      />
    </Link>
  )
}
