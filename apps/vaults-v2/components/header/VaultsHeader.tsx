import { APPS, AppName } from '@lib/components/Apps'
import { MotionDiv } from '@lib/components/MotionDiv'
import type { ReactElement } from 'react'
import type { RouterType } from '/src/types/router'

type TProps = {
  pathname: RouterType['pathname']
}

export function VaultsHeader({ pathname }: TProps): ReactElement {
  const { name, icon } = APPS[AppName.VAULTS]
  const isVaultPage = pathname === '/vaults/[chainID]/[address]'

  return (
    <MotionDiv animate={!isVaultPage && pathname.startsWith('/vaults') ? 'enter' : 'exit'} name={name}>
      {icon}
    </MotionDiv>
  )
}
