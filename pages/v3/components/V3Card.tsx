import Link from '@components/Link'
import { cl } from '@lib/utils'
import { V3Mask } from '@vaults-v3/Mark'
import type { ReactElement } from 'react'
import { V3_CARD_BASE } from './v3CardBase'

export function V3Card({ className }: { className?: string }): ReactElement {
  return (
    <Link className={cl(V3_CARD_BASE, className)} href={'/v3'}>
      <V3Mask className={'h-auto w-[75%]'} />
    </Link>
  )
}
