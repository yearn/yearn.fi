import { FooterNav } from '@lib/components/ModalMobileMenu'
import type { ReactElement } from 'react'

export function Footer(): ReactElement {
  return (
    <div className={'flex w-full max-w-[1180px] flex-col items-center justify-between px-4 pb-16 md:flex-row'}>
      <FooterNav />
    </div>
  )
}
