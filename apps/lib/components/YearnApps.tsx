import { LogoGimme } from '@lib/icons/LogoGimme'
import { toAddress } from '@lib/utils'
import Image from '/src/components/Image'

import { LogoYearn } from '../icons/LogoYearn'

const YCRV_TOKEN_ADDRESS = toAddress('0xFCc5c47bE19d06BF83eB04298b026F81069ff65b')
const VEYFI_DYFI_ADDRESS = toAddress('0x41252E8691e964f7DE35156B68493bAb6797a275')

export const APPS = {
  V3: {
    name: 'V3 Vaults',
    href: '/v3',
    host: ['yearn.fi'],
    pathname: '/v3',
    icon: <LogoYearn className={'size-8'} gradient={{ start: '#FB245A', end: '#0657F9' }} front={'text-white'} />
  },
  Vaults: {
    name: 'Vaults',
    href: '/vaults',
    host: ['localhost:3000/vaults', 'https://yearn.fi/vaults'],
    pathname: '/vaults',
    icon: <LogoYearn className={'size-8'} back={'text-[#f472b6]'} front={'text-white'} />
  },
  yCRV: {
    name: 'yCRV',
    href: 'https://ycrv.yearn.fi',
    host: ['ycrv.yearn.fi'],
    pathname: 'unused',
    icon: (
      <Image
        alt={'yCRV'}
        className={'size-8! max-h-8! max-w-8!'}
        width={64}
        height={64}
        src={`${import.meta.env.VITE_BASE_YEARN_ASSETS_URI}/token/1/${YCRV_TOKEN_ADDRESS}/logo-128.png`}
        loading={'eager'}
        priority
      />
    )
  },
  veYFI: {
    name: 'veYFI',
    href: 'https://veyfi.yearn.fi',
    host: ['veyfi.yearn.fi'],
    pathname: 'unused',
    icon: (
      <Image
        alt={'veYFI'}
        className={'size-8! max-h-8! max-w-8!'}
        width={64}
        height={64}
        src={`${import.meta.env.VITE_BASE_YEARN_ASSETS_URI}/token/1/${VEYFI_DYFI_ADDRESS}/logo-128.png`}
        loading={'eager'}
        priority
      />
    )
  },
  yFactory: {
    name: 'yFactory',
    href: 'https://factory.yearn.fi',
    host: ['factory.yearn.fi'],
    pathname: 'unused',
    icon: <LogoYearn className={'size-6! max-h-6! max-w-6!'} back={'text-neutral-0'} front={'text-neutral-900'} />
  },
  analytics: {
    name: 'Analytics',
    href: 'https://powerglove.yearn.fi/',
    host: ['powerglove.yearn.fi'],
    pathname: 'unused',
    icon: <LogoYearn className={'size-6! max-h-6! max-w-6!'} back={'text-neutral-100'} front={'text-primary'} />
  },
  yETH: {
    name: 'yETH',
    href: 'https://yeth.yearn.fi',
    host: ['yeth.yearn.fi'],
    pathname: 'unused',
    icon: (
      <Image
        alt={'yETH'}
        className={'size-8! max-h-8! max-w-8!'}
        width={64}
        height={64}
        src={`https://cdn.jsdelivr.net/gh/yearn/tokenassets@main/tokens/1/0x1bed97cbc3c24a4fb5c069c6e311a967386131f7/logo-128.png`}
        loading={'eager'}
        priority
      />
    )
  },
  yPrisma: {
    name: 'yPrisma',
    href: 'https://yprisma.yearn.fi',
    host: ['yprisma.yearn.fi'],
    pathname: 'unused',
    icon: (
      <Image
        priority
        src={`https://cdn.jsdelivr.net/gh/yearn/tokenassets@main/tokens/1/0xe3668873d944e4a949da05fc8bde419eff543882/logo-128.png`}
        className={'size-8! max-h-8! max-w-8!'}
        width={64}
        height={64}
        alt={'yPrisma'}
      />
    )
  },
  Gimme: {
    name: 'GIMME',
    href: 'https://gimme.mom',
    host: ['gimme.mom'],
    pathname: 'unused',
    icon: <LogoGimme className={'size-8'} />
  },
  Vaults_Beta: {
    name: 'Vaults_Beta',
    href: '/vaults-beta',
    host: ['localhost:3000/vaults-beta', 'https://yearn.fi/vaults-beta'],
    pathname: '/vaults-beta',
    icon: <LogoYearn className={'size-8'} back={'text-white'} front={'text-blue-500'} />
  }
}
