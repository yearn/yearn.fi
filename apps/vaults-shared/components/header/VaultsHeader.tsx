import { APPS, AppName } from '@lib/components/Apps'
import { MotionDiv } from '@lib/components/MotionDiv'
import type { ReactElement } from 'react'
import type { RouterType } from '/src/types/router'

type TProps = {
  pathname: RouterType['pathname']
}

export function VaultsHeader({ pathname }: TProps): ReactElement {
  const { name, icon } = APPS[AppName.VAULTS]
  const isVaultDetailPage =
    pathname.includes('/[chainID]/[address]') || /^\/(vaults|v2|v3)\/\d+\/0x[a-fA-F0-9]+/.test(pathname)

  const isVaultsRoute = pathname.startsWith('/vaults') || pathname.startsWith('/v2') || pathname.startsWith('/v3')

  return (
    <MotionDiv animate={!isVaultDetailPage && isVaultsRoute ? 'enter' : 'exit'} name={name}>
      {icon}
    </MotionDiv>
  )
}
