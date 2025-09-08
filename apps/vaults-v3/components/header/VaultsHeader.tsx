import { APPS, AppName } from '@lib/components/Apps'
import { MotionDiv } from '@lib/components/MotionDiv'

import type { RouterType } from '/src/types/router'
import type { ReactElement } from 'react'

type TProps = {
  pathname: RouterType['pathname']
}

export function VaultsV3Header({ pathname }: TProps): ReactElement {
  const { name, icon } = APPS[AppName.VAULTS]
  const isVaultPage = pathname === '/v3/[chainID]/[address]'

  return (
    <MotionDiv animate={!isVaultPage && pathname.startsWith('/v3') ? 'enter' : 'exit'} name={name}>
      {icon}
    </MotionDiv>
  )
}
